import { editorUser, sameOrigin } from '../../../lib/auth';
import { readAuditLog, readContent, readHistorySnapshot, saveContent } from '../../../lib/store';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  if (!(await editorUser())) {
    return Response.json({ error: 'Sign in with an authorized editor account.' }, { status: 403, headers });
  }
  const entries = await readAuditLog();
  return Response.json({ entries }, { headers });
}

/**
 * Load a historical snapshot as a draft (action: 'preview') or restore it directly (action: 'restore').
 */
export async function POST(request: Request) {
  const user = await editorUser();
  if (!user || !sameOrigin(request)) {
    return Response.json({ error: 'Open Manage scholarship and sign in.' }, { status: 403, headers });
  }
  try {
    const raw = await request.text();
    if (raw.length > 2000) throw new Error('Request is too large.');
    const body = JSON.parse(raw) as { revision?: string; action?: string };
    if (!body.revision) throw new Error('Choose a saved version to restore.');

    const snapshot = await readHistorySnapshot(body.revision);
    if (!snapshot) {
      return Response.json(
        { error: 'That older version is no longer available in storage.' },
        { status: 404, headers },
      );
    }

    if (body.action === 'restore') {
      const current = await readContent();
      const restored = await saveContent(
        snapshot,
        current.revision,
        `${user.displayName || user.email} (restored previous version)`,
      );
      if (!restored) {
        return Response.json(
          { error: 'Someone saved another update just now. Refresh and try again.' },
          { status: 409, headers },
        );
      }
      return Response.json({ content: restored }, { headers });
    }

    return Response.json({ snapshot }, { headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Could not open that saved version.' },
      { status: 400, headers },
    );
  }
}
