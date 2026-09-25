"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createFetcher, GitHubError, type Fetcher } from "./github";
import { StatsPendingError } from "./github-insights";
import { setRateLimit } from "./rate-limit";
import { readJSON, repoKey, writeJSON } from "./storage";
import { useToken } from "./token-store";
import { useHydrated } from "./use-hydrated";

/**
 * Keyed cache for everything except workflow runs (which have their own store):
 * repo metadata, statistics, pull requests, issues, releases, search counts.
 * Entries persist in localStorage under gv:r:<owner/repo>:<name> and are
 * refetched once older than their TTL.
 */

const PREFIX = "gv:r:";
const VERSION = 1;
/** Waits between retries while GitHub computes statistics. */
const PENDING_RETRY_MS = [3_000, 6_000, 12_000, 20_000];

export type ResourceError =
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "bad_token" }
  | { kind: "rate_limited"; resetAt: number; resource: "core" | "search" }
  | { kind: "pending" }
  | { kind: "other"; message: string };

export function toResourceError(error: unknown): ResourceError {
  if (error instanceof StatsPendingError) return { kind: "pending" };
  if (error instanceof GitHubError) {
    if (error.isRateLimited) {
      return { kind: "rate_limited", resetAt: error.rateLimit?.resetAt ?? Date.now() + 60_000, resource: "core" };
    }
    if (error.status === 404) return { kind: "not_found" };
    if (error.status === 401) return { kind: "bad_token" };
    if (error.status === 403) return { kind: "forbidden" };
    return { kind: "other", message: error.message };
  }
  return { kind: "other", message: error instanceof Error ? error.message : "Request failed" };
}

export type ResourceState<T> = {
  data: T | null;
  fetchedAt: number | null;
  loading: boolean;
  error: ResourceError | null;
};

type Stored<T> = { v: number; data: T; fetchedAt: number };

const EMPTY: ResourceState<never> = { data: null, fetchedAt: null, loading: false, error: null };
const SERVER: ResourceState<never> = { ...EMPTY, loading: true };

const entries = new Map<string, ResourceState<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();
const pendingAttempts = new Map<string, number>();

function read<T>(key: string): ResourceState<T> {
  let entry = entries.get(key) as ResourceState<T> | undefined;
  if (!entry) {
    const stored = readJSON<Stored<T>>(PREFIX + key);
    entry = stored?.v === VERSION ? { data: stored.data, fetchedAt: stored.fetchedAt, loading: false, error: null } : EMPTY;
    entries.set(key, entry);
  }
  return entry;
}

function write<T>(key: string, patch: Partial<ResourceState<T>>) {
  const next = { ...read<T>(key), ...patch };
  entries.set(key, next);
  listeners.get(key)?.forEach((listener) => listener());
  return next;
}

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => set.delete(listener);
}

export type Loader<T> = (get: Fetcher, repo: string) => Promise<T>;

/** Loads a resource unless it's fresh, already loading, or rate limited. */
export function loadResource<T>(
  key: string,
  repo: string,
  loader: Loader<T>,
  { token, ttlMs, force = false }: { token: string | null; ttlMs: number; force?: boolean },
) {
  const entry = read<T>(key);
  const fresh = entry.fetchedAt !== null && Date.now() - entry.fetchedAt < ttlMs;
  const limited = entry.error?.kind === "rate_limited" && Date.now() < entry.error.resetAt;
  if (inflight.has(key) || (!force && (fresh || limited))) return inflight.get(key) ?? Promise.resolve();

  write<T>(key, { loading: true });
  const promise = loader(createFetcher(token, setRateLimit), repo)
    .then((data) => {
      const fetchedAt = Date.now();
      pendingAttempts.delete(key);
      write<T>(key, { data, fetchedAt, loading: false, error: null });
      writeJSON(PREFIX + key, { v: VERSION, data, fetchedAt } satisfies Stored<T>);
    })
    .catch((failure) => {
      const error = toResourceError(failure);
      const attempt = pendingAttempts.get(key) ?? 0;
      const retryPending = error.kind === "pending" && attempt < PENDING_RETRY_MS.length;
      // Stay "loading" while a pending retry is queued so views show skeletons, not empty states.
      write<T>(key, { loading: retryPending, error });
      // The search limit resets every minute; try again once it has.
      if (error.kind === "rate_limited" && error.resetAt - Date.now() < 2 * 60_000) {
        setTimeout(() => loadResource(key, repo, loader, { token, ttlMs, force: true }), Math.max(1_000, error.resetAt - Date.now() + 1_500));
      }
      if (retryPending) {
        pendingAttempts.set(key, attempt + 1);
        setTimeout(() => loadResource(key, repo, loader, { token, ttlMs, force: true }), PENDING_RETRY_MS[attempt]);
      }
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function resourceKey(owner: string, repo: string, name: string) {
  return `${repoKey(owner, repo)}:${name}`;
}

/**
 * A cached GitHub resource for one repo. `name` must uniquely identify what
 * `loader` fetches (include parameters such as page counts in it).
 */
export function useResource<T>(
  owner: string,
  repo: string,
  name: string,
  loader: Loader<T>,
  { ttlMs, enabled = true }: { ttlMs: number; enabled?: boolean },
) {
  const token = useToken();
  const hydrated = useHydrated();
  const key = resourceKey(owner, repo, name);
  const fullName = `${owner}/${repo}`;

  const state = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    () => read<T>(key),
    () => SERVER as ResourceState<T>,
  );

  useEffect(() => {
    if (hydrated && enabled) loadResource(key, fullName, loader, { token, ttlMs });
    // `loader` is expected to be a stable module-level function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, enabled, key, fullName, token, ttlMs]);

  const reload = useCallback(
    () => loadResource(key, fullName, loader, { token, ttlMs, force: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, fullName, token, ttlMs],
  );

  // Before hydration, and until the first load starts, report loading rather than empty.
  const loading = state.loading || (enabled && hydrated && state.fetchedAt === null && state.error === null);
  return { ...state, loading: hydrated ? loading : true, reload };
}

/** Reads a cached resource without fetching (for previews such as recent-repo cards). */
export function peekResource<T>(owner: string, repo: string, name: string) {
  return read<T>(resourceKey(owner, repo, name)).data;
}
