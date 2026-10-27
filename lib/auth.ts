import { getChatGPTUser } from '../app/chatgpt-auth';
const editors = new Set(['jmacek3@gmail.com','kmacek715@gmail.com']);
export async function editorUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (editors.has(user.email.trim().toLowerCase())) return user;
  if (import.meta.env.DEV && user.userId === 'local_seedy') return user;
  return null;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}
