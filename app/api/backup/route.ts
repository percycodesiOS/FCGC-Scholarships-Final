import { readContent } from '../../../lib/store';
import { editorUser } from '../../../lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
 if (!await editorUser()) return new Response('Sign in with an authorized editor account.',{status:403});
 return new Response(JSON.stringify({format:'fcgc-scholarship-content-v1',exportedAt:new Date().toISOString(),content:await readContent()},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="scholarship-content-backup.json"','Cache-Control':'no-store'}});
}
