"use client";

import { useSyncExternalStore } from "react";

const KEY = "gv:token";
const listeners = new Set<() => void>();

function read() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked; token lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Optional GitHub token, kept in this browser's localStorage only. */
export function useToken() {
  return useSyncExternalStore(subscribe, read, () => null);
}
