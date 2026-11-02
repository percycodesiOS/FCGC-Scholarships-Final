import { env } from 'cloudflare:workers';
import { sameOrigin } from '../../../lib/auth';
import { readContent } from '../../../lib/store';
import { mailStatus,sendApplication } from '../../../lib/mail';
import { allowSubmission,boundedForm,hash,verifyToken } from '../../../lib/submission';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
type Receipt={hash:string;status:'processing'|'accepted'|'review-required';draftId?:string;created:string;};
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Open the application directly on this website.'},{status:403,headers});
 const content=await readContent();
 if(!content.submissionOpen||!(await mailStatus()).connected||!env.BUCKET)return Response.json({error:'Online submission is not connected. Download the completed PDF and email it to the Foundation.'},{status:503,headers});
 let receiptPath='',receipt:Receipt|null=null;
 try{
  const form=await boundedForm(request),value=(key:string)=>String(form.get(key)||'').trim(),id=value('submissionId'),name=value('name'),email=value('email'),age=Number(value('age')),pdf=form.get('pdf');
  if(value('website'))throw new Error('The submission could not be accepted.');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!name||name.length>160||/[\r\n]/.test(name)||! /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)||email.length>240)throw new Error('Check the applicant name and email.');
  if(value('year')!==content.year||value('revision')!==content.revision)throw new Error('The application settings changed. Save your progress, refresh, and review the current application before submitting.');
  if(!await verifyToken(value('token'),content.revision))throw new Error('This submission session expired. Save your progress, refresh, and try again.');
  if(!Number.isInteger(age)||age<1||age>120||value('studentSigned')!=='true'||age<18&&value('parentSigned')!=='true'||value('consent')!=='true')throw new Error('The required signatures and submission consent are missing.');
  if(!(pdf instanceof File)||pdf.size<100||pdf.size>20*1024*1024||pdf.type!=='application/pdf')throw new Error('Attach a completed PDF below 20 MB.');
  const bytes=new Uint8Array(await pdf.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('The attachment is not a valid PDF.');
  const digest=await hash(bytes);receiptPath='scholarship/private/receipts/'+id;
  const existing=await env.BUCKET.get(receiptPath);if(existing){const saved=await existing.json<Receipt>();if(saved.hash!==digest)throw new Error('This reference belongs to another PDF. Review the current application before submitting again.');if(saved.status==='accepted')return Response.json({reference:id,accepted:true},{headers});return Response.json({error:`This application is already being processed or needs a delivery check. Contact the Foundation with reference ${id} before trying again.`,reference:id},{status:409,headers});}
  if(!await allowSubmission(request.headers.get('cf-connecting-ip')||'local'))return Response.json({error:'Several submission attempts were made from this connection. Download your completed PDF and email it to the Foundation.'},{status:429,headers});
  receipt={hash:digest,status:'processing',created:new Date().toISOString()};const lock=await env.BUCKET.put(receiptPath,JSON.stringify(receipt),{onlyIf:{etagDoesNotMatch:'*'}});if(!lock)return Response.json({error:'This application is already being processed.'},{status:409,headers});
  await sendApplication(bytes,{id,year:content.year,name,email,recipients:content.submissionRecipients},async draftId=>{receipt!.draftId=draftId;await env.BUCKET!.put(receiptPath,JSON.stringify(receipt));});
  receipt.status='accepted';await env.BUCKET.put(receiptPath,JSON.stringify(receipt));
  return Response.json({reference:id,accepted:true},{headers});
 }catch(error){if(receipt&&receiptPath){receipt.status='review-required';await env.BUCKET?.put(receiptPath,JSON.stringify(receipt));}const reference=receiptPath.split('/').pop();const message=error instanceof Error?error.message:'Submission did not complete. Your answers remain on your device.';return Response.json({error:receipt?`${message} Reference: ${reference}. Contact the Foundation before retrying.`:message,reference:receipt?reference:undefined},{status:400,headers});}
}
