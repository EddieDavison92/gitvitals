"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { MiniBars } from "@/components/ui/charts";
import { Avatar, Card, Meter, Pill, ResourceNote, SectionHeader, Skeleton } from "@/components/ui/primitives";
import { BADGE, DOT, TEXT, type Tone } from "@/components/ui/tones";
import { formatCompact, formatCount, formatPercent, formatRate, formatRelativeTime, formatSpan, plural } from "@/lib/format";
import type { Community, Contributor, Release } from "@/lib/github-insights";
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
import { tabPath, type RepoTab } from "@/lib/routes";
import { branchHealth, summarizeRuns } from "@/lib/stats";
import type { RepoMeta } from "@/lib/types";
import { useNow } from "@/lib/use-now";

type Props = { owner: string; repo: string; meta: RepoMeta | null };

export function OverviewTab({ owner, repo, meta }: Props) {
  const now = useNow(60_000);
  const commits = useCommitActivity(owner, repo);
  const releases = useReleases(owner, repo, 10);
  const flow = useFlow(owner, repo);
  const contributors = useContributors(owner, repo);
  const branchRuns = useBranchRuns(owner, repo, meta?.defaultBranch ?? null);
  // Branch runs wait for metadata (the default branch), so treat that wait as loading.
  const ciResource = meta ? branchRuns : { ...branchRuns, loading: true };

  const activity = activityLevel(commits.data ?? [], meta?.isArchived ?? false);
  const cadence = releaseCadence(releases.data ?? [], now);
  const merge = durationSummary(flow.data?.merged.durations ?? []);
  const close = durationSummary(flow.data?.completed.durations ?? []);
  const bus = busFactor(contributors.data ?? []);
  const branch = meta?.defaultBranch ?? null;
  const health = branch && branchRuns.data ? branchHealth(branchRuns.data, branch) : [];
  const failing = health.filter((item) => item.failing);
  const ciSummary = summarizeRuns(branchRuns.data ?? []);

  const link = (tab: RepoTab) => tabPath(owner, repo, tab);

  return (
    <div className="space-y-6">
      <VerdictHero
        activity={activity}
        loading={commits.loading && !commits.data}
        commits={commits}
        reasons={[
          commits.data && {
            tone: activity.tone,
            text:
              activity.level === "dormant"
                ? "No commits in the past year"
                : activity.activeWeeks12 > 0
                  ? `Commits in ${activity.activeWeeks12} of the last 12 weeks`
                  : activity.lastActiveWeek
                    ? `Last commits ${formatRelativeTime(activity.lastActiveWeek, now)}`
                    : null,
          },
          releases.data && {
            tone: cadence.daysSinceLatest === null ? "idle" : cadence.daysSinceLatest < 90 ? "ok" : cadence.daysSinceLatest < 365 ? "warn" : "bad",
            text: cadence.latest ? `Latest release ${formatRelativeTime(cadence.latest.publishedAt, now)}` : "No releases published",
          },
          merge && { tone: merge.median < 7 * 86_400_000 ? "ok" : "warn", text: `Pull requests merged in about ${formatSpan(merge.median)}` },
          branchRuns.data &&
            health.length > 0 && {
              tone: failing.length > 0 ? "bad" : "ok",
              text: failing.length > 0 ? `${plural(failing.length, "workflow")} failing on ${branch}` : `CI passing on ${branch}`,
            },
        ]}
      />

      <section aria-label="Vital signs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <VitalCard
          icon="activity"
          label="Commits, 12 weeks"
          href={link("activity")}
          resource={commits}
          value={formatCount(activity.commits12)}
          detail={`${formatCount(activity.commits52)} in the last year · ${activity.activeWeeks12}/12 weeks active`}
          tone={activity.tone}
        />
        <VitalCard
          icon="tag"
          label="Latest release"
          href={link("releases")}
          resource={releases}
          value={cadence.latest?.tag ?? "None"}
          detail={
            cadence.latest
              ? `${formatRelativeTime(cadence.latest.publishedAt, now)}${cadence.medianGapDays !== null ? ` · every ~${formatSpan(cadence.medianGapDays * 86_400_000)}` : ""}`
              : "No published releases"
          }
          tone={cadence.daysSinceLatest === null ? "idle" : cadence.daysSinceLatest < 90 ? "ok" : "warn"}
          mono
        />
        <VitalCard
          icon="git-merge"
          label="Time to merge"
          href={link("pulls")}
          resource={flow}
          value={merge ? formatSpan(merge.median) : "–"}
          detail={
            merge
              ? `Median of the ${merge.count < (flow.data?.merged.total ?? 0) ? `${merge.count} most recent` : merge.count} merged in 30 days · 90% within ${formatSpan(merge.p90)}`
              : "Nothing merged in the last 30 days"
          }
          tone={!merge ? "idle" : merge.median < 2 * 86_400_000 ? "ok" : merge.median < 14 * 86_400_000 ? "info" : "warn"}
        />
        <VitalCard
          icon="git-merge"
          label="Open pull requests"
          href={link("pulls")}
          resource={flow}
          value={flow.data ? formatCount(flow.data.openPulls) : "–"}
          detail={
            flow.data
              ? `${formatCount(flow.data.merged.total)} merged in the last 30 days${flow.data.merged.byBots > 0 ? `, ${Math.round((flow.data.merged.byBots / Math.max(flow.data.merged.durations.length, 1)) * 100)}% by bots` : ""}`
              : undefined
          }
          tone="info"
        />
        <VitalCard
          icon="issue"
          label="Time to close issues"
          href={link("issues")}
          resource={flow}
          value={close ? formatSpan(close.median) : "–"}
          detail={
            close
              ? `Median of the ${close.count < (flow.data?.completed.total ?? 0) ? `${close.count} most recent` : close.count} completed in 30 days · 90% within ${formatSpan(close.p90)}`
              : meta?.hasIssues === false
                ? "Issues are disabled"
                : "No issues completed in the last 30 days"
          }
          tone={!close ? "idle" : close.median < 7 * 86_400_000 ? "ok" : close.median < 60 * 86_400_000 ? "info" : "warn"}
        />
        <VitalCard
          icon="issue"
          label="Open issues"
          href={link("issues")}
          resource={flow}
          value={flow.data ? formatCount(flow.data.openIssues) : "–"}
          detail={
            flow.data
              ? `${formatCount(flow.data.openedIssues)} opened · ${formatCount(flow.data.completed.total)} completed in 30 days`
              : undefined
          }
          tone={!flow.data ? "idle" : flow.data.openedIssues > 2 * Math.max(flow.data.completed.total, 1) ? "warn" : "info"}
        />
        <VitalCard
          icon="workflow"
          label={branch ? `CI on ${branch}` : "CI"}
          href={link("actions")}
          resource={ciResource}
          value={
            health.length === 0 ? "No workflows" : failing.length > 0 ? `${failing.length} failing` : "Passing"
          }
          detail={
            health.length === 0
              ? "No Actions runs on the default branch"
              : `${health.length - failing.length} of ${plural(health.length, "workflow")} green · ${formatRate(ciSummary.successRate)} of recent runs passed`
          }
          tone={health.length === 0 ? "idle" : failing.length > 0 ? "bad" : "ok"}
        />
        <VitalCard
          icon="people"
          label="Bus factor"
          href={link("activity")}
          resource={contributors}
          value={bus ? String(bus.factor) : "–"}
          detail={bus ? `${plural(bus.factor, "person", "people")} wrote half the commits · ${plural(bus.humans, "contributor")}` : "No contributor data"}
          tone={!bus ? "idle" : bus.factor === 1 ? "warn" : bus.factor === 2 ? "info" : "ok"}
        />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr]">
        <ContributorsCard owner={owner} repo={repo} resource={contributors} />
        <LanguagesCard owner={owner} repo={repo} />
        <CommunityCard owner={owner} repo={repo} meta={meta} />
      </section>

      <RecentReleases owner={owner} repo={repo} resource={releases} now={now} />
    </div>
  );
}

