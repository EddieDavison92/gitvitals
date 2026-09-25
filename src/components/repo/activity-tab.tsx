"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_ANIMATION_MS,
  CHART_HEIGHT,
  ChartCard,
  ChartSkeleton,
  CURSOR,
  EmptyChart,
  GRID,
  SERIES,
  TICK,
  TOOLTIP,
  type TooltipProps,
} from "@/components/ui/charts";
import { Avatar, Meter, PageHeader, Panel, ResourceNote, Skeleton, StatCell, StatGrid } from "@/components/ui/primitives";
import { formatCompact, formatCount, formatPercent, plural } from "@/lib/format";
import type { CommitWeek } from "@/lib/github-insights";
import { activityLevel, busFactor, punchCardSummary } from "@/lib/insights";
import { useCodeFrequency, useCommitActivity, useContributors, useParticipation, usePunchCard } from "@/lib/repo-data";
import { percentile } from "@/lib/stats";
import type { RepoMeta } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });
const HEAT = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];

function weekLabel(unixSeconds: number) {
  return dateFormat.format(new Date(unixSeconds * 1000));
}

export function ActivityTab({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const commits = useCommitActivity(owner, repo);
  const punch = usePunchCard(owner, repo);
  const participation = useParticipation(owner, repo);
  const contributors = useContributors(owner, repo);

  const weeks = commits.data ?? [];
  const activity = activityLevel(weeks, meta?.isArchived ?? false);
  const activeWeeks = weeks.filter((week) => week.total > 0).length;
  const punchSummary = punch.data ? punchCardSummary(punch.data) : null;
  const ownerShare =
    participation.data && participation.data.all.length > 0
      ? participation.data.owner.reduce((sum, value) => sum + value, 0) /
        Math.max(1, participation.data.all.reduce((sum, value) => sum + value, 0))
      : null;
  // Organisation-owned repos have no owner commits; show the bot share instead.
  const everyone = contributors.data ?? [];
  const allCommits = everyone.reduce((sum, person) => sum + person.commits, 0);
  const botShare = allCommits > 0 ? everyone.filter((person) => person.isBot).reduce((sum, person) => sum + person.commits, 0) / allCommits : null;
  const showOwner = ownerShare !== null && ownerShare > 0;
  const commitsLoading = commits.loading && !commits.data;

  return (
    <>
      <PageHeader title="Activity" description="Commits to the default branch over the last year, and who makes them." />

      <StatGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCell label="Commits, 52 weeks" value={formatCount(activity.commits52)} loading={commitsLoading} error={commits.data ? null : commits.error} tone={activity.tone} sub={activity.label} />
        <StatCell
          label="Active weeks"
          value={`${activeWeeks} of 52`}
          loading={commitsLoading}
          sub={activeWeeks > 0 ? `${formatCompact(activity.commits52 / activeWeeks)} commits per active week` : "No commits this year"}
        />
        <StatCell label="Commits, 12 weeks" value={formatCount(activity.commits12)} loading={commitsLoading} sub={`${activity.activeWeeks12} of 12 weeks active`} />
        <StatCell
          label="Busiest time"
          value={punchSummary && punchSummary.total > 0 ? `${DAYS[punchSummary.peak.day]} ${String(punchSummary.peak.hour).padStart(2, "0")}:00` : "–"}
          loading={punch.loading && !punch.data}
          sub="Committers' local time"
        />
        <StatCell label="Weekend commits" value={punchSummary ? formatPercent(punchSummary.weekendShare) : "–"} loading={punch.loading && !punch.data} sub="Saturday and Sunday" />
        {showOwner ? (
          <StatCell label="By the owner" value={formatPercent(ownerShare)} loading={participation.loading && !participation.data} sub={`Commits by ${owner}, last year`} />
        ) : (
          <StatCell label="From bots" value={botShare === null ? "–" : formatPercent(botShare)} loading={contributors.loading && !contributors.data} sub="Of all-time commits" />
        )}
      </StatGrid>

      <ChartCard title="Commit calendar" description="Commits per day, last 52 weeks" action={<ResourceNote error={commits.data ? null : commits.error} onRetry={commits.reload} />}>
        {commitsLoading ? <Skeleton className="h-32" /> : <CommitCalendar weeks={weeks} />}
      </ChartCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Commits per week"
          description={showOwner ? `${owner} against everyone else` : "Last 52 weeks"}
          action={
            showOwner ? (
              <span className="flex items-center gap-3 text-[11px] text-fg-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: SERIES.info }} />
                  Others
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: SERIES.neutral }} />
                  Owner
                </span>
              </span>
            ) : (
              <ResourceNote error={participation.data ? null : participation.error} onRetry={participation.reload} />
            )
          }
        >
          <OwnerVsCommunity weeks={weeks} participation={participation.data} />
        </ChartCard>
        <ChartCard
          title="When people commit"
          description="Weekday and hour, in each committer's local time"
          action={<ResourceNote error={punch.data ? null : punch.error} onRetry={punch.reload} />}
        >
          {punch.data ? <PunchCard grid={punch.data} /> : <Skeleton className="h-56" />}
        </ChartCard>
      </div>

      <CodeChurn owner={owner} repo={repo} />

      <ContributorList resource={contributors} />
    </>
  );
}

