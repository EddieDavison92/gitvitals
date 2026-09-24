# AGENTS.md

Architecture notes for humans and coding agents working in this repository.

## System overview

Client-side GitHub Actions dashboard for any repository. Next.js serves the shell; all data comes from the GitHub REST API, called from the browser. No backend, database or server-side GitHub calls.

- `src/app/page.tsx`: landing page (repo picker, recent repos)
- `src/app/[owner]/[repo]/[[...rest]]/page.tsx`: dashboard route; extra path segments redirect to `/owner/repo`
- `src/components/actions-dashboard.tsx`: dashboard UI
- `src/lib/github.ts`: API client, run mapping, failure summaries
- `src/lib/repo-store.ts`: per-repo store (loading, incremental refresh, failure enrichment) and `useRepoRuns` hook
- `src/lib/run-cache.ts`: `localStorage` cache and recent-repo index
- `src/lib/token-store.ts`: optional user token in `localStorage`

## Data flow

1. `useRepoRuns(owner, repo, period)` reads the cached runs, then calls `store.load(period, token)`.
2. `load` fetches runs created since twice the period ago, unless the cache already covers it. Page 1 gives `total_count`; later pages load in parallel batches.
3. Refresh fetches runs created since the newest cached run (minus a 10-minute overlap), stretched back to cover still-active runs from the last 24 hours.
4. The dashboard passes on-screen failed runs to `enrich`, which loads the failed job, step and annotations (2 requests per run) and caches them by `runId:attempt`.

Store operations are serialised through a promise queue. Loads wait for hydration so the token is read before the first request.

## Budgets

Defined in `BUDGET` in `src/lib/repo-store.ts`:

- Anonymous (60 requests/hour per IP): 3 pages, 1-page refresh every 5 minutes, enrichment stops at 12 remaining requests.
- Token (5,000/hour): 10 pages (GitHub returns at most 1,000 results for `created`-filtered queries), 5-page refresh every minute, enrichment stops at 100 remaining.

`/rate_limit` is free and is used to show the current limit.

## Guardrails

- Keep every GitHub call client-side. Don't add a server token or proxy.
- Re-check request budgets when adding API calls; anonymous users have 60 an hour.
- Job logs need auth even for public repos; failure summaries use steps and annotations instead.
- Preserve the filter and failure-first UX in dashboard edits.
- Only `failure`, `timed_out` and `startup_failure` count as failed.

## Validation checklist

- `npm run lint`
- `npm run build`
- Load a busy public repo (e.g. `cli/cli`) anonymously and confirm the request count stays near 10.
