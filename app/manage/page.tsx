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
    const signedChatGpt = await getChatGPTUser();
    let microsoftReady = false;
    try {
      microsoftReady = (await mailStatus()).configured;
    } catch {
      microsoftReady = false;
    }
    const params = searchParams ? await searchParams : {};
    const authNote =
      params.auth === 'unauthorized'
        ? 'That Microsoft account is not on the authorized Foundation editor list. Sign in with an authorized Club email.'
        : params.auth === 'not-configured'
          ? 'Club Microsoft 365 sign-in becomes active as soon as the one-time Microsoft Entra app setup is saved.'
          : params.auth
            ? 'Microsoft sign-in did not finish. Please try again.'
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
              : 'Sign in with an authorized Fox Chapel Golf Club Microsoft 365 account to manage the scholarship website.')}
        </p>
        <div className="v2-button-row" style={{ justifyContent: 'center', marginTop: '14px' }}>
          {microsoftReady && (
            <a className="button" href="/api/auth/microsoft" target="_top">
              Sign in with Club Microsoft 365 ↗
            </a>
          )}
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
        </div>
      </main>
    );
  }
  return <Manager initial={await readContent()} name={user.displayName} provider={user.provider} />;
}
