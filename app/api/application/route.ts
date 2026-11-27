import { env } from 'cloudflare:workers';
import { readContent } from '../../../lib/store';
import { mailStatus } from '../../../lib/mail';
import { makeToken } from '../../../lib/submission';
import { coverLetterVersion } from '../../../lib/application-policy';
import { editorUser } from '../../../lib/auth';
import { isDeadlinePassed } from '../../../lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const content = await readContent();
  const recipients = content.submissionRecipients;
  let connected = false;
  try {
    connected = (await mailStatus()).connected;
  } catch {
    connected = false;
  }

  let customCoverLetter = false;
  try {
    customCoverLetter = !!(await env.BUCKET?.head('scholarship/cover-letter/current.pdf'));
  } catch {
    customCoverLetter = false;
  }

  const deadlinePassed = isDeadlinePassed(content.deadlineIso, content.autoCloseAtDeadline);
  const canSubmit = content.submissionOpen && !deadlinePassed && connected;
  const closedReason = deadlinePassed
    ? 'deadline-passed'
    : !content.submissionOpen
      ? 'manually-closed'
      : !connected
        ? 'mail-not-connected'
        : null;

  return Response.json(
    {
      year: content.year,
      deadline: content.deadline,
      deadlineIso: content.deadlineIso,
      autoCloseAtDeadline: content.autoCloseAtDeadline,
      deadlinePassed,
      closedReason,
      closedNotice: content.closedNotice,
      eligibility: content.eligibility,
      customCoverLetter,
      submissionEmail: recipients[0],
      submissionRecipients: recipients,
      revision: content.revision,
      coverLetterVersion: coverLetterVersion(content.year),
      testModeAvailable: !!(await editorUser()),
      canSubmit,
      submissionToken: canSubmit ? await makeToken(content.revision) : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
