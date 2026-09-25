"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  createFetcher,
  failureConclusions,
  fetchFailureDetail,
  fetchRun,
  fetchRunJobs,
  fetchRuns,
  GitHubError,
  summarizeFailure,
  type Fetcher,
} from "./github";
import { getFetchSince, type PeriodFilter } from "./periods";
import { CACHE_VERSION, detailKey, mergeRuns, readCache, repoKey, writeCache, type RepoCache } from "./run-cache";
import { isActiveRun, isFailedRun, isLiveRun } from "./run-status";
import { currentRateLimit, setRateLimit } from "./rate-limit";
import { useToken } from "./token-store";
import { useHydrated } from "./use-hydrated";
import type { ActionsRun, FailureDetail, RunJobs } from "./types";

/**
 * Request budgets. Anonymous visitors get 60 requests/hour per IP, so they load
 * fewer pages, refresh less often and keep a reserve. GitHub returns at most
 * 1,000 runs (10 pages) for date-filtered queries.
 *
 * While runs are queued or in progress the dashboard polls faster (`liveRefreshMs`).
 * Anonymous fast polling stops once fewer than `liveReserve` requests remain.
 */
const BUDGET = {
  anonymous: {
    maxPages: 3,
    refreshPages: 1,
    refreshMs: 5 * 60_000,
    liveRefreshMs: 60_000,
    liveReserve: 20,
    detailReserve: 12,
  },
  token: {
    maxPages: 10,
    refreshPages: 5,
    refreshMs: 60_000,
    liveRefreshMs: 15_000,
    liveReserve: 200,
    detailReserve: 100,
  },
};

/** Overlap when refreshing so runs created during the last fetch aren't missed. */
const REFRESH_OVERLAP_MS = 10 * 60_000;
const DETAIL_CONCURRENCY = 4;
/** The run drawer shows annotations for up to this many failed jobs. */
const DRAWER_ANNOTATED_JOBS = 5;

export function budgetFor(token: string | null) {
  return token ? BUDGET.token : BUDGET.anonymous;
}

export type LoadError =
  | { kind: "not_found" }
  | { kind: "bad_token" }
  | { kind: "rate_limited"; resetAt: number }
  | { kind: "other"; message: string };

export function toLoadError(error: unknown): LoadError {
  if (error instanceof GitHubError) {
    if (error.isRateLimited) return { kind: "rate_limited", resetAt: error.rateLimit?.resetAt ?? Date.now() };
    if (error.status === 404) return { kind: "not_found" };
    if (error.status === 401) return { kind: "bad_token" };
    return { kind: "other", message: error.message };
  }
  return { kind: "other", message: error instanceof Error ? error.message : "Request failed" };
}

type StoreState = {
  cache: RepoCache | null;
  loading: boolean;
  error: LoadError | null;
};

function emptyCache(): RepoCache {
  return {
    version: CACHE_VERSION,
    runs: [],
    details: {},
    fetchedAt: 0,
    coveredSince: null,
    truncated: false,
    pageCap: 0,
  };
}

class RepoStore {
  private state: StoreState = { cache: null, loading: false, error: null };
  private hydrated = false;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private period: PeriodFilter = "7d";
  private lastToken: string | null | undefined = undefined;
  private detailsInFlight = new Set<string>();
  private detailsFailed = new Set<string>();
  private jobsCache = new Map<string, RunJobs>();

  constructor(
    readonly owner: string,
    readonly repo: string,
  ) {}

