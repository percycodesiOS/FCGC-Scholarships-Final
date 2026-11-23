import initial from './default-content.json';

export type Content = Omit<typeof initial, 'updatedAt'> & { updatedAt: string | null };
export const defaults = initial as Content;
export const fields = [
  'year',
  'headline',
  'intro',
  'deadline',
  'welcome',
  'email',
  'phone',
  'address',
  'notice',
  'closedNotice',
] as const;

const fieldNames: Record<(typeof fields)[number], string> = {
  year: 'Application year',
  headline: 'Foundation mission tagline',
  intro: 'Short introduction',
  deadline: 'Deadline text',
  welcome: 'About the scholarship',
  email: 'Contact email',
  phone: 'Front office phone',
  address: 'Foundation mailing address',
  notice: 'Open announcement banner',
  closedNotice: 'Closed announcement banner',
};

export function currentContent(value: Partial<Content>): Content {
  const next = { ...defaults, ...value };
  // Replace only the verified legacy application policy, keeping the owner's page copy.
  if (!value.applicationVersion) {
    next.requirements = defaults.requirements;
    next.eligibility = defaults.eligibility;
    next.notice = defaults.notice;
    next.applicationVersion = defaults.applicationVersion;
  }
  if (typeof next.autoCloseAtDeadline !== 'boolean') {
    next.autoCloseAtDeadline = defaults.autoCloseAtDeadline;
  }
  if (typeof next.deadlineIso !== 'string') {
    next.deadlineIso = defaults.deadlineIso;
  }
  if (typeof next.closedNotice !== 'string' || !next.closedNotice.trim()) {
    next.closedNotice = defaults.closedNotice.replaceAll('2027', next.year);
  }
  return next;
}

export function validate(value: unknown): Content {
  if (!value || typeof value !== 'object') {
    throw new Error('Choose a valid scholarship content file.');
  }
  const v = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of fields) {
    const fallback = key === 'closedNotice' ? defaults.closedNotice : undefined;
    const raw = typeof v[key] === 'string' ? v[key] : fallback;
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 3000) {
      throw new Error(`Please fill in "${fieldNames[key]}" (cannot be blank).`);
    }
    out[key] = raw.trim();
  }

  if (!/^20\d{2}$/.test(out.year as string)) {
    throw new Error('Application year must be a four-digit year such as 2027 or 2028.');
  }
  if (!(out.deadline as string).includes(out.year as string)) {
    throw new Error(`Update the deadline text so it includes the selected year (${out.year}).`);
  }
  if ((out.deadline as string).length > 120) {
    throw new Error('Keep the deadline text to 120 characters or fewer so it fits cleanly on the PDF.');
  }

  const deadlineIso = typeof v.deadlineIso === 'string' ? v.deadlineIso.trim() : '';
  if (deadlineIso && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadlineIso)) {
    throw new Error('Choose a valid automatic close date and time.');
  }
  if (deadlineIso && !deadlineIso.startsWith(`${out.year}-`)) {
    throw new Error(`The automatic close date (${deadlineIso.slice(0, 4)}) should match the application year (${out.year}).`);
  }
  out.deadlineIso = deadlineIso;
  out.autoCloseAtDeadline = v.autoCloseAtDeadline === true;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email as string)) {
    throw new Error(`Enter a valid email address for "${fieldNames.email}".`);
  }
  out.photoEmail = '';

  // Automatically strip accidental blank lines so non-technical editors are never blocked by extra Enters.
  for (const key of ['eligibility', 'requirements'] as const) {
    if (!Array.isArray(v[key])) {
      throw new Error(`Please include at least one item in ${key === 'eligibility' ? 'Eligibility' : 'Checklist'}.`);
    }
    const cleaned = (v[key] as unknown[])
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter((x) => x.length > 0);
    if (!cleaned.length || cleaned.length > 20 || cleaned.some((x) => x.length > 1500)) {
      throw new Error(
        `Check the ${key === 'eligibility' ? 'Eligibility' : 'Checklist'} list: keep between 1 and 20 items, each under 1,500 characters.`,
      );
    }
    out[key] = cleaned;
  }

  if (!Array.isArray(v.submissionRecipients)) {
    throw new Error('Enter at least one valid submission email address.');
  }
  const cleanedRecipients = (v.submissionRecipients as unknown[])
    .map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
    .filter((x) => x.length > 0);
  if (
    cleanedRecipients.length < 1 ||
    cleanedRecipients.length > 5 ||
    cleanedRecipients.some((x) => !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(x))
  ) {
    throw new Error('Enter 1 to 5 valid submission email addresses.');
  }

  out.submissionRecipients = [...new Set(cleanedRecipients)];
  out.submissionOpen = v.submissionOpen === true;
  out.applicationVersion = defaults.applicationVersion;
  return {
    ...out,
    revision: typeof v.revision === 'string' ? v.revision : 'initial',
    updatedAt: null,
  } as Content;
}

