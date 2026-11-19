'use client';
import type { Content } from '../../lib/content';

export default function CommitteeSheet({ data }: { data: Content }) {
  return (
    <section className="editor-section v2-committee-sheet">
      <div className="v2-section-head">
        <div>
          <p className="eyebrow">READY FOR KENT &amp; THE SCHOLARSHIP COMMITTEE</p>
          <h2>Security, Privacy &amp; Maintenance Fact Sheet</h2>
        </div>
        <button type="button" className="secondary" onClick={() => window.print()}>
          Print 1-page summary
        </button>
      </div>

      <p className="v2-lead">
        Hand this summary to Club leadership, committee members, or Club IT (Norman Alan) to show how applicant data is
        protected and how easily the Foundation maintains the site without coding.
      </p>

      <div className="v2-fact-grid">
        <article className="v2-fact-card">
          <h3>1. Zero Applicant Data Stored on the Server</h3>
          <p>
            Student essays, FAFSA pages, financial totals, and signatures stay exclusively on the applicant’s own device
            until they click Submit. Submitted PDFs go directly into the Foundation’s Microsoft 365 mailbox and are
            never stored in website cloud storage.
          </p>
        </article>
        <article className="v2-fact-card">
          <h3>2. Club-Controlled Microsoft 365 Delivery</h3>
          <p>
            Applications are delivered through the Club’s own Microsoft Entra app using delegated Send-As permission for{' '}
            <code>{data.submissionRecipients[0]}</code>. No Foundation password is shared, and Club IT can revoke access
            in one click at any time.
          </p>
        </article>
        <article className="v2-fact-card">
          <h3>3. Bank-Grade Encryption &amp; Anti-Abuse Protections</h3>
          <p>
            OAuth credentials are encrypted with HKDF-derived AES-256-GCM. Every submission is protected by strict CSP &amp;
            anti-clickjacking headers, Fetch Metadata isolation, single-use signed tokens, PDF active-content scanning
            (blocking embedded JavaScript/Launch attacks), and 3-layer daily rate limits.
          </p>
        </article>
        <article className="v2-fact-card">
          <h3>4. Automatic Deadline Cutoff &amp; Zero-Code Maintenance</h3>
          <p>
            The Foundation administrator updates dates, eligibility, checklist items, and recipients from a protected
            visual console with built-in New Year rollover, 1-click Undo history, automatic Eastern Time deadline
            closing, and downloadable full backups (zero vendor lock-in).
          </p>
        </article>
      </div>
    </section>
  );
}
