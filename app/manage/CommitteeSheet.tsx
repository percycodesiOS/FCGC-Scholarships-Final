'use client';
import type { Content } from '../../lib/content';

export default function CommitteeSheet({ data }: { data: Content }) {
  return (
    <section className="editor-section v2-committee-sheet">
      <div className="v2-section-head">
        <div>
          <p className="eyebrow">READY FOR KENT &amp; THE SCHOLARSHIP COMMITTEE</p>
          <h2>{data.year} Scholarship Program Overview &amp; Committee Fact Sheet</h2>
        </div>
        <button type="button" onClick={() => window.print()}>
          Print committee summary
        </button>
      </div>

      <p className="v2-lead">
        Share or print this overview for Club leadership, committee members, and Club IT (Norman Alan). It highlights
        every improvement made to streamline applications for students, keep committee packets consistent and ready to
        print, protect applicant privacy, and run the program year after year with zero coding.
      </p>

      <div className="v2-fact-grid">
        <article className="v2-fact-card">
          <h3>1. Live on the Club Website</h3>
          <p>
            Embedded directly at <code>foxchapelgolfclub.org/scholarships</code> in Fox Chapel Golf Club’s green, cream,
            and gold styling. Applicants see the current deadline ({data.deadline}), eligibility requirements, required
            document checklist, one clear application button, and clearly labeled Foundation Email and Club Front Office
            contacts.
          </p>
        </article>

        <article className="v2-fact-card">
          <h3>2. Scroll-to-Unlock Official Cover Letter</h3>
          <p>
            Before starting the form, every applicant must scroll through both pages of the official {data.year}{' '}
            Foundation Cover Letter. Reaching the end of page two unlocks the printable PDF link and two mandatory
            acknowledgment boxes (Cover Letter + Eligibility Requirements).
          </p>
        </article>

        <article className="v2-fact-card">
          <h3>3. Standardized, Clean Committee Packets</h3>
          <p>
            Every online field enforces clean formatting so committee binders look uniform: automatic{' '}
            <code>MM/DD/YYYY</code> dates, <code>(XXX) XXX-XXXX</code> phone numbers, <code>0.00</code> GPAs, bulleted
            lists for activities/honors/interests/volunteering, dedicated ACT/SAT/Other score rows, structured
            Employer/Position/Date work history, and a university-grade Section 4 Financial summary that auto-calculates
            Cost of Attendance, Confirmed Gift Aid, and Estimated Remaining Net Cost.
          </p>
        </article>

        <article className="v2-fact-card">
          <h3>4. Page 1 Applicant Photo + Promo JPG</h3>
          <p>
            Each submitted packet is assembled automatically in identical print order: <strong>Applicant Photo on Page 1</strong>,
            followed by the personalized <em>Dear [Applicant],</em> 2-page cover letter, the completed application with
            electronic signatures, and all uploaded supporting PDFs (Essay, Recommendation Letter, Financial Aid Offer,
            FAFSA) at the back. A standalone <code>.jpg</code> portrait is also attached to the email for Foundation
            publications.
          </p>
        </article>

        <article className="v2-fact-card">
          <h3>5. Auto-Save, Packet Preview &amp; Receipts</h3>
          <p>
            Answers auto-save locally in the student’s own browser with 1-click Restore (and an optional backup file for
            switching computers). Applicants preview their complete assembled PDF before submitting, sign electronically
            (with mandatory Parent/Guardian signature if under 18), and receive an automatic confirmation email with a
            unique Reference ID.
          </p>
        </article>

        <article className="v2-fact-card">
          <h3>6. Zero-Code Management &amp; Bank-Grade Security</h3>
          <p>
            Authorized Foundation staff sign in with their Club Office 365 account to edit wording, upload a new 2-page
            cover letter PDF, run the 4-step New Year Wizard, or use 1-click Undo version history. Student files never
            sit on website storage; packets deliver directly through the Club’s Office 365 mailbox (
            <code>{data.submissionRecipients[0]}</code>) with HKDF AES-256-GCM encryption, PDF active-content scanning,
            automatic Eastern Time deadline closing, and anti-abuse rate limits.
          </p>
        </article>
      </div>
    </section>
  );
}
