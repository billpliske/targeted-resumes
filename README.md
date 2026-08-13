# Targeted Resumes

A tool for tailoring a resume and cover letter to individual job postings, without inventing experience the applicant doesn't have — and keeping every version organized in one place.

## Requirements

- Node.js
- [Claude Code](https://claude.com/product/claude-code) with an active subscription (or API billing set up) — this is what actually does the tailoring. There's no bundled or free AI access; you bring your own Claude Code.

## How it works

There's no backend and no LLM API key baked into this app. Generation happens through a Claude Code chat using this repo's `add-application` skill; the React app itself is a static, read-only dashboard that displays whatever's already been generated and saved to disk.

```
Paste a job posting  →  Claude tailors resume + cover letter  →  Dashboard shows it
   (in the app)          (in a Claude Code chat, via the           (browse, compare,
                          add-application skill)                    download PDFs)
```

## Setup (if you've forked this)

1. `npm install`, then `npm run dev` and open the app.
2. Click the gear icon (top right) to open **Settings**. Enter your name and the PDF filenames you want tailored resumes/cover letters saved as (these default to `<Your Name> Resume.pdf` / `<Your Name> Cover Letter.pdf` — edit if you want something else).
3. Upload your resume as a markdown file — this becomes the canonical source every application gets tailored from. No PDF/DOCX support; write or convert it to markdown first. Optionally upload a cover letter template too (a voice/format reference — cover letters are drafted fresh per posting, not reused verbatim).
4. Optional: if you have public GitHub repos worth citing (a portfolio site, a side project) — genuinely useful if you list one on applications — add their URLs under **Personal project repos** in Settings (paste a URL, click Add; click the trash icon to remove one later). Click Save, then ask Claude Code, in a chat in this repo, to "sync my personal projects." That runs the `update-personal-projects` skill, which clones each repo fresh and reads the actual code — dependencies, real integrations, what's genuinely there — to regenerate `public/personal-projects-skills.md`. **Don't hand-write that file from memory or ask an AI to guess at it** — that risks the exact fabrication this tool is built to avoid; the skill exists specifically so nothing in it is invented. Re-run the sync any time you add, remove, or meaningfully change a repo. Skip this step entirely if you don't need it — both tailoring skills work fine without the file.

No separate indexing or setup step is needed before your first job posting — keywords aren't pre-built from your resume ahead of time. Each application's skill extracts its own 5–10 keywords straight from that job posting's text, on the spot, and compares them against whatever's currently in your resume file. Posting #1 and posting #100 both work the same way.

None of this is committed to git — `public/settings.json`, `public/original-resume.md`, `public/cover-letter-template.md`, `public/personal-projects-skills.md`, `public/applications/`, and the generated manifest are all gitignored, so forking and pushing your own changes back never risks leaking your personal data.

## Using it

1. **Add a job posting.** Paste the full job posting text into the "Screen a job posting" box (the URL is optional — it's just saved as a reference link, since many job boards render their content via JavaScript and won't fetch cleanly). Click "Copy prompt for Claude."

2. **Hand it to Claude Code.** Paste the copied prompt into a Claude Code chat in this repo. It fetches/reads the posting, extracts key requirements, and uses the `writer` subagent to tailor your resume into a resume and a standalone cover letter — rewording and re-emphasizing real experience to match the posting, never inventing skills or accomplishments. Genuine gaps get flagged, not papered over. It then generates PDFs and updates the dashboard.

3. **Review it.** Refresh the dashboard, click into the new application, and go through the tabs: Job Posting, Keyword Targeting (a before/after compare showing which terms from the posting actually got reinforced, and by how much), Resume, Cover Letter. Always review before using anything — nothing here should go out unreviewed.

4. **Apply.** Grab the PDFs — either the "Download PDF" links in the dashboard, or straight from `public/applications/<date>-<company>-<role>/` in Finder, named whatever you set in Settings, ready to upload as-is.

5. **Track it.** Update the application's status from the dropdown (Not Applied → Applied → Interviewing → Offer/Rejected/Filled) as things move. The home screen shows running counts per status, with click-to-filter. The "Check listings" button walks every application's job URL and flags dead or closed postings as Filled automatically (best-effort — some job boards render enough server-side to detect, others don't).

## Where things live

```
public/
  original-resume.md              canonical source resume (never edited by the skill)
  cover-letter-template.md        optional style/format reference (not tailored verbatim)
  personal-projects-skills.md     optional verified skills checklist (regenerated by update-personal-projects)
  settings.json                   name, PDF filenames, personal project repo URLs
  applications/
    2026-08-12-acme-corp-role/
      job-posting.md
      resume.md              cover-letter.md
      <Your Name> Resume.pdf     <Your Name> Cover Letter.pdf
      meta.json                   company, role, status, keywords, etc.
  applications-manifest.json      generated index the dashboard reads (npm run manifest)
```

## Development

- `npm run dev` — start the dashboard (also runs the local dev-only API endpoints the dashboard uses: `/api/status` and `/api/delete` for one-click status edits/deletions, `/api/check-listing` for the dead-listing checker, `/api/settings` and `/api/upload-resume`/`/api/upload-cover-letter-template` for the Settings panel — no external calls, no secrets)
- `npm run lint` — ESLint
- `npm run manifest` — rebuild `public/applications-manifest.json` from each application's `meta.json` (the `add-application` skill does this automatically)
- `node scripts/generate-pdf.mjs <input.md> <output.pdf>` — render a markdown file to a styled PDF
