import { readContent, saveContent } from '../../../lib/store';
import { publicContentView, validate } from '../../../lib/content';
import { editorUser, sameOrigin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  const content = await readContent();
  const editor = await editorUser();
  return Response.json(editor ? content : publicContentView(content), { headers });
}

export async function PUT(request: Request) {
  const user = await editorUser();
  if (!user) {
    return Response.json(
      { error: 'Please sign in with an authorized editor account.' },
      { status: 403, headers },
    );
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: 'Open the editor directly on this website.' }, { status: 403, headers });
  }
  if (Number(request.headers.get('content-length') || 0) > 45000) {
    return Response.json({ error: 'Content is too large.' }, { status: 413, headers });
  }
  try {
    const raw = await request.text();
    if (raw.length > 45000) {
      return Response.json({ error: 'Content is too large.' }, { status: 413, headers });
    }
    const parsed = JSON.parse(raw);
    const clean = validate(parsed);
    const saved = await saveContent(clean, parsed.revision, user.displayName || user.email);
    if (!saved) {
      return Response.json(
        {
          error:
            'Someone saved a newer version while this page was open. Download your draft, reload, and review the latest version before saving.',
        },
        { status: 409, headers },
      );
    }
    return Response.json(saved, { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'The save did not complete.' },
      { status: 400, headers },
    );
  }
}
