"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createFetcher,
  failureConclusions,
  fetchFailureDetail,
  fetchRateLimit,
  fetchRuns,
  GitHubError,
} from "./github";
import { getFetchSince, type PeriodFilter } from "./periods";
import { detailKey, mergeRuns, readCache, repoKey, writeCache, type RepoCache } from "./run-cache";
import { useToken } from "./token-store";
import { useHydrated } from "./use-hydrated";
import type { ActionsRun, RateLimit } from "./types";

/**
 * Request budgets. Anonymous visitors get 60 requests/hour per IP, so they load
 * fewer pages, refresh less often and keep a reserve for refreshes. GitHub
 * returns at most 1,000 runs (10 pages) for date-filtered queries.
 */
const BUDGET = {
  anonymous: { maxPages: 3, refreshPages: 1, refreshMs: 5 * 60_000, detailReserve: 12 },
  token: { maxPages: 10, refreshPages: 5, refreshMs: 60_000, detailReserve: 100 },
};

/** In-progress runs older than this are treated as stuck and no longer re-polled. */
const ACTIVE_WINDOW_MS = 24 * 60 * 60_000;
/** Overlap when refreshing so runs created during the last fetch aren't missed. */
const REFRESH_OVERLAP_MS = 10 * 60_000;
const DETAIL_CONCURRENCY = 4;

export function budgetFor(token: string | null) {
  return token ? BUDGET.token : BUDGET.anonymous;
}

export type LoadError =
  | { kind: "not_found" }
  | { kind: "bad_token" }
  | { kind: "rate_limited"; resetAt: number }
  | { kind: "other"; message: string };

function toLoadError(error: unknown): LoadError {
  if (error instanceof GitHubError) {
    if (error.isRateLimited) return { kind: "rate_limited", resetAt: error.rateLimit?.resetAt ?? Date.now() };
    if (error.status === 404) return { kind: "not_found" };
    if (error.status === 401) return { kind: "bad_token" };
    return { kind: "other", message: error.message };
  }
  return { kind: "other", message: error instanceof Error ? error.message : "Request failed" };
}

// Rate limits apply per IP or token, not per repo, so they live in one shared store.
let rateLimit: RateLimit | null = null;
const rateLimitListeners = new Set<() => void>();

function setRateLimit(next: RateLimit) {
  rateLimit = next;
  rateLimitListeners.forEach((listener) => listener());
}

export function useRateLimit() {
  const token = useToken();
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated) fetchRateLimit(token).then((next) => next && setRateLimit(next));
  }, [hydrated, token]);
  return useSyncExternalStore(
    (listener) => {
      rateLimitListeners.add(listener);
      return () => rateLimitListeners.delete(listener);
    },
    () => rateLimit,
    () => null,
  );
}

type StoreState = {
  cache: RepoCache | null;
  loading: boolean;
  error: LoadError | null;
};

class RepoStore {
  private state: StoreState = { cache: null, loading: false, error: null };
  private hydrated = false;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private period: PeriodFilter = "7d";
  private lastToken: string | null | undefined = undefined;
  private detailsInFlight = new Set<string>();
  private detailsFailed = new Set<string>();

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
    if (persist && this.state.cache) writeCache(this.key, `${this.owner}/${this.repo}`, this.state.cache);
    this.listeners.forEach((listener) => listener());
  }

  private enqueue(operation: () => Promise<void>) {
    this.queue = this.queue.then(operation, operation);
    return this.queue;
  }

  private isRateLimited() {
    return this.state.error?.kind === "rate_limited" && Date.now() < this.state.error.resetAt;
  }

  private async run(token: string | null, operation: (get: ReturnType<typeof createFetcher>) => Promise<Partial<StoreState>>) {
    this.set({ loading: true });
    try {
      const patch = await operation(createFetcher(token, setRateLimit));
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

  private fullFetch(since: string | null, token: string | null) {
    const { maxPages } = budgetFor(token);
    return this.run(token, async (get) => {
      // Show each page as it lands; busy repos take a few seconds to page through.
      const showPartial = (runsSoFar: ActionsRun[]) => {
        const current = this.state.cache;
        this.set({
          cache: {
            version: 1,
            runs: mergeRuns(current?.runs ?? [], runsSoFar),
            details: current?.details ?? {},
            fetchedAt: Date.now(),
            coveredSince: runsSoFar.at(-1)?.createdAt ?? since,
            truncated: false,
            pageCap: maxPages,
          },
        });
      };
      const result = await fetchRuns(get, this.owner, this.repo, since, maxPages, showPartial);
      const previous = this.state.cache;
      return {
        cache: {
          version: 1,
          runs: mergeRuns(previous?.runs ?? [], result.runs),
          details: previous?.details ?? {},
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

    const now = Date.now();
    let since = new Date(new Date(cache.runs[0].createdAt).getTime() - REFRESH_OVERLAP_MS).toISOString();
    for (const run of cache.runs) {
      if (run.status !== "completed" && now - new Date(run.createdAt).getTime() < ACTIVE_WINDOW_MS && run.createdAt < since) {
        since = run.createdAt;
      }
    }

    const { refreshPages } = budgetFor(token);
    let gap = false;
    await this.run(token, async (get) => {
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
    });
    if (gap) await this.fullFetch(getFetchSince(this.period), token);
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
        if (this.isRateLimited() || (rateLimit && rateLimit.remaining <= detailReserve)) return;
        const key = detailKey(run);
        this.detailsInFlight.add(key);
        try {
          const detail = await fetchFailureDetail(get, this.owner, this.repo, run);
          const cache = this.state.cache;
          if (cache) this.set({ cache: { ...cache, details: { ...cache.details, [key]: detail } } }, true);
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

  useEffect(() => {
    if (!hydrated) return;
    const { refreshMs } = budgetFor(token);
    const refreshIfStale = () => {
      const fetchedAt = store.getSnapshot().cache?.fetchedAt ?? 0;
      if (document.visibilityState === "visible" && Date.now() - fetchedAt >= refreshMs - 1000) {
        store.refresh(token);
      }
    };
    const interval = window.setInterval(refreshIfStale, refreshMs);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [hydrated, store, token]);

  const runs = useMemo(() => {
    const cache = state.cache;
    if (!cache) return null;
    return cache.runs.map((run) => {
      const detail = cache.details[detailKey(run)];
      return detail ? { ...run, failureSummary: detail.summary, failurePoints: detail.points } : run;
    });
  }, [state.cache]);

  const refresh = useCallback(() => store.refresh(token), [store, token]);
  const enrich = useCallback((target: ActionsRun[]) => store.enrich(target, token), [store, token]);

  return {
    runs,
    fetchedAt: state.cache?.fetchedAt ?? null,
    truncated: state.cache?.truncated ?? false,
    coveredSince: state.cache?.coveredSince ?? null,
    refreshMs: budgetFor(token).refreshMs,
    loading: state.loading,
    error: state.error,
    hasToken: token !== null,
    refresh,
    enrich,
  };
}
