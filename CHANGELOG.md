# Changelog

Notable changes to this app, listed by version. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

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