// ── Hero ───────────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, IconName> = {
  archived: "archive",
  dormant: "warning",
  quiet: "clock",
};

function VerdictHero({
  activity,
  loading,
  commits,
  reasons,
}: {
  activity: ReturnType<typeof activityLevel>;
  loading: boolean;
  commits: ResourceState<Array<{ total: number }>>;
  reasons: Array<{ tone: Tone; text: string | null } | null | false | undefined>;
}) {
  const visible = reasons.filter((reason): reason is { tone: Tone; text: string } => Boolean(reason && reason.text));
  const tone = activity.tone;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className={`absolute inset-y-0 left-0 w-1 ${DOT[tone]}`} aria-hidden="true" />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Vital signs</p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-64" />
          ) : (
            <h2 className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-tight">
              <span className={`grid size-9 place-items-center rounded-xl border ${BADGE[tone]}`}>
                <Icon name={ACTIVITY_ICON[activity.level] ?? "pulse"} className="size-5" />
              </span>
              {activity.label}
            </h2>
          )}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {visible.map((reason) => (
              <li key={reason.text} className="flex items-center gap-2 text-sm text-fg-2">
                <span className={`size-1.5 shrink-0 rounded-full ${DOT[reason.tone]}`} />
                {reason.text}
              </li>
            ))}
            {visible.length === 0 && !commits.error && <Skeleton className="h-5 w-96 max-w-full" />}
          </ul>
          <ResourceNote error={commits.data ? null : commits.error} className="mt-3" />
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs text-fg-muted">
            <span>Commits per week, last 52 weeks</span>
            <span className="font-mono tabular-nums">{formatCount(activity.commits52)}</span>
          </div>
          {commits.data ? (
            <MiniBars values={commits.data.map((week) => week.total)} height={64} color={`var(--${tone === "idle" ? "idle" : tone === "info" ? "info" : tone})`} />
          ) : (
            <Skeleton className="h-16" />
          )}
        </div>
      </div>
    </section>
  );
}

