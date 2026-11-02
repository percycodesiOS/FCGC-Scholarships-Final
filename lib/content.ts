import initial from './default-content.json';
export type Content = Omit<typeof initial, 'updatedAt'> & { updatedAt: string | null };
export const defaults = initial as Content;
export const fields = ['year','headline','intro','deadline','welcome','email','phone','photoEmail','address','notice'] as const;
export function currentContent(value: Partial<Content>): Content {
  const next={...defaults,...value};
  // Replace only the verified legacy application policy, keeping the owner's page copy.
  if (!value.applicationVersion) {
    next.requirements=defaults.requirements;
    next.eligibility=defaults.eligibility;
    next.notice=defaults.notice;
    next.applicationVersion=defaults.applicationVersion;
  }
  return next;
}
export function validate(value: unknown): Content {
  if (!value || typeof value !== 'object') throw new Error('Choose a valid scholarship content file.');
  const v = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (typeof v[key] !== 'string' || !(v[key] as string).trim() || (v[key] as string).length > 3000) throw new Error(`Check the ${key} field.`);
    out[key] = (v[key] as string).trim();
  }
  if (!/^20\d{2}$/.test(out.year as string)) throw new Error('Enter a four-digit year.');
  if (!(out.deadline as string).includes(out.year as string)) throw new Error('Update the deadline to include the selected application year.');
  if ((out.deadline as string).length>120) throw new Error('Keep the deadline to 120 characters or fewer so it fits the PDF.');
  for (const key of ['email','photoEmail']) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out[key] as string)) throw new Error('Enter a valid email address.');
  for (const key of ['eligibility','requirements']) {
    if (!Array.isArray(v[key]) || !(v[key] as unknown[]).length || (v[key] as unknown[]).length > 20 || (v[key] as unknown[]).some(x => typeof x !== 'string' || !x.trim() || x.length > 1500)) throw new Error(`Check the ${key} list.`);
    out[key] = (v[key] as string[]).map(x => x.trim());
  }
  if (!Array.isArray(v.submissionRecipients)||v.submissionRecipients.length<1||v.submissionRecipients.length>5||v.submissionRecipients.some(x=>typeof x!=='string'||! /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(x.trim()))) throw new Error('Enter one to five valid submission email addresses, one per line.');
  out.submissionRecipients=[...new Set((v.submissionRecipients as string[]).map(x=>x.trim().toLowerCase()))];
  out.submissionOpen=v.submissionOpen===true;
  out.applicationVersion=defaults.applicationVersion;
  return {...out, revision: typeof v.revision === 'string' ? v.revision : 'initial', updatedAt: null} as Content;
}
