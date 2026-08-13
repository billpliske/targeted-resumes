---
name: sync-manual-projects
description: Write manually-described personal projects (no repo — configured in the dashboard's Settings panel) into public/original-resume.md's Personal Projects section as real resume bullets, worded from what the user told you. Trigger on requests like "sync my manual projects", "add my project to the resume", "update my personal projects on the resume", or after the user has added/removed a manually-described project in Settings.
---

Writes manually-described personal projects into the resume itself, so they get reworded per posting like every other Personal Projects entry does during tailoring. Unlike `update-personal-projects` (which verifies GitHub/GitLab/Bitbucket repos by reading real code), this skill has no code to verify against — the output is worded from what the user tells you, the same trust model already used for their job-history bullets: not independently fact-checked, but never invented either.

## Input

Read `public/settings.json`'s `manualProjects` — a list of `{ name, description, details }` entries the user maintains in the Settings panel (gear icon), under "Other personal projects — no repo." If the list is empty, tell the user there's nothing to sync (and that they can add one via Settings) and stop here.

## Steps

1. **Read `public/original-resume.md`.** This is the one explicit, narrow exception to every other skill's "never edit `original-resume.md`" rule — scoped only to the marked region described in step 3, nothing else in the file.

2. **Draft resume bullets from the user's own words, for each manual project.** Write 3–5 action-verb-led bullets (AP style: no first-person, no "responsible for"/"duties included," quantify only real numbers the user actually gave you, parallel grammatical structure) purely from what's in that project's `details` field — this is wording, not fact-checking. Never add a technology, outcome, or scope the user didn't mention, even if it would make the bullets stronger or a better keyword match. If `details` is thin, write fewer, more modest bullets rather than padding with invented specifics — a short, honest entry is correct behavior here, not a failure. Match the existing hand-written entries' format exactly: `**<name>** — <description>` (use the project's `description` field; if it's empty, write a short neutral one-liner instead of leaving it blank) followed by a blank line, then the bullets, with a `<br>` separating multiple projects.

3. **Regenerate the whole marked region from scratch each run, don't patch bullets in place.** Look for `<!-- BEGIN: sync-manual-projects -->` … `<!-- END: sync-manual-projects -->` in `original-resume.md`. If found, replace everything between the markers with freshly-drafted bullets for the *current* full `manualProjects` list. If the markers don't exist yet, add them at the very end of the file (Personal Projects is currently the last section), preceded by a `<br>` to match the spacing already used between existing entries:
   ```markdown
   <br>

   <!-- BEGIN: sync-manual-projects (auto-generated from Settings — don't hand-edit; re-run the sync-manual-projects skill instead) -->

   **<name>** — <description>

   * <bullet>
   * <bullet>

   <!-- END: sync-manual-projects -->
   ```
   This regenerate-from-scratch approach is what makes removal work correctly: take a project out of Settings, and it disappears from the resume on the next sync with no manual cleanup — the same pattern `update-personal-projects` already uses for `personal-projects-skills.md`.

4. **Write the file**, preserving everything outside the marked region exactly as it was — don't touch the hand-written entries above it, don't touch job history, don't touch the summary.

5. **This only touches the resume file.** If the user also wants a repo-backed project added to `personal-projects-skills.md`, that's `update-personal-projects` — a separate skill, separate trust model.

6. **Report back briefly.** Which project(s) were written, and flag plainly if any project's `details` was thin enough that the bullets came out sparse — the user may want to add more detail in Settings and re-sync.