// ── Vital cards ────────────────────────────────────────────

function VitalCard({
  icon,
  label,
  href,
  resource,
  value,
  detail,
  tone,
  mono = false,
}: {
  icon: IconName;
  label: string;
  href: string;
  resource: ResourceState<unknown>;
  value: string;
  detail?: string;
  tone: Tone;
  mono?: boolean;
}) {
  const loading = resource.loading && resource.data === null;
  const error = resource.data === null ? resource.error : null;
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:border-info-line hover:shadow-md sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          <span className={`size-1.5 rounded-full ${DOT[error ? "idle" : tone]}`} />
          {label}
        </p>
        <Icon name={icon} className="size-4 text-fg-subtle transition group-hover:text-info-fg" />
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-24" />
          <Skeleton className="mt-2 h-3 w-40" />
        </>
      ) : error ? (
        <ResourceNote error={error} className="mt-3" />
      ) : (
        <>
          <p className={`mt-2 truncate text-2xl font-semibold tracking-tight text-fg ${mono ? "font-mono" : ""}`}>{value}</p>
          {detail && <p className="mt-1 line-clamp-2 text-xs leading-5 text-fg-muted">{detail}</p>}
        </>
      )}
    </Link>
  );
}

// ── Contributors ───────────────────────────────────────────

