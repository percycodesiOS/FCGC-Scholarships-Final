import { getChatGPTUser, chatGPTSignInPath } from '../chatgpt-auth';
import { editorUser } from '../../lib/auth';
import { readContent } from '../../lib/store';
import Manager from './Manager';
export const dynamic = 'force-dynamic';
export default async function Page(){
 const user=await editorUser();
 if(!user){const signed=await getChatGPTUser();return <main className="auth-card"><a className="text-link" href="/">← Scholarship website</a><img src="/fcgc-crest.gif" alt="Fox Chapel Golf Club crest"/><p className="eyebrow">SCHOLARSHIP EDITOR</p><h1>A simple place<br/>to keep things current.</h1><p>{signed?'This account does not have editing access. Use the authorized Janet or Kenny account.':'Sign in with the account authorized to manage this scholarship page.'}</p><a className="button" href={signed?'/signout-with-chatgpt?return_to=/manage':chatGPTSignInPath('/manage')} target="_top">{signed?'Switch account':'Sign in with ChatGPT'} ↗</a><a className="text-link" href="/handoff">Read the editing and handoff guide</a></main>}
 return <Manager initial={await readContent()} name={user.displayName}/>;
}
