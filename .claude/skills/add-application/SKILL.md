---
name: add-application
description: Tailor the user's resume and cover letter to a specific job posting and add it to the targeted-resumes dashboard. Trigger on requests like "tailor my resume for this job", "add a new application", "target my resume to this posting", or when the user shares a job listing URL or pasted job description in this repo.
---

Produces a tailored resume and cover letter (markdown + PDF) in a new folder under `public/applications/`, then rebuilds the manifest.

## Inputs

- Pasted job posting text (default), strongly preferably alongside the URL too — even though the text is what actually gets read, saving the URL is what lets the user jump straight back to the real listing from the dashboard later (e.g. to apply) instead of hunting for it again on LinkedIn or wherever they found it. If the user pastes text with no URL, ask once whether they have one before continuing; proceed without it if they don't have one or don't want to provide it. URL-only fetch (no pasted text) is a fallback — many job boards render client-side and won't fetch cleanly, so ask the user to paste the text if a fetch comes back thin or fails.
- Canonical source resume: `public/original-resume.md`. Read-only — never edit it.
- `public/settings.json` — `{ name, resumeFilename, coverLetterFilename }`, set via the dashboard's Settings panel (gear icon). Drives the PDF filenames and the cover letter sign-off below.
- `public/personal-projects-skills.md`, if present — a verified checklist of what's actually demonstrated in the user's public GitHub repos (the ones linked when a posting asks for a GitHub/portfolio URL), plus any tools confirmed real by the user but not in those repos. Read this alongside the source resume when tailoring — it often covers tool-specific keywords (Figma, Storybook, testing, specific frameworks) that never show up in the narrative job-history bullets. Never invent a claim about a public repo from a local disk read alone — verify the local checkout's `git rev-parse HEAD` matches the *public* remote's HEAD first, since a local folder can differ from what's actually public.

## Steps

1. **Read settings.** Read `public/settings.json` for `name`, `resumeFilename`, and `coverLetterFilename`. If the file is missing or any field is empty, stop and ask the user to fill in Settings (gear icon in the dashboard) first — the steps below depend on it.

2. **Get the posting.** Prefer pasted text over fetching. Only fetch a bare URL if no text was given.

3. **Extract facts.** Company, exact role title, location, and 5–10 short keyword phrases (one to three words each — the dashboard highlights these verbatim, so keep them short).

4. **Create the folder.** id = `<YYYY-MM-DD>-<company-slug>-<role-slug>` (today's date, lowercase/hyphenated slugs of company and role). Create `public/applications/<id>/`.

5. **Save the posting.** Write `public/applications/<id>/job-posting.md` — source URL at top if given, then the cleaned posting text.

6. **Tailor resume + cover letter in ONE `writer` subagent call.** Give it `public/original-resume.md`, the extracted keywords, and (if present) `public/cover-letter-template.md` as a voice/format reference — and ask for both files in the same invocation (don't call the subagent twice — it's the same source material and instructions either way):
   - **`resume.md`**: tighten the intro into a first-person professional summary starting "I'm a..." (a deliberate exception to the writer's usual no-first-person rule — bullets below the summary stay third-person). Keep it broken into 2–3 short paragraphs, matching the original resume's paragraph structure — don't collapse it into one dense block; a blank line between paragraphs is a hard markdown break here, same as elsewhere in the file. Reword/reweight bullets toward the posting's terms without inventing skills, employers, dates, or accomplishments. Critically, when a keyword from step 3 genuinely applies, use that **exact phrase** (grammatically adapted — "prototyping" not just "prototypes/prototyped") somewhere in the resume rather than a paraphrase — the dashboard's keyword-targeting view does literal substring matching, not concept matching, so "design-system ownership" or "aligning cross-functional teams" won't register as matches for "design systems" or "cross-functional collaboration" even though the substance is the same. Only skip a keyword's literal phrase if the underlying claim genuinely isn't true — don't force language onto experience that doesn't support it. Never write gap notes like `[NEEDS INPUT: ...]` into the file body itself — it gets rendered to the dashboard and printed to PDF; put any flagged gaps in your final report back to the user instead. Preserve the full job history, dates, and structure exactly.
   - **`cover-letter.md`**: 3–4 paragraphs, "Dear `<Company>` Hiring Team," citing two or three concrete accomplishments from the tailored resume, no fabrication, AP style. Close with "Sincerely,  " (two trailing spaces — a markdown hard break so it doesn't collapse onto one line) then the user's first name only, taken from `settings.name` (e.g. "Bill" from "Bill Pliske") on the next line.

7. **Assess the fit.** Write this directly — no subagent needed: `fitRating` (`strong`/`good`/`partial`/`stretch`, honest rather than encouraging — a `stretch` rating that saves the user from reapplying to a bad fit is more useful than an inflated one) and a 2–3 sentence `fitSummary` naming genuine overlaps and genuine gaps, specific to this posting.

8. **Generate PDFs**, named from `settings.resumeFilename` and `settings.coverLetterFilename` (e.g. "Bill Pliske Resume.pdf") — that's the literal filename the user uploads elsewhere, so it needs their real name, not a generic one. Markdown sources keep their generic names.
   ```
   node scripts/generate-pdf.mjs "public/applications/<id>/resume.md" "public/applications/<id>/<settings.resumeFilename>"
   node scripts/generate-pdf.mjs "public/applications/<id>/cover-letter.md" "public/applications/<id>/<settings.coverLetterFilename>"
   ```

9. **Write `meta.json`** (shape matches `Application` in `src/types.ts`):
   ```json
   {
     "id": "<id>",
     "company": "<company>",
     "role": "<role>",
     "dateAdded": "<YYYY-MM-DDTHH:MM:SS — run `date +%Y-%m-%dT%H:%M:%S` for the real current timestamp; the list sorts by this field, so a placeholder like midnight will sort it out of order against entries added earlier the same day>",
     "jobUrl": "<url or omit if pasted>",
     "jobPostingSource": "url | pasted",
     "location": "<location, if known>",
     "status": "not_applied",
     "fitRating": "strong | good | partial | stretch",
     "fitSummary": "2-3 sentence honest assessment from step 7",
     "tailored": true,
     "keywords": ["..."],
     "jobPostingFile": "job-posting.md",
     "resumeFile": "resume.md",
     "resumePdf": "<settings.resumeFilename>",
     "coverLetterFile": "cover-letter.md",
     "coverLetterPdf": "<settings.coverLetterFilename>"
   }
   ```
   `status` always starts `"not_applied"` — the user updates it themselves as things move.

10. **Rebuild the manifest.** `npm run manifest` via Bash.

11. **Report back briefly.** Folder path, fit rating, and a reminder to review before uploading anywhere — nothing here should go out unreviewed.

## Promoting a screened application to a full one

`check-fit` creates lightweight entries (`tailored: false` — just `job-posting.md` and `meta.json`). To promote one, don't create a new folder — reuse the existing id, run steps 1 and 6–10 above against it, and update `meta.json` in place (add the resume/cover-letter fields, flip `tailored` to `true`, refresh `fitRating`/`fitSummary` if the fuller pass changes the read). Skip steps 2–5.