function ContributorsCard({ owner, repo, resource }: { owner: string; repo: string; resource: ResourceState<Contributor[]> }) {
  const people = (resource.data ?? []).filter((person) => !person.isBot);
  const bots = (resource.data ?? []).filter((person) => person.isBot);
  const total = people.reduce((sum, person) => sum + person.commits, 0);
  const bus = busFactor(resource.data ?? []);

  return (
    <Card>
      <SectionHeader
        title="Top contributors"
        description={bus ? `All-time commits. ${plural(bus.factor, "person", "people")} account for half of them.` : "All-time commits to the default branch."}
        icon="people"
        action={
          <Link href={tabPath(owner, repo, "activity")} className="shrink-0 text-xs font-semibold text-info-fg hover:underline">
            Activity
          </Link>
        }
      />
      {resource.loading && !resource.data ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-7" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="p-5">
          <ResourceNote error={resource.error} />
          {!resource.error && <p className="text-sm text-fg-muted">No contributors found.</p>}
        </div>
      ) : (
        <ul className="space-y-3 px-5 py-4">
          {people.slice(0, 8).map((person, index) => (
            <li key={person.login} className="flex items-center gap-3">
              <Avatar src={person.avatarUrl} alt="" size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <a href={person.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-fg hover:text-info-fg">
                    {person.login}
                  </a>
                  <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                    {formatCompact(person.commits)} · {formatPercent(person.commits / total)}
                  </span>
                </div>
                <Meter value={person.commits / people[0].commits} tone={bus && index < bus.factor ? "info" : "idle"} className="mt-1.5" />
              </div>
            </li>
          ))}
          {bots.length > 0 && (
            <li className="pt-1 text-xs text-fg-subtle">
              Plus {plural(bots.length, "bot")} ({bots.slice(0, 2).map((bot) => bot.login).join(", ")}
              {bots.length > 2 ? ", …" : ""}), excluded from the bus factor.
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

// ── Languages ──────────────────────────────────────────────

function LanguagesCard({ owner, repo }: { owner: string; repo: string }) {
  const languages = useLanguages(owner, repo);
  const shares = languageShares(languages.data ?? []);
  return (
    <Card>
      <SectionHeader title="Languages" description="Share of code by bytes." icon="workflow" />
      <div className="px-5 py-4">
        {languages.loading && !languages.data ? (
          <Skeleton className="h-3" />
        ) : shares.length === 0 ? (
          <>
            <ResourceNote error={languages.error} />
            {!languages.error && <p className="text-sm text-fg-muted">No code detected.</p>}
          </>
        ) : (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
              {shares.map((share) => (
                <div key={share.name} title={`${share.name} ${formatPercent(share.share, 1)}`} style={{ width: `${share.share * 100}%`, background: share.color }} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {shares.map((share) => (
                <li key={share.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: share.color }} />
                  <span className="truncate text-fg-2">{share.name}</span>
                  <span className="ml-auto font-mono text-xs text-fg-muted tabular-nums">{formatPercent(share.share, share.share < 0.1 ? 1 : 0)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

// ── Community ──────────────────────────────────────────────

function CommunityCard({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const community = useCommunity(owner, repo);
  const data: Community | null = community.data;
  const score = data?.healthPercentage ?? null;
  const tone: Tone = score === null ? "idle" : score >= 80 ? "ok" : score >= 50 ? "info" : "warn";
  return (
    <Card>
      <SectionHeader
        title="Community health"
        description="GitHub's community standards checklist."
        icon="check"
        action={
          score !== null && (
            <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-sm font-semibold ${BADGE[tone]}`}>{score}%</span>
          )
        }
      />
      <div className="px-5 py-4">
        {community.loading && !data ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-4" />
            ))}
          </div>
        ) : !data ? (
          <ResourceNote error={community.error} />
        ) : (
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li key={item.key} className="flex items-center gap-2.5 text-sm">
                <span className={`grid size-4 shrink-0 place-items-center rounded-full ${item.present ? "bg-ok-soft text-ok-fg" : "bg-surface-3 text-fg-subtle"}`}>
                  <Icon name={item.present ? "check" : "x"} className="size-3" />
                </span>
                {item.present && item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-fg-2 hover:text-info-fg">
                    {item.label}
                  </a>
                ) : (
                  <span className={item.present ? "text-fg-2" : "text-fg-muted"}>{item.label}</span>
                )}
              </li>
            ))}
            {meta?.license && (
              <li className="pt-1 text-xs text-fg-subtle">
                Licensed under <span className="font-mono text-fg-muted">{meta.license}</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ── Releases ───────────────────────────────────────────────

function RecentReleases({ owner, repo, resource, now }: { owner: string; repo: string; resource: ResourceState<Release[]>; now: number }) {
  const releases = resource.data ?? [];
  if (!resource.loading && releases.length === 0 && !resource.error) return null;
  return (
    <Card>
      <SectionHeader
        title="Recent releases"
        icon="tag"
        action={
          <Link href={tabPath(owner, repo, "releases")} className="shrink-0 text-xs font-semibold text-info-fg hover:underline">
            All releases
          </Link>
        }
      />
      {resource.loading && !resource.data ? (
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : releases.length === 0 ? (
        <ResourceNote error={resource.error} className="p-5" />
      ) : (
        <ul className="grid divide-y divide-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {releases.slice(0, 3).map((release) => (
            <li key={release.tag} className="min-w-0 px-5 py-4">
              <div className="flex items-center gap-2">
                <a href={release.url} target="_blank" rel="noreferrer" className="truncate font-mono text-sm font-semibold text-fg hover:text-info-fg">
                  {release.tag}
                </a>
                {release.prerelease && <Pill tone="warn">Pre-release</Pill>}
              </div>
              <p className="mt-1 truncate text-xs text-fg-muted">{release.name !== release.tag ? release.name : " "}</p>
              <p className={`mt-2 flex items-center gap-3 text-xs ${TEXT.idle}`}>
                <span>{formatRelativeTime(release.publishedAt, now)}</span>
                {release.downloads > 0 && (
                  <span className="flex items-center gap-1">
                    <Icon name="download" className="size-3" />
                    {formatCompact(release.downloads)}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
