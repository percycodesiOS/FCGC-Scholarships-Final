'use client';
import { useEffect, useState } from 'react';
import type { ReceiptSummary } from '../../lib/store';

type MailStatus = {
  configured: boolean;
  connected: boolean;
  secureStorage: boolean;
  account: string | null;
  fromEmail: string | null;
  expiresAt?: number | null;
};

type LedgerData = {
  total: number;
  accepted: number;
  reviewRequired: number;
  processing: number;
  lastSubmissionAt: string | null;
  recent: ReceiptSummary[];
};

const OAUTH_MESSAGES: Record<string, string> = {
  connected: 'Microsoft mailbox connected! Online submissions are ready.',
  'access-denied': 'Microsoft sign-in was cancelled. No changes were made to your connection.',
  'consent-required':
    'Club IT administrator approval is required in Microsoft Entra for this app before connecting.',
  'interaction-required': 'Microsoft requires a fresh sign-in. Click "Connect Microsoft / Outlook" again.',
  'invalid-client': 'The Microsoft client secret in IT Setup needs to be updated before connecting.',
  'expired-state': 'The Microsoft sign-in window timed out after 10 minutes. Please click Connect again.',
  'connection-failed':
    'Microsoft did not complete the connection. Verify IT Setup or ask Club IT to check app approval.',
};

