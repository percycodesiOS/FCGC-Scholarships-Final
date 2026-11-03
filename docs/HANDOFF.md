# Fox Chapel Scholarship website handoff

Updated November 2, 2026. Publication and mailbox connection are separate verification steps; see the dated completion receipt for observed results.

Website: https://fcgcscholarships.percycodes.chatgpt.site/
Application: https://fcgcscholarships.percycodes.chatgpt.site/apply/index.html
Admin: https://fcgcscholarships.percycodes.chatgpt.site/manage
Guide: https://fcgcscholarships.percycodes.chatgpt.site/handoff
Sites project: appgprj_6ad7faa23d3c8191a980d93a1fbf1639

Janet (jmacek3@gmail.com) and Kenny (kmacek715@gmail.com) are authorized by the server-side editor allowlist. Each signs into the admin using their own ChatGPT account. A local development sign-in does not prove Janet's actual access; verify her sign-in on the published site.

## Approved application

The November 1 upload of 2027 Scholarship Application.xlsx is the approved application master, SHA-256 131559c42b783a4960e3259f617a5be6fc38c93cf1ac93b3ede4656fdf3f5b03. Its questions and five-page application body remain intact. At Kenny's explicit direction, blank downloads prepend the actual reviewed two-page 2027 Foundation cover letter, preserving its original wording and corrected letterhead. See AGENTS.md for exact provenance and hashes. The application has 121 fillable fields; completed online PDFs are flattened and retain their existing application, continuation and attachment structure. Long answers continue on added pages rather than being cut off.

The original home page and white “A strong foundation. A brighter next chapter.” headline are preserved. The mission tagline is a small addition in the existing lower Foundation introduction. Navigation, section headings and application options retain their original design. Applicants can still download and email their packet while automatic submission is unavailable.

Students can save/reopen a progress file, opt into saving on their own device, draw or type electronic signatures, add PDF/JPG/PNG supporting files, and download their completed PDF. The parent/guardian signature is required at Submit for applicants under 18. Editing answers clears signatures for re-signing. Supporting files must be reselected after reopening a draft. Limits: 8 supporting files, 5 MB each, 15 MB total; completed PDF under 20 MB.

## Annual and recipient updates

Change year and deadline together in Manage scholarship. The live form and newly generated application-body pages use the same year, deadline, photo email and first submission recipient. The original cover is a fixed reviewed document; review and update its editable master separately for a future cycle. Review the complete blank packet after saving. Changes to the actual questions or Excel layout still require matching template work.

Kenny's latest instruction makes scholarshipfoundation@foxchapelgolfclub.com the sole submission recipient and printed application address. Janet's Gmail is not on the student form or PDF and does not receive submissions. Recipients remain editable, one per line. The first prints on the application. The general contact address is also scholarshipfoundation@foxchapelgolfclub.com.

## Microsoft email connection

Janet's Club account is jmacek@foxchapelgolfclub.com. The Scholarship Foundation mailbox is shared with her, and the supplied Outlook screenshot shows Send As and read/manage access. Authenticate with her Club account; do not look for a separate Foundation password.

One-time Entra application registration is required: Web redirect https://fcgcscholarships.percycodes.chatgpt.site/api/mail/microsoft/callback; delegated offline_access, User.Read, Mail.ReadWrite and Mail.Send.Shared. Enter the application's client ID, tenant and secret in the protected Email connection panel. Send-from address: scholarshipfoundation@foxchapelgolfclub.com. The Club may require an administrator to approve registration/consent.

MAIL_ENCRYPTION_KEY must be a secret base64-encoded 32-byte value. The site encrypts app credentials and mailbox tokens in private R2 records. Do not rotate this key without reconnecting the mailbox. Credentials never enter the public page, backups or source package.

Draft preparation and large attachment uploads use Janet's authorized mailbox, with the explicit Foundation From address. Sent copies normally appear in Janet's Club Sent Items; Club configuration may also retain shared-mailbox copies. This avoids assuming that delegated large-file uploads into the shared mailbox work.

Submit stays disabled until a sending mailbox is connected. Students can still download and email their PDF to the displayed recipient. After connecting, send a made-up test through the actual form and verify the PDF arrives at every configured recipient. Provider acceptance alone is not proof of delivery. Keep a submission reference when a send is uncertain; the site prevents automatic duplicate sends with the same reference.

The site never stores completed application PDFs in R2. It retains minimal private receipts (hash, status, timestamp and provider draft ID). Answers stay on the student's device until Submit. Microsoft and the selected recipients receive the submitted PDF.

## Backups and migration

Download the current content JSON and full website package after changes. Preserve the original Excel and prior approved sources privately. The package excludes secrets, mailbox tokens and applicant data. The Portable website folder works from a static web server for drafts, signatures and PDF downloads, using exported settings; automatic email and the shared admin need the server application.

Before building a new handoff, run node scripts/make-portable.mjs, then python scripts/make-handoff.py. Use the installed Sites source helper to build, commit, package and publish. Preserve the existing Sites project and R2 binding. A downloaded export is a backup; it does not transfer hosting, accounts or ownership.

Do not announce automatic submission as ready until actual inbox delivery is verified. Do not infer that a later calendar-year policy or template change is approved just because annual settings are editable.
