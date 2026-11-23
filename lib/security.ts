import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();

export function base64Encode(bytes: Uint8Array): string {
  let value = '';
  for (let i = 0; i < bytes.length; i += 16384) {
    value += String.fromCharCode(...bytes.subarray(i, i + 16384));
  }
  return btoa(value);
}

export function base64Decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function getMasterSecretBytes(): Uint8Array {
  const raw = env.MAIL_ENCRYPTION_KEY;
  if (!raw) throw new Error('Secure storage key is not configured.');
  try {
    const decoded = base64Decode(raw);
    if (decoded.length === 32) return decoded;
  } catch {
    // Fallback to UTF-8 encoding if a dev environment uses a passphrase string.
  }
  return encoder.encode(raw);
}

/**
 * Derive a domain-separated key via HKDF-SHA256 from the master secret.
 * Separating AES-GCM mail storage keys from public submission HMAC keys and
 * rate-limit hashing keys prevents cross-protocol key reuse.
 */
async function importHkdfBaseKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', getMasterSecretBytes(), 'HKDF', false, ['deriveKey']);
}

const HKDF_SALT = encoder.encode('fcgc-scholarships-v2-salt');

export async function deriveAesGcmKey(purpose: 'mail-storage' | 'oauth-state'): Promise<CryptoKey> {
  const baseKey = await importHkdfBaseKey();
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: encoder.encode(`fcgc:${purpose}:v2`) },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function legacyV1AesGcmKey(): Promise<CryptoKey> {
  if (!env.MAIL_ENCRYPTION_KEY) throw new Error('Secure email storage is not configured.');
  return crypto.subtle.importKey('raw', base64Decode(env.MAIL_ENCRYPTION_KEY), { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function deriveHmacKey(
  purpose: 'submission-token' | 'rate-limit' | 'recipient-limit' | 'admin-session',
): Promise<CryptoKey> {
  const baseKey = await importHkdfBaseKey();
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: encoder.encode(`fcgc:${purpose}:v2`) },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
}

export type AdminSessionPayload = {
  email: string;
  displayName: string;
  provider: 'microsoft';
  exp: number;
};

function hexEncode(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function signAdminSession(email: string, displayName: string, ttlMs = 12 * 60 * 60 * 1000): Promise<string> {
  const payload: AdminSessionPayload = {
    email: email.trim().toLowerCase(),
    displayName: displayName.trim() || email.trim(),
    provider: 'microsoft',
    exp: Date.now() + ttlMs,
  };
  const encoded = base64Encode(encoder.encode(JSON.stringify(payload)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const sig = hexEncode(
    await crypto.subtle.sign('HMAC', await deriveHmacKey('admin-session'), encoder.encode(encoded)),
  );
  return `${encoded}.${sig}`;
}

export async function verifyAdminSession(token: string | null | undefined): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[1])) return null;
  const signature = Uint8Array.from(parts[1].match(/../g)!, (x) => parseInt(x, 16));
  const ok = await crypto.subtle.verify(
    'HMAC',
    await deriveHmacKey('admin-session'),
    signature,
    encoder.encode(parts[0]),
  );
  if (!ok) return null;
  try {
    const padded = parts[0].replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (parts[0].length % 4)) % 4);
    const parsed = JSON.parse(new TextDecoder().decode(base64Decode(padded))) as Partial<AdminSessionPayload>;
    if (
      typeof parsed.email !== 'string' ||
      !parsed.email ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return {
      email: parsed.email.trim().toLowerCase(),
      displayName: typeof parsed.displayName === 'string' && parsed.displayName ? parsed.displayName : parsed.email,
      provider: 'microsoft',
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Validate uploaded applicant photo magic bytes (JPEG or PNG) server-side.
 */
export function validatePhotoBytes(
  bytes: Uint8Array,
  mimeType: string,
): { ok: true; ext: 'jpg' | 'png'; contentType: 'image/jpeg' | 'image/png' } | { ok: false; reason: string } {
  if (bytes.length < 100 || bytes.length > 5 * 1024 * 1024) {
    return { ok: false, reason: 'Keep the uploaded applicant photo under 5 MB.' };
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isJpeg && (!mimeType || mimeType === 'image/jpeg' || mimeType === 'image/jpg')) {
    return { ok: true, ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (isPng && (!mimeType || mimeType === 'image/png')) {
    return { ok: true, ext: 'png', contentType: 'image/png' };
  }
  return { ok: false, reason: 'Upload a valid JPG or PNG applicant photo.' };
}

/**
 * Constant-time string comparison to avoid timing side-channels when validating
 * OAuth state cookies or tokens.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const maxLen = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Scan uploaded PDF bytes for active/executable PDF actions that do not belong
 * in a flat scholarship application packet. Protects the Foundation's Acrobat inbox.
 */
export function scanPdfForActiveContent(bytes: Uint8Array): { ok: true } | { ok: false; reason: string } {
  if (bytes.length < 100) {
    return { ok: false, reason: 'The PDF file appears empty or incomplete.' };
  }
  const header = new TextDecoder('latin1').decode(bytes.slice(0, 8));
  if (!header.startsWith('%PDF-')) {
    return { ok: false, reason: 'The attachment is not a valid PDF.' };
  }
  const tail = new TextDecoder('latin1').decode(bytes.slice(Math.max(0, bytes.length - 1024)));
  if (!tail.includes('%%EOF')) {
    return { ok: false, reason: 'The PDF file appears truncated or corrupted.' };
  }
  const text = new TextDecoder('latin1').decode(bytes);
  const forbiddenOperators: Array<[RegExp, string]> = [
    [/\/JavaScript\b/i, 'embedded JavaScript'],
    [/\/JS\s*(?:\(|<|\d+\s+\d+\s+R)/i, 'embedded JavaScript action'],
    [/\/Launch\b/i, 'external launch action'],
    // Allow benign PDF viewer destination arrays like `/OpenAction [0 /XYZ ...]` used by FAFSA/college PDFs,
    // while strictly blocking dictionary/indirect action dictionaries (`/OpenAction << ... >>` or `/OpenAction 5 0 R`).
    [/\/OpenAction\s*(?:<<|\d+\s+\d+\s+R)/i, 'automatic executable open action'],
    [/\/AA\s*<</i, 'additional trigger action'],
    [/\/RichMedia\b/i, 'embedded rich media'],
    [/\/SubmitForm\b/i, 'remote form submission action'],
  ];
  for (const [pattern, label] of forbiddenOperators) {
    if (pattern.test(text)) {
      return {
        ok: false,
        reason: `The uploaded PDF contains ${label}, which is not permitted for security reasons. Print or export a clean flat PDF copy and upload that instead.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Parse a YYYY-MM-DDTHH:MM wall-clock timestamp in America/New_York and convert
 * to an authoritative UTC epoch millisecond value, accounting for EST/EDT.
 */
export function easternWallTimeToUtcMs(wallIso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wallIso.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;

  // Iterative two-pass offset resolution handles DST transitions accurately.
  const wallUtcGuess = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  function offsetAt(utcMs: number): number {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const renderedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return renderedAsUtc - utcMs;
  }

  const firstPass = wallUtcGuess - offsetAt(wallUtcGuess);
  const secondPass = wallUtcGuess - offsetAt(firstPass);
  return secondPass;
}

export function isDeadlinePassed(
  deadlineIso: string | null | undefined,
  autoCloseAtDeadline: boolean | undefined,
  nowMs = Date.now(),
): boolean {
  if (!autoCloseAtDeadline || !deadlineIso) return false;
  const cutoffMs = easternWallTimeToUtcMs(deadlineIso);
  if (cutoffMs === null) return false;
  return nowMs >= cutoffMs;
}

export function formatEasternDeadline(wallIso: string): string | null {
  const utcMs = easternWallTimeToUtcMs(wallIso);
  if (utcMs === null) return null;
  const date = new Date(utcMs);
  const dayPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(date);
  const hour = timeParts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = timeParts.find((p) => p.type === 'minute')?.value ?? '00';
  const dayPeriod = (timeParts.find((p) => p.type === 'dayPeriod')?.value ?? '').toLowerCase() === 'pm' ? 'p.m.' : 'a.m.';
  const tz = timeParts.find((p) => p.type === 'timeZoneName')?.value ?? 'ET';
  return `${dayPart} · ${hour}:${minute} ${dayPeriod} ${tz}`;
}

/**
 * Fetch Metadata resource isolation (runs before auth/handlers on /api/*).
 * Blocks cross-site XSSI/CSRF requests while permitting:
 * 1. Top-level GET OAuth navigations (/api/auth/microsoft and /api/mail/microsoft/callback)
 * 2. Embedded student-facing requests from inside the official foxchapelgolfclub.org iframe
 *    (where browsers label same-origin iframe fetches as Sec-Fetch-Site: cross-site).
 */
export function checkFetchMetadata(request: Request): Response | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;

  const site = request.headers.get('sec-fetch-site');
  const mode = request.headers.get('sec-fetch-mode');
  const dest = request.headers.get('sec-fetch-dest');
  const origin = request.headers.get('origin');

  if (!site) return null; // Non-browser / legacy client fallback
  if (site === 'same-origin' || site === 'none') return null;

  // Permit Microsoft Entra OAuth start & redirect callback (top-level GET navigation).
  if (
    (url.pathname === '/api/mail/microsoft/callback' || url.pathname === '/api/auth/microsoft') &&
    request.method === 'GET' &&
    mode === 'navigate' &&
    dest === 'document'
  ) {
    return null;
  }

  // Permit public student read endpoints inside the embedded foxchapelgolfclub.org iframe.
  const isPublicStudentRead =
    request.method === 'GET' &&
    (url.pathname === '/api/application' ||
      url.pathname === '/api/content' ||
      url.pathname === '/api/cover-letter');
  if (isPublicStudentRead && (!origin || origin === url.origin)) {
    return null;
  }

  // Permit student application submission from inside an authorized same-origin iframe
  // (handler also enforces strict Origin === url.origin, HMAC token, and single-use nonce).
  if (
    url.pathname === '/api/applications' &&
    request.method === 'POST' &&
    origin === url.origin
  ) {
    return null;
  }

  return new Response(JSON.stringify({ error: 'Cross-site API request rejected.' }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site',
    },
  });
}

const ALLOWED_EMBED_ANCESTORS = "'self' https://foxchapelgolfclub.org https://www.foxchapelgolfclub.org";

/**
 * Attach defense-in-depth HTTP security headers across HTML, static assets, and APIs.
 * - Public pages (/ and /apply/*) allow framing EXCLUSIVELY by foxchapelgolfclub.org
 *   so the Club website embed works cleanly while blocking every other site on the web.
 * - Admin and API routes (/manage, /handoff, /api/*) remain strictly frame-ancestors 'none' + X-Frame-Options: DENY.
 */
export function applySecurityHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);

  const isAdminOrApi =
    url.pathname.startsWith('/manage') ||
    url.pathname.startsWith('/handoff') ||
    url.pathname.startsWith('/api/');

  headers.set('X-Content-Type-Options', 'nosniff');
  if (isAdminOrApi) {
    headers.set('X-Frame-Options', 'DENY');
  } else {
    headers.delete('X-Frame-Options');
  }
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  headers.set('Cross-Origin-Resource-Policy', isAdminOrApi ? 'same-origin' : 'cross-origin');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );

  if (url.protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/apply')) {
    headers.set('Referrer-Policy', 'no-referrer');
  } else {
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  if (url.pathname.startsWith('/api/')) {
    headers.append('Vary', 'Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site');
  }

  const contentType = headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const isApply = url.pathname.startsWith('/apply');
    const frameAncestors = isAdminOrApi ? "frame-ancestors 'none'" : `frame-ancestors ${ALLOWED_EMBED_ANCESTORS}`;
    const csp = isApply
      ? [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self'",
          "img-src 'self' data: blob:",
          "frame-src 'self' blob:",
          "connect-src 'self' blob:",
          "font-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
          frameAncestors,
        ].join('; ')
      : [
          "default-src 'self'",
          // Next.js / Vinext hydration uses inline bootstrap scripts; enforce strict object/base/frame lockdown
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob:",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
          frameAncestors,
        ].join('; ');
    headers.set('Content-Security-Policy', csp);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