export default function EmailDelivery({
  onStatusChange,
}: {
  onStatusChange?: (status: MailStatus | null) => void;
}) {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [origin, setOrigin] = useState('');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'ok' | 'warn' | 'err'>('ok');
  const [busy, setBusy] = useState(false);

  // IT one-time setup fields (tucked inside collapsed accordion)
  const [clientId, setClientId] = useState('');
  const [tenant, setTenant] = useState('organizations');
  const [secret, setSecret] = useState('');
  const [fromEmail, setFromEmail] = useState('scholarshipfoundation@foxchapelgolfclub.com');

  // Zero-PII submission ledger & reference verifier
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [refQuery, setRefQuery] = useState('');
  const [refResult, setRefResult] = useState<{
    checked: boolean;
    found: boolean;
    receipt: ReceiptSummary | null;
  }>({ checked: false, found: false, receipt: null });

  async function refresh() {
    const [mailRes, ledgerRes] = await Promise.all([
      fetch('/api/mail', { cache: 'no-store' }),
      fetch('/api/receipts', { cache: 'no-store' }),
    ]);
    if (mailRes.ok) {
      const value = (await mailRes.json()) as MailStatus;
      setStatus(value);
      onStatusChange?.(value);
      if (value.fromEmail) setFromEmail(value.fromEmail);
    }
    if (ledgerRes.ok) {
      setLedger((await ledgerRes.json()) as LedgerData);
    }
  }

  useEffect(() => {
    setOrigin(location.origin);
    void refresh();
    const mailParam = new URLSearchParams(location.search).get('mail');
    if (mailParam && OAUTH_MESSAGES[mailParam]) {
      setMessage(OAUTH_MESSAGES[mailParam]);
      setMessageKind(mailParam === 'connected' ? 'ok' : 'err');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function action(name: 'connect' | 'disconnect' | 'setup' | 'health') {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: name,
          ...(name === 'setup' ? { clientId, tenant, clientSecret: secret, fromEmail } : {}),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        url?: string;
        healthy?: boolean;
        message?: string;
      };
      if (!response.ok) throw new Error(result.error || 'The email action did not complete.');
      setSecret('');
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      await refresh();
      if (name === 'health') {
        setMessage(result.message || 'Connection checked.');
        setMessageKind(result.healthy ? 'ok' : 'err');
      } else if (name === 'setup') {
        setMessage('IT setup saved. Next, click "Connect Microsoft / Outlook" above.');
        setMessageKind('ok');
      } else {
        setMessage('Mailbox disconnected. Online submissions are paused until reconnected.');
        setMessageKind('warn');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The connection did not complete.');
      setMessageKind('err');
    } finally {
      setBusy(false);
    }
  }

  async function lookupReference(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = refQuery.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch('/api/receipts?ref=' + encodeURIComponent(trimmed), {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { found: boolean; receipt: ReceiptSummary | null };
        setRefResult({ checked: true, found: data.found, receipt: data.receipt });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="v2-stack">
      <section className="editor-section">
        <div className="v2-section-head">
          <div>
            <p className="eyebrow">EVERYDAY MAILBOX STATUS</p>
            <h2>Microsoft / Outlook email delivery</h2>
          </div>
          <span className={status?.connected ? 'v2-pill ok' : 'v2-pill warn'}>
            {status?.connected ? '● Connected & Ready' : '● Needs Connection'}
          </span>
        </div>

        <p className="v2-lead">
          {status?.connected
            ? `Signed in through ${status.account}. Completed student applications are sent from ${status.fromEmail} to the Foundation recipients you choose.`
            : 'Online submission is paused until a Club mailbox is connected. Students can still save progress and download their PDF.'}
        </p>

        <div className="v2-button-row">
          <button
            type="button"
            disabled={busy || !status?.configured}
            onClick={() => action('connect')}
          >
            {status?.connected ? 'Reconnect Office 365 mailbox' : 'Connect Office 365 Account'}
          </button>
          {status?.connected && (
            <>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => action('health')}
              >
                Test connection now
              </button>
              <button
                type="button"
                className="secondary v2-danger-outline"
                disabled={busy}
                onClick={() => action('disconnect')}
              >
                Disconnect mailbox
              </button>
            </>
          )}
        </div>

        {message && (
          <p className={`v2-callout v2-callout-${messageKind}`} role="status">
            {message}
          </p>
        )}

        <p className="fine">
          <strong>Everyday note for Janet:</strong> Sign in with <code>jmacek@foxchapelgolfclub.com</code> if
          Microsoft ever asks you to reconnect. You do <em>not</em> need to touch the IT Setup box below unless Club
          IT rotates the app secret.
        </p>
      </section>

      <section className="editor-section">
        <p className="eyebrow">CHECK A STUDENT SUBMISSION</p>
        <h2>Verify a student submission</h2>
        <p>
          For applicant privacy, the website never stores completed PDFs or student names on the server. It stores
          only anonymous delivery receipts so you can confirm whether an application reached Outlook safely.
        </p>

        {ledger && (
          <div className="v2-stat-row">
            <div className="v2-stat">
              <strong>{ledger.accepted}</strong>
              <span>Delivered to Outlook</span>
            </div>
            <div className="v2-stat">
              <strong>{ledger.reviewRequired}</strong>
              <span>Needs attention</span>
            </div>
            <div className="v2-stat">
              <strong>
                {ledger.lastSubmissionAt
                  ? new Date(ledger.lastSubmissionAt).toLocaleDateString('en-US', {
                      timeZone: 'America/New_York',
                    })
                  : 'None yet'}
              </strong>
              <span>Most recent receipt</span>
            </div>
          </div>
        )}

        <form className="v2-lookup-form" onSubmit={lookupReference}>
          <label className="editor-field">
            Paste a student’s Reference ID (from their confirmation screen or email)
            <div className="v2-inline-input">
              <input
                type="text"
                value={refQuery}
                onChange={(e) => setRefQuery(e.target.value)}
                placeholder="e.g. c560c299-bb64-4753-8607-0d8b9bb25594"
                autoComplete="off"
              />
              <button type="submit" disabled={busy || !refQuery.trim()}>
                Check reference
              </button>
            </div>
          </label>
        </form>

        {refResult.checked && (
          <div
            className={refResult.found ? 'v2-callout v2-callout-ok' : 'v2-callout v2-callout-warn'}
            role="status"
          >
            {refResult.found && refResult.receipt ? (
              <>
                <strong>Receipt found:</strong> Status is{' '}
                <code>{refResult.receipt.status.toUpperCase()}</code> · Submitted{' '}
                {new Date(refResult.receipt.created).toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                })}{' '}
                ET · Confirmation email:{' '}
                {refResult.receipt.confirmationAccepted ? 'Accepted by Microsoft' : 'Not confirmed'} · PDF
                fingerprint: <code>{refResult.receipt.hashPrefix}…</code>
              </>
            ) : (
              'No receipt matched that Reference ID. Check for typos or ask the applicant to check their saved PDF.'
            )}
          </div>
        )}
      </section>

      <section className="editor-section v2-it-box">
        <details>
          <summary>IT / Club Administrator Setup (One-Time Only — Janet does not need to edit this)</summary>
          <p className="fine">
            Configured once by Club IT / Kenny using the Fox Chapel Golf Club Microsoft Entra application registration.
            Credentials are encrypted with HKDF-derived AES-256-GCM in private Cloudflare R2 storage and are never
            exported in backups or website packages.
          </p>
          <p className="fine">
            Web redirect URI: <code>{origin}/api/mail/microsoft/callback</code>
          </p>
          <label className="editor-field">
            Send from this shared mailbox
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="editor-field">
            Application (client) ID
            <input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
          </label>
          <label className="editor-field">
            Directory (tenant) ID
            <input value={tenant} onChange={(e) => setTenant(e.target.value)} autoComplete="off" />
          </label>
          <label className="editor-field">
            Client secret
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="new-password"
              placeholder={status?.configured ? 'Leave blank to keep the saved secret' : ''}
            />
          </label>
          <button
            type="button"
            disabled={busy || !status?.secureStorage}
            onClick={() => action('setup')}
          >
            Save IT setup
          </button>
        </details>
      </section>
    </div>
  );
}
