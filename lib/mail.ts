import { env } from 'cloudflare:workers';
import {
  base64Decode,
  base64Encode,
  deriveAesGcmKey,
  legacyV1AesGcmKey,
} from './security';

const encoder = new TextEncoder();
export const mailScopes =
  'offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send.Shared';
export const connectionKey = 'scholarship/private/microsoft-connection';
export const setupKey = 'scholarship/private/microsoft-setup';

type Setup = { clientId: string; clientSecret: string; tenant: string; fromEmail: string };
type Connection = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  name: string;
};
type EncryptedEnvelope = { iv: string; data: string; v?: number };

export function base64(bytes: Uint8Array) {
  return base64Encode(bytes);
}

export function randomToken() {
  return base64Encode(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

/**
 * Encrypt private records using HKDF-derived v2 AES-GCM key (key separation from HMAC).
 */
export async function storePrivate(
  key: string,
  value: unknown,
  purpose: 'mail-storage' | 'oauth-state' = 'mail-storage',
) {
  if (!env.BUCKET) throw new Error('Website storage is unavailable.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesGcmKey(purpose);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(JSON.stringify(value)),
  );
  const envelope: EncryptedEnvelope = {
    v: 2,
    iv: base64Encode(iv),
    data: base64Encode(new Uint8Array(cipher)),
  };
  await env.BUCKET.put(key, JSON.stringify(envelope), {
    httpMetadata: { contentType: 'application/json' },
  });
}

/**
 * Read private records with seamless backward compatibility for existing v1 encrypted records.
 */
export async function readPrivate<T>(
  key: string,
  purpose: 'mail-storage' | 'oauth-state' = 'mail-storage',
): Promise<T | null> {
  const record = await env.BUCKET?.get(key);
  if (!record) return null;
  const raw = await record.json<EncryptedEnvelope>();
  const iv = base64Decode(raw.iv);
  const data = base64Decode(raw.data);

  if (raw.v === 2) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await deriveAesGcmKey(purpose), data);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }

  // Backward-compatible fallback for v1 records encrypted directly with MAIL_ENCRYPTION_KEY.
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await legacyV1AesGcmKey(), data);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function mailStatus() {
  const setup = await readPrivate<Setup>(setupKey);
  const connection = await readPrivate<Connection>(connectionKey);
  return {
    configured: !!setup,
    connected: !!connection,
    account: connection?.email || null,
    fromEmail: setup?.fromEmail || null,
    secureStorage: !!env.MAIL_ENCRYPTION_KEY,
    expiresAt: connection?.expiresAt || null,
  };
}

export async function saveMailSetup(value: {
  clientId: unknown;
  clientSecret: unknown;
  tenant: unknown;
  fromEmail: unknown;
}) {
  if (typeof value.clientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.clientId.trim())) {
    throw new Error('Enter a valid Microsoft application (client) ID.');
  }
  const tenant = String(value.tenant || 'organizations').trim();
  if (!/^(organizations|common|[0-9a-f-]{36})$/i.test(tenant)) {
    throw new Error('Enter a valid Microsoft directory (tenant) ID.');
  }
  const fromEmail = String(value.fromEmail || '').trim().toLowerCase();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(fromEmail) || fromEmail.length > 240) {
    throw new Error('Enter the sending mailbox address.');
  }
  const old = await readPrivate<Setup>(setupKey);
  const secret =
    typeof value.clientSecret === 'string' && value.clientSecret
      ? value.clientSecret
      : old?.clientSecret;
  if (!secret || secret.length > 500) {
    throw new Error('Enter the Microsoft application client secret.');
  }
  const next: Setup = {
    clientId: value.clientId.trim().toLowerCase(),
    clientSecret: secret,
    tenant: tenant.toLowerCase(),
    fromEmail,
  };
  if (
    old &&
    old.clientId.toLowerCase() === next.clientId &&
    old.tenant.toLowerCase() === next.tenant &&
    old.fromEmail.toLowerCase() === next.fromEmail &&
    old.clientSecret === next.clientSecret
  ) {
    return;
  }
  await storePrivate(setupKey, next);
  await env.BUCKET?.delete(connectionKey);
}

