---
name: check-fit
description: Quickly screen a job posting against the user's resume for fit — a rating and a short summary, no resume/cover letter generated. Trigger on requests like "check if this job fits me", "screen this posting", "how well does this match my skills", or when the user is triaging a batch of old job postings to decide which are worth reapplying to.
---

Fast triage path: saves a lightweight entry to the dashboard (job posting + fit assessment only) without the cost of generating a tailored resume, cover letter, and PDFs. Meant for going through a large batch of postings (e.g. reapplying to old applications) to find which ones are worth the full `add-application` treatment.

## Inputs

- Pasted job posting text (default) or a URL (fetch it if no text is given — same fetch caveats as `add-application`: many job boards render client-side and won't fetch cleanly, so ask the user to paste the text if a fetch comes back thin). Include the URL alongside pasted text when the user has it — it's what lets them jump back to the real listing from the dashboard later — but don't interrupt a batch-triage flow to ask for one on every posting; that defeats the point of this skill.
- The canonical source resume: `public/original-resume.md`. Never edit this file.
- `public/personal-projects-skills.md`, if present — a verified checklist of what's actually demonstrated in the user's public GitHub repos, plus tools confirmed real by the user but not in those repos. Check it alongside the source resume when assessing fit against tool-specific keywords (Figma, Storybook, testing, specific frameworks) that the narrative resume bullets don't capture.

## Steps

1. **Get the posting.** Same as `add-application` step 2 — prefer pasted text, fall back to fetching a bare URL, ask for pasted text if that fetch fails or looks incomplete.

2. **Extract key facts.** Company name, exact role title, location (if listed), and 5–10 short keyword phrases (one to three words each) the posting emphasizes.

3. **Create the application folder.** Same id scheme as `add-application`: `<YYYY-MM-DD>-<company-slug>-<role-slug>` under `public/applications/`.

4. **Save the job posting.** Write `public/applications/<id>/job-posting.md` (source URL at top if given, then the cleaned posting text) — same as `add-application` step 5. If the posting lists a salary/compensation figure, add a `Compensation:` line right under the location/remote-status line near the top, in addition to leaving it wherever it appears further down (e.g. alongside benefits) — don't move it, just also surface it up top so it's visible without scrolling.

5. **Assess the fit.** Read `public/original-resume.md` and compare it against the posting directly (no need for the `writer` subagent here — this is analysis, not resume writing). Write:
   - `fitRating`: `strong`, `good`, `partial`, or `stretch` — be honest, not encouraging. A `stretch` rating that saves the user from reapplying to a bad-fit posting is the whole point of this skill.
   - `fitSummary`: 2–3 sentences naming genuine overlaps and genuine gaps, specific to this posting — not generic.

6. **Write metadata.** Create `public/applications/<id>/meta.json`:
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
     "fitSummary": "2-3 sentence honest assessment from step 5",
     "tailored": false,
     "keywords": ["..."],
     "jobPostingFile": "job-posting.md"
   }
   ```
   `status` still defaults to `"not_applied"` even though these are often postings the user already applied to once before — they update it themselves once they know this run's actual status.

7. **Auto-promote only on a clear match; ask first otherwise.**
   - If `fitRating` is `strong` or `good`, don't stop here — immediately continue into the full `add-application` treatment using the posting/keywords already gathered: read `public/settings.json` for the PDF filenames (stop and ask the user to fill in Settings first if it's missing/empty), invoke the `writer` subagent to tailor the resume and draft the cover letter, generate both PDFs, and write the full `meta.json` (add `resumeFile`/`resumePdf`/`coverLetterFile`/`coverLetterPdf`, set `tailored: true`) — see `add-application` steps 6–10 for the exact process. Don't ask the user whether to continue; this is the default behavior for these two ratings.
   - If `fitRating` is `partial` or `stretch`, stop at the screening-only entry (`tailored: false`, no resume/cover-letter fields), rebuild the manifest (step 8), report the rating and gaps, and ask the user whether to continue into the full tailoring treatment. Don't promote these without their go-ahead.

8. **Rebuild the manifest.** Run `npm run manifest` via Bash.

9. **Report back — briefly.** For a `partial` or `stretch` match: the rating, a one-line reason naming the genuine gaps, and a question asking whether to build out the full resume/cover letter. For anything auto-promoted (`strong`/`good`): the fit rating plus a one-line note that it's fully tailored (e.g. "Strong match — fully tailored, resume and cover letter ready"). The user is likely doing this for many postings in a row; don't write a paragraph per one, and don't re-explain the process each time.
