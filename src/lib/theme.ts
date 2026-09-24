"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_KEY as KEY } from "./theme-script";

export type ThemePreference = "system" | "light" | "dark";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, preference);
  } catch {
    // Storage blocked; the choice lasts for this page only.
  }
  apply(preference);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The saved preference; also follows OS changes while set to "system". */
export function useThemePreference() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);
  return preference;
}
