"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseRecentRepos, RECENT_REPOS_KEY } from "./storage";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("gv:recent", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("gv:recent", listener);
  };
}

function readRaw() {
  try {
    return window.localStorage.getItem(RECENT_REPOS_KEY);
  } catch {
    return null;
  }
}

/** Recently viewed repos (`owner/repo`, newest first); empty during SSR. */
export function useRecentRepos() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parseRecentRepos(raw), [raw]);
}
