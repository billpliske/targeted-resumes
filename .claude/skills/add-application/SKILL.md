---
name: add-application
description: Tailor Bill's resume and cover letter to a specific job posting and add it to the resume-targeter dashboard. Trigger on requests like "tailor my resume for this job", "add a new application", "target my resume to this posting", or when the user shares a job listing URL or pasted job description in this repo.
---

Produces a tailored resume and cover letter (markdown + PDF) in a new folder under `public/applications/`, then rebuilds the manifest.

## Inputs

- Pasted job posting text (default), optionally with a URL. URL-only fetch is a fallback — many job boards render client-side and won't fetch cleanly, so ask Bill to paste the text if a fetch comes back thin or fails.
- Canonical source resume: `public/original-resume.md`. Read-only — never edit it.
- `public/personal-projects-skills.md` — a verified checklist of what's actually demonstrated in Bill's two public GitHub repos (the ones linked when a posting asks for a GitHub/portfolio URL), plus a short list of tools confirmed real by Bill but not in those repos (e.g. Storybook). Read this alongside the source resume when tailoring — it often covers tool-specific keywords (Figma, Storybook, testing, specific frameworks) that never show up in the narrative job-history bullets. Never invent a claim about the two public repos from a local disk read alone — if you need to verify current repo state rather than trust this file, confirm the local checkout's `git rev-parse HEAD` matches the *public* remote's HEAD first (see that file's "Keeping this current" section), since some of these folders have a separate private `origin` and public remote.

## Steps

1. **Get the posting.** Prefer pasted text over fetching. Only fetch a bare URL if no text was given.

2. **Extract facts.** Company, exact role title, location, and 5–10 short keyword phrases (one to three words each — the dashboard highlights these verbatim, so keep them short).

3. **Create the folder.** id = `<YYYY-MM-DD>-<company-slug>-<role-slug>` (today's date, lowercase/hyphenated slugs of company and role). Create `public/applications/<id>/`.

4. **Save the posting.** Write `public/applications/<id>/job-posting.md` — source URL at top if given, then the cleaned posting text.

5. **Tailor resume + cover letter in ONE `writer` subagent call.** Give it `public/original-resume.md` and the extracted keywords, and ask for both files in the same invocation (don't call the subagent twice — it's the same source material and instructions either way):
   - **`resume.md`**: tighten the intro into a first-person professional summary starting "I'm a..." (a deliberate exception to the writer's usual no-first-person rule — bullets below the summary stay third-person). Keep it broken into 2–3 short paragraphs, matching the original resume's paragraph structure — don't collapse it into one dense block; a blank line between paragraphs is a hard markdown break here, same as elsewhere in the file. Reword/reweight bullets toward the posting's terms without inventing skills, employers, dates, or accomplishments. Critically, when a keyword from step 2 genuinely applies, use that **exact phrase** (grammatically adapted — "prototyping" not just "prototypes/prototyped") somewhere in the resume rather than a paraphrase — the dashboard's keyword-targeting view does literal substring matching, not concept matching, so "design-system ownership" or "aligning cross-functional teams" won't register as matches for "design systems" or "cross-functional collaboration" even though the substance is the same. Only skip a keyword's literal phrase if the underlying claim genuinely isn't true — don't force language onto experience that doesn't support it. Never write gap notes like `[NEEDS INPUT: ...]` into the file body itself — it gets rendered to the dashboard and printed to PDF; put any flagged gaps in your final report back to Bill instead. Preserve the full job history, dates, and structure exactly.
   - **`cover-letter.md`**: 3–4 paragraphs, "Dear `<Company>` Hiring Team," citing two or three concrete accomplishments from the tailored resume, no fabrication, AP style. Close with "Sincerely,  " (two trailing spaces — a markdown hard break so it doesn't collapse onto one line) then "Bill" (first name only, not "Bill Pliske") on the next line.

6. **Assess the fit.** Write this directly — no subagent needed: `fitRating` (`strong`/`good`/`partial`/`stretch`, honest rather than encouraging — a `stretch` rating that saves Bill from reapplying to a bad fit is more useful than an inflated one) and a 2–3 sentence `fitSummary` naming genuine overlaps and genuine gaps, specific to this posting.

7. **Generate PDFs**, named "Bill Pliske Resume.pdf" and "Bill Pliske Cover Letter.pdf" — that's what Bill actually uploads, so it needs his name, not a generic filename. Markdown sources keep their generic names.
   ```
   node scripts/generate-pdf.mjs "public/applications/<id>/resume.md" "public/applications/<id>/Bill Pliske Resume.pdf"
   node scripts/generate-pdf.mjs "public/applications/<id>/cover-letter.md" "public/applications/<id>/Bill Pliske Cover Letter.pdf"
   ```

8. **Write `meta.json`** (shape matches `Application` in `src/types.ts`):
   ```json
   {
     "id": "<id>",
     "company": "<company>",
     "role": "<role>",
     "dateAdded": "<YYYY-MM-DDTHH:MM:SS>",
     "jobUrl": "<url or omit if pasted>",
     "jobPostingSource": "url | pasted",
     "location": "<location, if known>",
     "status": "not_applied",
     "fitRating": "strong | good | partial | stretch",
     "fitSummary": "2-3 sentence honest assessment from step 6",
     "tailored": true,
     "keywords": ["..."],
     "jobPostingFile": "job-posting.md",
     "resumeFile": "resume.md",
     "resumePdf": "Bill Pliske Resume.pdf",
     "coverLetterFile": "cover-letter.md",
     "coverLetterPdf": "Bill Pliske Cover Letter.pdf"
   }
   ```
   `status` always starts `"not_applied"` — Bill updates it himself as things move.

9. **Rebuild the manifest.** `npm run manifest` via Bash.

10. **Report back briefly.** Folder path, fit rating, and a reminder to review before uploading anywhere — nothing here should go out unreviewed.

## Promoting a screened application to a full one

`check-fit` creates lightweight entries (`tailored: false` — just `job-posting.md` and `meta.json`). To promote one, don't create a new folder — reuse the existing id, run steps 5–9 above against it, and update `meta.json` in place (add the resume/cover-letter fields, flip `tailored` to `true`, refresh `fitRating`/`fitSummary` if the fuller pass changes the read). Skip steps 1–4.
