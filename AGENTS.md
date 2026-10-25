# Working on TagTriage

## Verification (all must be green before pushing)
- `npx tsc --noEmit`
- `npm run lint`
- `npx vitest run`
- `npm run build`
- `npm run build && npx playwright test` (install Chromium first with `npx playwright install chromium`)

CI (`.github/workflows/ci.yml`) runs typecheck, lint, Vitest, the production build, and Playwright E2E tests on Node 24 for every PR and on pushes to `main`.
Local default Node is 26; if a Node-specific failure appears, retry with `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

## Conventions
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind 3. Path alias `@/*` -> `src/*`.
- Domain logic lives in `src/domain` and must stay pure (no React, no Dexie, no `Date.now()` inside reducers) and tested with Vitest (`src/**/*.test.ts`).
- The event log is append-only. Never add update/delete paths for events; corrections are new events.
- `write()` returns `{ ok }`; UI success banners render only when `ok` is true.
- No `any` (enforced by ESLint). Imports at the top of files.
- Dependencies are pinned exactly (`npm install --save-exact`) and must be at least 7 days old.
- Commit messages: plain imperative sentences, no `feat:`/`fix:` prefixes.
- Stacked PRs are merged in order with "Create a merge commit" (not squash) so later PRs retarget cleanly.

## Secrets
- `NVIDIA_NIM_API_KEY` lives only in `.env.local` (gitignored) and is read server-side in `src/app/api/rewrite/route.ts`.
- Never print, log or commit it. Check presence with `grep -c '^NVIDIA_NIM_API_KEY=nvapi-' .env.local`.
- Before pushing: `git grep -nI "nvapi-"` must return nothing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
