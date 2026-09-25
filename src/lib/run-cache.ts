import { readJSON, writeJSON } from "./storage";
import type { ActionsRun, FailureDetail } from "./types";

const PREFIX = "gv:runs:";
const MAX_RUNS = 1000;
export const CACHE_VERSION = 5;

export type RepoCache = {
  version: number;
  /** Runs, newest first. */
  runs: ActionsRun[];
  /** Keyed by `${runId}:${attempt}`; completed attempts never change. */
  details: Record<string, FailureDetail>;
  fetchedAt: number;
  /** Every run created at or after this time is in `runs`; null means full history. */
  coveredSince: string | null;
  /** True when coverage stopped at the page cap rather than the window start. */
  truncated: boolean;
  /** Page cap in force when `truncated` was set; a larger cap (token added) warrants a refetch. */
  pageCap: number;
};

export { repoKey } from "./storage";

export function detailKey(run: Pick<ActionsRun, "id" | "attempt">) {
  return `${run.id}:${run.attempt}`;
}

export function readCache(key: string): RepoCache | null {
  const parsed = readJSON<RepoCache>(PREFIX + key);
  return parsed?.version === CACHE_VERSION ? parsed : null;
}

export function writeCache(key: string, cache: RepoCache) {
  const trimmed =
    cache.runs.length > MAX_RUNS
      ? {
          ...cache,
          runs: cache.runs.slice(0, MAX_RUNS),
          coveredSince: cache.runs[MAX_RUNS - 1].createdAt,
          truncated: true,
        }
      : cache;
  writeJSON(PREFIX + key, trimmed);
}

/** Merges runs by id; the most recently updated copy wins. Returns newest-first by creation. */
export function mergeRuns(existing: ActionsRun[], incoming: ActionsRun[]) {
  const byId = new Map(existing.map((run) => [run.id, run]));
  for (const run of incoming) {
    const current = byId.get(run.id);
    if (!current || run.updatedAt >= current.updatedAt) byId.set(run.id, run);
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
