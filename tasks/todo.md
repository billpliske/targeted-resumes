# Resume Targeter — Build Plan

## Context

Bill wants a personal tool to tailor his resume/cover letter to individual job postings. The workflow: give a job posting to a Claude Code chat, Claude tailors the resume (no invented experience) and a matching cover letter, saves both as markdown + PDF, and a local React dashboard lets him browse everything he's generated. Decided architecture: no backend server, no LLM API key — all generation happens through Claude Code chat sessions using existing file/web/shell tools; the React app is a static, read-only dashboard reading files already saved to disk (`public/applications/`).

## Todo

- [x] Add dependencies: `react-markdown`, `remark-gfm` (deps); `md-to-pdf` (devDep)
- [x] Add `.gitignore` entries for `public/applications/`, `public/applications-manifest.json`, and `public/original-resume.md` (personal job-search data + real contact info)
- [x] Create `src/types.ts` with the `Application` interface
- [x] Create `scripts/build-manifest.mjs` — scans `public/applications/*/meta.json`, writes sorted `public/applications-manifest.json`
- [x] Create `scripts/generate-pdf.mjs` + `scripts/pdf/theme.css` — `md-to-pdf` wrapper for turning resume/cover-letter markdown into styled PDFs
- [x] Create `src/components/MarkdownView.tsx` — shared `react-markdown` + `remark-gfm` renderer
- [x] Create `src/components/ApplicationList.tsx` — list of applications sorted by date added, descending
- [x] Create `src/components/ApplicationDetail.tsx` — job posting summary + keyword compare + tailored resume + cover letter (rendered + PDF download links)
- [x] Rewrite `src/App.tsx` — replace stock Vite scaffold with list/detail dashboard (simple `useState` view switch, no router)
- [x] Clean up stock scaffold leftovers: `src/App.css`/`src/index.css` styling, removed unused `hero.png`, `react.svg`, `vite.svg`, `public/icons.svg`
- [x] Create `.claude/skills/add-application/SKILL.md` — codifies the repeatable "fetch posting → tailor via `writer` subagent → write files → generate PDFs → rebuild manifest" workflow for future sessions
- [x] Add `"manifest": "node scripts/build-manifest.mjs"` npm script
- [x] `npm install`, start dev server, open in Chrome to verify the empty-state dashboard renders correctly
- [x] Run the `add-application` skill end-to-end on a real job posting (Fleetio — Web Developer) to verify the full pipeline
- [x] Move canonical resume from `src/assets/original-resume.md` to `public/original-resume.md` so the browser can fetch it for the compare view
- [x] Build `src/components/KeywordCompare.tsx` — before/after keyword-highlighted side-by-side resume view
- [x] Build `src/components/AddApplication.tsx` — in-app URL intake box that copies a ready-to-paste Claude prompt to the clipboard

## Notes / decisions already locked in

- One folder per application: `public/applications/<YYYY-MM-DD>-<company-slug>-<role-slug>/` containing `job-posting.md`, `resume.md`, `resume.pdf`, `cover-letter.md`, `cover-letter.pdf`, `meta.json`
- PDF generated automatically every time a tailored resume/cover letter is created (via `md-to-pdf`, not raw Puppeteer/pandoc)
- No application-status tracking (applied/interviewing/etc.) — browsing only, kept minimal
- Canonical resume (`public/original-resume.md`) stays untouched as tailoring source — no Skills/Education section added, no restructuring
- No `react-router` — a personal two-view tool doesn't need it
- In-app "Add application" box stages a clipboard prompt rather than writing to disk directly (kept the no-backend, no-permissions architecture); Chrome's File System Access API was considered as an alternative for a more automatic queue-based flow but not built — flagged for Bill to decide if he wants it later

## Review

