import { startMicrosoftAdminLogin } from '../../../../lib/mail';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isHttps = url.protocol === 'https:';
  const cookieName = isHttps ? '__Secure-fcgc-mail-state' : 'fcgc-mail-state';
  const secureFlag = isHttps ? '; Secure' : '';

  try {
    const { url: authorizeUrl, state } = await startMicrosoftAdminLogin(url.origin);
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizeUrl,
        'Cache-Control': 'no-store',
        'Set-Cookie': `${cookieName}=${state}; HttpOnly${secureFlag}; SameSite=Lax; Path=/api/mail/microsoft/callback; Max-Age=600`,
      },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/manage?auth=not-configured',
        'Cache-Control': 'no-store',
      },
    });
  }
}
