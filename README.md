# GitHub Actions Observability

[![CI](https://github.com/EddieDavison92/gh-actions-observability/actions/workflows/ci.yml/badge.svg)](https://github.com/EddieDavison92/gh-actions-observability/actions/workflows/ci.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

Success rates, recent failures and run durations for any GitHub repository's Actions workflows. It runs in your browser with no backend, account or install.

**[gh-actions-observability.vercel.app](https://gh-actions-observability.vercel.app)**

## Usage

- Enter `owner/repo` or paste any GitHub URL on the home page.
- Or go straight to `/owner/repo`. Replacing `github.com` with the app's address in a repo URL works, including deeper links such as `/owner/repo/actions/runs/123`.
- Pick a period (24 hours to 90 days) and filter by workflow, branch, actor or pull request.

Private repos need a token (see [Rate limits and tokens](#rate-limits-and-tokens)).

## What it shows

- **Current health**: success rate against the previous period, failed and active runs, median duration.
- **Recent failures**: failed runs from the last 48 hours with the failed job, step and error annotations.
- **Reliability watch**: workflows ranked by failures and success rate. Click one to filter to it.
- **Trends**: daily success rate with failure volume, and median duration for the busiest workflows.
- **Run explorer**: searchable run history filtered by status.

## How it works

The browser calls the [GitHub REST API](https://docs.github.com/en/rest/actions/workflow-runs) directly. Next.js only serves the page.

| Step | Endpoint |
|---|---|
| Runs for the period (twice its length, for the comparison) | `GET /repos/{owner}/{repo}/actions/runs?created=>=…` |
| Failed job and step, for failures on screen | `GET …/actions/runs/{id}/attempts/{n}/jobs` |
| Error messages for that job | `GET …/check-runs/{job_id}/annotations` |

- Page 1 returns the total; the remaining pages load in parallel and the dashboard updates as each batch lands.
- Runs and failure summaries are cached in `localStorage` per repo (the last 8 repos, up to 1,000 runs each). Revisits only fetch runs created since the last load.
- The dashboard refreshes while the tab is visible: every 5 minutes without a token, every minute with one.
- Job logs aren't used because GitHub requires authentication to download them, even for public repos.

## Rate limits and tokens

| | Anonymous | With token |
|---|---|---|
| Requests per hour | 60 per IP | 5,000 |
| Runs loaded per period | 300 | 1,000 (GitHub's cap for date-filtered queries) |
| Failure summaries | Recent failures panel | Also failed rows in the run table |
| Private repos | No | Yes |

An anonymous first visit to a busy repo costs about 10 requests.

To add a token, click **Add token** in the header. A [fine-grained token](https://github.com/settings/personal-access-tokens/new) with read-only **Actions** access is enough. The token is kept in your browser's `localStorage` and only sent to `api.github.com`.

## Metric definitions

- **Failed**: conclusion `failure`, `timed_out` or `startup_failure`. Skipped, cancelled, neutral and stale runs are neither passes nor failures.
- **Success rate**: passed ÷ (passed + failed).
- **Duration**: workflow elapsed time from start to last update. This differs from GitHub's billed job-minutes.
- **Previous period**: the comparison is hidden when the page cap stops short of it.

## Development

Requires Node.js 24.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run lint
npm run typecheck
npm run build
```

`AGENTS.md` covers the architecture, request budgets and guardrails.

Pull requests run the same checks in CI and deploy a Vercel preview. `main` deploys to production.

## Licence

[MIT](LICENSE)
