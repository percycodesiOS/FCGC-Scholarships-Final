import { env } from 'cloudflare:workers';
import { editorUser, sameOrigin } from '../../../lib/auth';
import {
  connectionKey,
  mailStatus,
  saveMailSetup,
  startMicrosoft,
  verifyMailConnectionHealth,
} from '../../../lib/mail';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  if (!(await editorUser())) {
    return Response.json({ error: 'Sign in with an authorized editor account.' }, { status: 403, headers });
  }
  try {
    return Response.json(await mailStatus(), { headers });
  } catch {
    return Response.json(
      { configured: false, connected: false, secureStorage: false, account: null, fromEmail: null },
      { headers },
    );
  }
}

export async function POST(request: Request) {
  const user = await editorUser();
  if (!user || !sameOrigin(request)) {
    return Response.json({ error: 'Open Manage scholarship and sign in.' }, { status: 403, headers });
  }
  try {
    if (Number(request.headers.get('content-length') || 0) > 4000) {
      throw new Error('The setup request is too large.');
    }
    const raw = await request.text();
    if (raw.length > 4000) throw new Error('The setup request is too large.');
    const data = JSON.parse(raw);

    if (data.action === 'setup') {
      await saveMailSetup(data);
      return Response.json({ saved: true }, { headers });
    }
    if (data.action === 'disconnect') {
      await env.BUCKET?.delete(connectionKey);
      return Response.json({ disconnected: true }, { headers });
    }
    if (data.action === 'health') {
      const health = await verifyMailConnectionHealth();
      return Response.json(health, { headers });
    }
    if (data.action === 'connect') {
      const url = new URL(request.url);
      const result = await startMicrosoft(url.origin, user.userId);
      const isHttps = url.protocol === 'https:';
      const cookieName = isHttps ? '__Secure-fcgc-mail-state' : 'fcgc-mail-state';
      const secureFlag = isHttps ? '; Secure' : '';
      return Response.json(
        { url: result.url },
        {
          headers: {
            ...headers,
            'Set-Cookie': `${cookieName}=${result.state}; HttpOnly${secureFlag}; SameSite=Lax; Path=/api/mail/microsoft/callback; Max-Age=600`,
          },
        },
      );
    }
    throw new Error('Choose a supported action.');
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Email setup did not complete.' },
      { status: 400, headers },
    );
  }
}
