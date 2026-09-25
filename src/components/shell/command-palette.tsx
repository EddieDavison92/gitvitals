"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { parseRepo } from "@/lib/parse-repo";
import { peekResource } from "@/lib/resource-store";
import { TABS, tabPath } from "@/lib/routes";
import type { RepoMeta } from "@/lib/types";
import { useRecentRepos } from "@/lib/use-recent-repos";
import type { SidebarRepo } from "./sidebar";

// Open state is shared so any trigger (sidebar button, ⌘K) drives the one palette.
let paletteOpen = false;
let returnFocus: HTMLElement | null = null;
const listeners = new Set<() => void>();

function setPaletteOpen(open: boolean) {
  if (open === paletteOpen) return;
  if (open) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  paletteOpen = open;
  listeners.forEach((listener) => listener());
  // Hand focus back to whatever opened the palette.
  if (!open && returnFocus?.isConnected) returnFocus.focus();
}

export function openPalette() {
  setPaletteOpen(true);
}

function usePaletteOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => paletteOpen,
    () => false,
  );
}

type Item = { id: string; group: string; label: string; hint?: string; href: string; icon?: IconName; avatar?: string | null };

const TAB_ICONS: Record<string, IconName> = {
  overview: "home",
  activity: "activity",
  pulls: "git-merge",
  issues: "issue",
  releases: "tag",
  actions: "workflow",
  traffic: "eye",
};

/** ⌘K / Ctrl+K palette: open a repo, jump to a section of the current one, or revisit a recent repo. */
export function CommandPalette({ current }: { current: SidebarRepo | null }) {
  const open = usePaletteOpen();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return open ? <PaletteDialog current={current} onClose={() => setPaletteOpen(false)} /> : null;
}

function PaletteDialog({ current, onClose }: { current: SidebarRepo | null; onClose: () => void }) {
  const router = useRouter();
  const recent = useRecentRepos();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
    const currentName = current ? (current.meta?.fullName ?? `${current.owner}/${current.repo}`) : null;
    const result: Item[] = [];

    const parsed = parseRepo(query);
    if (parsed && `${parsed.owner}/${parsed.repo}`.toLowerCase() !== currentName?.toLowerCase()) {
      result.push({ id: "open", group: "Open", label: `${parsed.owner}/${parsed.repo}`, href: `/${parsed.owner}/${parsed.repo}`, icon: "arrow-up-right" });
    }
    if (current) {
      for (const tab of TABS) {
        if (tab.tab === "traffic" && !current.meta?.canPush) continue;
        if (!matches(tab.label)) continue;
        result.push({
          id: `tab-${tab.tab}`,
          group: currentName ?? "",
          label: tab.label,
          hint: tab.tab === current.tab ? "Current" : undefined,
          href: tabPath(current.owner, current.repo, tab.tab),
          icon: TAB_ICONS[tab.tab],
        });
      }
    }
    for (const name of recent) {
      if (name.toLowerCase() === currentName?.toLowerCase() || !matches(name)) continue;
      const [owner, repo] = name.split("/");
      result.push({ id: `repo-${name}`, group: "Recent", label: name, href: `/${name}`, avatar: peekResource<RepoMeta>(owner, repo, "meta")?.avatarUrl ?? null });
    }
    if (matches("Compare repositories")) result.push({ id: "compare", group: "Tools", label: "Compare repositories", href: "/compare", icon: "compare" });
    if (matches("Home")) result.push({ id: "home", group: "Tools", label: "Home", href: "/", icon: "home" });
    return result;
  }, [current, query, recent]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  // Handled on the dialog so Escape and Tab work wherever focus is; results aren't focusable, so Tab stays on the input.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Tab") {
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(items[activeIndex]);
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[14vh]">
      <div className="absolute inset-0 bg-black/40 animate-[fade-in_100ms_ease-out] dark:bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-surface shadow-2xl shadow-black/30"
      >
        <div className="flex h-12 items-center gap-3 border-b border-line px-4">
          <Icon name="search" className="size-4 shrink-0 text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="Type owner/repo, paste a GitHub URL, or search"
            aria-label="Search"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items.length > 0 ? `${listId}-${activeIndex}` : undefined}
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-fg-muted">
            {query.trim() ? "No matches. Enter a repo as owner/repo." : "No recent repositories yet."}
          </p>
        ) : (
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            // Keep focus on the input when clicking results, so keyboard handling keeps working.
            onMouseDown={(event) => event.preventDefault()}
            className="max-h-[min(28rem,60vh)] overflow-y-auto p-1.5 [scrollbar-width:thin]">
            {groupItems(items).map((group, groupIndex) => (
              <div key={group.name} role="group" aria-labelledby={`${listId}-g${groupIndex}`}>
                <p id={`${listId}-g${groupIndex}`} className={`px-2.5 pb-1 text-[11px] font-medium text-fg-subtle ${groupIndex === 0 ? "pt-1" : "pt-2"}`}>
                  {group.name}
                </p>
                {group.entries.map(({ item, index }) => (
                  <div
                    key={item.id}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(item)}
                    className={`flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] ${
                      index === activeIndex ? "bg-surface-3 text-fg" : "text-fg-2"
                    }`}
                  >
                    {item.avatar !== undefined ? (
                      item.avatar ? <Avatar src={item.avatar} alt="" size={16} className="rounded" /> : <span className="size-4 shrink-0 rounded bg-surface-3" />
                    ) : (
                      item.icon && <Icon name={item.icon} className="size-4 shrink-0 text-fg-subtle" />
                    )}
                    <span className={`min-w-0 flex-1 truncate ${item.group === "Recent" || item.group === "Open" ? "font-mono text-xs" : ""}`}>{item.label}</span>
                    {item.hint && <span className="text-xs text-fg-subtle">{item.hint}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}

/** Consecutive items sharing a group, keeping each item's overall index for keyboard selection. */
function groupItems(items: Item[]) {
  const groups: Array<{ name: string; entries: Array<{ item: Item; index: number }> }> = [];
  items.forEach((item, index) => {
    const last = groups.at(-1);
    if (last?.name === item.group) last.entries.push({ item, index });
    else groups.push({ name: item.group, entries: [{ item, index }] });
  });
  return groups;
}
