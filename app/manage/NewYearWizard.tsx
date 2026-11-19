'use client';
import { useState } from 'react';
import type { Content } from '../../lib/content';

function formatLocalEastern(wallIso: string): string {
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

export default function NewYearWizard({
  current,
  onApplyDraft,
}: {
  current: Content;
  onApplyDraft: (next: Content, openPreview: boolean) => void;
}) {
  const currentYearNum = Number(current.year) || 2027;
  const [step, setStep] = useState(1);
  const [nextYear, setNextYear] = useState(String(currentYearNum + 1));
  const [deadlineDate, setDeadlineDate] = useState(`${currentYearNum + 1}-06-16`);
  const [deadlineTime, setDeadlineTime] = useState('16:30');
  const [autoClose, setAutoClose] = useState(true);
  const [eligibility, setEligibility] = useState<string[]>(() =>
    current.eligibility.map((item) =>
      item
        .replaceAll(String(currentYearNum), String(currentYearNum + 1))
        .replaceAll(String(currentYearNum - 1), String(currentYearNum)),
    ),
  );
  const [requirements, setRequirements] = useState<string[]>(() =>
    current.requirements.map((item) => item.replaceAll(String(currentYearNum), String(currentYearNum + 1))),
  );
  const [coverChecked, setCoverChecked] = useState(false);

  const wallIso = `${deadlineDate}T${deadlineTime}`;
  const formattedDeadline = formatLocalEastern(wallIso) || `Friday, June 16, ${nextYear} · 4:30 p.m. EDT`;

  function syncYearSuggestions(targetYear: string) {
    setNextYear(targetYear);
    if (/^20\d{2}$/.test(targetYear)) {
      const targetNum = Number(targetYear);
      setDeadlineDate((prev) => `${targetYear}${prev.slice(4)}`);
      setEligibility(
        current.eligibility.map((item) =>
          item
            .replaceAll(String(currentYearNum), String(targetNum))
            .replaceAll(String(currentYearNum - 1), String(targetNum - 1)),
        ),
      );
      setRequirements(
        current.requirements.map((item) => item.replaceAll(String(currentYearNum), String(targetNum))),
      );
    }
  }

  function finish(openPreview: boolean) {
    const updated: Content = {
      ...current,
      year: nextYear,
      deadline: formattedDeadline,
      deadlineIso: wallIso,
      autoCloseAtDeadline: autoClose,
      notice: `${nextYear} scholarship applications are open.`,
      closedNotice: `The ${nextYear} scholarship application deadline has passed. Thank you to everyone who applied.`,
      eligibility: eligibility.map((x) => x.trim()).filter(Boolean),
      requirements: requirements.map((x) => x.trim()).filter(Boolean),
      submissionOpen: true,
    };
    onApplyDraft(updated, openPreview);
  }

  return (
    <section className="editor-section v2-wizard">
      <p className="eyebrow">GUIDED ANNUAL ROLLOVER · NO CODING NEEDED</p>
      <h2>Set up a new scholarship year in 4 quick steps</h2>
      <p className="v2-lead">
        This walkthrough prepares an <strong>unsaved draft</strong> for the new year so you can preview everything
        before anything changes on the live website.
      </p>

      <ol className="v2-steps-bar" aria-label="Wizard progress">
        {['1. Year & deadline', '2. Review old dates', '3. Cover letter check', '4. Preview draft'].map(
          (label, idx) => (
            <li key={label} className={step === idx + 1 ? 'active' : step > idx + 1 ? 'done' : ''}>
              <button type="button" onClick={() => setStep(idx + 1)}>
                {label}
              </button>
            </li>
          ),
        )}
      </ol>

      {step === 1 && (
        <div className="v2-wizard-body">
          <h3>Step 1: Pick the new scholarship year and deadline</h3>
          <div className="v2-two-col">
            <label className="editor-field">
              New scholarship year
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={nextYear}
                onChange={(e) => syncYearSuggestions(e.target.value)}
              />
            </label>
            <label className="editor-field">
              Deadline date
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
              />
            </label>
            <label className="editor-field">
              Deadline time (Eastern Time)
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
            />
            <span>
              <strong>Automatically close online submissions</strong> at this exact date and time (no need to rush to a
              computer at 4:30 p.m.!)
            </span>
          </label>
          <p className="v2-callout v2-callout-ok">
            <strong>How the website & PDF will display this deadline:</strong> {formattedDeadline}
          </p>
          <div className="v2-button-row">
            <button type="button" onClick={() => setStep(2)}>
              Next: Check old dates →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="v2-wizard-body">
          <h3>Step 2: Review automatically updated dates in Eligibility & Checklist</h3>
          <p>
            We automatically shifted <strong>{currentYearNum} → {nextYear}</strong> and{' '}
            <strong>{currentYearNum - 1} → {Number(nextYear) - 1}</strong> in your policy wording below. Read each
            card and adjust anything the committee changed.
          </p>
          <h4>Eligibility rules ({eligibility.length})</h4>
          {eligibility.map((item, index) => (
            <label className="editor-field" key={`e-${index}`}>
              Eligibility item {index + 1}
              <textarea
                rows={2}
                value={item}
                onChange={(e) => {
                  const copy = [...eligibility];
                  copy[index] = e.target.value;
                  setEligibility(copy);
                }}
              />
            </label>
          ))}
          <h4>Required checklist ({requirements.length})</h4>
          {requirements.map((item, index) => (
            <label className="editor-field" key={`r-${index}`}>
              Checklist item {index + 1}
              <textarea
                rows={2}
                value={item}
                onChange={(e) => {
                  const copy = [...requirements];
                  copy[index] = e.target.value;
                  setRequirements(copy);
                }}
              />
            </label>
          ))}
          <div className="v2-button-row">
            <button type="button" className="secondary" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button type="button" onClick={() => setStep(3)}>
              Next: Cover letter reminder →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="v2-wizard-body">
          <h3>Step 3: One important check outside this admin panel</h3>
          <div className="editor-warning">
            <p>
              <strong>What updates automatically when you save:</strong> The homepage, the online application form, the
              5-page application PDF, the deadline, and the automatic close clock.
            </p>
            <p>
              <strong>What stays locked until separately reviewed:</strong> The official 2-page Foundation Cover Letter
              PDF (with the green Club stripe and PA disclosure). Because it is an approved official letter, the website
              never rewrites it automatically. Before giving out the {nextYear} link, update the Word master in the
              shared folder and replace the cover letter PDF if the dates or rules changed.
            </p>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={coverChecked}
              onChange={(e) => setCoverChecked(e.target.checked)}
            />
            <span>
              I understand that I should review the official 2-page cover letter and test a blank PDF before sharing the{' '}
              {nextYear} link with employees.
            </span>
          </label>
          <div className="v2-button-row">
            <button type="button" className="secondary" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button type="button" disabled={!coverChecked} onClick={() => setStep(4)}>
              Next: Ready to preview →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="v2-wizard-body">
          <h3>Step 4: Load your {nextYear} draft and preview it</h3>
          <p>
            Nothing goes live yet. Clicking the button below loads all your {nextYear} updates into the editor and opens
            the full website preview so you can inspect every word before clicking <strong>Publish to website</strong>.
          </p>
          <ul className="v2-summary-list">
            <li>
              <strong>Year:</strong> {nextYear}
            </li>
            <li>
              <strong>Deadline:</strong> {formattedDeadline}
            </li>
            <li>
              <strong>Auto-close at deadline:</strong> {autoClose ? 'ON (automatic)' : 'OFF (manual)'}
            </li>
            <li>
              <strong>Eligibility items:</strong> {eligibility.filter((x) => x.trim()).length}
            </li>
            <li>
              <strong>Checklist items:</strong> {requirements.filter((x) => x.trim()).length}
            </li>
          </ul>
          <div className="v2-button-row">
            <button type="button" className="secondary" onClick={() => setStep(3)}>
              ← Back
            </button>
            <button type="button" onClick={() => finish(true)}>
              Load {nextYear} draft & open preview
            </button>
            <button type="button" className="secondary" onClick={() => finish(false)}>
              Load draft into editor
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
