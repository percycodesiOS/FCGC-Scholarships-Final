import type { Content } from '../lib/content';
import { isDeadlinePassed } from '../lib/security';

export default function Scholarship({
  data: d,
  preview = false,
}: {
  data: Content;
  preview?: boolean;
}) {
  const annual = (text: string) => text.replaceAll('{year}', d.year);
  const deadlinePassed = isDeadlinePassed(d.deadlineIso, d.autoCloseAtDeadline);
  const closed = !d.submissionOpen || deadlinePassed;
  const topBanner = closed ? d.closedNotice || d.notice : d.notice;

  // Format Mom's editable mailing address cleanly for the footer so editing Contact & Delivery stays in sync.
  const addressLines = d.address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const footerAddress =
    addressLines.length > 1
      ? addressLines.slice(1).join(' · ')
      : addressLines[0] || '426 Fox Chapel Road · Pittsburgh, PA 15238';

  return (
    <div className="site-shell">
      <div className={closed ? 'review-strip review-strip-closed' : 'review-strip'}>{topBanner}</div>
      <header className="site-header">
        <a className="wordmark" href="/">
          <img src="/fcgc-crest.gif" alt="Fox Chapel Golf Club crest" />
          <span>
            FOX CHAPEL GOLF CLUB
            <small>SCHOLARSHIP FOUNDATION</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#eligibility">Eligibility</a>
          <a href="#prepare">How to apply</a>
          <a href="#questions">Questions</a>
          <a className="nav-apply" href="#begin">
            Application guide ↗
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">THE {d.year} SCHOLARSHIP PROGRAM</p>
            <h1>
              <span>A strong foundation.</span>
              <span>A brighter next chapter.</span>
            </h1>
            <p className="hero-intro">{d.intro}</p>
            <a className="button light" href="#begin">
              Start with the application guide <span>↗</span>
            </a>
            <p className="hero-note">A community invested in your future.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="crest-panel">
              <p>FOX CHAPEL</p>
              <img src="/fcgc-crest.gif" alt="" />
              <span>GOLF CLUB</span>
              <div className="art-rule" />
              <small>SCHOLARSHIP FOUNDATION</small>
            </div>
            <span className="art-caption">ROOTED IN COMMUNITY. LOOKING AHEAD.</span>
          </div>
        </section>
        <section className="deadline-bar" aria-label="Application deadline">
          <div>
            <span className="eyebrow">
              {closed ? 'SUBMISSION STATUS · CLOSED' : 'MARK YOUR CALENDAR · SUBMISSION DEADLINE'}
            </span>
            <h2>{d.deadline}</h2>
          </div>
          <p>
            {closed
              ? d.closedNotice || 'Online applications are currently closed.'
              : 'Complete application and required materials must arrive by the deadline.'}
          </p>
        </section>
        <section id="eligibility" className="section eligibility">
          <div>
            <p className="eyebrow">AN OPPORTUNITY TO GROW</p>
            <h2>
              For the people who
              <br />
              make our Club community.
            </h2>
            <p className="foundation-mission">{d.headline.replace(/\s*\n\s*/g, ' ')}</p>
            <p>{d.welcome}</p>
            <p className="fine">
              This is a scholarship, not an employee bonus. Applying does not guarantee an interview or an award.
            </p>
          </div>
          <div className="eligibility-list">
            <h3 className="eligibility-label">Eligibility requirements</h3>
            <ol>
              {d.eligibility.map((item, i) => (
                <li key={i}>
                  <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <p>{annual(item)}</p>
                </li>
              ))}
            </ol>
            <a className="text-link" href="/apply/index.html">
              Open the current application ↗
            </a>
          </div>
        </section>
        <section id="begin" className="application-band">
          <div>
            <p className="eyebrow">ONE CLEAR PLACE TO BEGIN</p>
            <h2>
              Your application,
              <br />
              at your own pace.
            </h2>
            <p>
              Read the instructions, gather your materials, and complete the current application. Keep a copy for your
              records.
            </p>
          </div>
          <div className="application-options">
            <a className="button light application-primary" href="/apply/index.html">
              <span>
                {closed ? `View the ${d.year} application (closed)` : `Complete the ${d.year} application`}
              </span>
              <span aria-hidden="true">↗</span>
            </a>
            <p className="application-support">Save progress, calculate totals, sign, and download your PDF</p>
            <a className="application-download" href="/apply/index.html#cover-letter">
              Read the cover letter
              <span aria-hidden="true">↗</span>
            </a>
            <p className="application-download-note">
              Complete the application on this website, then keep a PDF copy.
            </p>
            <p className="privacy-note">
              Save progress on your own device. Submit sends the completed PDF and selected documents to the recipients
              shown on the form; downloading alone does not submit it.
            </p>
          </div>
        </section>
        <section id="prepare" className="section prepare">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A LITTLE PREPARATION GOES A LONG WAY</p>
              <h2>
                From first step
                <br />
                to finished packet.
              </h2>
            </div>
            <p>
              Give yourself time to gather documents and request a recommendation. Use this checklist before you submit.
            </p>
          </div>
          <div className="process-grid">
            <article className="process-intro">
              <span className="step-label">01 / GATHER</span>
              <h3>Bring the pieces together.</h3>
              <p>
                Complete the six sections and include the required documents. Explain pending aid or missing documents
                in the application.
              </p>
              <p>
                Email your digital photo separately to <a href={'mailto:' + d.photoEmail}>{d.photoEmail}</a>.
              </p>
            </article>
            <ul className="requirements">
              {d.requirements.map((item, i) => (
                <li key={i}>
                  <span aria-hidden="true">✓</span>
                  {annual(item)}
                </li>
              ))}
            </ul>
          </div>
          <div className="finish-grid">
            <article>
              <span className="step-label">02 / REVIEW</span>
              <h3>Check the details.</h3>
              <p>
                Use one full academic year and the same school for all costs and aid. Review the totals, signatures, and
                attachments. Keep original digitally signed documents separate.
              </p>
            </article>
            <article>
              <span className="step-label">03 / DELIVER</span>
              <h3>Make it official.</h3>
              <p>
                Complete and sign the application on this website, review your packet and choose Submit. Keep a PDF copy
                for your records.
              </p>
              <a href={'mailto:' + d.submissionRecipients[0]}>{d.submissionRecipients[0]}</a>
            </article>
          </div>
        </section>
        <section id="questions" className="questions">
          <div>
            <p className="eyebrow">WE’RE HERE TO HELP</p>
            <h2>
              A question before
              <br />
              your next step?
            </h2>
          </div>
          <div>
            <p>Contact the Club Front Office or the Scholarship Foundation.</p>
            <a href={'mailto:' + d.email}>{d.email}</a>
            <a href={'tel:' + d.phone.replace(/[^+\d]/g, '')}>{d.phone}</a>
            <p className="fine">
              Applications are completed and submitted on this website. Contact us if you need help using the form.
            </p>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div>
          <strong>
            Fox Chapel Golf Club
            <br />
            Scholarship Foundation, Inc.
          </strong>
          <p>{footerAddress}</p>
        </div>
        <div>
          <small>
            {preview
              ? 'Unsaved preview'
              : d.updatedAt
                ? 'Page updated ' + new Date(d.updatedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
                : d.year + ' scholarship application'}
          </small>
        </div>
        <p className="registration">
          Official registration and financial information may be obtained from the Pennsylvania Department of State at
          1-800-732-0999 (within PA). Registration does not imply endorsement.
        </p>
      </footer>
    </div>
  );
}
