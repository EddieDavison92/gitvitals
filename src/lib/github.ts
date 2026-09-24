import type { ActionsRun, FailureDetail, RateLimit, RunConclusion, RunStatus } from "./types";

const API = "https://api.github.com";
const PER_PAGE = 100;
/** Run pages are ~1.7 MB each and slow to generate, so fetch a few at once. */
const PAGE_CONCURRENCY = 4;

export const failureConclusions = new Set<RunConclusion>([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
]);

type RawRun = {
  id: number;
  name: string | null;
  display_title: string;
  path?: string;
  head_branch: string | null;
  event: string;
  status: RunStatus;
  conclusion: RunConclusion;
  html_url: string;
  actor?: { login: string } | null;
  run_number: number;
  run_attempt?: number;
  pull_requests?: Array<{ number?: number }> | null;
  head_commit?: { message?: string } | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
};

type RawJob = {
  id: number;
  name: string;
  conclusion: RunConclusion;
  steps?: Array<{ name: string; number: number; conclusion: RunConclusion }>;
};

type RawAnnotation = {
  annotation_level: "notice" | "warning" | "failure";
  message: string;
  title?: string | null;
  path?: string;
  start_line?: number;
};

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimit: RateLimit | null,
  ) {
    super(message);
  }

  get isRateLimited() {
    return (this.status === 403 || this.status === 429) && this.rateLimit?.remaining === 0;
  }
}

function readRateLimit(headers: Headers): RateLimit | null {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (!headers.has("x-ratelimit-limit") || [limit, remaining, reset].some(Number.isNaN)) {
    return null;
  }
  return { limit, remaining, resetAt: reset * 1000 };
}

export type Fetcher = <T>(path: string) => Promise<T>;

/** Creates a GitHub API fetcher that reports rate-limit headers after every response. */
export function createFetcher(
  token: string | null,
  onRateLimit: (rateLimit: RateLimit) => void,
  signal?: AbortSignal,
): Fetcher {
  return async <T>(path: string) => {
    const res = await fetch(`${API}${path}`, {
      signal,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const rateLimit = readRateLimit(res.headers);
    if (rateLimit) onRateLimit(rateLimit);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new GitHubError(body?.message ?? `GitHub API ${res.status}`, res.status, rateLimit);
    }
    return (await res.json()) as T;
  };
}

/** Reads the current limit without spending a request (/rate_limit is free). */
export async function fetchRateLimit(token: string | null): Promise<RateLimit | null> {
  try {
    const res = await fetch(`${API}/rate_limit`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { resources: { core: { limit: number; remaining: number; reset: number } } };
    const core = body.resources.core;
    return { limit: core.limit, remaining: core.remaining, resetAt: core.reset * 1000 };
  } catch {
    return null;
  }
}

function resolveRunTitle(run: RawRun) {
  const commitSubject = run.head_commit?.message
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return commitSubject || run.display_title || run.name || "Untitled run";
}

function workflowNameFromPath(path?: string) {
  const fileName = path?.split("/").pop();
  return fileName ? fileName.replace(/\.ya?ml$/, "") : "Unknown workflow";
}

function toActionsRun(run: RawRun): ActionsRun {
  const startedAt = run.run_started_at ?? run.created_at;
  const start = new Date(startedAt).getTime();
  const end = new Date(run.updated_at).getTime();
  return {
    id: run.id,
    attempt: run.run_attempt ?? 1,
    name: resolveRunTitle(run),
    workflowName: run.name || workflowNameFromPath(run.path),
    branch: run.head_branch ?? "(detached)",
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    actor: run.actor?.login ?? "unknown",
    runNumber: run.run_number,
    prNumbers: (run.pull_requests ?? [])
      .map((pr) => pr.number)
      .filter((num): num is number => typeof num === "number"),
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    startedAt,
    durationMs: Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.max(0, end - start),
    failureSummary: null,
    failurePoints: [],
  };
}

/** GitHub's `created` filter rejects fractional seconds. */
function toFilterDate(iso: string) {
  return iso.replace(/\.\d{3}Z$/, "Z");
}

/**
 * Fetches runs newest-first, optionally limited to runs created since `createdSince`.
 * Page 1 gives the total; the rest are fetched in parallel batches.
 * `truncated` is true when `maxPages` ran out before the window was exhausted.
 * `onPage` receives the runs so far after each batch except the last.
 */
export async function fetchRuns(
  get: Fetcher,
  owner: string,
  repo: string,
  createdSince: string | null,
  maxPages: number,
  onPage?: (runsSoFar: ActionsRun[]) => void,
) {
  const getPage = async (page: number) => {
    const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) });
    if (createdSince) params.set("created", `>=${toFilterDate(createdSince)}`);
    return get<{ total_count: number; workflow_runs: RawRun[] }>(
      `/repos/${owner}/${repo}/actions/runs?${params}`,
    );
  };

  const first = await getPage(1);
  const runs = first.workflow_runs.map(toActionsRun);
  const lastPage = Math.min(maxPages, Math.ceil(first.total_count / PER_PAGE));

  for (let start = 2; start <= lastPage; start += PAGE_CONCURRENCY) {
    onPage?.(runs);
    const pages = Array.from({ length: Math.min(PAGE_CONCURRENCY, lastPage - start + 1) }, (_, i) => start + i);
    for (const payload of await Promise.all(pages.map(getPage))) {
      runs.push(...payload.workflow_runs.map(toActionsRun));
    }
  }
  return { runs, truncated: first.total_count > lastPage * PER_PAGE };
}