Built a Vite/React dashboard (`src/App.tsx` + `src/components/*`) that reads tailored resumes/cover letters from `public/applications/<id>/`, driven by a generated `public/applications-manifest.json`. Added a `.claude/skills/add-application/SKILL.md` that codifies the repeatable Claude Code workflow: fetch/paste a job posting, extract keywords, tailor the resume and write a standalone cover letter via the `writer` subagent (no fabricated experience — gaps get flagged instead), generate PDFs via `scripts/generate-pdf.mjs` (`md-to-pdf` + a custom `scripts/pdf/theme.css`), write `meta.json`, and rebuild the manifest via `scripts/build-manifest.mjs`.

Ran the full pipeline end-to-end against a real posting (Fleetio — Web Developer, remote). The `writer` subagent correctly refused to fabricate matches for keywords Bill doesn't have real experience with (Next.js, Tailwind CSS, headless CMS/Sanity, formal SEO, Google Analytics/Search Console) — those show 0→0 in the keyword compare view — while genuinely honoring real overlaps (B2B SaaS background at Acronis, mentoring, cross-functional collaboration). The cover letter openly names the stack gap as an area of interest rather than pretending expertise.

Added two things beyond the original plan, both requested mid-build:
1. **Keyword compare view** (`KeywordCompare.tsx`) — a before/after side-by-side of the original vs. tailored resume with job-posting keywords highlighted and counted, so it's visible at a glance which terms were genuinely reinforced.
2. **In-app "Add application" box** (`AddApplication.tsx`) — lets Bill paste a job URL directly into the running dashboard; it copies a ready-to-send prompt to the clipboard rather than writing to disk itself, keeping the no-backend architecture intact.

Moved the canonical resume from `src/assets/original-resume.md` to `public/original-resume.md` so the browser can fetch it for the compare view, and gitignored it alongside the generated `applications/` data since it contains Bill's real name, email, and phone number.

Verified: `tsc -b` and `npm run lint` both pass clean; dev server runs; empty state, populated list, detail view, keyword compare, and both PDFs were checked live in Chrome.

**Open item for Bill:** the tailored resume inherited one cosmetic quirk from the original — some job entries' date lines are indented (rendering as a monospace code block) while others aren't, an inconsistency already present in the source resume that was preserved intentionally per "don't restructure the source." Worth a quick manual formatting pass in the source resume if it bothers him, since every future tailored version will inherit it.

## Round 2 — resume cleanup sync + scaling for 40-50+ applications

Bill cleaned up `public/original-resume.md` himself (fixed the Acronis title to "Senior Programmer / Design Engineer," changed heading levels, added `<br>` spacing, removed a stray empty heading). Re-tailored the Fleetio resume from the updated source via the `writer` subagent and regenerated its PDF. This surfaced a real bug: `<br>` tags rendered as literal text in the dashboard because `react-markdown` doesn't render raw HTML by default — fixed by adding `rehype-raw`. The PDF was unaffected since `md-to-pdf`'s underlying `marked` parser passes raw HTML through by default.

Bill then flagged that the dashboard needs to scale to 40-50+ applications. Built two changes to address it:
- **Tabs in `ApplicationDetail.tsx`** — Job Posting / Keyword Targeting / Resume / Cover Letter are now separate tabs instead of one long scrolling page (Keyword Targeting tab only shows if the application has keywords).
- **Search in `ApplicationList.tsx`** — a search box filters applications by company, role, or keyword; list stays sorted by date added.

Also fixed a related paper-cut found while testing tabs: the keyword compare view's plain-text panes (`KeywordCompare.tsx`) showed literal `<br>` text too, since that view renders raw text rather than through `react-markdown`. Added a `stripHtmlBreaks` helper to convert `<br>` tags to real line breaks before display/highlighting.

Verified: `tsc -b` and `npm run lint` pass clean; tabs, search filtering, and the cleaned-up keyword compare panes all checked live in Chrome.

**Still open:** Bill is about to share a second personal-project repo (a personal site with an admin panel and Google Analytics integration across marketing campaigns) to potentially add a "Personal Projects" section to the canonical resume — this would be a real structural change to `public/original-resume.md`, deferred until Bill provides that repo and confirms scope/specifics (no fabrication — need his actual description of what it does, metrics if any, and tech stack).

