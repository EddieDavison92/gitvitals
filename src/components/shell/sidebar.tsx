"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { TokenSettings } from "@/components/token-settings";
import { Avatar } from "@/components/ui/primitives";
import { DOT } from "@/components/ui/tones";
import { formatCompact } from "@/lib/format";
import { useBranchRuns, useFlow, useReleases } from "@/lib/repo-data";
import { peekResource } from "@/lib/resource-store";
import { TABS, tabPath, type RepoTab } from "@/lib/routes";
import { branchHealth } from "@/lib/stats";
import type { RepoMeta } from "@/lib/types";
import { useRecentRepos } from "@/lib/use-recent-repos";
import { RepoSwitcher } from "./repo-switcher";

export type SidebarRepo = { owner: string; repo: string; meta: RepoMeta | null; tab: RepoTab };

const TAB_ICONS: Record<RepoTab, IconName> = {
  overview: "home",
  activity: "activity",
  pulls: "git-merge",
  issues: "issue",
  releases: "tag",
  actions: "workflow",
  traffic: "eye",
};

export function BrandMark() {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-fg text-surface">
      <Icon name="activity" className="size-3.5" />
    </span>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  meta,
  onNavigate,
}: {
  href: string;
  icon: IconName;
  label: string;
  active: boolean;
  meta?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
        active ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:bg-surface-3/60 hover:text-fg"
      }`}
    >
      <Icon name={icon} className={`size-4 shrink-0 ${active ? "text-fg" : "text-fg-subtle"}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta !== undefined && meta !== null && <span className="shrink-0 font-mono text-[11px] text-fg-subtle tabular-nums">{meta}</span>}
    </Link>
  );
}

/** Nav counts come from whatever the tabs have already cached; the sidebar never fetches. */
function RepoNav({ current, onNavigate }: { current: SidebarRepo; onNavigate?: () => void }) {
  const { owner, repo, meta, tab } = current;
  const flow = useFlow(owner, repo, false);
  const releases = useReleases(owner, repo, 10, false);
  const runs = useBranchRuns(owner, repo, meta?.defaultBranch ?? null, false);
  const health = meta && runs.data ? branchHealth(runs.data, meta.defaultBranch) : [];
  const failing = health.some((item) => item.failing);

  const badges: Partial<Record<RepoTab, React.ReactNode>> = {
    pulls: flow.data ? formatCompact(flow.data.openPulls) : undefined,
    issues: flow.data ? formatCompact(flow.data.openIssues) : undefined,
    releases: releases.data?.[0]?.tag,
    actions: health.length > 0 ? <span className={`inline-block size-1.5 rounded-full ${failing ? DOT.bad : DOT.ok}`} /> : undefined,
  };

  return (
    <nav aria-label="Repository" className="space-y-px">
      {TABS.filter((item) => item.tab !== "traffic" || meta?.canPush || tab === "traffic").map((item) => (
        <NavItem
          key={item.tab}
          href={tabPath(owner, repo, item.tab)}
          icon={TAB_ICONS[item.tab]}
          label={item.label}
          active={item.tab === tab}
          meta={badges[item.tab]}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function RecentList({ exclude, onNavigate }: { exclude: string | null; onNavigate?: () => void }) {
  const recent = useRecentRepos().filter((name) => name.toLowerCase() !== exclude?.toLowerCase());
  if (recent.length === 0) return null;
  return (
    <div>
      <p className="px-2 pb-1 text-[11px] font-medium text-fg-subtle">Recent</p>
      <ul className="space-y-px">
        {recent.slice(0, 6).map((name) => {
          const [owner, repo] = name.split("/");
          const meta = peekResource<RepoMeta>(owner, repo, "meta");
          return (
            <li key={name}>
              <Link
                href={`/${name}`}
                onClick={onNavigate}
                className="flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-fg-muted transition-colors hover:bg-surface-3/60 hover:text-fg"
              >
                {meta ? <Avatar src={meta.avatarUrl} alt="" size={14} className="rounded-sm" /> : <span className="size-3.5 rounded-sm bg-surface-3" />}
                <span className="truncate">{name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar({
  current,
  section,
  onNavigate,
}: {
  current: SidebarRepo | null;
  /** Highlighted global item when not on a repo page. */
  section?: "home" | "compare";
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2" aria-label="gitvitals home">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-fg">gitvitals</span>
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-3">
        <RepoSwitcher current={current} />
        {current && <RepoNav current={current} onNavigate={onNavigate} />}
        <nav aria-label="Tools" className="space-y-px">
          {!current && <NavItem href="/" icon="home" label="Home" active={section === "home"} onNavigate={onNavigate} />}
          <NavItem href="/compare" icon="compare" label="Compare" active={section === "compare"} onNavigate={onNavigate} />
        </nav>
        <RecentList exclude={current ? `${current.owner}/${current.repo}` : null} onNavigate={onNavigate} />
      </div>

      <div className="flex shrink-0 items-center gap-1 border-t border-line p-2">
        <TokenSettings />
        <ThemeToggle />
      </div>
    </div>
  );
}
