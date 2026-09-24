# GitHub Actions Observability

Success rates, recent failures and run durations for any GitHub repository's Actions workflows.

Enter `owner/repo` (or paste a GitHub URL) and the dashboard loads at `/owner/repo`. Replacing `github.com` with the site's address in any repo URL works too.

## How it works

The browser calls the GitHub REST API directly. There's no backend, database or sign-in.

- **Runs**: `GET /repos/{owner}/{repo}/actions/runs`, filtered to twice the selected period so the dashboard can compare against the previous one. Page 1 returns the total; the remaining pages load in parallel.
- **Failure summaries**: for failed runs on screen, the failed job and step (`/jobs`) plus failure annotations (`/check-runs/{id}/annotations`). Logs aren't used because GitHub requires auth to download them.
- **Cache**: runs and failure summaries are kept in `localStorage` per repo (last 8 repos, 1,000 runs each). Revisits only fetch runs created since the last load.
- **Refresh**: every 5 minutes without a token, every minute with one, while the tab is visible.

## Rate limits

| | Anonymous | With token |
|---|---|---|
| Requests per hour | 60 per IP | 5,000 |
| Runs loaded | 300 | 1,000 (GitHub's cap for date-filtered queries) |
| Failure summaries | Recent failures panel only | Also failed rows in the run table |
| Private repos | No | Yes |

A first visit to a busy repo costs about 10 requests anonymously.

The token is optional and entered in the header. Use a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with read-only **Actions** access. It's stored in the browser's `localStorage` and only sent to `api.github.com`.

## Metrics

- **Failed** counts `failure`, `timed_out` and `startup_failure`. Skipped, cancelled and neutral runs count as neither passes nor failures.
- **Success rate** is passed ÷ (passed + failed).
- **Duration** is workflow elapsed time (start to last update), not billed job-minutes.

## Development

```bash
npm install
npm run dev
```

Before shipping: `npm run lint` and `npm run build`.

## Deployment

Deploys to Vercel from `main`. No environment variables needed.
