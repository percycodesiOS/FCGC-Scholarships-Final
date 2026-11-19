'use client';
import { useEffect, useRef, useState } from 'react';
import { describeContentChanges, type Content, validate } from '../../lib/content';
import type { AuditEntry } from '../../lib/store';
import Scholarship from '../Scholarship';
import CommitteeSheet from './CommitteeSheet';
import EmailDelivery from './EmailDelivery';
import NewYearWizard from './NewYearWizard';

type TabId = 'overview' | 'edit' | 'wizard' | 'email' | 'safety';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'At a glance' },
  { id: 'edit', label: 'Edit website' },
  { id: 'wizard', label: 'New year wizard' },
  { id: 'email', label: 'Email & submissions' },
  { id: 'safety', label: 'Safety net & committee' },
];

function formatEasternPreview(wallIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wallIso);
  if (!match) return '';
  const [, y, m, d, hh, mm] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, hh + 4, mm));
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const hour12 = hh % 12 || 12;
  const period = hh >= 12 ? 'p.m.' : 'a.m.';
  const isDst = m >= 4 && m <= 10;
  return `${dayStr} · ${hour12}:${String(mm).padStart(2, '0')} ${period} ${isDst ? 'EDT' : 'EST'}`;
}

export default function Manager({ initial, name }: { initial: Content; name: string }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [data, setData] = useState<Content>(initial);
  const [saved, setSaved] = useState<Content>(initial);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'ok' | 'err'>('ok');
  const [checked, setChecked] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [mailConnected, setMailConnected] = useState<boolean | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);

  const confirmDialogRef = useRef<HTMLDialogElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const changes = describeContentChanges(saved, data);
  const dirty = changes.length > 0;
  const changedPolicy = ['year', 'deadline', 'submissionRecipients', 'eligibility', 'requirements'].some(
    (k) => JSON.stringify(data[k as keyof Content]) !== JSON.stringify(saved[k as keyof Content]),
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function loadDashboardMetadata() {
    const [mailRes, histRes] = await Promise.all([
      fetch('/api/mail', { cache: 'no-store' }),
      fetch('/api/history', { cache: 'no-store' }),
    ]);
    if (mailRes.ok) {
      const m = (await mailRes.json()) as { connected?: boolean };
      setMailConnected(!!m.connected);
    }
    if (histRes.ok) {
      const h = (await histRes.json()) as { entries?: AuditEntry[] };
      setHistory(h.entries || []);
    }
  }

  useEffect(() => {
    void loadDashboardMetadata();
  }, []);

  function downloadJson(value: unknown, file: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function requestSaveConfirmation() {
    setMessage('');
    try {
      validate(data);
      if (changedPolicy && !checked) {
        throw new Error(
          'Before saving policy or date changes, check the confirmation box under Eligibility & Checklist (or inside the Review dialog).',
        );
      }
      confirmDialogRef.current?.showModal();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Please check your entries before saving.');
      setMessageKind('err');
    }
  }

  async function commitSave() {
    setMessage('');
    setBusy(true);
    try {
      const clean = validate(data);
      const response = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...clean, revision: saved.revision }),
      });
      const value = (await response.json()) as Content & { error?: string };
      if (!response.ok) throw new Error(value.error || 'The save did not complete.');
      setData(value);
      setSaved(value);
      setChecked(false);
      setMessage('Published to the live website! Open the homepage in a new tab to verify.');
      setMessageKind('ok');
      void loadDashboardMetadata();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The save did not complete.');
      setMessageKind('err');
    } finally {
      setBusy(false);
    }
  }

  async function restoreFromHistory(revision: string) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, action: 'preview' }),
      });
      const body = (await res.json()) as { snapshot?: Content; error?: string };
      if (!res.ok || !body.snapshot) throw new Error(body.error || 'Could not load that older version.');
      setData({ ...body.snapshot, revision: saved.revision, updatedAt: saved.updatedAt });
      setChecked(false);
      setTab('edit');
      setPreview(true);
      setMessage('Loaded that earlier version as an unsaved preview. Click "Publish changes" if you want to restore it.');
      setMessageKind('ok');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load that version.');
      setMessageKind('err');
    } finally {
      setBusy(false);
    }
  }

  async function restoreFromFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 50000) throw new Error('Choose a small content backup JSON file.');
      const input = JSON.parse(await file.text());
      const restored = validate(input.content || input);
      setData({ ...restored, revision: saved.revision, updatedAt: saved.updatedAt });
      setChecked(false);
      setTab('edit');
      setMessage('Backup loaded as an unsaved draft. Preview and publish when ready.');
      setMessageKind('ok');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not open this backup file.');
      setMessageKind('err');
    }
  }

  function updateListItem(key: 'eligibility' | 'requirements', index: number, value: string) {
    setData((cur) => {
      const copy = [...cur[key]];
      copy[index] = value;
      return { ...cur, [key]: copy };
    });
  }

  function moveListItem(key: 'eligibility' | 'requirements', index: number, delta: -1 | 1) {
    setData((cur) => {
      const target = index + delta;
      if (target < 0 || target >= cur[key].length) return cur;
      const copy = [...cur[key]];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return { ...cur, [key]: copy };
    });
  }

  function removeListItem(key: 'eligibility' | 'requirements', index: number) {
    setData((cur) => {
      if (cur[key].length <= 1) return cur;
      return { ...cur, [key]: cur[key].filter((_, i) => i !== index) };
    });
  }

  function addListItem(key: 'eligibility' | 'requirements') {
    setData((cur) => {
      if (cur[key].length >= 20) return cur;
      return { ...cur, [key]: [...cur[key], ''] };
    });
  }

  function addRecipient() {
    const email = newRecipient.trim().toLowerCase();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) {
      setMessage('Enter a valid email address before clicking Add.');
      setMessageKind('err');
      return;
    }
    if (data.submissionRecipients.length >= 5) return;
    setData((cur) => ({
      ...cur,
      submissionRecipients: [...new Set([...cur.submissionRecipients, email])],
    }));
    setNewRecipient('');
    setMessage('');
  }

  function handleTabKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const nextIdx =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? TABS.length - 1
          : (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[nextIdx].id);
    setPreview(false);
    tabRefs.current[nextIdx]?.focus();
  }

  const deadlineParts = (data.deadlineIso || `${data.year}-06-18T16:30`).split('T');
  const deadlineDateVal = deadlineParts[0] || `${data.year}-06-18`;
  const deadlineTimeVal = deadlineParts[1] || '16:30';

  function updateDeadlinePicker(nextDate: string, nextTime: string) {
    const iso = `${nextDate}T${nextTime}`;
    const pretty = formatEasternPreview(iso);
    setData((cur) => ({
      ...cur,
      deadlineIso: iso,
      ...(pretty ? { deadline: pretty } : {}),
    }));
  }

  return (
    <div className="manager">
      <header className="manager-top">
        <a href="/" target="_blank" rel="noopener">
          ← View live website
        </a>
        <span>Signed in as {name}</span>
        <a href="/signout-with-chatgpt?return_to=/" target="_top">
          Sign out
        </a>
      </header>

      <div className="manager-title">
        <div>
          <p className="eyebrow">FOX CHAPEL SCHOLARSHIP FOUNDATION · OWNER CONTROL CENTER</p>
          <h1>Manage scholarship</h1>
          <p>No coding or AI needed. Choose a task below, preview your changes, and publish when ready.</p>
        </div>
        <a className="text-link" href="/handoff">
          Owner guide ↗
        </a>
      </div>

      <div className="editor-actions">
        <span className={dirty ? 'unsaved' : 'saved'}>
          {dirty
            ? `● ${changes.length} unsaved ${changes.length === 1 ? 'change' : 'changes'}`
            : saved.updatedAt
              ? '✓ All saved · ' +
                new Date(saved.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) +
                ' ET'
              : '✓ Original reviewed content'}
        </span>
        <div>
          {dirty && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setData(saved);
                setChecked(false);
                setMessage('Discarded unsaved edits.');
                setMessageKind('ok');
              }}
            >
              Discard draft
            </button>
          )}
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setPreview(!preview)}
          >
            {preview ? 'Back to console' : 'Preview website'}
          </button>
          <button type="button" onClick={requestSaveConfirmation} disabled={busy || !dirty}>
            {busy ? 'Publishing…' : 'Publish changes'}
          </button>
        </div>
      </div>

      {message && (
        <p className={`v2-callout v2-callout-${messageKind}`} role="status">
          {message}
        </p>
      )}

      {!preview && (
        <div className="v2-tablist" role="tablist" aria-label="Manage scholarship sections">
          {TABS.map((item, idx) => (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {preview ? (
        <div className="preview-frame">
          <p className="preview-label">
            LIVE PREVIEW — Visitors do not see these changes until you click “Publish changes”.
          </p>
          <Scholarship data={data} preview />
        </div>
      ) : (
        <fieldset disabled={busy} className="edit-lock">
          {tab === 'overview' && (
            <div role="tabpanel" aria-labelledby="tab-overview" className="v2-panel">
              <div className="v2-status-grid">
                <article className="v2-status-card">
                  <span className={data.submissionOpen ? 'v2-pill ok' : 'v2-pill warn'}>
                    {data.submissionOpen ? '● Open for applications' : '● Closed / Paused'}
                  </span>
                  <h3>{data.year} Scholarship Cycle</h3>
                  <p>
                    <strong>Deadline:</strong> {data.deadline}
                  </p>
                  <p className="fine">
                    {data.autoCloseAtDeadline && data.deadlineIso
                      ? `Automatic cutoff ON (${data.deadlineIso.replace('T', ' ')} ET).`
                      : 'Automatic cutoff OFF (manual close only).'}
                  </p>
                  <label className="v2-big-toggle">
                    <input
                      type="checkbox"
                      checked={data.submissionOpen}
                      onChange={(e) =>
                        setData((cur) => ({ ...cur, submissionOpen: e.target.checked }))
                      }
                    />
                    <span>
                      {data.submissionOpen
                        ? 'Accepting online applications'
                        : 'Applications paused (turn on to reopen)'}
                    </span>
                  </label>
                </article>

                <article className="v2-status-card">
                  <span className={mailConnected ? 'v2-pill ok' : 'v2-pill warn'}>
                    {mailConnected === null
                      ? 'Checking mailbox…'
                      : mailConnected
                        ? '● Microsoft mailbox connected'
                        : '● Mailbox needs connection'}
                  </span>
                  <h3>Delivery Destination</h3>
                  <p>
                    <strong>Inbox:</strong> {data.submissionRecipients.join(', ')}
                  </p>
                  <p className="fine">Student PDFs go directly to Outlook and are never stored on the server.</p>
                  <button type="button" className="secondary" onClick={() => setTab('email')}>
                    Check connection &amp; verify receipts
                  </button>
                </article>

                <article className="v2-status-card">
                  <span className="v2-pill ok">● Security active</span>
                  <h3>Protected &amp; Committee-Ready</h3>
                  <p>
                    CSP &amp; anti-clickjacking headers, HKDF AES-256-GCM encryption, PDF script scanner, and 3-layer
                    rate limits are enforced.
                  </p>
                  <button type="button" className="secondary" onClick={() => setTab('safety')}>
                    Open printable committee sheet
                  </button>
                </article>
              </div>

              <section className="editor-section">
                <h2>What would you like to do today?</h2>
                <div className="v2-action-cards">
                  <button type="button" className="v2-action-tile" onClick={() => setTab('wizard')}>
                    <strong>Start a new scholarship year</strong>
                    <span>
                      Step-by-step wizard updates the year, deadline, auto-close clock, and old dates automatically.
                    </span>
                  </button>
                  <button type="button" className="v2-action-tile" onClick={() => setTab('edit')}>
                    <strong>Edit wording, dates, or checklist</strong>
                    <span>Clean visual cards for eligibility, checklist bullets, phone number, and contact emails.</span>
                  </button>
                  <button type="button" className="v2-action-tile" onClick={() => setTab('email')}>
                    <strong>Verify a student’s submission</strong>
                    <span>Look up any Reference ID in 1 second or test the Microsoft Outlook connection.</span>
                  </button>
                  <a
                    className="v2-action-tile"
                    href="/apply/index.html"
                    target="_blank"
                    rel="noopener"
                  >
                    <strong>Open live student application ↗</strong>
                    <span>Walk Kent and the committee through the cover letter, auto-totals, and Review PDF modal.</span>
                  </a>
                </div>
              </section>
            </div>
          )}

          {tab === 'edit' && (
            <div role="tabpanel" aria-labelledby="tab-edit" className="v2-panel">
              <section className="editor-section">
                <h2>1. Year, deadline &amp; automatic cutoff</h2>
                <div className="v2-two-col">
                  <label className="editor-field">
                    Application year
                    <input
                      value={data.year}
                      maxLength={4}
                      onChange={(e) => setData((cur) => ({ ...cur, year: e.target.value }))}
                    />
                  </label>
                  <label className="editor-field">
                    Automatic close date
                    <input
                      type="date"
                      value={deadlineDateVal}
                      onChange={(e) => updateDeadlinePicker(e.target.value, deadlineTimeVal)}
                    />
                  </label>
                  <label className="editor-field">
                    Automatic close time (Eastern Time)
                    <input
                      type="time"
                      value={deadlineTimeVal}
                      onChange={(e) => updateDeadlinePicker(deadlineDateVal, e.target.value)}
                    />
                  </label>
                </div>

                <label className="editor-field">
                  Displayed deadline wording (appears on homepage, form, and PDF)
                  <input
                    value={data.deadline}
                    maxLength={120}
                    onChange={(e) => setData((cur) => ({ ...cur, deadline: e.target.value }))}
                  />
                </label>

                <label className="check">
                  <input
                    type="checkbox"
                    checked={data.autoCloseAtDeadline}
                    onChange={(e) =>
                      setData((cur) => ({ ...cur, autoCloseAtDeadline: e.target.checked }))
                    }
                  />
                  <span>Automatically close online submissions when the Eastern Time deadline passes</span>
                </label>

                <label className="editor-field">
                  Top banner while applications are open
                  <input
                    value={data.notice}
                    maxLength={300}
                    onChange={(e) => setData((cur) => ({ ...cur, notice: e.target.value }))}
                  />
                </label>

                <label className="editor-field">
                  Top banner after deadline / while closed
                  <input
                    value={data.closedNotice}
                    maxLength={300}
                    onChange={(e) => setData((cur) => ({ ...cur, closedNotice: e.target.value }))}
                  />
                </label>
              </section>

              <section className="editor-section">
                <h2>2. Welcome wording</h2>
                <label className="editor-field">
                  Foundation mission tagline (below the main banner)
                  <input
                    value={data.headline}
                    onChange={(e) => setData((cur) => ({ ...cur, headline: e.target.value }))}
                  />
                </label>
                <label className="editor-field">
                  Short introduction
                  <textarea
                    rows={3}
                    value={data.intro}
                    onChange={(e) => setData((cur) => ({ ...cur, intro: e.target.value }))}
                  />
                </label>
                <label className="editor-field">
                  About the scholarship
                  <textarea
                    rows={3}
                    value={data.welcome}
                    onChange={(e) => setData((cur) => ({ ...cur, welcome: e.target.value }))}
                  />
                </label>
              </section>

              <section className="editor-section">
                <h2>3. Eligibility &amp; checklist (visual cards)</h2>
                <p className="fine">
                  Edit each bullet in its own card. Use Move Up, Move Down, or Add Item — blank lines are cleaned up
                  automatically.
                </p>

                <div className="v2-list-header">
                  <h3>Eligibility requirements</h3>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => addListItem('eligibility')}
                    disabled={data.eligibility.length >= 20}
                  >
                    + Add eligibility rule
                  </button>
                </div>
                <div className="v2-card-list">
                  {data.eligibility.map((item, idx) => (
                    <div className="v2-item-card" key={`el-${idx}`}>
                      <span className="v2-item-num">{String(idx + 1).padStart(2, '0')}</span>
                      <textarea
                        rows={2}
                        aria-label={`Eligibility rule ${idx + 1}`}
                        value={item}
                        onChange={(e) => updateListItem('eligibility', idx, e.target.value)}
                      />
                      <div className="v2-item-controls">
                        <button
                          type="button"
                          className="secondary"
                          aria-label={`Move eligibility rule ${idx + 1} up`}
                          disabled={idx === 0}
                          onClick={() => moveListItem('eligibility', idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          aria-label={`Move eligibility rule ${idx + 1} down`}
                          disabled={idx === data.eligibility.length - 1}
                          onClick={() => moveListItem('eligibility', idx, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="secondary v2-danger-outline"
                          aria-label={`Remove eligibility rule ${idx + 1}`}
                          disabled={data.eligibility.length <= 1}
                          onClick={() => removeListItem('eligibility', idx)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="v2-list-header">
                  <h3>Required documents checklist</h3>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => addListItem('requirements')}
                    disabled={data.requirements.length >= 20}
                  >
                    + Add checklist item
                  </button>
                </div>
                <div className="v2-card-list">
                  {data.requirements.map((item, idx) => (
                    <div className="v2-item-card" key={`req-${idx}`}>
                      <span className="v2-item-num">✓</span>
                      <textarea
                        rows={2}
                        aria-label={`Checklist item ${idx + 1}`}
                        value={item}
                        onChange={(e) => updateListItem('requirements', idx, e.target.value)}
                      />
                      <div className="v2-item-controls">
                        <button
                          type="button"
                          className="secondary"
                          aria-label={`Move checklist item ${idx + 1} up`}
                          disabled={idx === 0}
                          onClick={() => moveListItem('requirements', idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          aria-label={`Move checklist item ${idx + 1} down`}
                          disabled={idx === data.requirements.length - 1}
                          onClick={() => moveListItem('requirements', idx, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="secondary v2-danger-outline"
                          aria-label={`Remove checklist item ${idx + 1}`}
                          disabled={data.requirements.length <= 1}
                          onClick={() => removeListItem('requirements', idx)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {changedPolicy && (
                  <label className="check v2-policy-confirm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChecked(e.target.checked)}
                    />
                    <span>
                      I checked these date or policy changes against the approved cover letter and application PDF.
                    </span>
                  </label>
                )}
              </section>

              <section className="editor-section">
                <h2>4. Contact details &amp; application recipients</h2>
                <div className="v2-two-col">
                  <label className="editor-field">
                    Foundation contact email
                    <input
                      type="email"
                      value={data.email}
                      onChange={(e) => setData((cur) => ({ ...cur, email: e.target.value }))}
                    />
                  </label>
                  <label className="editor-field">
                    Front office phone
                    <input
                      value={data.phone}
                      onChange={(e) => setData((cur) => ({ ...cur, phone: e.target.value }))}
                    />
                  </label>
                  <label className="editor-field">
                    Digital photo email
                    <input
                      type="email"
                      value={data.photoEmail}
                      onChange={(e) => setData((cur) => ({ ...cur, photoEmail: e.target.value }))}
                    />
                  </label>
                </div>

                <label className="editor-field">
                  Foundation mailing address (automatically synced to the website footer)
                  <textarea
                    rows={3}
                    value={data.address}
                    onChange={(e) => setData((cur) => ({ ...cur, address: e.target.value }))}
                  />
                </label>

                <div className="v2-recipients-box">
                  <h3>Where completed applications are emailed</h3>
                  <ul className="v2-chips">
                    {data.submissionRecipients.map((addr, idx) => (
                      <li key={addr} className="v2-chip">
                        <span>
                          {addr} {idx === 0 && <small>(Primary)</small>}
                        </span>
                        {data.submissionRecipients.length > 1 && (
                          <button
                            type="button"
                            className="v2-chip-remove"
                            aria-label={`Remove ${addr}`}
                            onClick={() =>
                              setData((cur) => ({
                                ...cur,
                                submissionRecipients: cur.submissionRecipients.filter((x) => x !== addr),
                              }))
                            }
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {data.submissionRecipients.length < 5 && (
                    <div className="v2-inline-input">
                      <input
                        type="email"
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        placeholder="Add another committee email (optional)"
                      />
                      <button type="button" className="secondary" onClick={addRecipient}>
                        Add recipient
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === 'wizard' && (
            <div role="tabpanel" aria-labelledby="tab-wizard" className="v2-panel">
              <NewYearWizard
                current={data}
                onApplyDraft={(next, openPreview) => {
                  setData(next);
                  setChecked(false);
                  setTab('edit');
                  setPreview(openPreview);
                  setMessage(
                    `Loaded ${next.year} rollover draft. Review it carefully, then click "Publish changes" when ready.`,
                  );
                  setMessageKind('ok');
                }}
              />
            </div>
          )}

          {tab === 'email' && (
            <div role="tabpanel" aria-labelledby="tab-email" className="v2-panel">
              <EmailDelivery onStatusChange={(s) => setMailConnected(!!s?.connected)} />
            </div>
          )}

          {tab === 'safety' && (
            <div role="tabpanel" aria-labelledby="tab-safety" className="v2-panel v2-stack">
              <section className="editor-section">
                <p className="eyebrow">1-CLICK UNDO · RECENT SAVED VERSIONS</p>
                <h2>Version history</h2>
                <p>
                  Every time you publish a change, the website automatically keeps a snapshot of the previous version.
                  If you ever save a typo by mistake, restore an earlier version below.
                </p>
                {history.length === 0 ? (
                  <p className="fine">
                    No earlier edits recorded yet. Future saves will appear here with 1-click restore buttons.
                  </p>
                ) : (
                  <ol className="v2-history-list">
                    {history.map((entry) => (
                      <li key={entry.revision} className="v2-history-item">
                        <div>
                          <strong>
                            {new Date(entry.savedAt).toLocaleString('en-US', {
                              timeZone: 'America/New_York',
                            })}{' '}
                            ET
                          </strong>{' '}
                          <span className="fine">by {entry.savedBy}</span>
                          <ul>
                            {entry.summary.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => restoreFromHistory(entry.previousRevision)}
                        >
                          Preview version before this save
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="editor-section">
                <p className="eyebrow">PORTABILITY &amp; BACKUPS · YOU OWN EVERYTHING</p>
                <h2>Save a safety copy to your computer</h2>
                <p>
                  Download the current settings JSON or the entire self-contained website package at any time. Exports
                  never contain mailbox passwords, secrets, or student applications.
                </p>
                <div className="v2-button-row">
                  <a className="button" href="/api/backup">
                    Download saved settings backup
                  </a>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      downloadJson(
                        { format: 'fcgc-scholarship-content-v1', content: data },
                        'scholarship-unsaved-draft.json',
                      )
                    }
                  >
                    Download unsaved draft
                  </button>
                  <a className="button secondary" href="/api/package" download>
                    Download full website package ↗
                  </a>
                </div>
                <label className="restore-label">
                  Restore settings from a saved JSON backup file
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => restoreFromFile(e.target.files?.[0])}
                  />
                </label>
              </section>

              <CommitteeSheet data={data} />
            </div>
          )}
        </fieldset>
      )}

      {/* Native modal confirmation dialog (modern-web-guidance: no role/aria-modal, autofocus safe Cancel, reset returnValue) */}
      <dialog
        ref={confirmDialogRef}
        className="v2-confirm-dialog"
        aria-labelledby="v2-confirm-title"
        onClose={(e) => {
          const dialog = e.currentTarget;
          const choice = dialog.returnValue;
          dialog.returnValue = '';
          if (choice === 'publish') {
            void commitSave();
          }
        }}
      >
        <div className="v2-confirm-inner">
          <p className="eyebrow">FINAL CHECK BEFORE PUBLISHING</p>
          <h2 id="v2-confirm-title">Publish these changes to the live website?</h2>
          <p>Here is a summary of what will update right away (a safety copy of the old version is saved automatically):</p>
          <ul className="v2-summary-list">
            {changes.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
          <form method="dialog" className="v2-confirm-actions">
            <button type="submit" value="cancel" className="secondary" autoFocus>
              Cancel &amp; keep editing
            </button>
            <button type="submit" value="publish">
              Yes, publish now
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
