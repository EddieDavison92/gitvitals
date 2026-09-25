"use client";

import { Icon } from "@/components/icon";
import { MiniBars } from "@/components/ui/charts";
import {
  Avatar,
  Badge,
  Meter,
  Panel,
  ResourceNote,
  Skeleton,
  StatCell,
  StatGrid,
  TD,
  TextLink,
  TH,
  TR,
} from "@/components/ui/primitives";
import { DOT, type Tone } from "@/components/ui/tones";
import { formatCompact, formatCount, formatPercent, formatRate, formatRelativeTime, formatSpan, plural } from "@/lib/format";
import type { Release } from "@/lib/github-insights";
import { activityLevel, busFactor, durationSummary, languageShares, releaseCadence } from "@/lib/insights";
import {
  useBranchRuns,
  useCommitActivity,
  useCommunity,
  useContributors,
  useFlow,
  useLanguages,
  useReleases,
} from "@/lib/repo-data";
import type { ResourceState } from "@/lib/resource-store";
import { tabPath } from "@/lib/routes";
import { branchHealth, summarizeRuns } from "@/lib/stats";
import type { RepoMeta } from "@/lib/types";
import { useNow } from "@/lib/use-now";

type Props = { owner: string; repo: string; meta: RepoMeta | null };
type Reason = { tone: Tone; text: string };

const DAY = 86_400_000;

