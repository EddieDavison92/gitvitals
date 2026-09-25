"use client";

import { Icon } from "@/components/icon";
import { Avatar, Kbd } from "@/components/ui/primitives";
import type { RepoMeta } from "@/lib/types";
import { openPalette } from "./command-palette";

/** Sidebar button showing the current repo; opens the command palette (also ⌘K / Ctrl+K). */
export function RepoSwitcher({ current }: { current: { owner: string; repo: string; meta: RepoMeta | null } | null }) {
  const label = current ? (current.meta?.fullName ?? `${current.owner}/${current.repo}`) : null;
  return (
    <button
      type="button"
      onClick={openPalette}
      className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface px-2 text-left transition-colors hover:border-fg-subtle"
    >
      {current?.meta ? (
        <Avatar src={current.meta.avatarUrl} alt="" size={18} className="rounded" />
      ) : (
        <Icon name="search" className="size-4 shrink-0 text-fg-subtle" />
      )}
      <span className={`min-w-0 flex-1 truncate text-[13px] ${label ? "font-medium text-fg" : "text-fg-muted"}`}>{label ?? "Open a repository"}</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}
