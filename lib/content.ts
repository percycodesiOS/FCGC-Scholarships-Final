import initial from './default-content.json';
export type Content = Omit<typeof initial, 'updatedAt'> & { updatedAt: string | null };
export const defaults = initial as Content;
export const fields = ['year','headline','intro','deadline','welcome','email','phone','photoEmail','address','notice'] as const;
export function validate(value: unknown): Content {
  if (!value || typeof value !== 'object') throw new Error('Choose a valid scholarship content file.');
  const v = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (typeof v[key] !== 'string' || !(v[key] as string).trim() || (v[key] as string).length > 3000) throw new Error(`Check the ${key} field.`);
    out[key] = (v[key] as string).trim();
  }
  if (!/^20\d{2}$/.test(out.year as string)) throw new Error('Enter a four-digit year.');
  for (const key of ['email','photoEmail']) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out[key] as string)) throw new Error('Enter a valid email address.');
  for (const key of ['eligibility','requirements']) {
    if (!Array.isArray(v[key]) || !(v[key] as unknown[]).length || (v[key] as unknown[]).length > 20 || (v[key] as unknown[]).some(x => typeof x !== 'string' || !x.trim() || x.length > 1500)) throw new Error(`Check the ${key} list.`);
    out[key] = (v[key] as string[]).map(x => x.trim());
  }
  return {...out, revision: typeof v.revision === 'string' ? v.revision : 'initial', updatedAt: null} as Content;
}