// ── Calendar ───────────────────────────────────────────────

/** Month label for a week column, when the month changes (skipping a first label that would collide with the next). */
function monthLabels(weeks: CommitWeek[]) {
  const months = weeks.map((week) => new Date(week.week * 1000).getMonth());
  return weeks.map((week, index) => {
    const changed = index === 0 || months[index - 1] !== months[index];
    const nextChange = months.findIndex((month, later) => later > index && month !== months[index]);
    if (!changed || (index === 0 && nextChange !== -1 && nextChange < 3)) return "";
    return monthFormat.format(new Date(week.week * 1000));
  });
}

/** Colour level 0–4; thresholds are quartiles of active days so a single busy day doesn't wash out the rest. */
function heatLevels(weeks: CommitWeek[]) {
  const active = weeks.flatMap((week) => week.days).filter((count) => count > 0);
  const [q1, q2, q3] = [25, 50, 75].map((p) => percentile(active, p));
  return (count: number) => (count === 0 ? 0 : count <= q1 ? 1 : count <= q2 ? 2 : count <= q3 ? 3 : 4);
}

function CommitCalendar({ weeks }: { weeks: CommitWeek[] }) {
  if (weeks.length === 0) return <EmptyChart height={140}>No commit data.</EmptyChart>;
  const level = heatLevels(weeks);
  const labels = monthLabels(weeks);

  return (
    <div className="overflow-x-auto px-2 pb-1">
      <div
        className="grid min-w-[680px] grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "14px repeat(7, auto)", gridTemplateColumns: `28px repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        <span />
        {DAYS.map((day, index) => (
          <span key={day} className="self-center text-[10px] leading-none text-fg-subtle">
            {index % 2 === 1 ? day : ""}
          </span>
        ))}
        {weeks.map((week, weekIndex) => [
          <span key={`${week.week}-m`} className="overflow-visible whitespace-nowrap text-[10px] leading-3 text-fg-subtle">
            {labels[weekIndex]}
          </span>,
          ...week.days.map((count, day) => (
            <span
              key={`${week.week}-${day}`}
              title={`${plural(count, "commit")} on ${dateFormat.format(new Date((week.week + day * 86_400) * 1000))}`}
              className="aspect-square max-h-3.5 w-full rounded-[2px]"
              style={{ background: HEAT[level(count)] }}
            />
          )),
        ])}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-fg-subtle">
        Less
        {HEAT.map((color) => (
          <span key={color} className="size-2.5 rounded-[2px]" style={{ background: color }} />
        ))}
        More
      </div>
    </div>
  );
}

// ── Owner vs community ─────────────────────────────────────

type ParticipationRow = { week: string; owner: number; others: number };

