import { env } from 'cloudflare:workers';
import { editorUser, sameOrigin } from '../../../lib/auth';
import { scanPdfForActiveContent } from '../../../lib/security';

export const dynamic = 'force-dynamic';

const COVER_PDF_KEY = 'scholarship/cover-letter/current.pdf';
const COVER_META_KEY = 'scholarship/cover-letter/meta.json';
const noStore = { 'Cache-Control': 'no-store' };

type CoverLetterMeta = {
  uploadedAt: string;
  uploadedBy: string;
  filename: string;
  size: number;
};

/**
 * Public GET returns the custom uploaded 2-page cover letter PDF if one exists in R2,
 * or 404 when the built-in static cover-letter.pdf should be used.
 * Pass ?meta=1 (editor only) to inspect upload status.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('meta') === '1') {
    if (!(await editorUser())) {
      return Response.json({ error: 'Sign in required.' }, { status: 401, headers: noStore });
    }
    const metaObj = await env.BUCKET?.get(COVER_META_KEY);
    const meta = metaObj ? await metaObj.json<CoverLetterMeta>() : null;
    return Response.json({ custom: !!meta, meta }, { headers: noStore });
  }

  const file = await env.BUCKET?.get(COVER_PDF_KEY);
  if (!file) {
    return new Response('Using built-in cover letter.', { status: 404, headers: noStore });
  }
  return new Response(file.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cover-letter.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const user = await editorUser();
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401, headers: noStore });
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin.' }, { status: 403, headers: noStore });
  if (!env.BUCKET) return Response.json({ error: 'Storage is unavailable.' }, { status: 503, headers: noStore });

  try {
    const form = await request.formData();
    const pdf = form.get('pdf');
    if (!(pdf instanceof File) || pdf.size < 100 || pdf.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: 'Choose a valid PDF cover letter under 5 MB.' },
        { status: 400, headers: noStore },
      );
    }
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const scan = scanPdfForActiveContent(bytes);
    if (!scan.ok) {
      return Response.json({ error: scan.reason }, { status: 400, headers: noStore });
    }
    const meta: CoverLetterMeta = {
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.displayName || user.email,
      filename: pdf.name.slice(0, 120) || 'cover-letter.pdf',
      size: bytes.length,
    };
    await env.BUCKET.put(COVER_PDF_KEY, bytes, {
      httpMetadata: { contentType: 'application/pdf' },
    });
    await env.BUCKET.put(COVER_META_KEY, JSON.stringify(meta), {
      httpMetadata: { contentType: 'application/json' },
    });
    return Response.json({ custom: true, meta }, { headers: noStore });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not save cover letter PDF.' },
      { status: 400, headers: noStore },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await editorUser();
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401, headers: noStore });
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin.' }, { status: 403, headers: noStore });
  await env.BUCKET?.delete(COVER_PDF_KEY);
  await env.BUCKET?.delete(COVER_META_KEY);
  return Response.json({ custom: false, meta: null }, { headers: noStore });
}
