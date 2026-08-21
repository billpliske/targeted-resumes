# Changelog

Notable changes to this app, listed by version. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 1.4.0

- "Sync now" now also pulls down `original-resume.md` and `settings.json` (name, PDF filenames, personal project repos, manual projects) to a machine that doesn't have them yet — previously only per-application folders synced, so a fresh machine could see applications in the dashboard but Claude Code couldn't actually tailor or promote anything (no canonical resume or Settings to work from). Also pushes those files up the same way if this machine has them and the cloud doesn't.
- Fixed a real S3 permissions gap found while testing this: uploading a resume/cover-letter template in Settings was failing with a 403 in cloud mode — the storage access rule for that path needed a backend redeploy to take effect.

## 1.3.2

- Fixed "Sync" crashing with a raw "not valid JSON" error on a fresh machine with no local applications yet. A missing static file (`applications-manifest.json`, `amplify_outputs.json`) returns Vite's `index.html` app shell with a `200 OK` instead of a clean 404 — the code only checked the status, then tried to parse that HTML as JSON.
- Fixed a real gap in cloud sync: updating an application that already exists on both sides (e.g. Claude Code promoting a "screened only" entry to fully tailored) never pushed the change to the cloud — sync only handled "exists here but not there" cases. It now detects and pushes content updates too, without ever touching `status` (which only ever changes via the app itself, directly against the cloud) — so this can't undo a status change made from a different machine.

## 1.3.1

- Fixed "Sync now" silently showing "Up to date" (and staying disabled) when it actually failed to check sync status — it now shows a clear "Sync error" state with the real error message instead of hiding the failure.

## 1.3.0

- "Sync now" is now two-way: it still pushes applications created locally up to the cloud, but now also downloads applications that exist in the cloud but not on the current machine — so an application created on one computer becomes available for Claude Code to work with (e.g. "fully tailor this") on another, not just visible in the dashboard there.

## 1.2.1

- Fixed cloud mode silently showing a blank page instead of the login screen when `public/amplify_outputs.json` is missing or the backend can't be reached — now shows a clear error message instead.

## 1.2.0

- Added an optional cloud-backed mode (AWS Amplify + Cognito) for personal use: log in and see the same applications across multiple machines. Off by default — forking the repo and running it locally still works exactly as before, with zero new dependencies or setup required. Enabling it requires standing up your own AWS backend; it's not something a plain fork gets automatically.
- When enabled, a "Sync now" button pushes applications created locally (still generated the normal way, via Claude Code) up to the cloud — nothing syncs automatically, and the button disables itself once everything's up to date.
- Added an in-app "Change password" option for the cloud login.
- Dev server now defaults to port 5190 instead of Vite's default, with automatic fallback if it's taken.

## 1.1.1

- Fixed "Check listings" incorrectly marking open Ashby postings as filled. The check only looked for a schema.org marker that Ashby's `jobs.ashbyhq.com/<org>/<id>` board pages embed server-side when a job is live — but postings using Ashby's `?ashby_jid=` query-param embed style (its own generic careers page, or a company's custom domain embedding the widget) never include that marker at all, live or closed, so it was misread as closed every time.

## 1.1.0

- Added an "Interest" tab, generated alongside the tailored resume and cover letter — a short, casual, copy-paste-ready paragraph answering "why are you interested in working for our company?"-style application questions.
