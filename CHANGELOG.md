# Changelog

Notable changes to this app, listed by version. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 1.1.1

- Fixed "Check listings" incorrectly marking open Ashby postings as filled. The check only looked for a schema.org marker that Ashby's `jobs.ashbyhq.com/<org>/<id>` board pages embed server-side when a job is live — but postings using Ashby's `?ashby_jid=` query-param embed style (its own generic careers page, or a company's custom domain embedding the widget) never include that marker at all, live or closed, so it was misread as closed every time.

## 1.1.0

- Added an "Interest" tab, generated alongside the tailored resume and cover letter — a short, casual, copy-paste-ready paragraph answering "why are you interested in working for our company?"-style application questions.
