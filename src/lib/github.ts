import type {
  ActionsRun,
  Annotation,
  FailureDetail,
  RateLimit,
  RepoMeta,
  RunConclusion,
  RunJob,
  RunJobs,
  RunStatus,
} from "./types";

const API = "https://api.github.com";
const PER_PAGE = 100;
/** Run pages are ~1.7 MB each and slow to generate, so fetch a few at once. */
const PAGE_CONCURRENCY = 4;

/** Job and step conclusions worth explaining. Broader than a failed run, so cancelled jobs are found too. */
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
  pull_requests?: Array<{ number?: number; base?: { repo?: { id?: number } } }> | null;
  repository?: { id?: number };
  head_commit?: { message?: string } | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
};

type RawJob = {
  id: number;
  name: string;
  status: RunStatus;
  conclusion: RunConclusion;
  html_url: string;
  started_at: string | null;
  completed_at: string | null;
  runner_name?: string | null;
  labels?: string[];
  steps?: Array<{
    name: string;
    number: number;
    status: RunStatus;
    conclusion: RunConclusion;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
};

type RawAnnotation = {
  annotation_level: "notice" | "warning" | "failure";
  message: string;
  title?: string | null;
  path?: string;
  start_line?: number;
};

type RawRepo = {
  full_name: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  parent?: { full_name: string };
  stargazers_count: number;
  forks_count: number;
  subscribers_count?: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string | null; name: string } | null;
  topics?: string[];
  homepage: string | null;
  created_at: string;
  pushed_at: string;
  has_issues: boolean;
  permissions?: { push?: boolean };
  html_url: string;
  owner: { avatar_url: string };
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

/** "core" for most endpoints; search has its own, smaller per-minute limit. */
export type RateLimitResource = "core" | "search";
export type RateLimitListener = (rateLimit: RateLimit, resource: RateLimitResource) => void;

export type Fetcher = (<T>(path: string) => Promise<T>) & {
  /** Like the fetcher, but resolves null for 202 (stats still being computed) and 204. */
  maybe: <T>(path: string) => Promise<T | null>;
};

/**
 * Creates a GitHub API fetcher that reports rate-limit headers after every response.
 * With `revalidate`, the browser sends If-None-Match and reuses its cached body on
 * 304; GitHub doesn't count authenticated 304s against the rate limit.
 */
export function createFetcher(
  token: string | null,
  onRateLimit: RateLimitListener,
  { revalidate = false }: { revalidate?: boolean } = {},
): Fetcher {
  const request = async <T>(path: string): Promise<T | null> => {
    const res = await fetch(`${API}${path}`, {
      cache: revalidate ? "no-cache" : "default",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const rateLimit = readRateLimit(res.headers);
    if (rateLimit) onRateLimit(rateLimit, res.headers.get("x-ratelimit-resource") === "search" ? "search" : "core");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new GitHubError(body?.message ?? `GitHub API ${res.status}`, res.status, rateLimit);
    }
    if (res.status === 202 || res.status === 204) return null;
    return (await res.json()) as T;
  };
  const get = async <T>(path: string) => (await request<T>(path)) as T;
  return Object.assign(get, { maybe: request });
}

export type RateLimits = { core: RateLimit | null; search: RateLimit | null };

/** Reads the current limits without spending a request (/rate_limit is free). */
export async function fetchRateLimits(token: string | null): Promise<RateLimits | null> {
  try {
    const res = await fetch(`${API}/rate_limit`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    type Raw = { limit: number; remaining: number; reset: number };
    const { resources } = (await res.json()) as { resources: { core: Raw; search: Raw } };
    const map = (raw: Raw) => ({ limit: raw.limit, remaining: raw.remaining, resetAt: raw.reset * 1000 });
    return { core: map(resources.core), search: map(resources.search) };
  } catch {
    return null;
  }
}

export async function fetchRepoMeta(get: Fetcher, owner: string, repo: string): Promise<RepoMeta> {
  const raw = await get<RawRepo>(`/repos/${owner}/${repo}`);
  const spdx = raw.license?.spdx_id;
  return {
    fullName: raw.full_name,
    description: raw.description,
    defaultBranch: raw.default_branch,
    isPrivate: raw.private,
    isArchived: raw.archived,
    isFork: raw.fork,
    parent: raw.parent?.full_name ?? null,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    watchers: raw.subscribers_count ?? 0,
    openIssuesAndPulls: raw.open_issues_count,
    language: raw.language,
    license: raw.license ? (spdx && spdx !== "NOASSERTION" ? spdx : raw.license.name) : null,
    topics: raw.topics ?? [],
    homepage: raw.homepage || null,
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at,
    hasIssues: raw.has_issues,
    canPush: raw.permissions?.push ?? false,
    avatarUrl: raw.owner.avatar_url,
    htmlUrl: raw.html_url,
  };
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
  const name = run.name || workflowNameFromPath(run.path);
  // GitHub-managed "dynamic" runs (Dependabot, CodeQL default setup) append a job id; drop it so they group.
  const workflowName = run.event === "dynamic" ? name.replace(/ #\d+$/, "") : name;
  const start = new Date(startedAt).getTime();
  const end = new Date(run.updated_at).getTime();
  return {
    id: run.id,
    attempt: run.run_attempt ?? 1,
    name: resolveRunTitle(run),
    workflowName,
    branch: run.head_branch ?? "(detached)",
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    actor: run.actor?.login ?? "unknown",
    runNumber: run.run_number,
    // GitHub also lists PRs in forks whose head matches; keep this repo's own.
    prNumbers: (run.pull_requests ?? [])
      .filter((pr) => pr.base?.repo?.id === undefined || run.repository?.id === undefined || pr.base.repo.id === run.repository.id)
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

export async function fetchRun(get: Fetcher, owner: string, repo: string, runId: number) {
  return toActionsRun(await get<RawRun>(`/repos/${owner}/${repo}/actions/runs/${runId}`));
}

/** Latest runs on one branch (one request); enough to judge its current health. */
export async function fetchBranchRuns(get: Fetcher, owner: string, repo: string, branch: string) {
  const params = new URLSearchParams({ branch, per_page: "100", exclude_pull_requests: "true" });
  const payload = await get<{ workflow_runs: RawRun[] }>(`/repos/${owner}/${repo}/actions/runs?${params}`);
  return payload.workflow_runs.map(toActionsRun);
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

function toRunJob(job: RawJob): RunJob {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    url: job.html_url,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    runnerName: job.runner_name ?? null,
    labels: job.labels ?? [],
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      number: step.number,
      status: step.status,
      conclusion: step.conclusion,
      startedAt: step.started_at ?? null,
      completedAt: step.completed_at ?? null,
    })),
  };
}

const NOISE_ANNOTATION = /^Process completed with exit code \d+\.?$/i;

function toAnnotation(raw: RawAnnotation): Annotation {
  const message = raw.message.split("\n").map((line) => line.trim()).find(Boolean) ?? raw.message.trim();
  const hasFile = raw.path && raw.path !== ".github";
  return {
    level: raw.annotation_level,
    message: message.slice(0, 240),
    title: raw.title || null,
    location: hasFile ? `${raw.path}${raw.start_line ? `:${raw.start_line}` : ""}` : null,
  };
}

/** Failure annotations minus "exit code 1" noise, de-duplicated. */
export function failureMessages(annotations: Annotation[]) {
  const messages = annotations
    .filter((item) => item.level === "failure" && !NOISE_ANNOTATION.test(item.message))
    .map((item) => (item.location ? `${item.location} ${item.message}` : item.message));
  return Array.from(new Set(messages));
}

/**
 * Jobs for a run attempt, plus annotations for up to `annotateFailed` failed
 * jobs (cancelled and timed-out jobs have none worth fetching).
 */
export async function fetchRunJobs(
  get: Fetcher,
  owner: string,
  repo: string,
  run: Pick<ActionsRun, "id" | "attempt">,
  annotateFailed: number,
): Promise<RunJobs> {
  const { jobs: rawJobs } = await get<{ jobs: RawJob[] }>(
    `/repos/${owner}/${repo}/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100`,
  );
  const jobs = rawJobs.map(toRunJob);
  const toAnnotate = jobs.filter((job) => job.conclusion === "failure").slice(0, annotateFailed);
  const annotations: Record<number, Annotation[]> = {};
  await Promise.all(
    toAnnotate.map(async (job) => {
      const raw = await get<RawAnnotation[]>(`/repos/${owner}/${repo}/check-runs/${job.id}/annotations?per_page=50`).catch(
        () => [] as RawAnnotation[],
      );
      annotations[job.id] = raw.map(toAnnotation);
    }),
  );
  return { jobs, annotations };
}

/** One-line explanation of a failed run from its first failed job. */
export function summarizeFailure(run: ActionsRun, { jobs, annotations }: RunJobs): FailureDetail {
  if (run.conclusion === "startup_failure") {
    return { summary: "Workflow failed to start. Check the workflow file for errors.", points: [] };
  }
  // Prefer the job that actually failed over siblings cancelled because of it.
  const job =
    jobs.find((item) => item.conclusion === "failure") ??
    jobs.find((item) => failureConclusions.has(item.conclusion));
  if (!job) {
    return { summary: `Run ended with ${run.conclusion ?? "no conclusion"}.`, points: [] };
  }

  const failedStep = job.steps.find((step) => failureConclusions.has(step.conclusion));
  const stepLabel = failedStep ? ` at step "${failedStep.name}"` : "";
  if (job.conclusion === "cancelled") return { summary: `${job.name}: Cancelled${stepLabel}.`, points: [] };
  if (job.conclusion === "timed_out") return { summary: `${job.name}: Timed out${stepLabel}.`, points: [] };

  const messages = failureMessages(annotations[job.id] ?? []);
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

/** Failure summary for a run. Costs two requests: jobs, then annotations for the first failed job. */
export async function fetchFailureDetail(
  get: Fetcher,
  owner: string,
  repo: string,
  run: ActionsRun,
): Promise<FailureDetail> {
  if (run.conclusion === "startup_failure") return summarizeFailure(run, { jobs: [], annotations: {} });
  return summarizeFailure(run, await fetchRunJobs(get, owner, repo, run, 1));
}