/**
 * Summarize plain-English differences between two Content objects for Mom's
 * pre-save review dialog and audit log.
 */
export function describeContentChanges(previous: Content, next: Content): string[] {
  const changes: string[] = [];
  if (previous.year !== next.year) changes.push(`Application year: ${previous.year} -> ${next.year}`);
  if (previous.deadline !== next.deadline) changes.push(`Deadline: "${previous.deadline}" -> "${next.deadline}"`);
  if (previous.deadlineIso !== next.deadlineIso || previous.autoCloseAtDeadline !== next.autoCloseAtDeadline) {
    changes.push(
      next.autoCloseAtDeadline && next.deadlineIso
        ? `Automatic close set to ${next.deadlineIso.replace('T', ' ')} ET`
        : 'Automatic close at deadline turned off',
    );
  }
  if (previous.submissionOpen !== next.submissionOpen) {
    changes.push(next.submissionOpen ? 'Online submissions OPENED' : 'Online submissions PAUSED / CLOSED');
  }
  if (previous.notice !== next.notice) changes.push('Updated top open-status announcement banner');
  if (previous.closedNotice !== next.closedNotice) changes.push('Updated closed-status banner message');
  if (previous.headline !== next.headline) changes.push('Updated Foundation mission tagline');
  if (previous.intro !== next.intro) changes.push('Updated short homepage introduction');
  if (previous.welcome !== next.welcome) changes.push('Updated "About the scholarship" text');
  if (previous.email !== next.email) changes.push(`Contact email: ${previous.email} -> ${next.email}`);
  if (previous.phone !== next.phone) changes.push(`Front office phone: ${previous.phone} -> ${next.phone}`);
  if (previous.address !== next.address) changes.push('Updated Foundation mailing address');
  if (JSON.stringify(previous.eligibility) !== JSON.stringify(next.eligibility)) {
    changes.push(`Eligibility list updated (${next.eligibility.length} items)`);
  }
  if (JSON.stringify(previous.requirements) !== JSON.stringify(next.requirements)) {
    changes.push(`Required checklist updated (${next.requirements.length} items)`);
  }
  if (JSON.stringify(previous.submissionRecipients) !== JSON.stringify(next.submissionRecipients)) {
    changes.push(`Submission recipients: ${next.submissionRecipients.join(', ')}`);
  }
  return changes;
}

/**
 * Minimized public view for unauthenticated GET /api/content requests.
 * Excludes internal revision IDs and any secondary copy-only recipient addresses.
 */
export function publicContentView(content: Content) {
  return {
    year: content.year,
    headline: content.headline,
    intro: content.intro,
    deadline: content.deadline,
    deadlineIso: content.deadlineIso,
    autoCloseAtDeadline: content.autoCloseAtDeadline,
    welcome: content.welcome,
    eligibility: content.eligibility,
    requirements: content.requirements,
    email: content.email,
    phone: content.phone,
    address: content.address,
    notice: content.notice,
    closedNotice: content.closedNotice,
    submissionOpen: content.submissionOpen,
    primaryRecipient: content.submissionRecipients[0],
    updatedAt: content.updatedAt,
  };
}
