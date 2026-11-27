import { env } from 'cloudflare:workers';
import { sameOrigin, editorUser } from '../../../lib/auth';
import { readContent } from '../../../lib/store';
import { mailStatus, sendApplication } from '../../../lib/mail';
import {
  allowSubmission,
  boundedForm,
  consumeTokenNonce,
  hash,
  verifyAndExtractToken,
} from '../../../lib/submission';
import { coverLetterVersion } from '../../../lib/application-policy';
import { isDeadlinePassed, scanPdfForActiveContent, validatePhotoBytes } from '../../../lib/security';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

type Receipt = {
  hash: string;
  status: 'processing' | 'accepted' | 'review-required';
  draftId?: string;
  created: string;
  confirmationAccepted?: boolean;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: 'Open the application directly on this website.' },
      { status: 403, headers },
    );
  }
  const content = await readContent();

  if (isDeadlinePassed(content.deadlineIso, content.autoCloseAtDeadline)) {
    return Response.json(
      { error: content.closedNotice || 'The application deadline has passed.' },
      { status: 403, headers },
    );
  }

  if (!content.submissionOpen || !(await mailStatus()).connected || !env.BUCKET) {
    return Response.json(
      {
        error:
          'Online submission is temporarily unavailable. Save your progress and contact the Foundation for assistance.',
      },
      { status: 503, headers },
    );
  }

  let receiptPath = '';
  let receipt: Receipt | null = null;
  try {
    const form = await boundedForm(request);
    const value = (key: string) => String(form.get(key) || '').trim();
    const id = value('submissionId');
    const name = value('name');
    const email = value('email');
    const rawConfirmationEmail = value('confirmationEmail');
    const confirmationEmail = rawConfirmationEmail || email;
    const age = Number(value('age'));
    const pdf = form.get('pdf');

    if (value('website')) throw new Error('The submission could not be accepted.');
    if (
      !/^[0-9a-f-]{36}$/i.test(id) ||
      !name ||
      name.length > 160 ||
      /[\r\n]/.test(name) ||
      !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) ||
      email.length > 240
    ) {
      throw new Error('Check the applicant name and email.');
    }
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(confirmationEmail) || confirmationEmail.length > 240) {
      throw new Error('Check the confirmation email address.');
    }
    if (value('year') !== content.year || value('revision') !== content.revision) {
      throw new Error(
        'The application settings changed. Save your progress, refresh, and review the current application before submitting.',
      );
    }
    if (
      value('coverLetterAcknowledged') !== 'true' ||
      value('coverLetterVersion') !== coverLetterVersion(content.year)
    ) {
      throw new Error('Read and acknowledge the current cover letter before submitting.');
    }

    const testApplication = value('testApplication') === 'true';
    if (testApplication && !(await editorUser())) {
      throw new Error('Only an authorized website editor can send a marked test application.');
    }

    const tokenCheck = await verifyAndExtractToken(value('token'), content.revision);
    if (!tokenCheck.valid) {
      throw new Error('This submission session expired. Save your progress, refresh, and try again.');
    }

    if (
      !Number.isInteger(age) ||
      age < 1 ||
      age > 120 ||
      value('studentSigned') !== 'true' ||
      (age < 18 && value('parentSigned') !== 'true') ||
      value('consent') !== 'true'
    ) {
      throw new Error('The required signatures and submission consent are missing.');
    }

    if (!(pdf instanceof File) || pdf.size < 100 || pdf.size > 20 * 1024 * 1024 || pdf.type !== 'application/pdf') {
      throw new Error('Attach a completed PDF below 20 MB.');
    }

    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const pdfScan = scanPdfForActiveContent(bytes);
    if (!pdfScan.ok) {
      throw new Error(pdfScan.reason);
    }

    // Validate optional standalone applicant photo (compressed JPG/PNG uploaded with application).
    let validatedPhoto: { bytes: Uint8Array; ext: 'jpg' | 'png'; contentType: 'image/jpeg' | 'image/png' } | null = null;
    const rawPhoto = form.get('photo');
    if (rawPhoto instanceof File && rawPhoto.size > 0) {
      const photoBytes = new Uint8Array(await rawPhoto.arrayBuffer());
      const photoCheck = validatePhotoBytes(photoBytes, rawPhoto.type);
      if (!photoCheck.ok) {
        throw new Error(photoCheck.reason);
      }
      validatedPhoto = { bytes: photoBytes, ext: photoCheck.ext, contentType: photoCheck.contentType };
    }

    const digest = await hash(bytes);
    receiptPath = 'scholarship/private/receipts/' + id;
    const existing = await env.BUCKET.get(receiptPath);
    if (existing) {
      const saved = await existing.json<Receipt>();
      if (saved.hash !== digest) {
        throw new Error(
          'This reference belongs to another PDF. Review the current application before submitting again.',
        );
      }
      if (saved.status === 'accepted') {
        return Response.json(
          { reference: id, accepted: true, confirmationAccepted: !!saved.confirmationAccepted },
          { headers },
        );
      }
      return Response.json(
        {
          error: `This application is already being processed or needs a delivery check. Contact the Foundation with reference ${id} before trying again.`,
          reference: id,
        },
        { status: 409, headers },
      );
    }

    // Consume the submission token nonce once to block replay attacks.
    const freshNonce = await consumeTokenNonce(tokenCheck.nonce);
    if (!freshNonce) {
      throw new Error(
        'This submission session was already used. Refresh the page before starting a new submission.',
      );
    }

    const rateResult = await allowSubmission(request.headers.get('cf-connecting-ip') || 'local', email);
    if (!rateResult.allowed) {
      const rateMessage =
        rateResult.reason === 'recipient-limit'
          ? 'Multiple applications were recently submitted for this email address today. Contact the Foundation if you need assistance.'
          : rateResult.reason === 'global-limit'
            ? 'The website reached its daily submission safety limit. Save your progress and contact the Foundation.'
            : 'Several submission attempts were made from this connection. Save your progress and contact the Foundation before trying again.';
      return Response.json({ error: rateMessage }, { status: 429, headers });
    }

    receipt = { hash: digest, status: 'processing', created: new Date().toISOString() };
    const lock = await env.BUCKET.put(receiptPath, JSON.stringify(receipt), {
      onlyIf: { etagDoesNotMatch: '*' },
    });
    if (!lock) {
      return Response.json({ error: 'This application is already being processed.' }, { status: 409, headers });
    }

    const result = await sendApplication(
      bytes,
      {
        id,
        year: content.year,
        name,
        email,
        confirmationEmail,
        recipients: content.submissionRecipients,
        deadline: content.deadline,
        testApplication,
        photo: validatedPhoto,
      },
      async (draftId) => {
        receipt!.draftId = draftId;
        await env.BUCKET!.put(receiptPath, JSON.stringify(receipt));
      },
    );

    receipt.status = 'accepted';
    receipt.confirmationAccepted = result.confirmationAccepted;
    await env.BUCKET.put(receiptPath, JSON.stringify(receipt));
    return Response.json(
      { reference: id, accepted: true, confirmationAccepted: result.confirmationAccepted },
      { headers },
    );
  } catch (error) {
    if (receipt && receiptPath) {
      receipt.status = 'review-required';
      await env.BUCKET?.put(receiptPath, JSON.stringify(receipt));
    }
    const reference = receiptPath.split('/').pop();
    const message =
      error instanceof Error
        ? error.message
        : 'Submission did not complete. Your answers remain on your device.';
    return Response.json(
      {
        error: receipt
          ? `${message} Reference: ${reference}. Contact the Foundation before retrying.`
          : message,
        reference: receipt ? reference : undefined,
      },
      { status: 400, headers },
    );
  }
}
