"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { parseRecentRepos, RECENT_REPOS_KEY } from "@/lib/run-cache";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function readRaw() {
  try {
    return window.localStorage.getItem(RECENT_REPOS_KEY);
  } catch {
    return null;
  }
}

const chipClass =
  "rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-xs text-slate-600 transition hover:border-sky-300 hover:text-sky-700";

/** Repo chips: recently viewed ones when there are any, otherwise examples. */
export function RecentRepos({ examples }: { examples: string[] }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const recent = useMemo(() => parseRecentRepos(raw), [raw]);
  const items = recent.length > 0 ? recent : examples;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-400">{recent.length > 0 ? "Recent" : "Try"}</span>
      {items.map((name) => (
        <Link key={name} href={`/${name}`} className={chipClass}>
          {name}
        </Link>
      ))}
    </div>
  );
}
