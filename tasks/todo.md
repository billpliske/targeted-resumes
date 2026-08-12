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

## Round 8 — fit rating, Personal Projects, and a fast triage path for reapplying

Bill explained the real driver behind wanting a fit assessment: he's already applied to ~90 jobs outside this tool and heard back from only ~10, and wants to selectively reapply to the strongest-fit ones from that backlog rather than blanket-reapplying to all ~80 unanswered. That reframed several decisions below.

**Fit rating.** Added `fitRating` (`strong`/`good`/`partial`/`stretch` — a qualitative scale rather than a fake-precise number) and `fitSummary` (2-3 sentences) to the `Application` type and `meta.json` schema. New `FitBadge` component, color-coded via the existing status color tokens (green/blue/amber/red). Shown as a badge next to the role in the list and prominently in the detail header with the full summary. Backfilled both existing applications from the fit analysis already produced during their original tailoring (Fleetio: partial — real B2B SaaS/mentoring overlap but missing Next.js/Tailwind/headless CMS/SEO/GA; GC AI: strong — a genuine hybrid design-engineering match). `add-application` skill updated with a new step 7 that generates this for every future application.

**Personal Projects section.** Bill shared two more repos (`social-videos`, `billpliske-portfolio`) and asked whether/how to reference personal-project work on the resume. Investigated both properly rather than trusting surface impressions:
- A screenshot of a custom admin analytics dashboard initially looked like it might be self-built rather than real Google Analytics — cloned `billpliske-portfolio` and read `docs/ANALYTICS_SETUP.md` plus the actual Lambda/GraphQL/store code, which confirmed genuine GA4 integration (tracking script + a secure server-side path to the Google Analytics Data API via AWS Lambda + Secrets Manager + GraphQL), e-commerce conversion-funnel event tracking, and a campaign-attribution report blending GA4 data with the site's own cart/conversion data. No committed credentials found.
- Cloned `social-videos` again at file-content level (not just README) and found genuine hand-authored animation code (Remotion's `interpolate()` across five templates) and real AI-tool integration (ElevenLabs for AI voice narration, Whisper for auto-transcribed captions) — closing the "UI animations" gap flagged earlier for the GC AI application.
- Had the `writer` subagent draft a new "Personal Projects" section appended to `public/original-resume.md` (two entries, 4-5 bullets each, matching the existing document's formatting exactly). Fixed one structural issue the agent flagged itself: it had used two consecutive `##` headings ("Personal Projects" then the project name); changed the project names to bold inline text under a single section heading instead. No fabricated metrics or invented facts — every bullet traces to something read directly in the code or docs. No project URLs included since Bill hasn't confirmed the live links yet.
- Existing applications (Fleetio, GC AI) still need to be re-tailored against the updated source to actually pick up this new content — not yet done as of this round.

**Fast triage path for the reapply backlog.** Built a parallel lightweight flow so Bill can screen many old postings without paying for full tailoring on each one:
- New `.claude/skills/check-fit/SKILL.md` — takes a posting, writes just `job-posting.md` + `meta.json` (fit rating/summary, keywords, no resume/cover letter/PDFs), reports back tersely (built for repeated back-to-back use across many postings, not a full explanation each time).
- Added a `tailored: boolean` field; `resumeFile`/`resumePdf`/`coverLetterFile`/`coverLetterPdf` are now optional in the `Application` type to support screening-only entries. Backfilled both existing applications with `tailored: true`.
- `add-application` SKILL.md gained a "Promoting a screened application" section: fully tailoring a previously-screened entry reuses its existing folder/id rather than creating a new one.
- `ApplicationDetail.tsx` gates the Keyword Targeting/Resume/Cover Letter tabs behind `application.tailored`, showing a "Screened only" hint with the exact phrase to use ("fully tailor the `<company>` application") instead of infinite loading states.
- `ApplicationList.tsx` shows a dashed "Screened only" badge next to screening-only entries, and gained a sort control (Date added / Fit rating, via a new `FIT_RATING_ORDER` map) alongside the existing search.
- `AddApplication.tsx` now has two submit buttons — "Check fit only" and "Copy prompt for Claude" — building a prompt for whichever skill, so the triage workflow is drivable straight from the dashboard.

Verified: `tsc -b` and `npm run lint` pass clean throughout. Tested the screened-only UI path end-to-end with a throwaway entry (created directly via files + manifest rebuild, confirmed the detail view correctly shows only the Job Posting tab and the right promotion hint text, deleted via the existing `/api/delete` endpoint afterward). Confirmed fit badges and the new "Check fit only" button render correctly live in Chrome.

**Still open:** re-tailor Fleetio and GC AI now that the source resume has the Personal Projects section, so their keyword compare views and fit ratings reflect it (Fleetio in particular should finally show real movement on Google Analytics). Bill is about to start working through his ~80-job reapply backlog using `check-fit`.

## Round 9 — intake box confusion, then simplified to screen-only

Bill expected the dashboard's purple button to trigger processing automatically rather than just copying a prompt to the clipboard. Explained the hard constraint honestly: a static page with no backend can't call an AI model without embedding a secret API key in browser JS, which was explicitly ruled out earlier — there's no version of "click and it just happens" that doesn't reintroduce that risk. Pointed out that for bulk-processing his ~80-job backlog, pasting straight into a Claude Code chat (skipping the dashboard entirely) is actually faster than the copy/switch-window/paste round-trip — he just needs to include the URL alongside the pasted text, which I parse out same as the box does.

Also discussed, but explicitly deferred rather than built: a cron-scheduled background Claude Code session that polls a locally-written queue file (same no-API-key pattern as the status/delete endpoints) so the button could trigger processing without a manual chat paste. Real tradeoffs (polling delay, added complexity, a background session needs somewhere to report results) meant it wasn't worth building mid-flight; if useful later, auto-**screening** is the better candidate for that treatment than auto-tailoring, since it's cheap and doesn't need a deliberate "yes, pursue this one" moment the way full tailoring does.

Bill's actual ask that came out of this: the two-button box (`check-fit` vs `add-application`) wasn't earning its complexity, since he'd rather do full tailoring by talking to Claude directly anyway. Simplified `AddApplication.tsx` to a single-purpose "Screen a job posting" form — one button, always builds a `check-fit` prompt. Full tailoring is chat-only now, no dashboard shortcut for it.

Also ran a real end-to-end application through the pipeline: Ancestry — Lead Product Designer (fully tailored, not just screened, since Bill confirmed intent to apply). Rated "good" — genuine substantive overlap (Gannett's design-guideline/pattern-library work maps directly to the posting's "define core interaction patterns and reusable components" ask, plus real mentoring and cross-functional-alignment history), but the `writer` subagent flagged an important, specific gap worth relaying: this posting lists a design portfolio as a **core requirement**, not a bonus, and there's no portfolio anywhere in Bill's background material — the single biggest risk to this application, more than any skill-keyword gap.

Verified: `tsc -b` and `npm run lint` pass clean; simplified intake box and the new Ancestry entry (with its "Good match" badge) both checked live in Chrome.

**Still open:** same as before (re-tailor Fleetio/GC AI against the Personal Projects section) — Bill hasn't done this yet, and the Ancestry portfolio gap is worth a direct conversation with him about whether to build one before applying.

## Round 10 — process fixes so future applications tailor better automatically

Started as cleanup on specific applications, surfaced two systemic problems worth fixing at the skill level so every future `add-application`/`check-fit` run benefits, not just this round's four.

**1. Keyword-targeting only does literal substring matching, not concept matching.** `KeywordCompare.tsx` counts exact phrases, case-insensitive — "prototypes"/"prototyped" doesn't count toward a "prototyping" keyword, "design-system ownership" doesn't count toward "design systems." Several tailored resumes had real, true experience that just wasn't worded to match, so the dashboard showed false 0→0s and made the tailoring look thinner than it was. Bill's expectation (correctly) is that tailoring should reword to hit the posting's exact phrasing whenever the underlying claim is genuinely true — that was always the intent, just not executed precisely. Fixed:
- `.claude/skills/add-application/SKILL.md` step 5 now explicitly instructs: reuse a keyword's exact phrase (grammatically adapted) whenever it's true, never force it when it isn't, and never leave `[NEEDS INPUT: ...]` gap-notes in the actual file body (a bug caught this round — they'd render straight into the PDF).
- Reworded **Ancestry** and **Kong** resumes to close the wording gap (6 of 8 keywords went from 0→0 to genuinely matching on both; the remaining zeros are real gaps, left alone rather than forced).

**2. No verified skills/tools inventory anywhere.** `original-resume.md` is narrative-only — no Skills section — so tool-specific keywords (Figma, Storybook, design tokens) had nowhere to surface even when true. Bill flagged he uses Storybook at Acronis; it had been wrongly disclosed as a gap on Kong's application until caught. Root-cause fix: new `public/personal-projects-skills.md`, a checklist dissected directly from reading code/`package.json` in Bill's two **public** GitHub repos (`billpliske-portfolio`, `social-videos` — specifically the ones he links from applications, not his local disk in general, which can differ from what's public) plus tools confirmed real by Bill but not in those repos (Storybook). Explicitly lists genuine gaps too (Figma-to-code/CodeConnect, Framer, formal test suite, formal accessibility audit) so future tailoring doesn't have to guess or re-ask every time. Wired into both `add-application` and `check-fit` skill instructions as a required read alongside `original-resume.md`.

**Applied the fixes to all four live applications** (checked each against the new skills file rather than assuming a blanket redo was needed):
- **Kong** — promoted from screened-only (files existed on disk but `meta.json` was never flipped to `tailored: true` — fixed). Reworded resume/cover letter for literal keyword matches, added the real Storybook experience, corrected the cover letter's now-inaccurate "I don't have Storybook" disclosure.
- **Consertus** — promoted from screened-only to fully tailored (rated "good," not "strong" — the `meta.json` fit summary in place before promotion turned out to be a stale copy-paste of GC AI's text). No changes needed post-skills-file since its one real gap (Figma) was already honestly disclosed.
- **GC AI** — re-tailored to pick up the Personal Projects section it was missing (added after this application was first created). Then, checked against the new skills file and caught a real error: the fit summary said accessibility was "neither a hard requirement," but the posting lists it under Required, not Nice to have — corrected, and added a true, modest accessibility bullet (ARIA-labeled markup, verified in the e-commerce site's actual code) rather than leaving the gap disclosure overly bleak.
- **Ancestry** — reworded for literal keyword matches (prototyping, design systems, interaction design, cross-functional collaboration). No skills-file-related changes needed.

**Also fixed, unrelated:** links inside rendered job-posting/resume/cover-letter markdown (e.g. the "Source: `<url>`" line) now open in a new tab — `MarkdownView.tsx` didn't set `target="_blank"` on markdown-rendered links before.

**Found, not fixed:** the **Fleetio** application (resume, cover letter, PDFs, `meta.json`) is gone from disk entirely — not touched this session, no trace in `public/applications/`, no git history since that folder is gitignored, nothing in Trash. Manifest now correctly shows 4 applications instead of 5. Bill needs to say whether to re-run it from scratch or if he has another copy somewhere.

Verified: `tsc -b` and `npm run lint` clean throughout. PDFs regenerated for every file that changed.

**Still open:** Fleetio needs to be re-added from scratch (or recovered) if Bill wants it back on the dashboard. Also worth asking Bill directly whether he has hands-on Figma-to-code/design-token experience (Kong/Consertus both asked, still unconfirmed) — if yes, `personal-projects-skills.md` needs updating and both applications would need another pass.

## Round 11 — "Check listings" button (proposed, not yet built)

Bill wants a header button that walks every application's job URL, detects dead links or "position filled" language, and auto-marks those as a new `filled` status — with filled rows grayed out and sorted to the bottom.

### Todo

- [x] `src/types.ts` — add `'filled'` to `ApplicationStatus` / `APPLICATION_STATUSES` (label "Filled")
- [x] `src/index.css` — add a `--status-filled` color pair (muted gray, light + dark variants), matching the existing per-status token pattern
- [x] `vite.config.ts` — new dev-only `POST /api/check-listing` endpoint (`{ id }` in, single application at a time): server-side `fetch()`s that app's `jobUrl` with a browser-like User-Agent and a ~15s timeout, classifies the result, and — only for `filled`/`broken` — writes the status to `meta.json` and rebuilds the manifest, same guarded path pattern as `/api/status`
- [x] `src/App.tsx` — `handleCheckListings()`: loops sequentially (not parallel — deliberate, so as not to hammer several job sites at once and so progress is visible one at a time) over applications that have a `jobUrl` and aren't already `filled`, calling `/api/check-listing` one at a time, updating local state as results land
- [x] Header UI — a "Check listings" button (far right of the `app-header` row, next to "Resume Targeter") with a `RefreshCw`-style icon (`lucide-react`, already a dependency); shows "Checking 3 of 9…" while running, then a short-lived summary ("Checked 9 — 2 marked Filled, 1 unreachable") next to it, same fade-after-a-few-seconds pattern `AddApplication.tsx` already uses for its "Copied" hint
- [x] `ApplicationList.tsx` — sort filled applications to the bottom regardless of the active sort (date/fit becomes the secondary key, "is filled" the primary key); add a `.application-row--filled` style (reduced opacity) in `App.css`
- [x] `StatusSummary.tsx` — the new "Filled" status gets a summary tile + filter, same as the other five (came free — it already derives tiles from `APPLICATION_STATUSES`)
- [x] Two-column homepage layout (added mid-round, Bill's request): widened `.app-shell` to 1240px; `.home-layout` grid puts the narrow "Screen a job posting" form in a ~240–300px left column and status tiles/search/sort/list in the right column (collapses to one column under 720px)

### Detection heuristic (server side, no new dependencies)

Verified against 3 of Bill's real example URLs by curling them with a browser-like User-Agent and inspecting the raw HTML (i.e., exactly what the new server-side `fetch()` will see — not what a browser with JS renders):

- Network error/timeout, or HTTP 404/410 → **broken** (confirmed: Airbnb's Greenhouse-hosted posting returns a plain 404 for a pulled listing)
- HTTP 200 whose raw HTML contains a closed-posting signal → **filled**:
  - LinkedIn `/jobs/view/<id>/`: confirmed closed listings statically render `<figcaption class="closed-job__flavor--closed">No longer accepting applications</figcaption>` — match on that class or phrase
  - Greenhouse `job-boards.greenhouse.io/<org>/jobs/<id>`: confirmed closed/removed listings 200-redirect to the org's root board with `?error=true` and a generic `<title>Jobs at <org>` — no plain-text message server-side, so detect this by comparing the final resolved URL to the requested one (path collapsed to the org root and/or `error=true` present)
  - Generic fallback phrase list for other boards (Lever, plain company career pages, etc.) — "no longer accepting applications," "position has been filled," "this posting has expired," "no longer active," case-insensitive
- Anything else (200 with no match, or a blocked/anomalous status like 403/500) → **inconclusive**, left alone, called out in the summary as "couldn't check"
- Both **broken** and **filled** results write `status: "filled"` to `meta.json` (per Bill's framing — either signal means "stop tracking this one")

**Confirmed real limitation:** LinkedIn's `/jobs/collections/recommended/...` feed-style URL (one of Bill's 4 examples) is algorithmic/client-rendered — the specific job's open/closed state never appears in the static HTML regardless of actual status, so it's structurally undetectable this way. Workday `ExternalCareerSite` links are almost certainly the same (full SPA), though not directly verified this round. These land in **inconclusive**, not a false "filled." Anything using a direct, job-specific static URL (LinkedIn `/jobs/view/`, Greenhouse, plain career pages) should work; algorithmic/feed URLs and heavy SPA boards won't be reliably auto-detected — Bill will still need to eyeball those manually.

Applications without a `jobUrl` (pasted-only postings) are skipped, not counted as errors.

Manual override stays available either way: the status dropdown is never locked, so any wrong auto-mark can be flipped back by hand.

**Verified live in Chrome** with a throwaway test entry pointed at a real closed LinkedIn posting Bill supplied (`/jobs/view/4443005111/`): clicking "Check listings" correctly classified it as a closed posting and flipped it to Filled — row went gray and sank below all 11 real applications regardless of the active date sort — while none of the 11 real, still-open applications' actual job URLs got a false positive (all 11 landed in "couldn't check," mostly Ashby/Greenhouse/JS-rendered boards, exactly the known limitation called out above). Test entry deleted afterward via `/api/delete`; dashboard reset to its real 11 applications. `tsc -b` and `npm run lint` pass clean.

**One layout bug found and fixed along the way:** narrowing `AddApplication.tsx`'s form into the new ~280px left column broke its button row — "Copy prompt for Claude" was wide enough to overflow its flex container and visually spill into the list column. Fixed by changing `.add-application-row` from a horizontal flex row to a vertical stack (input, then Clear, then Copy prompt, each full-width) — Bill confirmed this stacked layout is what he wanted anyway.
