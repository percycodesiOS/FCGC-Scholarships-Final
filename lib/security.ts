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

export async function deriveHmacKey(purpose: 'submission-token' | 'rate-limit' | 'recipient-limit'): Promise<CryptoKey> {
  const baseKey = await importHkdfBaseKey();
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: encoder.encode(`fcgc:${purpose}:v2`) },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
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
    [/\/OpenAction\b/i, 'automatic open action'],
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
 * Blocks cross-site XSSI/CSRF requests while permitting the Microsoft Entra
 * OAuth top-level GET navigation callback.
 */
export function checkFetchMetadata(request: Request): Response | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;

  const site = request.headers.get('sec-fetch-site');
  const mode = request.headers.get('sec-fetch-mode');
  const dest = request.headers.get('sec-fetch-dest');

  if (!site) return null; // Non-browser / legacy client fallback
  if (site === 'same-origin' || site === 'none') return null;

  // Permit Microsoft Entra OAuth redirect callback (top-level GET navigation).
  if (
    url.pathname === '/api/mail/microsoft/callback' &&
    request.method === 'GET' &&
    mode === 'navigate' &&
    dest === 'document'
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

/**
 * Attach defense-in-depth HTTP security headers across HTML, static assets, and APIs.
 * Allows same-origin blob: frames on /apply/* so the in-page PDF review modal works cleanly,
 * while preventing external clickjacking (frame-ancestors 'none' + X-Frame-Options: DENY).
 */
export function applySecurityHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
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
          "frame-ancestors 'none'",
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
          "frame-ancestors 'none'",
        ].join('; ');
    headers.set('Content-Security-Policy', csp);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
