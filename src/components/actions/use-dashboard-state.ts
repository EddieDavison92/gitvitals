"use client";

import { useCallback, useEffect, useState } from "react";
import { serializeDashboardState, type DashboardState } from "@/lib/dashboard-state";

/**
 * Dashboard state mirrored to the query string with replaceState, so filters
 * survive reloads and links are shareable without adding history entries.
 */
export function useDashboardState(initial: DashboardState) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    const query = serializeDashboardState(state);
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [state]);

  const update = useCallback((patch: Partial<DashboardState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  return [state, update] as const;
}
