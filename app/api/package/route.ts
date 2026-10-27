import { editorUser } from '../../../lib/auth';
import { packageBase64 } from '../../../lib/package-data';
export const dynamic='force-dynamic';
export async function GET(){
 if(!await editorUser())return new Response('Sign in with an authorized editor account.',{status:403});
 const bytes=Uint8Array.from(atob(packageBase64),x=>x.charCodeAt(0));
 return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Fox-Chapel-Scholarship-Website.zip"','Cache-Control':'no-store'}});
}
