# Working on TagTriage

## Verification (all must be green before pushing)
- `npx tsc --noEmit`
- `npm run lint`
- `npx vitest run`
- `npm run build`
- `npm run build && npx playwright test` (install Chromium first with `npx playwright install chromium`)

CI (`.github/workflows/ci.yml`) runs these checks on Node 24 for every PR and on pushes to `main`.
Local default Node is 26; if a Node-specific failure appears, retry with `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

## Conventions
- Next.js 14 App Router, React 18, TypeScript strict, Tailwind 3. Path alias `@/*` -> `src/*`.
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
