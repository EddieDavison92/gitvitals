"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchRateLimits, type RateLimitResource, type RateLimits } from "./github";
import { useToken } from "./token-store";
import type { RateLimit } from "./types";
import { useHydrated } from "./use-hydrated";

// Limits apply per IP or token, not per repo, so one store serves every view.
let limits: RateLimits = { core: null, search: null };
const listeners = new Set<() => void>();

export function setRateLimit(next: RateLimit, resource: RateLimitResource = "core") {
  limits = { ...limits, [resource]: next };
  listeners.forEach((listener) => listener());
}

export function currentRateLimit(resource: RateLimitResource = "core") {
  return limits[resource];
}

/** Current core and search limits, refreshed from the free /rate_limit endpoint when the token changes. */
export function useRateLimits() {
  const token = useToken();
  const hydrated = useHydrated();
  useEffect(() => {
    if (!hydrated) return;
    fetchRateLimits(token).then((next) => {
      if (!next) return;
      limits = next;
      listeners.forEach((listener) => listener());
    });
  }, [hydrated, token]);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => limits,
    () => limits,
  );
}
