import { headers } from 'next/headers';
import { getChatGPTUser, chatGPTSignInPath } from '../chatgpt-auth';
import { editorUser } from '../../lib/auth';
import { mailStatus } from '../../lib/mail';
import { readContent } from '../../lib/store';
import Manager from './Manager';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ auth?: string }>;
}) {
  const user = await editorUser();
  if (!user) {
    const reqHeaders = await headers();
    const host = (reqHeaders.get('host') || '').toLowerCase();
    const isChatGptHost = host.endsWith('.chatgpt.site');
    const signedChatGpt = isChatGptHost ? await getChatGPTUser() : null;
    let microsoftReady = false;
    try {
      microsoftReady = (await mailStatus()).configured;
    } catch {
      microsoftReady = false;
    }
    const params = searchParams ? await searchParams : {};
    const authNote =
      params.auth === 'unauthorized'
        ? 'That Office 365 account is not on the authorized Foundation editor list. Sign in with an authorized Club email.'
        : params.auth === 'not-configured'
          ? 'Office 365 sign-in is not configured yet. Verify the Microsoft Entra Worker variables and secrets in Cloudflare.'
          : params.auth
            ? 'Office 365 sign-in did not finish. Please try again.'
            : null;

    return (
      <main className="auth-card">
        <a className="text-link" href="/">
          ← Scholarship website
        </a>
        <img src="/fcgc-crest.gif" alt="Fox Chapel Golf Club crest" />
        <p className="eyebrow">SCHOLARSHIP FOUNDATION CONTROL CENTER</p>
        <h1>Administrator sign-in</h1>
        <p>
          {authNote ||
            (signedChatGpt
              ? 'This account does not have administrative access. Sign in with an authorized Foundation account.'
              : 'Sign in with an authorized Fox Chapel Golf Club Office 365 account to manage the scholarship website.')}
        </p>
        <div className="v2-button-row" style={{ justifyContent: 'center', marginTop: '14px' }}>
          {microsoftReady ? (
            <a className="button" href="/api/auth/microsoft" target="_top">
              Sign in with Office 365 Account ↗
            </a>
          ) : (
            !isChatGptHost && (
              <p className="small">
                Office 365 sign-in requires the Cloudflare Worker Microsoft Entra settings (`MS_CLIENT_ID`, `MS_TENANT_ID`, and `MS_CLIENT_SECRET`).
              </p>
            )
          )}
          {isChatGptHost && (
            <a
              className={microsoftReady ? 'button secondary' : 'button'}
              href={
                signedChatGpt
                  ? '/signout-with-chatgpt?return_to=/manage'
                  : chatGPTSignInPath('/manage')
              }
              target="_top"
            >
              {signedChatGpt ? 'Switch ChatGPT account' : 'Sign in with ChatGPT'} ↗
            </a>
          )}
        </div>
      </main>
    );
  }
  return <Manager initial={await readContent()} name={user.displayName} provider={user.provider} />;
}