export function OverviewTab({ owner, repo, meta }: Props) {
  const now = useNow(60_000);
  const commits = useCommitActivity(owner, repo);
  const releases = useReleases(owner, repo, 10);
  const flow = useFlow(owner, repo);
  const contributors = useContributors(owner, repo);
  const branchRuns = useBranchRuns(owner, repo, meta?.defaultBranch ?? null);

  const activity = activityLevel(commits.data ?? [], meta?.isArchived ?? false);
  const cadence = releaseCadence(releases.data ?? [], now);
  const merge = durationSummary(flow.data?.merged.durations ?? []);
  const close = durationSummary(flow.data?.completed.durations ?? []);
  const bus = busFactor(contributors.data ?? []);
  const branch = meta?.defaultBranch ?? null;
  const health = branch && branchRuns.data ? branchHealth(branchRuns.data, branch) : [];
  const failing = health.filter((item) => item.failing);
  const ciRate = summarizeRuns(branchRuns.data ?? []).successRate;
  const ciLoading = !meta || (branchRuns.loading && !branchRuns.data);
  const flowLoading = flow.loading && !flow.data;
  const releaseTone: Tone = cadence.daysSinceLatest === null ? "idle" : cadence.daysSinceLatest < 90 ? "ok" : cadence.daysSinceLatest < 365 ? "warn" : "bad";

  const reasons: Reason[] = [];
  if (commits.data) {
    reasons.push({
      tone: activity.tone,
      text:
        activity.level === "dormant"
          ? "No commits in the past year"
          : activity.activeWeeks12 > 0
            ? `Commits in ${activity.activeWeeks12} of the last 12 weeks`
            : `Last commits ${formatRelativeTime(activity.lastActiveWeek, now)}`,
    });
  }
  if (releases.data) {
    reasons.push({ tone: releaseTone, text: cadence.latest ? `Released ${formatRelativeTime(cadence.latest.publishedAt, now)}` : "No releases" });
  }
  if (merge) reasons.push({ tone: merge.median < 7 * DAY ? "ok" : "warn", text: `PRs merged in ~${formatSpan(merge.median)}` });
  if (health.length > 0) {
    reasons.push({ tone: failing.length > 0 ? "bad" : "ok", text: failing.length > 0 ? `${plural(failing.length, "workflow")} failing on ${branch}` : `CI green on ${branch}` });
  }

  const link = (tab: Parameters<typeof tabPath>[2]) => tabPath(owner, repo, tab);
  const sampleNote = (count: number, total: number) => (count < total ? `${count} most recent` : String(count));

  return (
    <>
      <RepoHeader meta={meta} />

      <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface px-4 py-3.5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          {commits.loading && !commits.data ? (
            <Skeleton className="h-5 w-72" />
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Badge tone={activity.tone} className="text-xs">
                <span className={`size-1.5 rounded-full ${DOT[activity.tone]}`} />
                {activity.label}
              </Badge>
              {reasons.map((reason) => (
                <span key={reason.text} className="flex items-center gap-1.5 text-[13px] text-fg-2">
                  <span className={`size-1.5 shrink-0 rounded-full ${DOT[reason.tone]}`} />
                  {reason.text}
                </span>
              ))}
            </div>
          )}
          <ResourceNote error={commits.data ? null : commits.error} onRetry={commits.reload} className="mt-2" />
        </div>
        <div className="w-full shrink-0 lg:w-80">
          <div className="mb-1 flex justify-between text-[11px] text-fg-subtle">
            <span>Commits per week, 52 weeks</span>
            <span className="tabular-nums">{formatCount(activity.commits52)}</span>
          </div>
          {commits.data ? <MiniBars values={commits.data.map((week) => week.total)} height={28} color="var(--ok)" /> : <Skeleton className="h-7" />}
        </div>
      </section>

      <StatGrid className="grid-cols-2 xl:grid-cols-4">
        <StatCell
          label="Commits, 12 weeks"
          href={link("activity")}
          loading={commits.loading && !commits.data}
          error={commits.data ? null : commits.error}
          value={formatCount(activity.commits12)}
          sub={`${formatCount(activity.commits52)} this year · ${activity.activeWeeks12}/12 weeks active`}
        />
        <StatCell
          label="Latest release"
          href={link("releases")}
          loading={releases.loading && !releases.data}
          error={releases.data ? null : releases.error}
          tone={releaseTone}
          value={<span className="font-mono text-lg">{cadence.latest?.tag ?? "None"}</span>}
          sub={
            cadence.latest
              ? `${formatRelativeTime(cadence.latest.publishedAt, now)}${cadence.medianGapDays !== null ? ` · typically every ${formatSpan(cadence.medianGapDays * DAY)}` : ""}`
              : "No published releases"
          }
        />
        <StatCell
          label="Time to merge"
          href={link("pulls")}
          loading={flowLoading}
          error={flow.data ? null : flow.error}
          value={merge ? formatSpan(merge.median) : "–"}
          sub={merge ? `Median of ${sampleNote(merge.count, flow.data?.merged.total ?? 0)} merged in 30 days` : "Nothing merged in 30 days"}
        />
        <StatCell
          label="Open pull requests"
          href={link("pulls")}
          loading={flowLoading}
          error={flow.data ? null : flow.error}
          value={flow.data ? formatCount(flow.data.openPulls) : "–"}
          sub={flow.data ? `${formatCount(flow.data.merged.total)} merged in 30 days` : undefined}
        />
        <StatCell
          label="Time to close issues"
          href={link("issues")}
          loading={flowLoading}
          error={flow.data ? null : flow.error}
          value={close ? formatSpan(close.median) : "–"}
          sub={
            close
              ? `Median of ${sampleNote(close.count, flow.data?.completed.total ?? 0)} completed in 30 days`
              : meta?.hasIssues === false
                ? "Issues are turned off"
                : "None completed in 30 days"
          }
        />
        <StatCell
          label="Open issues"
          href={link("issues")}
          loading={flowLoading}
          error={flow.data ? null : flow.error}
          value={flow.data ? formatCount(flow.data.openIssues) : "–"}
          sub={flow.data ? `${formatCount(flow.data.openedIssues)} opened · ${formatCount(flow.data.completed.total)} completed in 30 days` : undefined}
        />
        <StatCell
          label={branch ? `CI on ${branch}` : "CI"}
          href={link("actions")}
          loading={ciLoading}
          error={branchRuns.data ? null : branchRuns.error}
          tone={health.length === 0 ? undefined : failing.length > 0 ? "bad" : "ok"}
          value={health.length === 0 ? "No workflows" : failing.length > 0 ? `${failing.length} failing` : "Passing"}
          sub={health.length === 0 ? "No Actions runs on the default branch" : `${health.length - failing.length}/${health.length} workflows green · ${formatRate(ciRate)} of recent runs passed`}
        />
        <StatCell
          label="Bus factor"
          href={link("activity")}
          loading={contributors.loading && !contributors.data}
          error={contributors.data ? null : contributors.error}
          tone={!bus ? undefined : bus.factor === 1 ? "warn" : undefined}
          value={bus ? String(bus.factor) : "–"}
          sub={bus ? `${plural(bus.factor, "person", "people")} wrote half the commits · ${plural(bus.humans, "contributor")}` : undefined}
        />
      </StatGrid>

      <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]">
        <ContributorsPanel owner={owner} repo={repo} resource={contributors} />
        <LanguagesPanel owner={owner} repo={repo} />
        <CommunityPanel owner={owner} repo={repo} meta={meta} />
      </div>

      <ReleasesPanel owner={owner} repo={repo} resource={releases} now={now} />
    </>
  );
}

