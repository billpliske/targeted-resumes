# Personal Projects — Verified Skills Reference

Source of truth for what's genuinely demonstrated in Bill's two **public** GitHub repos — the ones actually linked from job applications when a posting asks for a GitHub/portfolio URL. Employers can click through and inspect these directly, so nothing listed here should overstate what's really in them.

- **billpliske-portfolio** — https://github.com/billpliske/billpliske-portfolio (Art by Bill Pliske e-commerce site)
- **social-videos** — https://github.com/billpliske/social-videos (Automated Social Video Production Tool)

Verified by reading `package.json`, source files, and docs directly — not from descriptions alone. Use this to check off job-posting keywords honestly during tailoring: if something isn't listed here and isn't in a job-history bullet in `original-resume.md` either, treat it as a real gap unless Bill confirms otherwise directly.

## billpliske-portfolio (Vue / AWS Amplify e-commerce site)

- Vue 3, TypeScript, Vite, Pinia (state management), Vue Router, Sass
- AWS Amplify Gen 2 — Lambda functions, AppSync/GraphQL, DynamoDB, Cognito auth, S3 storage
- AWS CDK, AWS Secrets Manager
- Google Analytics Data API integration (GA4, server-side via Lambda + Google Cloud service account)
- Square (payments + webhook integration), Shippo (shipping rates/labels), MailerSend (transactional/newsletter email with custom rate-limiting)
- SEO/social meta tag prerendering (Open Graph tags generated at build time)
- Content taxonomy/IA design (a documented tagging strategy for product discovery)
- Basic ARIA/accessibility markup present in components — not a full accessibility audit or certification, don't overclaim
- Vitest is a configured dev dependency, but there are no test files in the repo — don't claim an active automated-testing practice from this alone

## social-videos (Remotion video-generation tool)

- React 19, TypeScript, Remotion (`@remotion/effects`, `@remotion/transitions`, `@remotion/media`, `@remotion/fonts`)
- Hand-authored animation using frame-interpolation primitives (`interpolate()`/`spring()`, used across 5 files) — fades, enter/exit transitions, scale/opacity, easing
- ElevenLabs (AI-generated voice narration), Whisper (automatic speech-to-text captioning)
- ffmpeg-based audio pipeline (noise cleanup, loudness normalization)
- Zod (schema validation)
- Template-driven architecture separating rendering code from content/config

## Confirmed real but NOT in either repo (from Bill directly, not from code)

- Storybook — used at Acronis (day job), not in these personal projects

## Not present anywhere — genuine gaps, don't claim without asking Bill first

- Figma or Figma-to-code tooling (CodeConnect, design tokens)
- Framer
- Formal automated test suite / CI pipeline
- Formal accessibility audit/certification (WCAG, etc.)

## Keeping this current

Local checkouts exist at `~/Documents/CODE/billpliske.com` (its **`public`** remote points to `billpliske-portfolio` — its `origin` remote is a *different, non-public* repo, don't confuse the two) and `~/Documents/CODE/social-videos` (its `origin` remote is the public repo). Before trusting a local checkout as equivalent to what's actually public, confirm the checked-out branch's HEAD matches the public remote's HEAD:

```
git rev-parse HEAD
git rev-parse public/main   # or origin/main, whichever remote is actually the public one
```

If they don't match, read from the public remote (fetch/clone it fresh, or use `git show public/main:<path>`) rather than the working tree. Regenerate this file — don't hand-patch stale entries — if either repo changes meaningfully (new integrations, new tools).
