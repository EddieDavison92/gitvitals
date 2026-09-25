"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ActionsDashboard } from "@/components/actions/dashboard";
import { Icon, type IconName } from "@/components/icon";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Avatar, describeResourceError, EmptyState, Pill, Skeleton } from "@/components/ui/primitives";
import type { DashboardState } from "@/lib/dashboard-state";
import { formatCount } from "@/lib/format";
import { useRepoMeta } from "@/lib/repo-data";
import { TABS, tabPath, type RepoTab } from "@/lib/routes";
import { touchRecentRepo } from "@/lib/storage";
import type { RepoMeta } from "@/lib/types";
import { ActivityTab } from "./activity-tab";
import { IssuesTab } from "./issues-tab";
import { OverviewTab } from "./overview-tab";
import { PullsTab } from "./pulls-tab";
import { ReleasesTab } from "./releases-tab";
import { TrafficTab } from "./traffic-tab";

const TAB_ICONS: Record<RepoTab, IconName> = {
  overview: "pulse",
  activity: "activity",
  pulls: "git-merge",
  issues: "issue",
  releases: "tag",
  actions: "workflow",
  traffic: "eye",
};

export function RepoShell({
  owner,
  repo,
  tab,
  actionsState,
}: {
  owner: string;
  repo: string;
  tab: RepoTab;
  actionsState: DashboardState;
}) {
  const meta = useRepoMeta(owner, repo);
  const fullName = meta.data?.fullName;

  useEffect(() => {
    if (fullName) touchRecentRepo(fullName);
  }, [fullName]);

  if (!meta.data && meta.error && !meta.loading) {
    return (
      <main className="flex min-h-screen flex-col bg-canvas text-fg">
        <SiteHeader />
        <div className="flex-1">
          <EmptyState icon="warning" tone="warn" title={`Couldn't load ${owner}/${repo}`} className="min-h-96">
            {meta.error.kind === "not_found"
              ? "Repository not found. If it's private, add a token that can read it."
              : describeResourceError(meta.error)}
            <Link href="/" className="mt-4 block text-xs font-semibold text-info-fg hover:underline">
              Try another repository
            </Link>
          </EmptyState>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-fg">
      <SiteHeader />
      <RepoIdentity owner={owner} repo={repo} meta={meta.data} />
      <TabNav owner={owner} repo={repo} tab={tab} showTraffic={meta.data?.canPush ?? false} />
      <div className="flex-1">
        {tab === "actions" ? (
          <ActionsDashboard owner={owner} repo={repo} meta={meta.data} initialState={actionsState} />
        ) : (
          <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {tab === "overview" && <OverviewTab owner={owner} repo={repo} meta={meta.data} />}
            {tab === "activity" && <ActivityTab owner={owner} repo={repo} meta={meta.data} />}
            {tab === "pulls" && <PullsTab owner={owner} repo={repo} />}
            {tab === "issues" && <IssuesTab owner={owner} repo={repo} meta={meta.data} />}
            {tab === "releases" && <ReleasesTab owner={owner} repo={repo} />}
            {tab === "traffic" && <TrafficTab owner={owner} repo={repo} meta={meta.data} />}
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}

function RepoIdentity({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const [displayOwner, displayRepo] = (meta?.fullName ?? `${owner}/${repo}`).split("/");
  const facts: Array<{ icon: IconName; label: string; value: string; href?: string }> = meta
    ? [
        { icon: "star", label: "Stars", value: formatCount(meta.stars), href: `${meta.htmlUrl}/stargazers` },
        { icon: "fork", label: "Forks", value: formatCount(meta.forks), href: `${meta.htmlUrl}/forks` },
        { icon: "eye", label: "Watchers", value: formatCount(meta.watchers), href: `${meta.htmlUrl}/watchers` },
      ]
    : [];

  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-start gap-3.5">
          {meta ? <Avatar src={meta.avatarUrl} alt="" size={44} className="rounded-xl" /> : <Skeleton className="size-11 rounded-xl" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noreferrer" className="hover:text-info-fg">
                  <span className="font-normal text-fg-muted">{displayOwner}/</span>
                  {displayRepo}
                </a>
              </h1>
              {meta?.isPrivate && (
                <Pill>
                  <Icon name="lock" className="size-3" />
                  Private
                </Pill>
              )}
              {meta?.isArchived && (
                <Pill tone="warn">
                  <Icon name="archive" className="size-3" />
                  Archived
                </Pill>
              )}
              {meta?.isFork && meta.parent && (
                <Pill>
                  <Icon name="fork" className="size-3" />
                  Fork of {meta.parent}
                </Pill>
              )}
            </div>
            {meta ? (
              <p className="mt-1 max-w-3xl text-sm text-fg-muted">{meta.description ?? "No description."}</p>
            ) : (
              <Skeleton className="mt-2 h-4 w-80 max-w-full" />
            )}
            {meta && (meta.topics.length > 0 || meta.homepage) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {meta.homepage && (
                  <a
                    href={meta.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="mr-1 flex items-center gap-1 text-xs font-medium text-info-fg hover:underline"
                  >
                    <Icon name="arrow-up-right" className="size-3" />
                    {meta.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
                {meta.topics.slice(0, 8).map((topic) => (
                  <a
                    key={topic}
                    href={`https://github.com/topics/${topic}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info-fg hover:underline"
                  >
                    {topic}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
        <dl className="flex shrink-0 items-center gap-2">
          {facts.map((fact) => (
            <a
              key={fact.label}
              href={fact.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 transition hover:border-info-line"
            >
              <Icon name={fact.icon} className="size-4 text-fg-subtle" />
              <span>
                <dt className="sr-only">{fact.label}</dt>
                <dd className="font-mono text-sm font-semibold tabular-nums text-fg">{fact.value}</dd>
              </span>
            </a>
          ))}
        </dl>
      </div>
    </section>
  );
}

function TabNav({ owner, repo, tab, showTraffic }: { owner: string; repo: string; tab: RepoTab; showTraffic: boolean }) {
  const tabs = TABS.filter((item) => item.tab !== "traffic" || showTraffic || tab === "traffic");
  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur" aria-label="Repository sections">
      <div className="mx-auto flex h-11 max-w-[1480px] items-stretch gap-1 overflow-x-auto px-2 [scrollbar-width:none] sm:px-4 lg:px-6">
        {tabs.map((item) => {
          const active = item.tab === tab;
          return (
            <Link
              key={item.tab}
              href={tabPath(owner, repo, item.tab)}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={`relative flex shrink-0 items-center gap-2 px-3 text-sm font-medium transition ${
                active ? "text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              <Icon name={TAB_ICONS[item.tab]} className={`size-4 ${active ? "text-info-fg" : ""}`} />
              {item.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-info" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
