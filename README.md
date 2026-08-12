# Targeted Resumes

A personal tool for tailoring my resume and cover letter to individual job postings, without inventing experience I don't have — and keeping every version organized in one place.

## How it works

There's no backend and no LLM API key. Generation happens through a Claude Code chat using this repo's `add-application` skill; the React app itself is a static, read-only dashboard that displays whatever's already been generated and saved to disk.

```
Paste a job posting  →  Claude tailors resume + cover letter  →  Dashboard shows it
   (in the app)          (in a Claude Code chat, via the           (browse, compare,
                          add-application skill)                    download PDFs)
```

## Using it

1. **Add a job posting.** Run `npm run dev` and open the app. Paste the full job posting text into the "Add a new application" box (the URL is optional — it's just saved as a reference link, since many job boards render their content via JavaScript and won't fetch cleanly). Click "Copy prompt for Claude."

2. **Hand it to Claude Code.** Paste the copied prompt into a Claude Code chat in this repo. It fetches/reads the posting, extracts key requirements, and uses the `writer` subagent to tailor `public/original-resume.md` into a resume and a standalone cover letter — rewording and re-emphasizing real experience to match the posting, never inventing skills or accomplishments. Genuine gaps get flagged, not papered over. It then generates PDFs and updates the dashboard.

3. **Review it.** Refresh the dashboard, click into the new application, and go through the tabs: Job Posting, Keyword Targeting (a before/after compare showing which terms from the posting actually got reinforced, and by how much), Resume, Cover Letter. Always review before using anything — nothing here should go out unreviewed.

4. **Apply.** Grab the PDFs — either the "Download PDF" links in the dashboard, or straight from `public/applications/<date>-<company>-<role>/` in Finder (named "Bill Pliske Resume.pdf" / "Bill Pliske Cover Letter.pdf", ready to upload as-is).

5. **Track it.** Update the application's status from the dropdown (Not Applied → Applied → Interviewing → Offer/Rejected) as things move. The home screen shows running counts per status, with click-to-filter.

## Where things live

```
public/
  original-resume.md              canonical source resume (never edited by the skill)
  applications/
    2026-08-12-acme-corp-role/
      job-posting.md
      resume.md              cover-letter.md
      Bill Pliske Resume.pdf     Bill Pliske Cover Letter.pdf
      meta.json                   company, role, status, keywords, etc.
  applications-manifest.json      generated index the dashboard reads (npm run manifest)
```

`public/original-resume.md`, `public/applications/`, and the manifest are gitignored — this repo can be pushed without pushing personal contact info or application history.

## Development

- `npm run dev` — start the dashboard (also runs the local `/api/status` and `/api/delete` endpoints the dashboard uses for one-click status edits and deletions — dev-only, no external calls, no secrets)
- `npm run lint` — ESLint
- `npm run manifest` — rebuild `public/applications-manifest.json` from each application's `meta.json` (the `add-application` skill does this automatically)
- `node scripts/generate-pdf.mjs <input.md> <output.pdf>` — render a markdown file to a styled PDF
