import { ADMIN_COOKIE_DEV, ADMIN_COOKIE_SECURE } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isHttps = url.protocol === 'https:';
  const headers = new Headers({
    Location: '/manage',
    'Cache-Control': 'no-store',
  });
  headers.append(
    'Set-Cookie',
    `${ADMIN_COOKIE_DEV}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
  if (isHttps) {
    headers.append(
      'Set-Cookie',
      `${ADMIN_COOKIE_SECURE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    );
  }
  return new Response(null, { status: 302, headers });
}