## Round 3 — second test application to exercise search

Added a second application (GC AI — Design Engineer, pasted job posting since Ashby's job boards render client-side and `WebFetch` couldn't pull the description) to verify search/list behavior with more than one entry. This role turned out to be an unusually strong genuine match — Bill has literally worked the hybrid design+engineering seat before (UX/UI lead designer + front-end dev at Acronis, design-system/style-guide work at Court Technology Services and Gannett, decade-plus of mentoring). Keyword compare confirms it: React 3→4, design systems 0→1, component architecture 0→1, B2B SaaS 0→3, while honestly showing 0→0 for genuine gaps (accessibility standards, UI animations, Framer).

Verified live in Chrome with two applications present: search correctly filters by company/role/keyword (tested "framer" → GC AI only, and a no-match query → correct empty state), list sorting, and the second application's full tab flow (job posting, keyword compare, resume, cover letter).

## Round 4 — cover letter/resume style tweaks

Two standing style conventions requested and applied to both existing applications plus persisted into `.claude/skills/add-application/SKILL.md` for all future ones:
- Resume professional summary rewritten fully in first person, starting "I'm a..." (was third-person "Design engineer who...").
- Cover letter sign-off changed to "Sincerely," / "Bill" (first name only) on separate lines — required a markdown hard break (trailing two spaces) since a plain single newline collapses onto one line when rendered.

## Round 5 — application status tracking

Bill wants to track submission status (not applied / applied / interviewing / offer / rejected) per application, editable via a one-click dropdown in the dashboard, plus a home-page summary of counts by status. This reintroduces a small "backend," but a narrowly scoped one — unlike the earlier no-backend decision (which was about avoiding a secret LLM API key and CORS-sensitive external fetches), this is just a local dev-only file write with no secrets or external calls involved. Confirmed with Bill before building.

Implementation:
- `src/types.ts` — added `ApplicationStatus` type and `status` field on `Application`.
- `scripts/build-manifest.mjs` — refactored to export a reusable `buildManifest()` function (previously ran as a side effect on import), so both the CLI and the new API route can call the same logic.
- `vite.config.ts` — added a `statusApiPlugin` using Vite's `configureServer` hook (dev-server only, never runs in a production build) exposing `POST /api/status` with `{ id, status }`, which writes to the application's `meta.json` and rebuilds the manifest. Validates status against the known set and guards the resolved path stays inside `public/applications/`.
- `src/components/StatusSelect.tsx` — the dropdown, color-coded per status (gray/blue/amber/green/red, defined as CSS variables in `src/index.css` with light/dark variants). Stops click *and* keydown propagation so it doesn't trigger the parent row's click-to-navigate — this was a real bug caught during testing (pressing Enter to confirm a selection was also bubbling up and navigating into the detail page).
- `src/components/StatusSummary.tsx` — home-page stat tiles (Total + one per status), clickable to filter the list.
- `ApplicationList.tsx` / `ApplicationDetail.tsx` / `App.tsx` — wired the dropdown into both the list rows and the detail header; status filter combines with the existing search box; status changes update optimistically in React state and roll back with an alert if the API call fails (e.g., dev server not running).
- Updated both existing applications' `meta.json` to add `"status": "not_applied"` and updated the `add-application` skill so every future application starts there too — Claude never guesses a different starting status.

Verified: `tsc -b` and `npm run lint` pass clean. Tested the API directly via curl (status write + manifest rebuild both correct) since native `<select>` dropdowns don't automate reliably through the browser screenshot tool. Confirmed live in Chrome: status pill colors, summary tiles updating correctly, click-to-filter by status, and the detail-page dropdown. Reset test data back to "not_applied" afterward so real tracking starts clean.

## Aside — portfolio repo security check (not a resume-targeter change)

