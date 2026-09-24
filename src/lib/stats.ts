import { isActiveRun, isFailedRun, isPassedRun, queueMs } from "./run-status";
import type { ActionsRun } from "./types";

export function median(values: number[]) {
  return percentile(values, 50);
}

/** Linear-interpolated percentile; 0 for an empty list. */
export function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/** Passed ÷ (passed + failed) as a whole percentage; null when neither occurred. */
export function successRateOf(successful: number, failed: number) {
  const decided = successful + failed;
  return decided === 0 ? null : Math.round((successful / decided) * 100);
}

/** Durations of runs that passed or failed. Skipped runs finish in seconds and would skew these. */
function decidedDurations(runs: ActionsRun[]) {
  return runs
    .filter((run) => isPassedRun(run) || isFailedRun(run))
    .map((run) => run.durationMs)
    .filter((duration) => duration > 0);
}

export function summarizeRuns(runs: ActionsRun[]) {
  const successful = runs.filter(isPassedRun).length;
  const failed = runs.filter(isFailedRun).length;
  const durations = decidedDurations(runs);
  const queues = runs.map(queueMs).filter((wait): wait is number => wait !== null);

  return {
    total: runs.length,
    completed: runs.filter((run) => !isActiveRun(run)).length,
    successful,
    failed,
    active: runs.filter(isActiveRun).length,
    reruns: runs.filter((run) => run.attempt > 1).length,
    /** Passed only after a re-run: a flakiness signal. */
    passedOnRerun: runs.filter((run) => run.attempt > 1 && isPassedRun(run)).length,
    successRate: successRateOf(successful, failed),
    medianDurationMs: median(durations),
    p95DurationMs: percentile(durations, 95),
    medianQueueMs: median(queues),
  };
}

export type RunSummary = ReturnType<typeof summarizeRuns>;

export type WorkflowStat = {
  workflow: string;
  runs: number;
  failed: number;
  passedOnRerun: number;
  successRate: number | null;
  medianMinutes: number;
};

/** Per-workflow stats, worst first: most failures, then lowest success rate. */
export function workflowStats(runs: ActionsRun[]): WorkflowStat[] {
  const grouped = new Map<string, ActionsRun[]>();
  for (const run of runs) {
    const group = grouped.get(run.workflowName) ?? [];
    group.push(run);
    grouped.set(run.workflowName, group);
  }
  return Array.from(grouped, ([workflow, group]) => {
    const stats = summarizeRuns(group);
    return {
      workflow,
      runs: stats.total,
      failed: stats.failed,
      passedOnRerun: stats.passedOnRerun,
      successRate: stats.successRate,
      medianMinutes: Number((stats.medianDurationMs / 60_000).toFixed(1)),
    };
  }).sort(
    (a, b) =>
      b.failed - a.failed ||
      (a.successRate ?? 101) - (b.successRate ?? 101) ||
      a.workflow.localeCompare(b.workflow),
  );
}

const dayFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

/** Local `YYYY-MM-DD` for a timestamp. */
export function dayKey(value: string) {
  return dayFormat.format(new Date(value));
}

export type DayStat = {
  day: string;
  successful: number;
  failed: number;
  successRate: number | null;
  p50Minutes: number | null;
  p95Minutes: number | null;
};

/** Completed runs grouped by the local day they finished, oldest first. */
export function dailyTrend(runs: ActionsRun[]): DayStat[] {
  const grouped = new Map<string, ActionsRun[]>();
  for (const run of runs) {
    if (isActiveRun(run)) continue;
    const day = dayKey(run.updatedAt);
    const group = grouped.get(day) ?? [];
    group.push(run);
    grouped.set(day, group);
  }
  return Array.from(grouped, ([day, group]) => {
    const successful = group.filter(isPassedRun).length;
    const failed = group.filter(isFailedRun).length;
    const durations = decidedDurations(group);
    const toMinutes = (ms: number) => Number((ms / 60_000).toFixed(2));
    return {
      day,
      successful,
      failed,
      successRate: successRateOf(successful, failed),
      p50Minutes: durations.length ? toMinutes(percentile(durations, 50)) : null,
      p95Minutes: durations.length ? toMinutes(percentile(durations, 95)) : null,
    };
  }).sort((a, b) => a.day.localeCompare(b.day));
}

// PR runs report the PR's head branch, which can be a fork's "main".
const PR_EVENTS = new Set(["pull_request", "pull_request_target"]);

/** Most common branch among push runs; used when repo metadata isn't loaded. */
export function inferDefaultBranch(runs: ActionsRun[]) {
  const counts = new Map<string, number>();
  for (const run of runs) {
    if (run.event === "push") counts.set(run.branch, (counts.get(run.branch) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [branch, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = branch;
  }
  return best;
}

export type WorkflowHealth = {
  workflow: string;
  failing: boolean;
  /** Most recent run that passed or failed. */
  latest: ActionsRun;
  /** Consecutive failures up to `latest`; 0 when passing. */
  streak: number;
  /** Created time of the first failure in the current streak. */
  failingSince: string | null;
  /** False when the streak reaches the oldest loaded run, so it may be longer. */
  streakComplete: boolean;
};

/**
 * State of each workflow on `branch`, judged by its latest run that passed or
 * failed (skipped and cancelled runs don't change it). Failing workflows come
 * first, longest-broken first.
 */
export function branchHealth(runs: ActionsRun[], branch: string): WorkflowHealth[] {
  const grouped = new Map<string, ActionsRun[]>();
  for (const run of runs) {
    if (run.branch !== branch || PR_EVENTS.has(run.event)) continue;
    if (!isPassedRun(run) && !isFailedRun(run)) continue;
    const group = grouped.get(run.workflowName) ?? [];
    group.push(run);
    grouped.set(run.workflowName, group);
  }

  const health = Array.from(grouped, ([workflow, group]): WorkflowHealth => {
    group.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const passedIndex = group.findIndex(isPassedRun);
    const streak = passedIndex === -1 ? group.length : passedIndex;
    return {
      workflow,
      failing: streak > 0,
      latest: group[0],
      streak,
      failingSince: streak > 0 ? group[streak - 1].createdAt : null,
      streakComplete: passedIndex !== -1,
    };
  });

  return health.sort((a, b) => {
    if (a.failing !== b.failing) return a.failing ? -1 : 1;
    if (a.failing && b.failing) return (a.failingSince ?? "").localeCompare(b.failingSince ?? "");
    return a.workflow.localeCompare(b.workflow);
  });
}
