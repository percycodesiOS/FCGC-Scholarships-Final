import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { verifyAdminSession } from './security';

const BASE_EDITORS = [
  'jmacek@foxchapelgolfclub.com',
  'jmacek3@gmail.com',
  'kmacek715@gmail.com',
];

export const ADMIN_COOKIE_SECURE = '__Secure-fcgc-admin';
export const ADMIN_COOKIE_DEV = 'fcgc-admin';

export function authorizedEditors(): Set<string> {
  const extra = String((env as unknown as Record<string, unknown>).ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...BASE_EDITORS, ...extra]);
}

export function isAuthorizedEditorEmail(email: string): boolean {
  return authorizedEditors().has(email.trim().toLowerCase());
}

export type EditorSession = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: 'microsoft' | 'chatgpt';
};

/**
 * Resolve the signed-in Foundation editor.
 * Checks Club Microsoft 365 signed HttpOnly session cookie FIRST (zero ChatGPT dependency),
 * then falls back to ChatGPT Sites identity during transition.
 */
export async function editorUser(): Promise<EditorSession | null> {
  try {
    const cookieStore = await cookies();
    const rawToken =
      cookieStore.get(ADMIN_COOKIE_SECURE)?.value || cookieStore.get(ADMIN_COOKIE_DEV)?.value;
    if (rawToken) {
      const session = await verifyAdminSession(rawToken);
      if (session && isAuthorizedEditorEmail(session.email)) {
        return {
          userId: `ms:${session.email}`,
          displayName: session.displayName,
          email: session.email,
          fullName: session.displayName,
          provider: 'microsoft',
        };
      }
    }
  } catch {
    // Fallback cleanly if cookies() is unavailable outside request context.
  }

  const user = await getChatGPTUser();
  if (!user) return null;
  if (isAuthorizedEditorEmail(user.email)) {
    return { ...user, provider: 'chatgpt' };
  }
  if (import.meta.env.DEV && user.userId === 'local_seedy') {
    return { ...user, provider: 'chatgpt' };
  }
  return null;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}
