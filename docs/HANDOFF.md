# Fox Chapel Scholarship Foundation — website handoff

Prepared October 26, 2026. This guide describes the intended completed setup and how to maintain it. The checklist below must be completed against the actual site before treating access, publication, backups, or live saving as verified. Do not remove pending items merely because the code exists.

## Links and ownership

| Item | Location or status |
|---|---|
| Public website | Use the Manage scholarship link on the website; the published link is in the completion receipt. |
| Staff content editor | Use the Manage scholarship link on the website; the published link is in the completion receipt. — `/manage` |
| Applicant form | Use the Manage scholarship link on the website; the published link is in the completion receipt. — `/apply` |
| Downloadable source ZIP | Use the Manage scholarship link on the website; the published link is in the completion receipt. |
| Existing Sites project | `appgprj_6ad7faa23d3c8191a980d93a1fbf1639` |
| Sites slug | `fox-chapel-scholarship-2027` |
| New site source | `sites\fox-chapel-scholarship-source` in the current project |
| Existing application source | `K:\Projects\fcgc-scholarships` |
| Initial authorized editor | Kenny; actual account identity and access must be checked |
| Janet's editor access | Pending confirmation of her email, authorization, and sign-in test |
| Club successor / backup editor | To be named and individually authorized |

Full new-source path: `C:\Users\Administrator\Documents\Codex\2026-09-25\hey-for-some-reason-it-s\sites\fox-chapel-scholarship-source`.

The project reuses the existing Sites identity. The existing application is preserved under `/apply`; the original `K:\Projects\fcgc-scholarships` repository is not replaced by this site build. The application baseline inspected for this work was commit `44e76e58b11fdde64c16b5b0fd54339b977e6fea`.

## What the site does

The public page explains the program, eligibility, deadline, requirements, contacts, and next steps. The authenticated `/manage` editor is for these public page texts. It offers **Preview** and **Save to website**, with shared content stored persistently in R2. Saving shared content is different from a browser-only preview or local draft.

Editor permission is enforced on the server against an allowlist. Knowing the editor URL or opening the public site does not grant permission. Kenny is the initial intended authorized editor; Janet's email must be confirmed before she is added. A public viewer is not an editor.

The client-only application has five sections: Applicant, Family, Education, Financial, and Finish. It calculates totals, can download/reopen a JSON draft, and generates a completed PDF. Optional supporting files are merged on the applicant's device. The current application permits PDF/JPG/PNG attachments, up to 8 files, 5 MB per file, and 15 MB combined. Attachments must be selected again after reopening a saved draft.

**Applicant answers, drafts, attachments, and completed PDFs must remain on the applicant's device.** They are not website content, must not be saved to R2, and must not be included in source archives or a public repository. This site does not provide an application inbox or submit an application by email. Downloading a packet is not submission; applicants follow the packet's signature and delivery directions.

## Routine edits

1. Sign in to `/manage` with an authorized individual account.
2. Edit the public text that needs changing.
3. Select **Preview**. Check the wording, links, and appearance on a narrow screen as well as a computer.
4. Select **Save to website**. Confirm the success message; an error or unfinished request is not proof of a save.
5. Reload the public page and confirm the saved text. For an important change, check it in a fresh visitor session as well.
6. Use **Backup** to download the current content JSON and keep it in the Club's shared records with the date.

If a save fails, preserve the proposed wording separately and keep the current site in place. Do not repeatedly publish or replace the site to work around an unexplained error. Confirm the account's editor permission and the site's server/storage status first.

The page editor is not an editor for the PDF templates, application questions, calculations, login rules, or code. Native Sites source editing and ownership controls are separate from this content editor and are tied to the relevant workspace. Do not promise an external viewer source-editing access or an ownership transfer until the platform permits it and the recipient has successfully tested it.

## Annual update checklist

The current application and reviewed documents are for **2027**. Changing a date or year on the public page does not change the form, generated PDF, cover letter, or blank packet.

