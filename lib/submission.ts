import { env } from 'cloudflare:workers';
import { deriveHmacKey } from './security';

const encoder = new TextEncoder();

function hex(input: ArrayBuffer): string {
  return [...new Uint8Array(input)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function makeToken(revision: string): Promise<string> {
  const payload = btoa(JSON.stringify({ created: Date.now(), revision, nonce: crypto.randomUUID() }));
  const sig = hex(
    await crypto.subtle.sign('HMAC', await deriveHmacKey('submission-token'), encoder.encode(payload)),
  );
  return `${payload}.${sig}`;
}

export async function verifyAndExtractToken(
  token: string,
  revision: string,
): Promise<{ valid: true; nonce: string } | { valid: false }> {
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[1])) return { valid: false };
  const signature = Uint8Array.from(parts[1].match(/../g)!, (x) => parseInt(x, 16));
  const ok = await crypto.subtle.verify(
    'HMAC',
    await deriveHmacKey('submission-token'),
    signature,
    encoder.encode(parts[0]),
  );
  if (!ok) return { valid: false };
  try {
    const data = JSON.parse(atob(parts[0])) as {
      revision?: string;
      created?: number;
      nonce?: string;
    };
    const age = Date.now() - Number(data.created);
    if (
      data.revision !== revision ||
      typeof data.created !== 'number' ||
      typeof data.nonce !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(data.nonce) ||
      age < 1500 ||
      age >= 12 * 60 * 60 * 1000
    ) {
      return { valid: false };
    }
    return { valid: true, nonce: data.nonce };
  } catch {
    return { valid: false };
  }
}

export async function verifyToken(token: string, revision: string): Promise<boolean> {
  const result = await verifyAndExtractToken(token, revision);
  return result.valid;
}

/**
 * Consume a submission token nonce exactly once in R2 to prevent replay attacks
 * using an intercepted or reused submission session token.
 */
export async function consumeTokenNonce(nonce: string): Promise<boolean> {
  if (!env.BUCKET || !/^[0-9a-f-]{36}$/i.test(nonce)) return false;
  const day = new Date().toISOString().slice(0, 10);
  const path = `scholarship/private/used-nonces/${day}/${nonce}`;
  const put = await env.BUCKET.put(path, JSON.stringify({ usedAt: new Date().toISOString() }), {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
  });
  return !!put;
}

export async function hash(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
}

async function incrementCounter(path: string, maxPerDay: number): Promise<boolean> {
  if (!env.BUCKET) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const old = await env.BUCKET.get(path);
    const data = old ? await old.json<{ count: number }>() : { count: 0 };
    if (data.count >= maxPerDay) return false;
    const put = await env.BUCKET.put(path, JSON.stringify({ count: data.count + 1 }), {
      onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    if (put) return true;
  }
  return false;
}

/**
 * Three-layer anti-abuse rate limiting (all privacy-preserving via keyed HMAC):
 * 1. Per-IP daily limit (max 25/day — generous enough for caddies/staff sharing Club Wi-Fi on deadline day)
 * 2. Per-applicant-email daily limit (max 3/day) to block email-bombing third-party addresses
 * 3. Global daily circuit breaker (max 80/day) to protect the Club's M365 mailbox quota
 */
export async function allowSubmission(ip: string, applicantEmail?: string): Promise<{
  allowed: boolean;
  reason?: 'ip-limit' | 'recipient-limit' | 'global-limit';
}> {
  if (!env.BUCKET) return { allowed: false, reason: 'global-limit' };
  const day = new Date().toISOString().slice(0, 10);

  const ipDigest = hex(
    await crypto.subtle.sign('HMAC', await deriveHmacKey('rate-limit'), encoder.encode(ip)),
  );
  if (!(await incrementCounter(`scholarship/private/rate/${day}/${ipDigest}`, 25))) {
    return { allowed: false, reason: 'ip-limit' };
  }

  if (applicantEmail) {
    const emailDigest = hex(
      await crypto.subtle.sign(
        'HMAC',
        await deriveHmacKey('recipient-limit'),
        encoder.encode(applicantEmail.trim().toLowerCase()),
      ),
    );
    if (!(await incrementCounter(`scholarship/private/recipient-rate/${day}/${emailDigest}`, 3))) {
      return { allowed: false, reason: 'recipient-limit' };
    }
  }

  if (!(await incrementCounter(`scholarship/private/global-rate/${day}`, 80))) {
    return { allowed: false, reason: 'global-limit' };
  }

  return { allowed: true };
}

export async function boundedForm(request: Request, limit = 27 * 1024 * 1024) {
  if (Number(request.headers.get('content-length') || 0) > limit || !request.body) {
    throw new Error('The application is too large. Keep the completed PDF below 20 MB.');
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('The application is too large. Keep the completed PDF below 20 MB.');
    }
    chunks.push(result.value);
  }
  return new Response(new Blob(chunks.map((x) => new Uint8Array(x))), {
    headers: { 'Content-Type': request.headers.get('content-type') || '' },
  }).formData();
}
