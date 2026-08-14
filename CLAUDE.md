# CLAUDE.md

Project-specific instructions for Claude Code when working in this repo (`targeted-resumes`). These apply on top of any global `~/Documents/CODE/CLAUDE.md` instructions.

## Versioning

Bill bumps this app's version by hand-editing `package.json`, not via git tags or a release process. When creating a commit in this repo (and only when actually committing — not for every edit), bump the **patch** digit in `package.json`'s `version` field first, before staging, unless the change clearly warrants a minor or major bump instead (use judgment: a new user-facing feature → minor; a breaking change to the data/settings format → major; everything else, including most bug fixes and small additions → patch).

Whenever `package.json`'s version changes, also update the `**vX.Y.Z**` badge at the top of `README.md` to match, in the same commit.

Also add an entry to `CHANGELOG.md` in the same commit — a new `## X.Y.Z` heading (newest on top) with one or two short bullets describing what changed, in plain language a forker skimming the file would understand. Keep it terse: this is a changelog, not commit-message prose. Skip it only for changes that don't affect the shipped app at all (e.g. editing this file, or a skill/CLAUDE.md-only change with no code impact).

**Why:** The app shows its own version next to the title and checks GitHub for a newer one to nudge forkers that an update exists (see `/api/latest-version` in `vite.config.ts`). That check only works if the version number actually moves forward with real changes. Bill relies on Claude Code to remember this consistently rather than enforcing it via CI, since he does his commits and pushes through Claude Code rather than directly — confirmed 2026-08-13.