1. Obtain the Foundation's approved year, deadline, eligibility, requirements, contacts, and documents. Preserve the previous year's final files in the Club's records.
2. Have a maintainer update the application form and its approved PDF templates, cover letter, and blank packet. Update the corresponding public page wording in the same release. Do not relabel the 2027 form as a new application year without updating and checking it.
3. Check every date, year, address, contact, requirement, and download against the approved package. Confirm that public wording and PDFs agree.
4. Use made-up test information to save/reopen a draft, check financial totals, and download a completed packet with a small test attachment. Inspect every page and verify signatures, required materials, and delivery instructions. Do not use an actual applicant's information for this test.
5. Record Foundation approval of the online format when obtained, verify the published result, and save fresh content and source backups before announcing the new cycle.

The reviewed current deadline is **Friday, June 18, 2027, at 4:30 p.m. Eastern Daylight Time**. The existing application says **“Review preview · Online format pending Foundation approval.”** Retain that status unless later approval is explicitly recorded. Building or publishing a working preview does not itself establish Foundation approval.

## Backups and moving to another host

Keep these together in a Club-controlled shared folder:

- **Content JSON:** Downloaded with **Backup** after important changes. It contains the public page content, not applicant answers. Keep dated copies.
- **Website source ZIP:** The supplied export contains site code, templates, logo, and a standalone static export that preserves the local application for another host. Keep a copy outside the current service.
- **Approved source documents:** Current cover-letter source, application/PDF masters, final student packet, and the policy approval record.
- **Access and operational notes:** Named owner, backup owner, authorized editor emails, hosting/domain account ownership, renewal responsibility, and the last verified deployment. Store passwords and recovery codes in the Club's approved password manager, not this document or the source ZIP.

An export is a portable backup, not continued hosting. A static export can serve the public pages and browser-only application on an appropriate web host. The authenticated editor, authorization rules, and persistent shared storage require their supported server services or a replacement implementation; a generic static host does not recreate those features automatically. A successor should verify that the exported page contains the intended content and that all application/template files are included before switching hosts.

Continued availability after canceling a subscription, deleting an account, changing a plan, or losing workspace access has not been established. Do not promise that it will stay online or remain editable. Check the applicable service terms and actual account setup before cancellation, and complete/test any migration first. Access to a downloaded backup does not transfer an account, domain, or live project automatically.

## Handoff to the Club or a successor

1. Name one responsible owner and one backup person, with their own accounts.
2. Give them the latest content JSON, source ZIP, approved documents, this guide, and `START-HERE-JANET.md`.
3. Grant the minimum required permissions and test each person's actual sign-in. Do not share Kenny's credentials.
4. Have the new owner make an agreed small wording change, preview it, save it, and verify it as a visitor. Restore the original wording if it was only a test.
5. Confirm control of hosting, domain, storage, backups, and renewals. Where native Sites ownership/source access requires the same workspace, verify that route explicitly; otherwise provide the portable export and plan a tested move.
6. Remove departing staff access only after the new owner can operate the site and the backups are safely stored. Record the handoff date and identities.

## Completion record — fill from observed results

- [ ] Public website URL recorded and correct content reloaded after publication.
- [ ] `/apply` matches the preserved application files and generated-PDF behavior.
- [ ] Kenny's authorized sign-in and an actual save/reload are verified.
- [ ] Janet's email confirmed, individually authorized, and actual sign-in tested.
- [ ] Unauthorized visitors cannot read or call staff editing operations.
- [ ] Preview leaves the live site unchanged until Save to website is used.
- [ ] Saved public content persists after reload/new visitor session.
- [ ] Backup JSON downloaded and checked against saved content.
- [ ] Source ZIP downloaded, inspected, and its standalone export tested.
- [ ] Applicant drafts, attachments, and completed packets stay local to the applicant's device.
- [ ] Phone/tablet layout, links, downloads, and current seven-page application packet checked.
- [ ] Foundation approval status recorded accurately; no unapproved policy changes introduced.
- [ ] Owner, backup owner, hosting responsibilities, and outstanding access/transfer limits recorded.

**Verified by / date:** Pending final implementation tests.  
**Known unresolved items:** Final URLs; Janet's confirmed email/access; observed save and export checks; Club successor and actual transfer/hosting arrangements. Update this list from evidence at completion.

## Content sources

See `ASSETS-AND-CONTENT.md` in this folder for exact current wording, document paths, file hashes, and authentic logo provenance. The latest reviewed package used for this build is `outputs\scholarship-pages-2026-10-21\email-attachments`, containing the seven-page student and editable PDFs and the editable cover letter. These October 21 copies supersede older October 16/20 copies for this task.

No applicant records belong in this handoff.
