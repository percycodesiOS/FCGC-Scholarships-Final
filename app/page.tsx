import { readContent } from '../lib/store';
import Scholarship from './Scholarship';
export const dynamic = 'force-dynamic';
export default async function Page(){return <Scholarship data={await readContent()}/>;}
