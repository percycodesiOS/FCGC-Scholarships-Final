# Fox Chapel Golf Club scholarship Site

Maintained source for the Sites page and protected content editor. Existing 2027 application is preserved under public/apply from K:/Projects/fcgc-scholarships commit44e76e58b11fdde64c16b5b0fd54339b977e6fea. The online format remains pending Foundation approval.

## Everyday edits
Use /manage. Authorized editor identities are configured in lib/auth.ts. Save writes website content to R2 BUCKET; no applicant records are stored. Content backups are JSON from /api/backup. Full source package /api/package requires editor sign-in. Credentials are not in this source.

## Run and build
Node22.13+; npm ci; npm run dev. For production use the installed Sites workflow with this existing project ID, npm build via the supplied helper, and R2 binding BUCKET. Build retains Sites managed authentication; do not trust caller-supplied headers on another host. Local sign-in is development-only.

## Move hosts
Portable website in the handoff ZIP can run on ordinary static hosting without ChatGPT. It has no shared content editor. To migrate the full application, configure authentication, authorize the successor, and replace Sites identity headers with verified identity from that host; provide R2 or equivalent storage and import the latest content JSON. Do not expose a write endpoint without authorization.

## Annual changes
Page edits do not change application fields/PDF templates. The 2027 field map, coverletter and templates must be updated together for another year. User-facing year changes hide the online preview and label the retained PDF as2027. Maintain review status until Foundation approval.

## Build package
Run the task workspace packaging script after a verified page render. lib/package-data.ts is generated from a ZIP excluding itself, Git data, environment files and runtime storage. See docs/HANDOFF.md.
