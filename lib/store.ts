import { env } from 'cloudflare:workers';
import { defaults, currentContent, describeContentChanges, type Content } from './content';

const CONTENT_KEY = 'scholarship/content.json';
const AUDIT_LOG_KEY = 'scholarship/private/audit-log.json';
const HISTORY_PREFIX = 'scholarship/history/';
const RECEIPTS_PREFIX = 'scholarship/private/receipts/';

export type AuditEntry = {
  revision: string;
  previousRevision: string;
  savedAt: string;
  savedBy: string;
  summary: string[];
  year: string;
  deadline: string;
  submissionOpen: boolean;
};

export type ReceiptSummary = {
  reference: string;
  status: 'processing' | 'accepted' | 'review-required';
  created: string;
  confirmationAccepted: boolean;
  hashPrefix: string;
};

export async function readContent(): Promise<Content> {
  if (!env.BUCKET) return defaults;
  const object = await env.BUCKET.get(CONTENT_KEY);
  return object ? currentContent(await object.json<Content>()) : defaults;
}

export async function saveContent(
  content: Content,
  revision: string,
  savedBy = 'Authorized editor',
): Promise<Content | null> {
  if (!env.BUCKET) throw new Error('The website storage is unavailable. No changes were saved.');
  const old = await env.BUCKET.get(CONTENT_KEY);
  const previous = old ? currentContent(await old.json<Content>()) : defaults;
  if (previous.revision !== revision) return null;

  const now = new Date().toISOString();
  const next: Content = { ...content, revision: crypto.randomUUID(), updatedAt: now };
  const summary = describeContentChanges(previous, next);

  await env.BUCKET.put(
    `${HISTORY_PREFIX}${previous.revision}.json`,
    JSON.stringify(previous),
    { httpMetadata: { contentType: 'application/json' } },
  );

  const result = await env.BUCKET.put(CONTENT_KEY, JSON.stringify(next), {
    onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
  });
  if (!result) return null;

  // Record a lightweight, zero-PII audit entry so Mom can see recent saves and undo in one click.
  try {
    const existingLog = await readAuditLog();
    const entry: AuditEntry = {
      revision: next.revision,
      previousRevision: previous.revision,
      savedAt: now,
      savedBy: savedBy.slice(0, 120),
      summary: summary.length ? summary : ['Saved settings snapshot'],
      year: next.year,
      deadline: next.deadline,
      submissionOpen: next.submissionOpen,
    };
    const updatedLog = [entry, ...existingLog].slice(0, 25);
    await env.BUCKET.put(AUDIT_LOG_KEY, JSON.stringify(updatedLog), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch {
    // Audit logging never blocks a successful content save.
  }

  return next;
}

export async function readAuditLog(): Promise<AuditEntry[]> {
  if (!env.BUCKET) return [];
  const obj = await env.BUCKET.get(AUDIT_LOG_KEY);
  if (!obj) return [];
  try {
    const parsed = await obj.json<AuditEntry[]>();
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function readHistorySnapshot(revision: string): Promise<Content | null> {
  if (!env.BUCKET || !/^[0-9a-zA-Z_-]{6,80}$/.test(revision)) return null;
  const obj = await env.BUCKET.get(`${HISTORY_PREFIX}${revision}.json`);
  if (!obj) return null;
  try {
    return currentContent(await obj.json<Content>());
  } catch {
    return null;
  }
}

/**
 * List zero-PII submission receipts stored in R2 for Mom's Delivery Ledger.
 * Receipts contain ONLY reference UUID, SHA-256 hash, timestamp, status, and confirmation boolean.
 */
export async function listSubmissionLedger(limit = 50): Promise<{
  total: number;
  accepted: number;
  reviewRequired: number;
  processing: number;
  lastSubmissionAt: string | null;
  recent: ReceiptSummary[];
}> {
  if (!env.BUCKET) {
    return { total: 0, accepted: 0, reviewRequired: 0, processing: 0, lastSubmissionAt: null, recent: [] };
  }
  const listed = await env.BUCKET.list({ prefix: RECEIPTS_PREFIX, limit: 250 });
  const items: ReceiptSummary[] = [];
  let accepted = 0;
  let reviewRequired = 0;
  let processing = 0;

  for (const obj of listed.objects) {
    const record = await env.BUCKET.get(obj.key);
    if (!record) continue;
    try {
      const parsed = await record.json<{
        hash: string;
        status: 'processing' | 'accepted' | 'review-required';
        created: string;
        confirmationAccepted?: boolean;
      }>();
      const reference = obj.key.slice(RECEIPTS_PREFIX.length);
      if (parsed.status === 'accepted') accepted++;
      else if (parsed.status === 'review-required') reviewRequired++;
      else processing++;
      items.push({
        reference,
        status: parsed.status,
        created: parsed.created,
        confirmationAccepted: !!parsed.confirmationAccepted,
        hashPrefix: (parsed.hash || '').slice(0, 12),
      });
    } catch {
      // Ignore malformed receipt entries.
    }
  }

  items.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  return {
    total: items.length,
    accepted,
    reviewRequired,
    processing,
    lastSubmissionAt: items[0]?.created ?? null,
    recent: items.slice(0, limit),
  };
}

export async function lookupSubmissionReceipt(reference: string): Promise<ReceiptSummary | null> {
  if (!env.BUCKET || !/^[0-9a-f-]{36}$/i.test(reference.trim())) return null;
  const cleanRef = reference.trim().toLowerCase();
  const record = await env.BUCKET.get(`${RECEIPTS_PREFIX}${cleanRef}`);
  if (!record) return null;
  try {
    const parsed = await record.json<{
      hash: string;
      status: 'processing' | 'accepted' | 'review-required';
      created: string;
      confirmationAccepted?: boolean;
    }>();
    return {
      reference: cleanRef,
      status: parsed.status,
      created: parsed.created,
      confirmationAccepted: !!parsed.confirmationAccepted,
      hashPrefix: (parsed.hash || '').slice(0, 12),
    };
  } catch {
    return null;
  }
}
