import { readContent } from '../../../lib/store';
import { mailStatus } from '../../../lib/mail';
import { makeToken } from '../../../lib/submission';
export const dynamic='force-dynamic';
export async function GET(){
 const content=await readContent();
 const recipients=content.submissionRecipients;
 let connected=false;try{connected=(await mailStatus()).connected;}catch{}
 const canSubmit=content.submissionOpen&&connected;
 return Response.json({year:content.year,deadline:content.deadline,photoEmail:content.photoEmail,submissionEmail:recipients[0],submissionRecipients:recipients,revision:content.revision,canSubmit,submissionToken:canSubmit?await makeToken(content.revision):null},{headers:{'Cache-Control':'no-store'}});
}
