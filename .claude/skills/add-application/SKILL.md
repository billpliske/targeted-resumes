---
name: add-application
description: Tailor Bill's resume and cover letter to a specific job posting and add it to the resume-targeter dashboard. Trigger on requests like "tailor my resume for this job", "add a new application", "target my resume to this posting", or when the user shares a job listing URL or pasted job description in this repo.
---

Produces a tailored resume, a standalone cover letter, and a PDF of each, saved into a new folder under `public/applications/`, then updates the dashboard's manifest so it shows up in the React app immediately.

## Inputs

- Pasted job posting text (the default — the in-app "Add a new application" box always provides this), optionally paired with the job URL.
- A URL by itself, with no pasted text, can still happen (e.g. Bill just drops a link in chat). The canonical source resume: `public/original-resume.md`. Never edit this file — it is read-only source material for every tailored version.

## Steps

1. **Get the posting.** If pasted text is provided, use it directly — don't attempt to fetch the URL, even if one is also given; it's only needed as a reference link (see step 4). If only a URL is given with no pasted text, fetch it and extract the plain-text posting (title, company, responsibilities, requirements). If that fetch fails, looks incomplete, or is blocked (common on LinkedIn/Workday/Ashby/Lever — many job boards render the posting client-side via JavaScript, which a plain fetch won't see), ask Bill to paste the job description text instead — don't guess at missing content.

2. **Extract key facts.** Identify: company name, exact role title, location (if listed), and 5–10 key requirement/keyword phrases the posting emphasizes (the specific technologies, responsibilities, and terms it repeats). Keep each keyword short (one to three words, e.g. "Next.js", "cross-functional collaboration") — the dashboard highlights these terms verbatim in the before/after resume compare view, so long sentence-length phrases won't match well.

3. **Create the application folder.** Build an id as `<YYYY-MM-DD>-<company-slug>-<role-slug>` using today's date and lowercase, hyphenated, punctuation-stripped slugs of the company and role. Create `public/applications/<id>/`.

4. **Save the job posting.** Write `public/applications/<id>/job-posting.md` — the source URL (if any) at the top, followed by the cleaned posting text.

5. **Tailor the resume.** Invoke the `writer` subagent (`.claude/agents/writer.md`) with `public/original-resume.md` and the extracted keywords. Instruct it to:
   - Tighten the five intro paragraphs into a focused professional summary using language that echoes the posting, without keyword-stuffing.
   - Write the summary in first person throughout, starting with "I'm a..." — this is a deliberate exception to the writer subagent's usual no-first-person-pronouns rule (which still applies to the job bullets below the summary).
   - Reword and reweight existing bullets toward the posting's terms and priorities — never invent skills, employers, titles, dates, or accomplishments Bill doesn't already have. Flag any real gap with `[NEEDS INPUT: ...]` rather than guessing.
   - Preserve the full job history, all dates, and the overall structure exactly as in the source resume.
   Save the result as `public/applications/<id>/resume.md`.

6. **Draft the cover letter.** Invoke the `writer` subagent again to expand the tailored summary into a standalone 3–4 paragraph cover letter addressed to this specific company/role, citing two or three concrete accomplishments from the resume, in AP style, with no fabrication. Close with "Sincerely," on its own line followed by "Bill" (first name only, not "Bill Pliske") on the next line — end the "Sincerely," line with two trailing spaces (a markdown hard break) so it renders as two separate lines rather than collapsing onto one. Save as `public/applications/<id>/cover-letter.md`.

7. **Generate PDFs.** Name the PDF files "Bill Pliske Resume.pdf" and "Bill Pliske Cover Letter.pdf" (not "resume.pdf"/"cover-letter.pdf") — this is what Bill actually uploads when applying, so it needs his name in the filename, not a generic one. The markdown source files keep their generic names (`resume.md`, `cover-letter.md`); only the PDF output filenames change. Run, via Bash:
   ```
   node scripts/generate-pdf.mjs "public/applications/<id>/resume.md" "public/applications/<id>/Bill Pliske Resume.pdf"
   node scripts/generate-pdf.mjs "public/applications/<id>/cover-letter.md" "public/applications/<id>/Bill Pliske Cover Letter.pdf"
   ```

8. **Write metadata.** Create `public/applications/<id>/meta.json` matching the `Application` shape in `src/types.ts`:
   ```json
   {
     "id": "<id>",
     "company": "<company>",
     "role": "<role>",
     "dateAdded": "<YYYY-MM-DD>",
     "jobUrl": "<url or omit if pasted>",
     "jobPostingSource": "url | pasted",
     "location": "<location, if known>",
     "status": "not_applied",
     "keywords": ["..."],
     "jobPostingFile": "job-posting.md",
     "resumeFile": "resume.md",
     "resumePdf": "Bill Pliske Resume.pdf",
     "coverLetterFile": "cover-letter.md",
     "coverLetterPdf": "Bill Pliske Cover Letter.pdf"
   }
   ```

   Always set `status` to `"not_applied"` for a newly created application — Bill updates it from the dashboard as he actually applies, hears back, etc. Don't guess a different starting status.

9. **Rebuild the manifest.** Run `npm run manifest` via Bash to regenerate `public/applications-manifest.json` from all folders' `meta.json` files.

10. **Report back.** Tell the user the folder path and remind them the new application now appears in the dashboard (`npm run dev`, or refresh if it's already running). Remind them to review the tailored content before uploading anywhere — nothing here should be uploaded unreviewed.
