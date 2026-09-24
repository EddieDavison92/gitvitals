import type { ActionsRun, FailureDetail } from "./types";

const PREFIX = "gao:repo:";
export const RECENT_REPOS_KEY = "gao:recent";
const MAX_REPOS = 8;
const MAX_RUNS = 1000;
const VERSION = 1;

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

export function repoKey(owner: string, repo: string) {
  return `${owner}/${repo}`.toLowerCase();
}

export function detailKey(run: Pick<ActionsRun, "id" | "attempt">) {
  return `${run.id}:${run.attempt}`;
}

export function readCache(key: string): RepoCache | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as RepoCache) : null;
    return parsed?.version === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, displayName: string, cache: RepoCache) {
  const trimmed =
    cache.runs.length > MAX_RUNS
      ? {
          ...cache,
          runs: cache.runs.slice(0, MAX_RUNS),
          coveredSince: cache.runs[MAX_RUNS - 1].createdAt,
          truncated: true,
        }
      : cache;
  const recent = readRecentRepos().filter((name) => name.toLowerCase() !== key);
  const evicted = recent.slice(MAX_REPOS - 1);
  try {
    for (const name of evicted) window.localStorage.removeItem(PREFIX + name.toLowerCase());
    window.localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify([displayName, ...recent.slice(0, MAX_REPOS - 1)]));
    window.localStorage.setItem(PREFIX + key, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded or storage blocked; the in-memory copy still works.
  }
}

/** Parses the stored recent-repo list (`owner/repo`, newest first). */
export function parseRecentRepos(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readRecentRepos() {
  try {
    return parseRecentRepos(window.localStorage.getItem(RECENT_REPOS_KEY));
  } catch {
    return [];
  }
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