function OwnerVsCommunity({ weeks, participation }: { weeks: CommitWeek[]; participation: { all: number[]; owner: number[] } | null }) {
  if (!participation || participation.all.length === 0) return <ChartSkeleton />;
  // Participation covers the same 52 weeks as commit activity, oldest first.
  const rows: ParticipationRow[] = participation.all.map((all, index) => ({
    week: weeks[index] ? weekLabel(weeks[index].week) : String(index),
    owner: participation.owner[index] ?? 0,
    others: Math.max(0, all - (participation.owner[index] ?? 0)),
  }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<ParticipationTooltip />} cursor={CURSOR} />
        <Bar dataKey="others" stackId="a" fill={SERIES.info} animationDuration={CHART_ANIMATION_MS} />
        <Bar dataKey="owner" stackId="a" fill={SERIES.neutral} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ParticipationTooltip({ active, payload }: TooltipProps<ParticipationRow>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-medium text-fg">Week of {row.week}</p>
      <p className="mt-0.5 text-fg-muted">{plural(row.others + row.owner, "commit")}</p>
      {row.owner > 0 && <p className="text-fg-muted">{row.owner} by the owner</p>}
    </div>
  );
}

// ── Punch card ─────────────────────────────────────────────

function PunchCard({ grid }: { grid: number[][] }) {
  const max = Math.max(...grid.flat(), 1);
  // Monday first reads more naturally.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="overflow-x-auto px-2 pb-1">
      <div className="grid min-w-[560px] gap-y-1" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
        {order.map((day) => (
          <div key={day} className="contents">
            <span className="text-[11px] leading-6 text-fg-subtle">{DAYS[day]}</span>
            {grid[day].map((count, hour) => {
              const size = count === 0 ? 3 : 5 + Math.sqrt(count / max) * 13;
              return (
                <span key={hour} className="grid h-6 place-items-center" title={`${DAYS[day]} ${String(hour).padStart(2, "0")}:00 · ${plural(count, "commit")}`}>
                  <span
                    className="rounded-full"
                    style={{ width: size, height: size, background: count === 0 ? "var(--line)" : "var(--chart-line)", opacity: count === 0 ? 1 : 0.4 + (count / max) * 0.6 }}
                  />
                </span>
              );
            })}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="pt-1 text-center text-[10px] text-fg-subtle">
            {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Code churn ─────────────────────────────────────────────

type ChurnRow = { week: string; additions: number; deletions: number };

function CodeChurn({ owner, repo }: { owner: string; repo: string }) {
  const frequency = useCodeFrequency(owner, repo);
  const rows: ChurnRow[] = (frequency.data ?? []).slice(-52).map((week) => ({
    week: weekLabel(week.week),
    additions: week.additions,
    deletions: -week.deletions,
  }));
  const unavailable = frequency.data === null && frequency.fetchedAt !== null;
  return (
    <ChartCard
      title="Code churn"
      description={unavailable ? "GitHub doesn't compute line counts for repositories with 10,000+ commits" : "Lines added and deleted per week, last 52 weeks"}
      action={<ResourceNote error={frequency.data ? null : frequency.error} onRetry={frequency.reload} />}
    >
      {unavailable ? null : frequency.loading && frequency.fetchedAt === null ? (
        <ChartSkeleton />
      ) : rows.length === 0 ? (
        <EmptyChart>No changes recorded.</EmptyChart>
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} stackOffset="sign">
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tickFormatter={(value: number) => formatCompact(Math.abs(value))} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<ChurnTooltip />} />
            <Area type="monotone" dataKey="additions" stroke={SERIES.ok} fill={SERIES.ok} fillOpacity={0.15} strokeWidth={1.5} animationDuration={CHART_ANIMATION_MS} />
            <Area type="monotone" dataKey="deletions" stroke={SERIES.bad} fill={SERIES.bad} fillOpacity={0.15} strokeWidth={1.5} animationDuration={CHART_ANIMATION_MS} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function ChurnTooltip({ active, payload }: TooltipProps<ChurnRow>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-medium text-fg">Week of {row.week}</p>
      <p className="mt-0.5 text-ok-fg">+{formatCount(row.additions)} lines</p>
      <p className="text-bad-fg">−{formatCount(Math.abs(row.deletions))} lines</p>
    </div>
  );
}

// ── Contributors ───────────────────────────────────────────

function ContributorList({ resource }: { resource: ReturnType<typeof useContributors> }) {
  const people = (resource.data ?? []).filter((person) => !person.isBot);
  const bots = (resource.data ?? []).filter((person) => person.isBot);
  const total = people.reduce((sum, person) => sum + person.commits, 0);
  const bus = busFactor(resource.data ?? []);

  return (
    <Panel
      title="Contributors"
      description={
        bus
          ? `Top ${people.length} by all-time commits. Bus factor ${bus.factor}: the highlighted ${plural(bus.factor, "person", "people")} wrote half of them.`
          : "All-time commits to the default branch"
      }
    >
      {resource.loading && !resource.data ? (
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="h-7" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <ResourceNote error={resource.error} onRetry={resource.reload} className="p-4" />
      ) : (
        <ol className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
          {people.slice(0, 30).map((person, index) => (
            <li key={person.login} className="flex items-center gap-2.5 border-b border-line-soft px-4 py-2">
              <span className="w-5 shrink-0 text-right font-mono text-[11px] text-fg-subtle tabular-nums">{index + 1}</span>
              <Avatar src={person.avatarUrl} alt="" size={18} />
              <a href={person.url} target="_blank" rel="noreferrer" className="w-28 shrink-0 truncate text-[13px] text-fg hover:underline">
                {person.login}
              </a>
              <Meter value={person.commits / people[0].commits} tone={bus && index < bus.factor ? "info" : "idle"} className="min-w-8 flex-1" />
              <span className="w-20 shrink-0 text-right font-mono text-xs text-fg-muted tabular-nums">
                {formatCompact(person.commits)} <span className="text-fg-subtle">{formatPercent(person.commits / total, 1)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {bots.length > 0 && (
        <p className="px-4 py-2.5 text-xs text-fg-muted">
          Bots: {bots.map((bot) => `${bot.login} (${formatCompact(bot.commits)})`).join(", ")}
        </p>
      )}
    </Panel>
  );
}
