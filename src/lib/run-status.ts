import type { ActionsRun, RunConclusion, RunStatus } from "./types";

/** Skipped, cancelled, neutral and stale runs are neither passes nor failures. */
const FAILED_CONCLUSIONS = new Set<ActionsRun["conclusion"]>(["failure", "timed_out", "startup_failure"]);

/** Queued or in-progress runs older than this are treated as stuck, not live. */
export const ACTIVE_WINDOW_MS = 24 * 60 * 60_000;

export function isFailedRun(run: ActionsRun) {
  return run.status === "completed" && FAILED_CONCLUSIONS.has(run.conclusion);
}

export function isPassedRun(run: ActionsRun) {
  return run.status === "completed" && run.conclusion === "success";
}

export function isActiveRun(run: ActionsRun) {
  return run.status !== "completed";
}

/** Active and recent enough to be worth polling for. */
export function isLiveRun(run: ActionsRun, now: number) {
  return isActiveRun(run) && now - new Date(run.createdAt).getTime() < ACTIVE_WINDOW_MS;
}

/** Colour family for a run: ok = passed, bad = failed, warn = running or waiting, idle = everything else. */
export type RunTone = "ok" | "bad" | "warn" | "idle";

/** Tone for any run, job or step status pair. */
export function toneOf(status: RunStatus, conclusion: RunConclusion): RunTone {
  if (status !== "completed" || conclusion === "action_required") return "warn";
  if (conclusion === "success") return "ok";
  if (FAILED_CONCLUSIONS.has(conclusion)) return "bad";
  return "idle";
}

export function runTone(run: ActionsRun) {
  return toneOf(run.status, run.conclusion);
}

export function statusLabel(run: Pick<ActionsRun, "status" | "conclusion">) {
  if (run.status === "in_progress") return "Running";
  if (run.status === "waiting") return "Waiting";
  if (run.status !== "completed") return "Queued";
  switch (run.conclusion) {
    case "success":
      return "Passed";
    case "cancelled":
      return "Cancelled";
    case "skipped":
      return "Skipped";
    case "neutral":
      return "Neutral";
    case "stale":
      return "Stale";
    case "action_required":
      return "Needs approval";
    case "timed_out":
      return "Timed out";
    case "startup_failure":
      return "Startup failure";
    default:
      return "Failed";
  }
}

/** Time between the run being created and a runner starting it. Only exact for first attempts. */
export function queueMs(run: ActionsRun) {
  if (run.attempt > 1) return null;
  const wait = new Date(run.startedAt).getTime() - new Date(run.createdAt).getTime();
  return Number.isFinite(wait) && wait >= 0 ? wait : null;
}

/** Elapsed time, counting up to `now` while the run is still going. */
export function elapsedMs(run: ActionsRun, now: number) {
  if (!isActiveRun(run)) return run.durationMs;
  const start = new Date(run.startedAt).getTime();
  return Number.isFinite(start) ? Math.max(0, now - start) : run.durationMs;
}

/** Failure summary without its "job name: " prefix, or null before it has loaded. */
export function failureHeadline(run: ActionsRun) {
  const summary = run.failureSummary;
  if (!summary) return null;
  const separator = summary.indexOf(": ");
  return separator === -1 ? summary : summary.slice(separator + 2);
}

/** Milliseconds between two timestamps, counting up to `now` when there's no end yet. */
export function spanMs(startedAt: string | null, completedAt: string | null, now: number) {
  if (!startedAt) return null;
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const span = end - new Date(startedAt).getTime();
  return Number.isFinite(span) ? Math.max(0, span) : null;
}