Bill shared a second personal repo (`billpliske-portfolio` — a Vue/AWS Amplify e-commerce/admin site) as potential Personal Projects material, noting it had been private until that day. Cloned it to a scratch directory and checked both the current tree and full git history (not just current state) for leaked secrets — found none: `.env.production` is intentionally committed and contains only two non-secret flags, and the two env var names an AI summary had flagged as "potentially exposed" (`MAILERSEND_API_KEY`, `SHIPPO_API_TOKEN`) are only ever referenced as `process.env.X`, never hardcoded, anywhere in history. Scratch clone deleted after the check. Genuine tech stack found (Lambda, AppSync/GraphQL, DynamoDB, Cognito, Square/Shippo/MailerSend integrations, admin dashboard merging multiple customer data sources) is broader than what Bill originally described — no explicit Google Analytics integration turned up, which Bill has not yet clarified. The "Personal Projects" resume section is still deferred pending that clarification.

## Round 6 — job posting intake: text-paste by default instead of URL

Bill asked whether pasting a URL has any real benefit over pasting the job posting text directly in the "Add a new application" box. Real answer: not much — many modern ATS platforms (Ashby, Lever, Workday, some LinkedIn/SPA pages) render the posting client-side via JavaScript, so a plain fetch silently returns little or nothing (already hit this exact failure with GC AI's Ashby posting). The one genuine benefit of a URL — it becomes the "View original job posting" reference link in the dashboard — doesn't require URL to be the *primary* input.

Changed `src/components/AddApplication.tsx`: the box now leads with a required textarea for pasted job posting text, with the URL field demoted to optional/secondary (explicitly labeled "saved as a reference link"). Updated `.claude/skills/add-application/SKILL.md` step 1 to match: pasted text is used directly whenever provided (never attempts a fetch even if a URL is also given), and a URL-only fetch is now the fallback path rather than the default. Added `.add-application-textarea` styling in `App.css`.

Verified: `tsc -b` and `npm run lint` pass clean; new layout checked live in Chrome.

## Round 7 — delete applications, red trash icon, PDF filenames

Three related changes:

1. **Delete an application.** Same pattern as status editing: a new dev-only `/api/delete` endpoint in `vite.config.ts` (`deleteApiPlugin`) removes an application's folder recursively and rebuilds the manifest. Refactored the shared path-validation logic (`resolveApplicationDir`) and body-parsing (`readJsonBody`) out of `statusApiPlugin` so both endpoints use the same guarded, path-traversal-safe helpers. `App.tsx` adds a `handleDelete` that confirms via `window.confirm` (destructive, no undo — files aren't in git since `public/applications/` is gitignored) before calling the API, then removes the item from state. Delete buttons added to both `ApplicationList` rows and the `ApplicationDetail` header.
2. **Icon instead of text.** Installed `lucide-react` (the icon set shadcn/ui itself uses) for a `Trash2` icon rather than adopting all of shadcn/ui's Tailwind/Radix stack, which would have been a much bigger architecture change than this app needs. Styled red via the existing `--status-rejected` color token.
3. **PDF filenames.** Bill asked whether PDFs were already saved per-company-folder with his name in the filename — the per-application folder part was already true, but the files were generically named `resume.pdf`/`cover-letter.pdf`. Renamed both existing applications' PDFs to "Bill Pliske Resume.pdf" and "Bill Pliske Cover Letter.pdf" (the markdown source files keep generic names — only the PDF, which is what actually gets uploaded, needed the real name), updated both `meta.json` files and rebuilt the manifest, and updated the `add-application` skill so every future application generates PDFs with this naming convention automatically.

Also saved a memory (`name_spelling_pliske`) noting that voice-dictated messages sometimes transcribe "Pliske" as "Pliskey" — always use the correct spelling regardless of how a dictated message renders it.

Verified: `tsc -b` and `npm run lint` pass clean (had to fix an `any` type flagged by the linter in the new shared API helper). Tested the delete flow safely by creating a throwaway duplicate application, deleting it via direct API call (curl) rather than automating the native `confirm()` dialog through the browser, confirming the folder was removed and the manifest correctly dropped back to the 2 real applications. Confirmed the renamed PDF is served correctly at its space-containing filename. Checked the icon buttons and detail-header delete button live in Chrome.
