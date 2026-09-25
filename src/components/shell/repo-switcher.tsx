"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { parseRepo } from "@/lib/parse-repo";
import { peekResource } from "@/lib/resource-store";
import type { RepoMeta } from "@/lib/types";
import { useRecentRepos } from "@/lib/use-recent-repos";

/**
 * Sidebar button showing the current repo; opens a search popover (also ⌘K / Ctrl+K)
 * that takes owner/repo or a GitHub URL and lists recent repos.
 */
export function RepoSwitcher({ current }: { current: { owner: string; repo: string; meta: RepoMeta | null } | null }) {
  const router = useRouter();
  const recent = useRecentRepos();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [invalid, setInvalid] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const go = (name: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/${name}`);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseRepo(query);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    go(`${parsed.owner}/${parsed.repo}`);
  };

  const needle = query.trim().toLowerCase();
  const matches = recent.filter((name) => !needle || name.toLowerCase().includes(needle)).slice(0, 8);
  const label = current ? (current.meta?.fullName ?? `${current.owner}/${current.repo}`) : null;

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface px-2 text-left transition-colors hover:bg-surface-2"
      >
        {current?.meta ? (
          <Avatar src={current.meta.avatarUrl} alt="" size={18} className="rounded" />
        ) : (
          <Icon name="search" className="size-4 shrink-0 text-fg-subtle" />
        )}
        <span className={`min-w-0 flex-1 truncate text-[13px] ${label ? "font-medium text-fg" : "text-fg-muted"}`}>
          {label ?? "Open a repository"}
        </span>
        <Kbd>⌘K</Kbd>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface shadow-xl shadow-black/15">
          <form onSubmit={submit} className="border-b border-line p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setInvalid(false);
              }}
              placeholder="owner/repo or GitHub URL"
              aria-label="Repository"
              aria-invalid={invalid}
              spellCheck={false}
              className="h-8 w-full rounded-md bg-surface-2 px-2.5 font-mono text-[13px] text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
            />
            {invalid && <p className="mt-1.5 px-1 text-xs text-bad-fg">Enter owner/repo or a GitHub URL.</p>}
          </form>
          {matches.length > 0 && (
            <ul className="max-h-72 overflow-y-auto p-1">
              <li className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-fg-subtle">Recent</li>
              {matches.map((name) => {
                const [owner, repo] = name.split("/");
                const meta = peekResource<RepoMeta>(owner, repo, "meta");
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => go(name)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg-2 hover:bg-surface-3 hover:text-fg"
                    >
                      {meta ? <Avatar src={meta.avatarUrl} alt="" size={16} className="rounded" /> : <span className="size-4 rounded bg-surface-3" />}
                      <span className="truncate">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
