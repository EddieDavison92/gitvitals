# AGENTS.md

Architecture notes for humans and coding agents working in this repository.

## System overview

gitvitals shows the health of any GitHub repository. Next.js serves the pages; every GitHub request is made from the browser. There is no backend, database or server-side GitHub call (social cards render text only).

- `src/app/page.tsx`: landing page
- `src/app/[owner]/[repo]/[[...rest]]/page.tsx`: repo pages; `resolveRepoPath` (`src/lib/routes.ts`) maps the path to a tab and redirects GitHub-style paths
- `src/app/compare/page.tsx`: side-by-side comparison
- `src/components/shell/`: app layout (sidebar with repo switcher and nav, ⌘K command palette, top bar with breadcrumbs, page body)
- `src/components/repo/`: repo page wrapper and one component per tab
- `src/components/actions/`: the Actions tab (CI dashboard, run drawer)
- `src/components/compare/`: comparison table
- `src/components/ui/`: shared primitives (`Panel`, `StatGrid`, `Badge`, `BUTTON`/`BUTTON_SM`, table classes), chart helpers (`CHART_HEIGHT`, `ChartSkeleton`) and tone classes. Use these rather than ad hoc cards or overriding their sizes; colour is for status only.

## Data layer

- `src/lib/github.ts`: fetcher (rate-limit reporting, 202 handling, conditional requests), repo metadata, workflow runs, jobs and failure summaries
- `src/lib/github-insights.ts`: commit statistics, contributors, community profile, releases, pull requests, issues, search-based flow counts, traffic. Loaders map raw payloads to small shapes before caching.
- `src/lib/resource-store.ts`: keyed cache for everything except runs. Persists to `localStorage` (`gv:r:<owner/repo>:<name>`), respects a TTL, de-duplicates in-flight loads, retries while stats are computing (202) and once the search limit resets.
- `src/lib/repo-data.ts`: one hook per dataset with its loader and TTL. Names must encode parameters (e.g. `pulls-3`).
- `src/lib/repo-store.ts`: workflow runs (paged loads, incremental refresh, live polling, failure enrichment, run jobs)
- `src/lib/insights.ts` and `src/lib/stats.ts`: pure analytics (activity level, bus factor, cadence, cohorts, durations, branch health). Keep these pure and tested.
- `src/lib/storage.ts`: `localStorage` helpers and the recent-repo list; evicting a repo clears all its keys
- `src/lib/rate-limit.ts`: shared core and search rate limits

## Request budgets

Anonymous users get 60 core requests an hour and 10 searches a minute.

- Overview: ~7 core requests plus 5 searches (the `flow-30d` bundle). Other tabs add 1–4 each; most datasets are shared between tabs.
- Actions: see `BUDGET` in `src/lib/repo-store.ts` (3 pages anonymously, 10 with a token; faster polling while runs are live).
- Prefer search counts over list pagination for totals, and cached, shared resources over new requests.

## Guardrails

- Keep every GitHub call client-side. Don't add a server token or proxy.
- Don't import non-component values from `"use client"` modules into server components; they become client references. Put shared constants in plain modules (see `theme-script.ts`, `compare.ts`).
- Map API payloads to minimal shapes before caching; raw PR and release lists are megabytes.
- Label samples honestly (e.g. "100 most recent") and prefer larger samples when two are available.
- Job logs need auth even for public repos; failure summaries use steps and annotations.
- Only `failure`, `timed_out` and `startup_failure` count as failed runs.

## Validation checklist

CI (`.github/workflows/ci.yml`) runs these on every PR; `main` requires it to pass.

- `npm run lint`
- `npm run typecheck`
- `npm test` (Vitest; tests sit next to the code as `*.test.ts`)
- `npm run build`
