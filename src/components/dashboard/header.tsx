"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { RepoPicker } from "@/components/repo-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { TokenSettings } from "@/components/token-settings";
import { formatCount } from "@/lib/format";
import type { RepoMeta } from "@/lib/types";
import { RelativeTime } from "./ui";

function cadence(ms: number) {
  return ms < 60_000 ? `${ms / 1000} seconds` : ms === 60_000 ? "minute" : `${ms / 60_000} minutes`;
}

export function DashboardHeader({
  owner,
  repo,
  meta,
  fetchedAt,
  loading,
  liveCount,
  refreshMs,
  onRefresh,
}: {
  owner: string;
  repo: string;
  meta: RepoMeta | null;
  fetchedAt: number | null;
  loading: boolean;
  liveCount: number;
  refreshMs: number;
  onRefresh: () => void;
}) {
  const [displayOwner, displayRepo] = (meta?.fullName ?? `${owner}/${repo}`).split("/");

  return (
    <header className="border-b border-white/10 bg-chrome text-white">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Choose another repository"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-sky-300 shadow-inner transition hover:bg-white/15"
          >
            <Icon name="workflow" className="size-5" />
          </Link>
          {meta?.avatarUrl && (
            <Image
              src={meta.avatarUrl}
              alt=""
              width={28}
              height={28}
              unoptimized
              className="hidden size-7 shrink-0 rounded-lg bg-white/10 sm:block"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={`https://github.com/${owner}/${repo}/actions`}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm font-semibold tracking-tight hover:text-sky-300 sm:text-base"
              >
                <span className="text-slate-400">{displayOwner}/</span>
                {displayRepo}
              </a>
              {meta?.isPrivate && (
                <span className="hidden items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 sm:inline-flex">
                  <Icon name="lock" className="size-3" />
                  Private
                </span>
              )}
              {meta?.isArchived && (
                <span className="hidden items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 sm:inline-flex">
                  <Icon name="archive" className="size-3" />
                  Archived
                </span>
              )}
            </div>
            <p className="flex min-w-0 items-center gap-2 truncate text-xs text-slate-400">
              {meta && (
                <span className="flex shrink-0 items-center gap-1" title="Stars">
                  <Icon name="star" className="size-3" />
                  {formatCount(meta.stars)}
                </span>
              )}
              <span className="truncate">{meta?.description ?? "GitHub Actions"}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          <RepoPicker variant="compact" />
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title={`Refreshes every ${cadence(refreshMs)}${liveCount > 0 ? " while runs are active" : ""}. Click to refresh now.`}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-white/5 hover:text-slate-200 disabled:cursor-default"
          >
            {liveCount > 0 && !loading ? (
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative size-2 rounded-full bg-emerald-400" />
              </span>
            ) : (
              <Icon name="refresh" className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            )}
            <span className="hidden sm:inline">
              {loading ? (
                "Updating"
              ) : liveCount > 0 ? (
                <span className="text-emerald-300">
                  Live · {liveCount} active
                </span>
              ) : fetchedAt ? (
                <RelativeTime value={fetchedAt} prefix="Updated " />
              ) : (
                "Not loaded"
              )}
            </span>
          </button>
          <ThemeToggle />
          <TokenSettings />
        </div>
      </div>
    </header>
  );
}
