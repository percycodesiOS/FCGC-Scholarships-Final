# Fox Chapel Golf Club scholarship Site

Maintained source for the Sites website, protected editor and approved Excel-based application. Read `AGENTS.md` for Kenny's saved design/document constraints. The original green-and-cream website and white “A strong foundation. A brighter next chapter.” hero are retained. The Foundation mission tagline is a small addition in the existing lower introduction. The approved November 1 upload of `2027 Scholarship Application.xlsx` supplies the questions and five-page PDF layout. The website is the standard completion route. Applicants read and acknowledge the original two-page cover letter before the form. Completed PDFs prepend that letter with a personalized greeting, followed by the five-page application body, answer continuations and selected attachments. The original letter master is unchanged; staff may generate a blank reference packet.

## Everyday edits
Use /manage. Authorized editors are Janet (jmacek3@gmail.com) and Kenny (kmacek715@gmail.com), enforced in lib/auth.ts. Save writes website settings to R2 BUCKET. Content backups are JSON from /api/backup. The full source package /api/package requires editor sign-in. Credentials are excluded from exports. Application answers and files remain on the student's device until Submit; completed PDFs are sent to configured recipients and are not stored in R2. Private submission receipts contain only a hash, status, time and provider draft ID.

## Run and build
Node22.13+; npm ci; npm run dev. For production use the installed Sites workflow with this existing project ID, npm build via the supplied helper, and R2 binding BUCKET. Build retains Sites managed authentication; do not trust caller-supplied headers on another host. Local sign-in is development-only.

## Move hosts
Portable website in the handoff ZIP can run on ordinary static hosting without ChatGPT. It has no shared content editor. To migrate the full application, configure authentication, authorize the successor, and replace Sites identity headers with verified identity from that host; provide R2 or equivalent storage and import the latest content JSON. Do not expose a write endpoint without authorization.

## Annual changes
The year, deadline, photo email and primary submission recipient update the form and application-body PDF. The original cover letter is a fixed reviewed document; it must be deliberately reviewed and replaced from its editable master for a future cycle, not synthesized from settings. Edit annual settings in /manage and verify a completed test packet and the current original cover letter after saving. The editable mission tagline appears in the Foundation introduction below the main banner. Actual question or layout changes require an updated PDF template and corresponding field map. Draft files are year-specific. Current recipient and printed application address: scholarshipfoundation@foxchapelgolfclub.com only, per Kenny's latest instruction.

## Email delivery
Microsoft OAuth uses a one-time Entra application registration and authorized sending mailbox. Configure client ID, tenant and secret in the protected editor. Set MAIL_ENCRYPTION_KEY to a secret base64-encoded 32-byte key before connecting. OAuth credentials and tokens are encrypted in private R2 records, never exported. Outlook sign-in alone does not establish this connection. Submit remains disabled until connected. A provider acceptance is not inbox delivery proof; verify an actual test in every destination before announcing automatic submission as ready.

## Build package
Run `python scripts/make-handoff.py` before building after source changes. The portable-template folder contains the current static page snapshot. Its application uses an exported settings file and supports local drafts, signatures and PDF downloads; automatic email and shared admin edits require the server. lib/package-data.ts is generated from a ZIP excluding itself, Git data, environment files and runtime storage. See docs/HANDOFF.md.