export async function startMicrosoft(origin: string, userId: string) {
  const setup = await readPrivate<Setup>(setupKey);
  if (!setup) throw new Error('Complete the one-time Microsoft application setup first.');
  const state = crypto.randomUUID();
  const verifier = randomToken();
  const challenge = base64Encode(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

  await storePrivate(
    'scholarship/private/oauth/' + state,
    { verifier, userId, origin, created: Date.now() },
    'oauth-state',
  );
  const parameters = new URLSearchParams({
    client_id: setup.clientId,
    response_type: 'code',
    redirect_uri: origin + '/api/mail/microsoft/callback',
    response_mode: 'query',
    scope: mailScopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return {
    url: `https://login.microsoftonline.com/${setup.tenant}/oauth2/v2.0/authorize?${parameters}`,
    state,
  };
}

async function exchange(parameters: URLSearchParams) {
  const setup = await readPrivate<Setup>(setupKey);
  if (!setup) throw new Error('Microsoft email is not configured.');
  parameters.set('client_id', setup.clientId);
  parameters.set('client_secret', setup.clientSecret);
  const response = await fetch(
    `https://login.microsoftonline.com/${setup.tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: parameters,
    },
  );
  if (!response.ok) {
    let errorCode = 'token_error';
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody.error) errorCode = errBody.error;
    } catch {
      // Ignore parse failures.
    }
    if (errorCode === 'invalid_client') {
      throw new Error('The Microsoft client secret appears invalid or expired. Update it in IT Setup.');
    }
    if (errorCode === 'invalid_grant') {
      throw new Error('The Microsoft connection expired or was revoked. Choose Reconnect Microsoft mailbox.');
    }
    throw new Error(
      'Microsoft authorization did not complete. Reconnect the mailbox or ask the Club IT administrator to approve the application.',
    );
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!data.access_token) throw new Error('Microsoft did not provide an email connection.');
  return data;
}

export async function completeMicrosoft(
  code: string,
  state: string,
  userId: string,
  origin: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(state)) throw new Error('The connection request is invalid.');
  const key = 'scholarship/private/oauth/' + state;
  const request = await readPrivate<{
    verifier: string;
    userId: string;
    origin: string;
    created: number;
  }>(key, 'oauth-state');
  if (
    !request ||
    request.userId !== userId ||
    request.origin !== origin ||
    Date.now() - request.created > 600000
  ) {
    throw new Error('The connection request expired. Start again from Manage scholarship.');
  }
  await env.BUCKET?.delete(key);
  const token = await exchange(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: origin + '/api/mail/microsoft/callback',
      code_verifier: request.verifier,
      scope: mailScopes,
    }),
  );
  if (!token.refresh_token) {
    throw new Error('Microsoft did not allow a persistent email connection.');
  }
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName',
    { headers: { Authorization: 'Bearer ' + token.access_token } },
  );
  if (!response.ok) throw new Error('The connected Microsoft mailbox could not be verified.');
  const profile = (await response.json()) as {
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };
  await storePrivate(connectionKey, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    email: profile.mail || profile.userPrincipalName || '',
    name: profile.displayName || '',
  });
}

async function accessToken() {
  const connection = await readPrivate<Connection>(connectionKey);
  if (!connection) {
    throw new Error('Online submission is not connected. Save your progress and contact the Foundation.');
  }
  if (connection.expiresAt > Date.now() + 120000) return connection.accessToken;
  const result = await exchange(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
      scope: mailScopes,
    }),
  );
  await storePrivate(connectionKey, {
    ...connection,
    accessToken: result.access_token,
    refreshToken: result.refresh_token || connection.refreshToken,
    expiresAt: Date.now() + result.expires_in * 1000,
  });
  return result.access_token;
}

/**
 * Non-destructive health check for Mom's "Test Connection" button.
 * Verifies token refresh and Microsoft Graph identity without sending any email.
 */
export async function verifyMailConnectionHealth() {
  const setup = await readPrivate<Setup>(setupKey);
  if (!setup) {
    return { healthy: false, message: 'One-time Microsoft setup has not been saved yet.' };
  }
  const token = await accessToken();
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName',
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (!response.ok) {
    return {
      healthy: false,
      message: 'Microsoft rejected the saved token. Click "Reconnect Microsoft mailbox" to refresh sign-in.',
    };
  }
  const profile = (await response.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return {
    healthy: true,
    account: profile.mail || profile.userPrincipalName || null,
    fromEmail: setup.fromEmail,
    checkedAt: new Date().toISOString(),
    message: `Connection verified! Signed in as ${profile.mail || profile.userPrincipalName} and ready to send from ${setup.fromEmail}.`,
  };
}

export async function sendApplication(
  pdf: Uint8Array,
  info: {
    id: string;
    year: string;
    name: string;
    email: string;
    recipients: string[];
    photoEmail: string;
    deadline: string;
    testApplication?: boolean;
  },
  onDraft: (id: string) => Promise<void>,
) {
  const setup = await readPrivate<Setup>(setupKey);
  if (!setup?.fromEmail) throw new Error('Choose the sending mailbox in email setup.');
  // Drafts and attachment uploads stay in the authorized user mailbox. The explicit From address uses existing Send As permission.
  const token = await accessToken();
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const filename = `${info.year}-Scholarship-Application-${info.id.slice(0, 8)}.pdf`;
  const testPrefix = info.testApplication ? '[TEST - FICTIONAL APPLICATION] ' : '';
  const message = {
    from: { emailAddress: { address: setup.fromEmail } },
    subject: `${testPrefix}${info.year} Scholarship Application - ${info.name}`,
    body: {
      contentType: 'Text',
      content: `${
        info.testApplication
          ? 'TEST ONLY. This is a fictional demonstration. Do not process it as a scholarship application.\n\n'
          : ''
      }A completed scholarship application is attached.\nApplicant: ${info.name}\nApplicant email: ${info.email}\nReference: ${info.id}\n\nThe attached PDF includes the cover letter, application, electronic signatures and the supporting documents selected by the applicant. This email does not indicate a scholarship decision.`,
    },
    toRecipients: info.recipients.map((address) => ({ emailAddress: { address } })),
    replyTo: [{ emailAddress: { address: info.email } }],
    internetMessageHeaders: [{ name: 'x-fcgc-submission-id', value: info.id }],
  };
  const draft = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });
  if (!draft.ok) {
    throw new Error('Microsoft could not prepare the application email. Your answers are still on this device.');
  }
  const { id } = (await draft.json()) as { id: string };
  await onDraft(id);

  let attached = false;
  if (pdf.length < 2900000) {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}/attachments`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: filename,
          contentType: 'application/pdf',
          contentBytes: base64Encode(pdf),
        }),
      },
    );
    attached = response.ok;
  } else {
    const session = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}/attachments/createUploadSession`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          AttachmentItem: {
            attachmentType: 'file',
            name: filename,
            size: pdf.length,
            contentType: 'application/pdf',
          },
        }),
      },
    );
    if (session.ok) {
      const { uploadUrl } = (await session.json()) as { uploadUrl: string };
      const target = new URL(uploadUrl);
      if (
        target.protocol !== 'https:' ||
        !/(^|\.)outlook\.(com|office365\.com|office\.com)$/.test(target.hostname)
      ) {
        throw new Error('Microsoft returned an unexpected attachment upload destination.');
      }
      for (let start = 0; start < pdf.length; start += 3276800) {
        const end = Math.min(pdf.length, start + 3276800);
        const part = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(end - start),
            'Content-Range': `bytes ${start}-${end - 1}/${pdf.length}`,
          },
          body: pdf.slice(start, end),
        });
        if (!part.ok) {
          throw new Error('The attachment upload did not complete. No application email was sent.');
        }
        attached = end === pdf.length && part.status === 201;
      }
    }
  }
  if (!attached) {
    throw new Error('The PDF attachment could not be added. No application email was sent.');
  }
  const sent = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}/send`,
    { method: 'POST', headers },
  );
  if (sent.status !== 202) {
    throw new Error('Microsoft did not confirm acceptance. Contact the Foundation with your reference before retrying.');
  }
  // A confirmation failure must not turn the accepted Foundation submission into a retry.
  let confirmationAccepted = false;
  try {
    const confirmation = {
      message: {
        from: { emailAddress: { address: setup.fromEmail } },
        toRecipients: [{ emailAddress: { address: info.email } }],
        subject: `${info.testApplication ? '[TEST] ' : ''}${info.year} Scholarship Application - Submission Confirmation`,
        body: {
          contentType: 'Text',
          content: `Dear ${info.name},\n\n${
            info.testApplication
              ? 'TEST MESSAGE: This is a fictional demonstration of the student confirmation.\n\n'
              : ''
          }Your ${info.year} scholarship application has been successfully submitted.\n\nApplication reference: ${info.id}\n\nAs a reminder, please email a digital photo of the applicant to ${info.photoEmail}, if you have not already done so.\n\nThe committee will review applications after the application deadline: ${info.deadline}. Applicants selected for an interview will be contacted.\n\nPlease keep this confirmation and your completed application PDF for your records. This confirmation does not indicate a scholarship decision or guarantee an interview or award.\n\nQuestions? Contact ${setup.fromEmail}.\n\nFox Chapel Golf Club Scholarship Foundation, Inc.`,
        },
      },
      saveToSentItems: true,
    };
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers,
      body: JSON.stringify(confirmation),
    });
    confirmationAccepted = response.status === 202;
  } catch {
    // Non-fatal; Foundation email was already accepted.
  }
  return { accepted: true, confirmationAccepted };
}