const NOISE_ANNOTATION = /^Process completed with exit code \d+\.?$/i;

function firstLine(text: string) {
  return text.split("\n").map((line) => line.trim()).find(Boolean) ?? text.trim();
}

/**
 * Builds a failure summary from the first failed job: its failed step plus any
 * failure annotations (compiler errors, test failures, `::error::` output).
 * Costs two requests: jobs, then annotations for that job.
 */
export async function fetchFailureDetail(
  get: Fetcher,
  owner: string,
  repo: string,
  run: ActionsRun,
): Promise<FailureDetail> {
  if (run.conclusion === "startup_failure") {
    return { summary: "Workflow failed to start. Check the workflow file for errors.", points: [] };
  }

  const { jobs } = await get<{ jobs: RawJob[] }>(
    `/repos/${owner}/${repo}/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100`,
  );
  const job = jobs.find((item) => failureConclusions.has(item.conclusion));
  if (!job) {
    return { summary: `Run ended with ${run.conclusion ?? "no conclusion"}.`, points: [] };
  }

  const failedStep = job.steps?.find((step) => failureConclusions.has(step.conclusion));
  const stepLabel = failedStep ? ` at step "${failedStep.name}"` : "";

  if (job.conclusion === "cancelled") {
    return { summary: `${job.name}: Cancelled${stepLabel}.`, points: [] };
  }
  if (job.conclusion === "timed_out") {
    return { summary: `${job.name}: Timed out${stepLabel}.`, points: [] };
  }

  const annotations = await get<RawAnnotation[]>(
    `/repos/${owner}/${repo}/check-runs/${job.id}/annotations?per_page=50`,
  ).catch(() => [] as RawAnnotation[]);
  const messages = Array.from(
    new Set(
      annotations
        .filter((item) => item.annotation_level === "failure")
        .map((item) => {
          const message = firstLine(item.message);
          const location = item.path && item.path !== ".github" ? `${item.path}${item.start_line ? `:${item.start_line}` : ""} ` : "";
          return `${location}${message}`.slice(0, 240);
        })
        .filter((message) => !NOISE_ANNOTATION.test(message)),
    ),
  );

  if (messages.length > 0) {
    return {
      summary: `${job.name}: ${messages[0]}`,
      points: messages.slice(0, 3).map((message) => `${job.name}: ${message}`),
    };
  }

  const summary = failedStep
    ? `${job.name}: Step "${failedStep.name}" failed.`
    : `${job.name}: Job ended with ${job.conclusion}.`;
  return { summary, points: [summary] };
}
