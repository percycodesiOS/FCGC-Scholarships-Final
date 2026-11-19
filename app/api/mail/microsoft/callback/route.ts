import { editorUser } from '../../../../../lib/auth';
import { completeMicrosoft } from '../../../../../lib/mail';
import { timingSafeEqualString } from '../../../../../lib/security';

export const dynamic = 'force-dynamic';

const SAFE_OAUTH_REASONS: Record<string, string> = {
  access_denied: 'access-denied',
  consent_required: 'consent-required',
  interaction_required: 'interaction-required',
  invalid_client: 'invalid-client',
};

function readCookie(cookieHeader: string, name: string): string {
  const prefix = `${name}=`;
  const found = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await editorUser();
  const state = url.searchParams.get('state') || '';
  const isHttps = url.protocol === 'https:';
  const cookieName = isHttps ? '__Secure-fcgc-mail-state' : 'fcgc-mail-state';
  const cookieHeader = request.headers.get('cookie') || '';
  const cookie = readCookie(cookieHeader, cookieName) || readCookie(cookieHeader, 'fcgc-mail-state');

  let status = 'connected';
  try {
    const providerError = url.searchParams.get('error');
    if (providerError) {
      status = SAFE_OAUTH_REASONS[providerError] || 'connection-failed';
    } else if (!user || !state || !cookie || !timingSafeEqualString(cookie, state)) {
      status = 'expired-state';
    } else {
      await completeMicrosoft(url.searchParams.get('code') || '', state, user.userId, url.origin);
    }
  } catch {
    status = 'connection-failed';
  }

  const secureFlag = isHttps ? '; Secure' : '';
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/manage?mail=' + encodeURIComponent(status),
      'Cache-Control': 'no-store',
      'Set-Cookie': `${cookieName}=; HttpOnly${secureFlag}; SameSite=Lax; Path=/api/mail/microsoft/callback; Max-Age=0`,
    },
  });
}
