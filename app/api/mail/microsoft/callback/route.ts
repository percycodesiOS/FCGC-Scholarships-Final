import {
  ADMIN_COOKIE_DEV,
  ADMIN_COOKIE_SECURE,
  editorUser,
  isAuthorizedEditorEmail,
} from '../../../../../lib/auth';
import {
  completeMicrosoft,
  completeMicrosoftAdminLogin,
  peekMicrosoftOAuthPurpose,
} from '../../../../../lib/mail';
import { signAdminSession, timingSafeEqualString } from '../../../../../lib/security';

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
  const state = url.searchParams.get('state') || '';
  const isHttps = url.protocol === 'https:';
  const stateCookieName = isHttps ? '__Secure-fcgc-mail-state' : 'fcgc-mail-state';
  const secureFlag = isHttps ? '; Secure' : '';
  const cookieHeader = request.headers.get('cookie') || '';
  const cookie =
    readCookie(cookieHeader, stateCookieName) || readCookie(cookieHeader, 'fcgc-mail-state');

  const clearStateCookie = `${stateCookieName}=; HttpOnly${secureFlag}; SameSite=Lax; Path=/api/mail/microsoft/callback; Max-Age=0`;
  const purpose = state ? await peekMicrosoftOAuthPurpose(state) : null;

  // Handle Club Microsoft 365 Admin Sign-In for /manage (zero ChatGPT dependency)
  if (purpose === 'admin-login') {
    const providerError = url.searchParams.get('error');
    if (providerError || !state || !cookie || !timingSafeEqualString(cookie, state)) {
      const reason = providerError ? SAFE_OAUTH_REASONS[providerError] || 'auth-failed' : 'expired-state';
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/manage?auth=' + encodeURIComponent(reason),
          'Cache-Control': 'no-store',
          'Set-Cookie': clearStateCookie,
        },
      });
    }
    try {
      const profile = await completeMicrosoftAdminLogin(
        url.searchParams.get('code') || '',
        state,
        url.origin,
      );
      if (!isAuthorizedEditorEmail(profile.email)) {
        return new Response(null, {
          status: 303,
          headers: {
            Location: '/manage?auth=unauthorized',
            'Cache-Control': 'no-store',
            'Set-Cookie': clearStateCookie,
          },
        });
      }
      const sessionToken = await signAdminSession(profile.email, profile.displayName);
      const adminCookieName = isHttps ? ADMIN_COOKIE_SECURE : ADMIN_COOKIE_DEV;
      const headers = new Headers({
        Location: '/manage',
        'Cache-Control': 'no-store',
      });
      headers.append('Set-Cookie', clearStateCookie);
      headers.append(
        'Set-Cookie',
        `${adminCookieName}=${sessionToken}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=43200`,
      );
      return new Response(null, { status: 303, headers });
    } catch {
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/manage?auth=auth-failed',
          'Cache-Control': 'no-store',
          'Set-Cookie': clearStateCookie,
        },
      });
    }
  }

  // Handle Outlook mailbox delivery connection (requires signed-in editor)
  const user = await editorUser();
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

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/manage?mail=' + encodeURIComponent(status),
      'Cache-Control': 'no-store',
      'Set-Cookie': clearStateCookie,
    },
  });
}
