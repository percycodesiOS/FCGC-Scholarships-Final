import { env } from 'cloudflare:workers';
import { defaults, currentContent, type Content } from './content';
const key = 'scholarship/content.json';
export async function readContent(): Promise<Content> {
  if (!env.BUCKET) return defaults;
  const object = await env.BUCKET.get(key);
  return object ? currentContent(await object.json<Content>()) : defaults;
}
export async function saveContent(content: Content, revision: string) {
  if (!env.BUCKET) throw new Error('The website storage is unavailable. No changes were saved.');
  const old = await env.BUCKET.get(key);
  const previous = old ? await old.json<Content>() : defaults;
  if (previous.revision !== revision) return null;
  const next = {...content, revision: crypto.randomUUID(), updatedAt: new Date().toISOString()};
  await env.BUCKET.put(`scholarship/history/${previous.revision}.json`,JSON.stringify(previous),{httpMetadata:{contentType:'application/json'}});
  const result = await env.BUCKET.put(key, JSON.stringify(next), {onlyIf: old ? {etagMatches: old.etag} : {etagDoesNotMatch:'*'}, httpMetadata:{contentType:'application/json'}});
  if (!result) return null;
  return next;
}