  private get key() {
    return repoKey(this.owner, this.repo);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => {
    if (!this.hydrated) {
      this.hydrated = true;
      this.state = { ...this.state, cache: readCache(this.key) };
    }
    return this.state;
  };

  private set(patch: Partial<StoreState>, persist = false) {
    this.state = { ...this.state, ...patch };
    if (persist && this.state.cache) writeCache(this.key, this.state.cache);
    this.listeners.forEach((listener) => listener());
  }

  private updateCache(update: (cache: RepoCache) => RepoCache) {
    this.set({ cache: update(this.state.cache ?? emptyCache()) }, true);
  }

  private enqueue(operation: () => Promise<void>) {
    this.queue = this.queue.then(operation, operation);
    return this.queue;
  }

  private isRateLimited() {
    return this.state.error?.kind === "rate_limited" && Date.now() < this.state.error.resetAt;
  }

  private async run(
    token: string | null,
    operation: (get: Fetcher) => Promise<Partial<StoreState>>,
    { revalidate = false } = {},
  ) {
    this.set({ loading: true });
    try {
      const patch = await operation(createFetcher(token, setRateLimit, { revalidate }));
      this.set({ ...patch, loading: false, error: null }, true);
    } catch (error) {
      this.set({ loading: false, error: toLoadError(error) });
    }
  }

  /** Makes sure the cache covers `period`, fetching the window if it doesn't. */
  load(period: PeriodFilter, token: string | null) {
    this.period = period;
    return this.enqueue(async () => {
      this.getSnapshot();
      const tokenChanged = this.lastToken !== undefined && this.lastToken !== token;
      this.lastToken = token;
      const budget = budgetFor(token);
      const cache = this.state.cache;
      const since = getFetchSince(period);

      const covered =
        cache !== null &&
        cache.pageCap > 0 &&
        (cache.coveredSince === null ||
          (since !== null && cache.coveredSince <= since) ||
          (cache.truncated && cache.pageCap >= budget.maxPages));

      if (!covered) {
        if (this.isRateLimited() && !tokenChanged) return;
        await this.fullFetch(since, token);
      } else if (tokenChanged || Date.now() - cache.fetchedAt > budget.refreshMs) {
        await this.incremental(token);
      }
    });
  }

  /** Fetches runs created since the newest known run, plus any still-active runs. */
  refresh(token: string | null) {
    return this.enqueue(async () => {
      if (this.isRateLimited()) return;
      await this.incremental(token);
    });
  }

  /** Delay until the next automatic refresh: faster while runs are live. */
  nextRefreshDelay(token: string | null) {
    const budget = budgetFor(token);
    const cache = this.state.cache;
    const live =
      cache?.runs.some((run) => isLiveRun(run, cache.fetchedAt)) &&
      (token !== null || (currentRateLimit()?.remaining ?? budget.liveReserve + 1) > budget.liveReserve);
    const interval = live ? budget.liveRefreshMs : budget.refreshMs;
    const age = Date.now() - (cache?.fetchedAt ?? 0);
    return Math.max(1_000, interval - age);
  }

  private fullFetch(since: string | null, token: string | null) {
    const { maxPages } = budgetFor(token);
    return this.run(token, async (get) => {
      // Show each batch as it lands; busy repos take a few seconds to page through.
      const showPartial = (runsSoFar: ActionsRun[]) => {
        const current = this.state.cache ?? emptyCache();
        this.set({
          cache: {
            ...current,
            runs: mergeRuns(current.runs, runsSoFar),
            fetchedAt: Date.now(),
            coveredSince: runsSoFar.at(-1)?.createdAt ?? since,
            truncated: false,
            pageCap: maxPages,
          },
        });
      };
      const result = await fetchRuns(get, this.owner, this.repo, since, maxPages, showPartial);
      const previous = this.state.cache ?? emptyCache();
      return {
        cache: {
          ...previous,
          runs: mergeRuns(previous.runs, result.runs),
          fetchedAt: Date.now(),
          coveredSince: result.truncated ? (result.runs.at(-1)?.createdAt ?? since) : since,
          truncated: result.truncated,
          pageCap: maxPages,
        },
      };
    });
  }

  private async incremental(token: string | null) {
    const cache = this.state.cache;
    if (!cache || cache.runs.length === 0) {
      await this.fullFetch(getFetchSince(this.period), token);
      return;
    }

    // Stable while nothing changes, so revalidation can return 304.
    const now = Date.now();
    let since = new Date(new Date(cache.runs[0].createdAt).getTime() - REFRESH_OVERLAP_MS).toISOString();
    for (const run of cache.runs) {
      if (isLiveRun(run, now) && run.createdAt < since) since = run.createdAt;
    }

    const { refreshPages } = budgetFor(token);
    let gap = false;
    await this.run(
      token,
      async (get) => {
        const result = await fetchRuns(get, this.owner, this.repo, since, refreshPages);
        // More new runs than one refresh can page through leaves a hole in coverage.
        gap = result.truncated;
        const latest = this.state.cache ?? cache;
        return {
          cache: {
            ...latest,
            runs: mergeRuns(latest.runs, result.runs),
            fetchedAt: Date.now(),
            coveredSince: gap ? (result.runs.at(-1)?.createdAt ?? since) : latest.coveredSince,
            truncated: gap ? false : latest.truncated,
          },
        };
      },
      { revalidate: true },
    );
    if (gap) await this.fullFetch(getFetchSince(this.period), token);
  }

  /** Fetches a single run (e.g. from a shared link) and merges it into the cache. */
  async loadRun(runId: number, token: string | null) {
    const get = createFetcher(token, setRateLimit);
    const run = await fetchRun(get, this.owner, this.repo, runId);
    this.updateCache((cache) => ({ ...cache, runs: mergeRuns(cache.runs, [run]) }));
    return run;
  }

  setDetail(run: ActionsRun, detail: FailureDetail) {
    this.updateCache((cache) => ({ ...cache, details: { ...cache.details, [detailKey(run)]: detail } }));
  }

  /** Jobs and failure annotations for a run; cached once the run has finished. */
  async runJobs(run: ActionsRun, token: string | null) {
    const key = detailKey(run);
    const cached = this.jobsCache.get(key);
    if (cached) return cached;

    const get = createFetcher(token, setRateLimit, { revalidate: isActiveRun(run) });
    const jobs = await fetchRunJobs(get, this.owner, this.repo, run, DRAWER_ANNOTATED_JOBS);
    if (!isActiveRun(run)) {
      this.jobsCache.set(key, jobs);
      if (isFailedRun(run) && !this.state.cache?.details[key]) this.setDetail(run, summarizeFailure(run, jobs));
    }
    return jobs;
  }

  /** Loads failure summaries for failed runs, stopping before the request reserve is spent. */
  async enrich(runs: ActionsRun[], token: string | null) {
    const { detailReserve } = budgetFor(token);
    const details = this.state.cache?.details ?? {};
    const pending = runs.filter((run) => {
      const key = detailKey(run);
      return (
        run.status === "completed" &&
        failureConclusions.has(run.conclusion) &&
        !details[key] &&
        !this.detailsInFlight.has(key) &&
        !this.detailsFailed.has(key)
      );
    });
    if (pending.length === 0) return;

    const get = createFetcher(token, setRateLimit);
    const worker = async () => {
      for (let run = pending.shift(); run; run = pending.shift()) {
        const limit = currentRateLimit();
        if (this.isRateLimited() || (limit && limit.remaining <= detailReserve)) return;
        const key = detailKey(run);
        this.detailsInFlight.add(key);
        try {
          this.setDetail(run, await fetchFailureDetail(get, this.owner, this.repo, run));
        } catch (error) {
          this.detailsFailed.add(key);
          if (error instanceof GitHubError && error.isRateLimited) {
            this.set({ error: toLoadError(error) });
            return;
          }
        } finally {
          this.detailsInFlight.delete(key);
        }
      }
    };
    await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));
  }
}

