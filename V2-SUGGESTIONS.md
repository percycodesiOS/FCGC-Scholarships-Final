# Fox Chapel Golf Club Scholarship Website — V2 Suggestions & Security Audit

> **Safety status:** This folder is a **completely air-gapped V2 clone** of your live Version 17 source (`commit 90fe8a4` running at `https://fcgcscholarships.percycodes.chatgpt.site/`). Its Git remote was removed so nothing can accidentally push or alter the live website.

---

## Executive Summary: You Already Built Something Strong — Here Is What Takes It From 95% to 100%

Your live Version 17 site already nails the hardest parts:
- Preserves the classic Fox Chapel green-and-cream homepage, hero, crest, and original reviewed 2-page cover letter (`51a129f1380bd820...`).
- Keeps the 121-field approved Excel PDF layout, square checkboxes, ruled answer lines, in-page Review Application dialog, and Save/Open progress.
- Zero student PII stored in R2 (completed PDFs stay on the student's device until Submit, then go straight to Outlook).
- AES-GCM encrypted Microsoft Graph credentials and single-flight duplicate-submission locking.

Below are the **exact security upgrades**, **non-coder maintenance upgrades for Mom**, and **one urgent public-link cleanup** we found by auditing every file of your live codebase — all implemented here in V2 for you to review first.

---

## 1. Security & IT-Audit Upgrades (Built to Impress Club Leadership & Norman Alan / Security Auditors)

| # | Finding in Live v17 | Risk / Impact | V2 Upgrade Implemented in This Clone |
|---|---|---|---|
| **S1** | **No HTTP security response headers** (`worker/index.ts`, `next.config.ts`) | Missing CSP, anti-clickjacking, HSTS, CORP, COOP, and Permissions-Policy. Automated security scanners (Mozilla Observatory / SecurityHeaders.com) would score D/F. | Added `applySecurityHeaders()` in `lib/security.ts` + `worker/index.ts`: enforces `Content-Security-Policy` (permitting `frame-src 'self' blob:` on `/apply` for the PDF review modal while locking down `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP: same-origin-allow-popups`, `CORP: same-origin`, and `HSTS`. |
| **S2** | **No Fetch Metadata (`Sec-Fetch-Site`) edge guard on `/api/*`** | Cross-site requests hit API handlers before rejection. | Added `checkFetchMetadata()` in `worker/index.ts` running **before** auth/handlers: blocks all cross-site `/api/*` calls except Microsoft Entra's top-level `GET` OAuth redirect to `/api/mail/microsoft/callback`. |
| **S3** | **Single master key reused directly across AES-GCM & public HMAC tokens** (`lib/mail.ts` & `lib/submission.ts`) | Violates cryptographic key separation: `MAIL_ENCRYPTION_KEY` encrypts Entra secrets AND signs public submission tokens + IP hashes directly. | Added WebCrypto **HKDF-SHA256** domain-separated subkeys (`fcgc:mail-storage:v2`, `fcgc:oauth-state:v2`, `fcgc:submission-token:v2`, `fcgc:rate-limit:v2`, `fcgc:recipient-limit:v2`) in `lib/security.ts`, with **seamless v1 decryption fallback** so existing R2 tokens stay connected without re-auth. |
| **S4** | **Submission token nonces never consumed + no per-recipient/global mail quota breaker** (`lib/submission.ts`, `app/api/applications/route.ts`) | A captured token stays replayable for 12 hours, and rotating IPs could trigger confirmation emails to arbitrary victims ("email bombing" through the Club's M365 mailbox). | Enforced **single-use token nonce consumption** in R2 (`consumeTokenNonce`), plus **3-layer keyed-HMAC rate limits**: max 8/day per IP, max 3/day per applicant email, and a **60/day global circuit breaker** protecting Club M365 quotas. |
| **S5** | **Uploaded PDFs only checked for `%PDF-` header** (`app/api/applications/route.ts`) | Maliciously crafted PDFs with `/JavaScript`, `/JS`, `/Launch`, `/OpenAction`, `/AA`, `/RichMedia`, or `/SubmitForm` could reach the Foundation's Adobe Acrobat inbox. | Verified that all three Foundation master PDFs contain **zero** active actions, and added `scanPdfForActiveContent()` on the server to verify `%%EOF` integrity and reject active executable PDF operators before Microsoft Graph ever touches them. |
| **S6** | **OAuth state cookie lacks `__Secure-` prefix, constant-time compare, and clear failure categories** (`app/api/mail/route.ts`, `callback/route.ts`) | Cookie tossing defense missing; plain `!==` comparison; generic `connection-failed` hides whether Club IT consent expired vs secret expired vs user cancelled. | Upgraded to `__Secure-fcgc-mail-state` on HTTPS, `timingSafeEqualString()`, and safe mapped failure categories (`access-denied`, `consent-required`, `invalid-client`, `expired-state`) rendered in plain English for Janet. |
| **S7** | **Public `GET /api/content` dumps full internal config** (`app/api/content/route.ts`) | Any unauthenticated caller sees internal revisions and any secondary review recipient emails. | Minimized anonymous `GET /api/content` via `publicContentView()`; full editable state is returned only to signed-in editors. |

---

## 2. Urgent Public-Link Cleanup Finding (Outside Live v17)

- **Stale October 21 static copy still live on GitHub Pages:** Your public GitHub repo `percycodesiOS/fcgc-scholarships` (`https://percycodesios.github.io/fcgc-scholarships/`) is still active with an older preview that says *"Review preview · Online format pending Foundation approval"* and tells applicants to **mail paper applications** to 426 Fox Chapel Road instead of submitting online!
- **Recommendation (do after committee approval):** Disable GitHub Pages on `percycodesiOS/fcgc-scholarships` (or replace it with a clean link pointing to the approved live Foundation URL) so nobody on the committee or staff accidentally opens the outdated Oct 21 version.

---

## 3. Making Mom's Maintenance Effortless (Zero Coding, Zero AI Needed)

In live v17, `/manage` puts 14 raw inputs on one long page, uses multiline textareas that reject saves if Janet hits Enter twice, forces her to close submissions manually at 4:30 p.m. on deadline day, doesn't sync her mailing address to the footer, exposes Entra Client ID / Tenant / Secret right beside her daily buttons, and gives her no way to undo a mistake or verify a student's submission receipt.

**What we built for Mom in V2** (open `v2-preview/mom-admin-v2-demo.html` in Chrome right now to click through every tab!):

1. **5-Tab "Owner Control Center" (`/manage`)**:
   - **At a Glance (Dashboard):** Big Open/Closed toggle switch, Eastern Time auto-close countdown, green/amber Mailbox & Security health cards, and 4 plain-English Quick Action tiles.
   - **Edit Website (Visual No-Code Editor):** Eligibility and Checklist become **individual visual bullet cards** with `+ Add`, `↑`, `↓`, and `Remove` buttons (and blank lines are cleaned automatically — impossible to break!).
   - **Automatic Eastern Time Deadline Cutoff:** Real Date + Time picker automatically formats the text (`Friday, June 18, 2027 · 4:30 p.m. EDT`) AND automatically closes online submissions at the exact Eastern Time minute (`isDeadlinePassed()` on the server), so Mom never has to race to a computer at 4:30 p.m.!
   - **Guided 4-Step "New Year Wizard":** Lets Mom roll over `2027 → 2028` in 5 minutes — automatically shifts `2027 → 2028` and `2026 → 2027` across Eligibility & Checklist items for her review, reminds her about the separate official 2-page Word cover letter, and opens a full Live Preview before anything saves.
   - **Pre-Publish "What Changed?" Confirmation Dialog:** Before anything goes live, Mom sees a clear bullet list of *exactly* what she changed, with Cancel safely focused by default.
   - **1-Click Undo Version History (`/api/history`):** Every save automatically records a snapshot and plain-English change log (`savedBy`, timestamp, bullet summary). Mom can preview and restore any earlier save in 1 click.
   - **Zero-PII Submission Reference Verifier + "Test Connection Now" (`/api/receipts`, `/api/mail`):** If a student asks *"Did you get my application?"*, Mom pastes their Reference ID and gets an instant verified status + timestamp + confirmation email check — while keeping 0 bytes of student PII on the server. Technical Microsoft Entra ID settings are tucked safely behind a collapsed *"IT / Club Administrator Setup (One-Time Only)"* panel.
   - **Mailing Address Footer Sync (`app/Scholarship.tsx`):** Editing the Foundation address now automatically updates the homepage footer too.
   - **Built-in Printable 1-Page "Committee & Club IT Security Fact Sheet":** Ready to print straight from `/manage` and hand to Kent and the Scholarship Committee.

### Note on Long-Term Sign-In / Hosting Portability
- Today `/manage` authenticates Janet (`jmacek3@gmail.com`) via **Sign in with ChatGPT** because the site runs on ChatGPT Sites (`*.chatgpt.site`).
- That works great for your committee demo today, and Janet does **not** need a paid AI subscription to sign in.
- **When the Club eventually attaches its own domain (e.g., `scholarships.foxchapelgolfclub.com`) or moves to Club-managed Cloudflare hosting:** swapping `app/chatgpt-auth.ts` for **Microsoft Entra ID sign-in** (using the exact same Club Entra app you already registered!) lets Janet manage the site with her existing Club email (`jmacek@foxchapelgolfclub.com`) — zero ChatGPT account required!

---

## Files Added / Upgraded in This V2 Clone
- `lib/security.ts` (NEW): HKDF-SHA256 key derivation, security headers, Fetch Metadata guard, constant-time compare, PDF active-content scanner, Eastern Time auto-close clock.
- `worker/index.ts`: Pre-auth Fetch Metadata guard + global security headers.
- `lib/content.ts` & `lib/default-content.json`: `deadlineIso`, `autoCloseAtDeadline`, `closedNotice`, blank-line tolerance, plain-English change diffing, minimized public API view.
- `lib/store.ts`: Audit trail + historical snapshot restore + zero-PII receipt ledger & Reference ID lookup.
- `lib/mail.ts` & `lib/submission.ts`: HKDF v2 encryption with v1 read compatibility, connection health check, single-use token nonces, 3-layer rate limits.
- `app/api/application/route.ts`, `app/api/applications/route.ts`, `app/api/content/route.ts`, `app/api/mail/route.ts`, `app/api/mail/microsoft/callback/route.ts`, `app/api/history/route.ts` (NEW), `app/api/receipts/route.ts` (NEW).
- `app/Scholarship.tsx`: Footer mailing address sync + automatic closed-status banner.
- `app/manage/Manager.tsx`, `app/manage/NewYearWizard.tsx` (NEW), `app/manage/EmailDelivery.tsx`, `app/manage/CommitteeSheet.tsx` (NEW), `public/site.css`.
- `public/apply/app.js`, `public/apply/style.css`: Deadline-passed banner, modal scroll containment, post-interaction validation ARIA sync.
- `v2-preview/mom-admin-v2-demo.html` (NEW): Double-click standalone interactive preview of Mom's V2 Owner Control Center.
