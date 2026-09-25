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

1. **Get the posting.** Same as `add-application` step 2 — prefer pasted text, fall back to fetching a bare URL, ask for pasted text if that fetch fails or looks incomplete. This includes the same scam-source check: if the posting is from HireFeed or micro1 (URL or posting text names either), stop before creating anything and ask the user whether they still want to proceed — see `add-application` step 2 for the exact flagged-source list and wording.

2. **Extract key facts.** Company name, exact role title, location (if listed), and 5–10 short keyword phrases (one to three words each) the posting emphasizes.

3. **Check the location/commute gate.** Bill is based in the Phoenix, AZ metro area. Determine whether the posting is fully remote or expects any hybrid/on-site presence — look for explicit language ("remote," "fully remote," "100% remote," "hybrid," "on-site," "in-office," "campus-based/home-based," "N days a week in office"). Treat it as fully remote only when the posting says so explicitly; treat anything hybrid, on-site, or ambiguous-but-tied-to-an-office as requiring a commute. **If it's genuinely fully remote, skip this gate entirely** — location doesn't matter.

   If it requires a commute, judge whether the posting's location is within roughly 25 miles of Tempe, AZ. Tempe, Phoenix, Scottsdale, Mesa, Chandler, Gilbert, Guadalupe, and Paradise Valley are comfortably inside; Glendale, Peoria, Surprise, Queen Creek, and Apache Junction are borderline — use your best judgment on actual driving distance and flag your uncertainty in the final report rather than guessing silently. If the location is outside that range, or no Phoenix-metro location is given at all for a role that clearly requires one, **the gate fails**.

   A failed gate is a hard override: regardless of how strong the skills fit looks in step 5, this application never gets auto-promoted (step 7) without the user's explicit go-ahead.

4. **Create the application folder.** Same id scheme as `add-application`: `<YYYY-MM-DD>-<company-slug>-<role-slug>` under `public/applications/`.

5. **Save the job posting.** Write `public/applications/<id>/job-posting.md` (source URL at top if given, then the cleaned posting text) — same as `add-application` step 6. If the posting lists a salary/compensation figure, add a `Compensation:` line right under the location/remote-status line near the top, in addition to leaving it wherever it appears further down (e.g. alongside benefits) — don't move it, just also surface it up top so it's visible without scrolling.

6. **Assess the fit.** Read `public/original-resume.md` and compare it against the posting directly (no need for the `writer` subagent here — this is analysis, not resume writing). Write:
   - `fitRating`: `strong`, `good`, `partial`, or `stretch` — be honest, not encouraging. A `stretch` rating that saves the user from reapplying to a bad-fit posting is the whole point of this skill. This is a skills-only read — assess it the same way regardless of what the location gate said.
   - `fitSummary`: 2–3 sentences naming genuine overlaps and genuine gaps, specific to this posting — not generic. If the location gate in step 3 failed, put the geographic disqualification first, ahead of the skills read — e.g. "Outside commute range: hybrid role based in `<city>`, ~`<n>` miles from Tempe, AZ. " followed by the normal skills summary.

7. **Write metadata.** Create `public/applications/<id>/meta.json`:
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
     "fitSummary": "2-3 sentence honest assessment from step 6",
     "tailored": false,
     "keywords": ["..."],
     "jobPostingFile": "job-posting.md"
   }
   ```
   `status` still defaults to `"not_applied"` even though these are often postings the user already applied to once before — they update it themselves once they know this run's actual status. If the location/commute gate in step 3 failed, add `"outOfCommuteRange": true` to this object — the dashboard renders a standing warning badge/banner off this field, so it's the actual mechanism that protects the user from missing the geographic disqualification later while browsing. Omit the field entirely (don't write `false`) when the gate passed or didn't apply.

8. **Auto-promote only on a clear match; ask first otherwise.**
   - **If the location/commute gate in step 3 failed, never auto-promote** — stop at the screening-only entry regardless of `fitRating`, rebuild the manifest (step 9), and report the geographic disqualification to the user, asking whether they want the full resume/cover letter built anyway (e.g. they're open to relocating or the commute).
   - Otherwise, if `fitRating` is `strong` or `good`, don't stop here — immediately continue into the full `add-application` treatment using the posting/keywords already gathered: read `public/settings.json` for the PDF filenames (stop and ask the user to fill in Settings first if it's missing/empty), invoke the `writer` subagent to tailor the resume and draft the cover letter, generate both PDFs, and write the full `meta.json` (add `resumeFile`/`resumePdf`/`coverLetterFile`/`coverLetterPdf`, set `tailored: true`) — see `add-application` steps 7–11 for the exact process. Don't ask the user whether to continue; this is the default behavior for these two ratings.
   - If `fitRating` is `partial` or `stretch`, stop at the screening-only entry (`tailored: false`, no resume/cover-letter fields), rebuild the manifest (step 9), report the rating and gaps, and ask the user whether to continue into the full tailoring treatment. Don't promote these without their go-ahead.

9. **Rebuild the manifest.** Run `npm run manifest` via Bash.

10. **Report back — briefly.** For a location-gate failure: lead with that (city, approximate distance, hybrid/on-site status) and ask whether to build the full resume/cover letter anyway. For a `partial` or `stretch` skills match: the rating, a one-line reason naming the genuine gaps, and a question asking whether to build out the full resume/cover letter. For anything auto-promoted (`strong`/`good`): the fit rating plus a one-line note that it's fully tailored (e.g. "Strong match — fully tailored, resume and cover letter ready"). The user is likely doing this for many postings in a row; don't write a paragraph per one, and don't re-explain the process each time.