function RepoHeader({ meta }: { meta: RepoMeta | null }) {
  if (!meta) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="size-10" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
    );
  }
  const [owner, name] = meta.fullName.split("/");
  return (
    <div className="flex items-start gap-3.5">
      <Avatar src={meta.avatarUrl} alt="" size={40} className="rounded-md" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-fg">
            <span className="font-normal text-fg-muted">{owner}/</span>
            {name}
          </h1>
          {meta.isPrivate && <Badge>Private</Badge>}
          {meta.isArchived && <Badge tone="warn">Archived</Badge>}
          {meta.isFork && meta.parent && <Badge>Fork of {meta.parent}</Badge>}
        </div>
        <p className="mt-0.5 text-[13px] text-fg-muted">{meta.description ?? "No description."}</p>
        {(meta.topics.length > 0 || meta.homepage) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {meta.homepage && (
              <a
                href={meta.homepage}
                target="_blank"
                rel="noreferrer"
                className="mr-1 inline-flex items-center gap-1 text-xs text-info-fg hover:underline"
              >
                {meta.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                <Icon name="arrow-up-right" className="size-3" />
              </a>
            )}
            {meta.topics.slice(0, 10).map((topic) => (
              <a
                key={topic}
                href={`https://github.com/topics/${topic}`}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-line px-1.5 py-px text-[11px] text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
              >
                {topic}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContributorsPanel({
  owner,
  repo,
  resource,
}: {
  owner: string;
  repo: string;
  resource: ReturnType<typeof useContributors>;
}) {
  const people = (resource.data ?? []).filter((person) => !person.isBot);
  const total = people.reduce((sum, person) => sum + person.commits, 0);
  const bus = busFactor(resource.data ?? []);
  return (
    <Panel
      title="Top contributors"
      description={bus ? `Bus factor ${bus.factor}: highlighted people wrote half the commits` : "All-time commits"}
      actions={<TextLink href={tabPath(owner, repo, "activity")}>Activity</TextLink>}
    >
      {resource.loading && !resource.data ? (
        <div className="space-y-2.5 p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-6" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="p-4 text-[13px] text-fg-muted">
          <ResourceNote error={resource.error} onRetry={resource.reload} />
          {!resource.error && "No contributors found."}
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {people.slice(0, 8).map((person, index) => (
            <li key={person.login} className="flex items-center gap-3 px-4 py-2">
              <Avatar src={person.avatarUrl} alt="" size={20} />
              <a href={person.url} target="_blank" rel="noreferrer" className="w-32 shrink-0 truncate text-[13px] text-fg hover:underline">
                {person.login}
              </a>
              <Meter value={person.commits / people[0].commits} tone={bus && index < bus.factor ? "info" : "idle"} className="flex-1" />
              <span className="w-24 shrink-0 text-right font-mono text-xs text-fg-muted tabular-nums">
                {formatCompact(person.commits)} <span className="text-fg-subtle">{formatPercent(person.commits / total)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LanguagesPanel({ owner, repo }: { owner: string; repo: string }) {
  const languages = useLanguages(owner, repo);
  const shares = languageShares(languages.data ?? []);
  return (
    <Panel title="Languages" description="Share of code by bytes" bodyClassName="p-4">
      {languages.loading && !languages.data ? (
        <Skeleton className="h-2" />
      ) : shares.length === 0 ? (
        <div className="text-[13px] text-fg-muted">
          <ResourceNote error={languages.error} />
          {!languages.error && "No code detected."}
        </div>
      ) : (
        <>
          <div className="flex h-2 gap-px overflow-hidden rounded-full">
            {shares.map((share) => (
              <div key={share.name} title={`${share.name} ${formatPercent(share.share, 1)}`} style={{ width: `${share.share * 100}%`, background: share.color }} />
            ))}
          </div>
          <ul className="mt-4 space-y-1.5">
            {shares.map((share) => (
              <li key={share.name} className="flex items-center gap-2 text-[13px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: share.color }} />
                <span className="truncate text-fg-2">{share.name}</span>
                <span className="ml-auto font-mono text-xs text-fg-muted tabular-nums">{formatPercent(share.share, share.share < 0.1 ? 1 : 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function CommunityPanel({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const community = useCommunity(owner, repo);
  const data = community.data;
  return (
    <Panel
      title="Community profile"
      description="GitHub's community standards checklist"
      actions={data && <span className="font-mono text-xs text-fg-2 tabular-nums">{data.healthPercentage}%</span>}
      bodyClassName="p-4"
    >
      {community.loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
      ) : !data ? (
        <ResourceNote error={community.error} onRetry={community.reload} />
      ) : (
        <ul className="space-y-1.5">
          {data.items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-[13px]">
              <Icon name={item.present ? "check" : "x"} className={`size-3.5 shrink-0 ${item.present ? "text-ok-fg" : "text-fg-subtle"}`} />
              {item.present && item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="text-fg-2 hover:underline">
                  {item.label}
                </a>
              ) : (
                <span className={item.present ? "text-fg-2" : "text-fg-muted"}>{item.label}</span>
              )}
            </li>
          ))}
          {meta?.license && (
            <li className="pt-2 text-xs text-fg-muted">
              Licence <span className="font-mono text-fg-2">{meta.license}</span>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

function ReleasesPanel({
  owner,
  repo,
  resource,
  now,
}: {
  owner: string;
  repo: string;
  resource: ResourceState<Release[]>;
  now: number;
}) {
  const releases = resource.data ?? [];
  if (!resource.loading && releases.length === 0 && !resource.error) return null;
  return (
    <Panel title="Recent releases" actions={<TextLink href={tabPath(owner, repo, "releases")}>All releases</TextLink>}>
      {resource.loading && !resource.data ? (
        <Skeleton className="m-4 h-24" />
      ) : releases.length === 0 ? (
        <ResourceNote error={resource.error} className="p-4" />
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Release</th>
              <th className={TH}>Published</th>
              <th className={`${TH} text-right`}>Downloads</th>
            </tr>
          </thead>
          <tbody>
            {releases.slice(0, 5).map((release) => (
              <tr key={release.tag} className={TR}>
                <td className={TD}>
                  <a href={release.url} target="_blank" rel="noreferrer" className="font-mono font-medium text-fg hover:underline">
                    {release.tag}
                  </a>
                  {release.name !== release.tag && <span className="ml-2 text-fg-muted">{release.name}</span>}
                  {release.prerelease && <Badge tone="warn" className="ml-2">Pre-release</Badge>}
                </td>
                <td className={`${TD} text-fg-muted`}>{formatRelativeTime(release.publishedAt, now)}</td>
                <td className={`${TD} text-right font-mono text-fg-muted tabular-nums`}>{release.downloads > 0 ? formatCompact(release.downloads) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
