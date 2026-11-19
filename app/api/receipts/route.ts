import { editorUser } from '../../../lib/auth';
import { listSubmissionLedger, lookupSubmissionReceipt } from '../../../lib/store';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

/**
 * Zero-PII submission health ledger and Reference ID verifier for authorized editors.
 * Contains ONLY reference UUIDs, timestamps, SHA-256 prefixes, and delivery status.
 */
export async function GET(request: Request) {
  if (!(await editorUser())) {
    return Response.json({ error: 'Sign in with an authorized editor account.' }, { status: 403, headers });
  }
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');
  if (ref) {
    const found = await lookupSubmissionReceipt(ref);
    return Response.json({ found: !!found, receipt: found }, { headers });
  }
  const ledger = await listSubmissionLedger(50);
  return Response.json(ledger, { headers });
}