const stores = new Map<string, RepoStore>();
const emptyState: StoreState = { cache: null, loading: true, error: null };

function getStore(owner: string, repo: string) {
  const key = repoKey(owner, repo);
  let store = stores.get(key);
  if (!store) {
    store = new RepoStore(owner, repo);
    stores.set(key, store);
  }
  return store;
}

/** Workflow runs for one repo, served from the browser cache and refreshed from GitHub. */
export function useRepoRuns(owner: string, repo: string, period: PeriodFilter) {
  const token = useToken();
  // The token only exists client-side; loading before hydration would run anonymously first.
  const hydrated = useHydrated();
  const store = useMemo(() => getStore(owner, repo), [owner, repo]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, () => emptyState);

  useEffect(() => {
    if (hydrated) store.load(period, token);
  }, [hydrated, store, period, token]);

  // Self-scheduling so the interval can speed up while runs are live.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
      if (!cancelled) timer = window.setTimeout(tick, store.nextRefreshDelay(token));
    };
    const tick = async () => {
      if (document.visibilityState === "visible") await store.refresh(token);
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrated, store, token]);

  const cache = state.cache;
  const runs = useMemo(() => {
    if (!cache || cache.pageCap === 0) return null;
    return cache.runs.map((run) => {
      const detail = cache.details[detailKey(run)];
      return detail ? { ...run, failureSummary: detail.summary, failurePoints: detail.points } : run;
    });
  }, [cache]);
  const liveCount = useMemo(
    () => (cache ? cache.runs.filter((run) => isLiveRun(run, cache.fetchedAt)).length : 0),
    [cache],
  );

  const refresh = useCallback(() => store.refresh(token), [store, token]);
  const enrich = useCallback((target: ActionsRun[]) => store.enrich(target, token), [store, token]);
  const loadRun = useCallback((runId: number) => store.loadRun(runId, token), [store, token]);
  const budget = budgetFor(token);

  return {
    runs,
    fetchedAt: cache?.fetchedAt || null,
    truncated: cache?.truncated ?? false,
    coveredSince: cache?.coveredSince ?? null,
    liveCount,
    refreshMs: liveCount > 0 ? budget.liveRefreshMs : budget.refreshMs,
    loading: state.loading,
    error: state.error,
    hasToken: token !== null,
    refresh,
    enrich,
    loadRun,
  };
}

type JobsState = { key: string; jobs: RunJobs | null; error: LoadError | null };

/** Jobs for the run shown in the drawer; re-fetched when an active run updates. */
export function useRunJobs(owner: string, repo: string, run: ActionsRun | null) {
  const token = useToken();
  const store = useMemo(() => getStore(owner, repo), [owner, repo]);
  const requestKey = run ? `${detailKey(run)}:${run.updatedAt}` : "";
  const [state, setState] = useState<JobsState>({ key: "", jobs: null, error: null });

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    store.runJobs(run, token).then(
      (jobs) => !cancelled && setState({ key: requestKey, jobs, error: null }),
      (error) => !cancelled && setState({ key: requestKey, jobs: null, error: toLoadError(error) }),
    );
    return () => {
      cancelled = true;
    };
    // requestKey captures the parts of `run` that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, token, requestKey]);

  // Keep showing the previous jobs while an active run's update loads.
  const sameRun = run !== null && state.key.startsWith(`${detailKey(run)}:`);
  return {
    jobs: sameRun ? state.jobs : null,
    error: sameRun ? state.error : null,
    loading: state.key !== requestKey,
  };
}
