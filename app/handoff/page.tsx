import { redirect } from 'next/navigation';
import { editorUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function Handoff() {
  if (!(await editorUser())) redirect('/manage');
  return (
    <main className="guide">
      <a className="text-link" href="/manage">
        ← Back to Manage scholarship
      </a>
      <p className="eyebrow">FOR OFFICIAL ADMIN USE ONLY</p>
      <h1>
        Keep the scholarship
        <br />
        ready for the next year.
      </h1>

      <h2>1. Start a new scholarship year (4-step wizard)</h2>
      <ol>
        <li>
          Open <a href="/manage">Manage scholarship</a> and sign in with your authorized Club Office 365 account.
        </li>
        <li>
          Click the <strong>New year wizard</strong> tab. Pick the new year, deadline date, and Eastern Time cutoff.
        </li>
        <li>
          Review the automatically updated dates in Eligibility and Checklist, then preview the website and click{' '}
          <strong>Publish changes</strong>.
        </li>
        <li>
          If the official 2-page Foundation Cover Letter changed, upload the new PDF under{' '}
          <strong>Edit website → Contact details &amp; application recipients → Official 2-Page Cover Letter PDF</strong>.
        </li>
      </ol>

      <h2>2. Choose who receives completed applications</h2>
      <p>
        Under <strong>Edit website → Where completed applications are emailed</strong>, add or remove recipient email
        chips (up to 5). The first address is the primary Foundation mailbox (
        <code>scholarshipfoundation@foxchapelgolfclub.com</code>).
      </p>

      <h2>3. Check or reconnect the Office 365 sending mailbox</h2>
      <p>
        Open the <strong>Email &amp; submissions</strong> tab to check mailbox health, look up any student Reference ID,
        or reconnect Outlook if Microsoft ever requests a fresh sign-in. Sign in with{' '}
        <code>jmacek@foxchapelgolfclub.com</code> to authorize sending from the shared Scholarship Foundation mailbox.
      </p>

      <h2>4. What students experience &amp; what arrives in Outlook</h2>
      <p>
        Students read and scroll through both pages of the cover letter, complete Sections 1 through 6 (with automatic
        browser saving, formatted dates/phone/GPA, bulleted lists, and auto-calculated financial totals), upload their
        JPG/PNG applicant photo and supporting PDFs, sign electronically, and preview their complete packet before
        clicking Submit.
      </p>
      <p>
        Each submission delivers one print-ready PDF (Applicant Photo on Page 1, personalized cover letter, completed
        application, and supporting documents at the back) plus a separate standalone <code>.jpg</code> portrait to the
        Foundation inbox, and sends a confirmation receipt to the student’s chosen confirmation email.
      </p>
      <p>
        For applicant privacy, completed PDFs and student names are never stored on the website server. Only anonymous
        delivery receipts are retained so you can verify a student’s Reference ID.
      </p>

      <h2>5. Committee showcase, 1-click Undo &amp; backups</h2>
      <p>
        Open the <strong>Committee showcase &amp; backups</strong> tab anytime to print the 1-page Committee Fact Sheet,
        restore an earlier version with 1-click Undo, or download a settings backup or full website package. Exports
        never include secrets or student applications.
      </p>

      <div className="guide-downloads">
        <a className="button" href="/api/package" download>
          Download website package ↗
        </a>
        <a className="button secondary" href="/api/backup">
          Download current content backup
        </a>
      </div>
    </main>
  );
}
