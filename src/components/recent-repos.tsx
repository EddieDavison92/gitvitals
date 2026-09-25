"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Avatar } from "@/components/ui/primitives";
import { DOT } from "@/components/ui/tones";
import { formatCompact } from "@/lib/format";
import type { CommitWeek } from "@/lib/github-insights";
import { activityLevel } from "@/lib/insights";
import { peekResource } from "@/lib/resource-store";
import { parseRecentRepos, RECENT_REPOS_KEY } from "@/lib/storage";
import type { RepoMeta } from "@/lib/types";

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
  "rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-fg-muted transition hover:border-info hover:text-info-fg";

/** Example chips before any visits; afterwards, cards for recently viewed repos from the local cache. */
export function RecentRepos({ examples }: { examples: string[] }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const recent = useMemo(() => parseRecentRepos(raw), [raw]);

  if (recent.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fg-subtle">Try</span>
        {examples.map((name) => (
          <Link key={name} href={`/${name}`} className={chipClass}>
            {name}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-fg-subtle">Recently viewed</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {recent.slice(0, 6).map((name) => (
          <RecentCard key={name} name={name} />
        ))}
      </ul>
    </div>
  );
}

function RecentCard({ name }: { name: string }) {
  const [owner, repo] = name.split("/");
  const meta = peekResource<RepoMeta>(owner, repo, "meta");
  const weeks = peekResource<CommitWeek[]>(owner, repo, "commit-activity");
  const activity = weeks ? activityLevel(weeks, meta?.isArchived ?? false) : null;
  return (
    <li>
      <Link
        href={`/${name}`}
        className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition hover:border-info-line hover:shadow-card"
      >
        {meta ? <Avatar src={meta.avatarUrl} alt="" size={28} className="rounded-lg" /> : <span className="size-7 rounded-lg bg-surface-3" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-xs font-semibold text-fg">{name}</span>
          <span className="flex items-center gap-2 text-[11px] text-fg-muted">
            {activity && (
              <span className="flex items-center gap-1">
                <span className={`size-1.5 rounded-full ${DOT[activity.tone]}`} />
                {activity.label}
              </span>
            )}
            {meta && <span>★ {formatCompact(meta.stars)}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}
