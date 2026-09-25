"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ActionsDashboard } from "@/components/actions/dashboard";
import { Icon } from "@/components/icon";
import { AppShell, PageBody } from "@/components/shell/app-shell";
import { Sidebar } from "@/components/shell/sidebar";
import { BUTTON, describeResourceError, EmptyState } from "@/components/ui/primitives";
import type { DashboardState } from "@/lib/dashboard-state";
import { formatCompact } from "@/lib/format";
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

  const [displayOwner, displayRepo] = (fullName ?? `${owner}/${repo}`).split("/");
  const tabLabel = TABS.find((item) => item.tab === tab)?.label;
  const crumbs = [
    { label: displayOwner, href: `https://github.com/${displayOwner}` },
    { label: displayRepo, href: tabPath(owner, repo, "overview") },
    ...(tab === "overview" ? [] : [{ label: tabLabel }]),
  ];
  const notFound = !meta.data && meta.error && !meta.loading;

  return (
    <AppShell
      sidebar={(onNavigate) => <Sidebar current={{ owner, repo, meta: meta.data, tab }} onNavigate={onNavigate} />}
      crumbs={crumbs}
      actions={<RepoFacts owner={owner} repo={repo} meta={meta.data} />}
    >
      {notFound ? (
        <PageBody>
          <EmptyState icon="warning" title={`Couldn't load ${owner}/${repo}`} className="py-24">
            {meta.error!.kind === "not_found"
              ? "Repository not found. If it's private, add a token that can read it."
              : describeResourceError(meta.error!)}
            <Link href="/" className="mt-3 block text-info-fg hover:underline">
              Open another repository
            </Link>
          </EmptyState>
        </PageBody>
      ) : tab === "actions" ? (
        <ActionsDashboard owner={owner} repo={repo} meta={meta.data} initialState={actionsState} />
      ) : (
        <PageBody>
          {tab === "overview" && <OverviewTab owner={owner} repo={repo} meta={meta.data} />}
          {tab === "activity" && <ActivityTab owner={owner} repo={repo} meta={meta.data} />}
          {tab === "pulls" && <PullsTab owner={owner} repo={repo} />}
          {tab === "issues" && <IssuesTab owner={owner} repo={repo} meta={meta.data} />}
          {tab === "releases" && <ReleasesTab owner={owner} repo={repo} />}
          {tab === "traffic" && <TrafficTab owner={owner} repo={repo} meta={meta.data} />}
        </PageBody>
      )}
    </AppShell>
  );
}

function RepoFacts({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  return (
    <>
      {meta && (
        <dl className="hidden items-center gap-4 text-xs text-fg-muted md:flex">
          <div className="flex items-center gap-1" title="Stars">
            <dt className="sr-only">Stars</dt>
            <Icon name="star" className="size-3.5" />
            <dd className="tabular-nums">{formatCompact(meta.stars)}</dd>
          </div>
          <div className="flex items-center gap-1" title="Forks">
            <dt className="sr-only">Forks</dt>
            <Icon name="fork" className="size-3.5" />
            <dd className="tabular-nums">{formatCompact(meta.forks)}</dd>
          </div>
          {meta.license && (
            <div className="hidden xl:block">
              <dt className="sr-only">Licence</dt>
              <dd className="font-mono">{meta.license}</dd>
            </div>
          )}
          {meta.language && (
            <div className="hidden xl:block">
              <dt className="sr-only">Language</dt>
              <dd>{meta.language}</dd>
            </div>
          )}
        </dl>
      )}
      <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noreferrer" className={`${BUTTON} h-7 text-xs`}>
        GitHub
        <Icon name="arrow-up-right" className="size-3" />
      </a>
    </>
  );
}
