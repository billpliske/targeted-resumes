# Targeted Resumes

**v1.0.0**

A tool for tailoring a resume and cover letter to individual job postings, without inventing experience the applicant doesn't have — and keeping every version organized in one place.

## Requirements

- Node.js
- [Claude Code](https://claude.com/product/claude-code) with an active subscription (or API billing set up) — this is what actually does the tailoring. There's no bundled or free AI access; you bring your own Claude Code.

## Quickstart

**1. Fork this repo, then clone your fork and install.**

```
git clone <your-fork-url>
cd targeted-resumes
npm install
```

**2. Start the dashboard.**

```
npm run dev
```

Open **http://localhost:5173**. Leave this terminal running for the whole session — it's the local server your browser talks to for everything except the AI tailoring itself.

**3. Fill out Settings.** Click the gear icon, top right.

- Your name and the PDF filenames you want (defaults to `<Your Name> Resume.pdf` / `<Your Name> Cover Letter.pdf`).
- Upload your resume as a markdown file (`.md`) — this becomes the source every application gets tailored from.
- Optional: a cover letter template (style reference only, never reused verbatim), and any personal projects worth citing (synced in step 4, below) — a public repo URL (GitHub, GitLab, Bitbucket, etc.) under "Personal project repos" if the code is readable, or, for a project with no linkable repo, a name/description/details entry under "Other personal projects — no repo."
- Click **Save**.

**4. Open a second window: Claude Code, in the same repo folder.**

```
cd targeted-resumes
claude
```

This is the two-window model for the whole app: your **browser tab** is the dashboard — where you paste postings, review results, and organize applications (I just keep them side by side). Your **terminal** is where the actual AI work happens — Claude reads your resume, tailors it, drafts the cover letter, generates PDFs. The dashboard can't do that part itself (no API key baked in, nothing automated) — pasting into this terminal is the step that does it. Keep both windows open and switch between them as you go.

If you added anything under Personal Projects in step 3, ask Claude here now: *"sync my personal projects."* Repo-backed projects get read and verified against real code, updating `personal-projects-skills.md`; no-repo projects get worded from what you wrote and written directly into your resume's Personal Projects section (the one deliberate exception to "the skills never edit your resume").

**5. Add a job posting.**

- **In the browser:** paste the full posting text into "Screen a job posting." Include the job URL too if you have it — **strongly recommended, not required**: it's what lets you click straight back to the real listing from the dashboard later when you're ready to apply, instead of hunting for it again on LinkedIn or wherever you found it. Click **Copy prompt for Claude**.
- **Switch to the terminal — this is the one point where you interact with it directly.** Paste, hit Enter. Claude reads the posting and rates the fit as strong, good, partial, or a stretch.
  - **Strong or good match:** Claude keeps going in that same turn — tailors your resume and cover letter and generates both PDFs, no extra prompting needed (usually well under a minute; you'll watch it happen).
  - **Partial match or a stretch:** Claude stops there instead of tailoring. It saves the posting and its fit rating/gaps to the dashboard (no resume or cover letter yet) and asks you, right in the terminal, whether to go ahead anyway. Say yes to continue immediately in that same turn, or decide later — the dashboard marks it "Screened only," and whenever you're ready you can just tell Claude *"fully tailor the `<Company>` application"* to pick up right where it left off.
- **Switch back to the browser and refresh.** The new application is in the list.

**6. Review it.** Click into the application and go through the tabs — Job Posting, Keyword Targeting, Resume, Cover Letter. Always read before sending anything out; nothing here is meant to go out unreviewed.

**7. Apply — grab the right file, every time.** Next to the Resume or Cover Letter tab:

- **Reveal in Finder** (Explorer on Windows, Open folder on Linux) — opens your file manager with *that application's* exact PDF selected. No ambiguity, even deep into a long session of applying to job after job.
- **Download PDF** — also safe now: the downloaded filename includes the company (e.g. `Jane Doe Resume - Acme Corp.pdf`), so it won't overwrite the last one in your Downloads folder.

**8. Track it.** Update status from the dropdown (Not Applied → Applied → Interviewing → Offer/Rejected/Filled) as things move. **Check listings** (top right) walks every application's job URL and flags dead/closed postings as Filled automatically — best-effort, some job boards render too little server-side to detect.

None of your personal data is committed to git — `public/settings.json`, `public/original-resume.md`, `public/cover-letter-template.md`, `public/personal-projects-skills.md`, `public/applications/`, and the generated manifest are all gitignored, so pushing changes back to your fork never risks leaking it.

## Where things live

```
public/
  original-resume.md              canonical source resume (hand-edited only, except the marked
                                   Personal Projects region sync-manual-projects manages)
  cover-letter-template.md        optional style/format reference (not tailored verbatim)
  personal-projects-skills.md     optional verified skills checklist (regenerated by update-personal-projects)
  settings.json                   name, PDF filenames, personal project repos + no-repo project entries
  applications/
    2026-08-12-acme-corp-role/
      job-posting.md
      resume.md              cover-letter.md
      <Your Name> Resume.pdf     <Your Name> Cover Letter.pdf
      meta.json                   company, role, status, keywords, etc.
  applications-manifest.json      generated index the dashboard reads (npm run manifest)
```

## Development

- `npm run dev` — start the dashboard (also runs the local dev-only API endpoints it uses: `/api/status`/`/api/delete` for status edits/deletions, `/api/reveal-file` for Reveal in Finder, `/api/settings` and `/api/upload-resume`/`/api/upload-cover-letter-template` for the Settings panel — no secrets, no external calls. Two endpoints *do* make external calls, deliberately: `/api/check-listing` fetches whatever job-posting URL you ask it to check, and `/api/latest-version` checks this repo's GitHub page once per load for a version nudge — both read-only, nothing of yours ever leaves your machine)
- `npm run lint` — ESLint
- `npm run manifest` — rebuild `public/applications-manifest.json` from each application's `meta.json` (the `add-application` skill does this automatically)
- `node scripts/generate-pdf.mjs <input.md> <output.pdf>` — render a markdown file to a styled PDF
