"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_ANIMATION_MS,
  ChartCard,
  CURSOR,
  EmptyChart,
  GRID,
  SERIES,
  TICK,
  TOOLTIP,
  type TooltipProps,
} from "@/components/ui/charts";
import { Avatar, Card, Meter, ResourceNote, SectionHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { formatCompact, formatCount, formatPercent, plural } from "@/lib/format";
import type { CommitWeek } from "@/lib/github-insights";
import { activityLevel, busFactor, punchCardSummary } from "@/lib/insights";
import { useCodeFrequency, useCommitActivity, useContributors, useParticipation, usePunchCard } from "@/lib/repo-data";
import type { RepoMeta } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });

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

  return (
    <div className="space-y-6">
      <Card className="grid gap-6 p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-6">
        <Stat label="Commits, 52 weeks" value={formatCount(activity.commits52)} loading={commits.loading && !commits.data} tone={activity.tone} detail={activity.label} />
        <Stat
          label="Active weeks"
          value={`${activeWeeks}/52`}
          loading={commits.loading && !commits.data}
          detail={activeWeeks > 0 ? `${formatCompact(activity.commits52 / activeWeeks)} commits per active week` : "No commits this year"}
        />
        <Stat
          label="Last 12 weeks"
          value={formatCount(activity.commits12)}
          loading={commits.loading && !commits.data}
          detail={`${activity.activeWeeks12} of 12 weeks active`}
        />
        <Stat
          label="Busiest time"
          value={punchSummary && punchSummary.total > 0 ? `${DAYS[punchSummary.peak.day]} ${String(punchSummary.peak.hour).padStart(2, "0")}:00` : "–"}
          loading={punch.loading && !punch.data}
          detail="In committers' local time"
        />
        <Stat
          label="Weekend commits"
          value={punchSummary ? formatPercent(punchSummary.weekendShare) : "–"}
          loading={punch.loading && !punch.data}
          detail="Saturday and Sunday"
        />
        {showOwner ? (
          <Stat
            label="By the owner"
            value={formatPercent(ownerShare)}
            loading={participation.loading && !participation.data}
            detail={`Commits by ${owner}, last year`}
          />
        ) : (
          <Stat
            label="From bots"
            value={botShare === null ? "–" : formatPercent(botShare)}
            loading={contributors.loading && !contributors.data}
            detail="Of all-time commits"
          />
        )}
      </Card>

      <ChartCard
        title="Commit calendar"
        description="Commits per day over the last year. Darker means more."
        action={<ResourceNote error={commits.data ? null : commits.error} onRetry={commits.reload} />}
      >
        {commits.loading && !commits.data ? <Skeleton className="m-2 h-32" /> : <CommitCalendar weeks={weeks} />}
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Commits per week"
          description={showOwner ? `The owner (${owner}) against everyone else.` : "Last 52 weeks."}
          action={<ResourceNote error={participation.data ? null : participation.error} onRetry={participation.reload} />}
        >
          <OwnerVsCommunity weeks={weeks} participation={participation.data} />
        </ChartCard>
        <ChartCard
          title="When people commit"
          description="Commits by weekday and hour, in each committer's local time."
          action={<ResourceNote error={punch.data ? null : punch.error} onRetry={punch.reload} />}
        >
          {punch.data ? <PunchCard grid={punch.data} /> : <Skeleton className="m-2 h-56" />}
        </ChartCard>
      </div>

      <CodeChurn owner={owner} repo={repo} />

      <ContributorList resource={contributors} />
    </div>
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

function CommitCalendar({ weeks }: { weeks: CommitWeek[] }) {
  if (weeks.length === 0) return <EmptyChart height={140}>No commit data.</EmptyChart>;
  const max = Math.max(...weeks.flatMap((week) => week.days), 1);
  const level = (count: number) => (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)));
  const opacity = [0, 0.3, 0.5, 0.75, 1];
  const labels = monthLabels(weeks);

  return (
    <div className="overflow-x-auto px-2 py-3">
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
          ...week.days.map((count, day) => {
            const cellDate = new Date((week.week + day * 86_400) * 1000);
            return (
              <span
                key={`${week.week}-${day}`}
                title={`${plural(count, "commit")} on ${dateFormat.format(cellDate)}`}
                className="aspect-square max-h-4 w-full rounded-[3px]"
                style={{
                  background: count === 0 ? "var(--surface-3)" : "var(--ok)",
                  opacity: count === 0 ? 1 : opacity[level(count)],
                }}
              />
            );
          }),
        ])}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-fg-subtle">
        Less
        {opacity.map((value, index) => (
          <span
            key={index}
            className="size-3 rounded-[3px]"
            style={{ background: index === 0 ? "var(--surface-3)" : "var(--ok)", opacity: index === 0 ? 1 : value }}
          />
        ))}
        More
      </div>
    </div>
  );
}

// ── Owner vs community ─────────────────────────────────────

type ParticipationRow = { week: string; owner: number; others: number };

function OwnerVsCommunity({ weeks, participation }: { weeks: CommitWeek[]; participation: { all: number[]; owner: number[] } | null }) {
  if (!participation || participation.all.length === 0) return <Skeleton className="m-2 h-60" />;
  // Participation covers the same 52 weeks as commit activity, oldest first.
  const rows: ParticipationRow[] = participation.all.map((all, index) => ({
    week: weeks[index] ? weekLabel(weeks[index].week) : String(index),
    owner: participation.owner[index] ?? 0,
    others: Math.max(0, all - (participation.owner[index] ?? 0)),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<ParticipationTooltip />} cursor={CURSOR} />
        <Bar dataKey="others" stackId="a" fill={SERIES.info} animationDuration={CHART_ANIMATION_MS} />
        <Bar dataKey="owner" stackId="a" fill={SERIES.warn} radius={[3, 3, 0, 0]} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ParticipationTooltip({ active, payload }: TooltipProps<ParticipationRow>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-semibold text-fg">Week of {row.week}</p>
      <p className="mt-1 text-info-fg">{plural(row.others, "commit")} by others</p>
      <p className="text-warn-fg">{plural(row.owner, "commit")} by the owner</p>
    </div>
  );
}

// ── Punch card ─────────────────────────────────────────────

function PunchCard({ grid }: { grid: number[][] }) {
  const max = Math.max(...grid.flat(), 1);
  // Monday first reads more naturally.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="overflow-x-auto px-2 py-3">
      <div className="grid min-w-[560px] gap-y-1.5" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
        {order.map((day) => (
          <div key={day} className="contents">
            <span className="text-[11px] leading-5 text-fg-subtle">{DAYS[day]}</span>
            {grid[day].map((count, hour) => {
              const size = count === 0 ? 0 : 4 + Math.sqrt(count / max) * 14;
              return (
                <span key={hour} className="grid h-5 place-items-center" title={`${DAYS[day]} ${String(hour).padStart(2, "0")}:00 · ${plural(count, "commit")}`}>
                  <span
                    className="rounded-full"
                    style={{ width: size, height: size, background: "var(--chart-line)", opacity: count === 0 ? 0 : 0.35 + (count / max) * 0.65 }}
                  />
                </span>
              );
            })}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="text-center text-[10px] text-fg-subtle">
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
  return (
    <ChartCard
      title="Code churn"
      description="Lines added and deleted per week, last 52 weeks."
      action={<ResourceNote error={frequency.data ? null : frequency.error} onRetry={frequency.reload} />}
    >
      {frequency.loading && frequency.fetchedAt === null ? (
        <Skeleton className="m-2 h-56" />
      ) : frequency.data === null && frequency.fetchedAt !== null ? (
        <EmptyChart height={90}>GitHub doesn&apos;t compute line counts for repositories with 10,000+ commits.</EmptyChart>
      ) : rows.length === 0 ? (
        <EmptyChart height={200}>No changes recorded.</EmptyChart>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows} margin={{ top: 12, right: 4, bottom: 0, left: -6 }} stackOffset="sign">
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tickFormatter={(value: number) => formatCompact(Math.abs(value))} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<ChurnTooltip />} />
            <Area type="monotone" dataKey="additions" stroke={SERIES.ok} fill={SERIES.ok} fillOpacity={0.2} strokeWidth={1.5} animationDuration={CHART_ANIMATION_MS} />
            <Area type="monotone" dataKey="deletions" stroke={SERIES.bad} fill={SERIES.bad} fillOpacity={0.2} strokeWidth={1.5} animationDuration={CHART_ANIMATION_MS} />
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
      <p className="font-semibold text-fg">Week of {row.week}</p>
      <p className="mt-1 text-ok-fg">+{formatCount(row.additions)} lines</p>
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
    <Card>
      <SectionHeader
        title="Contributors"
        icon="people"
        description={
          bus
            ? `${plural(bus.humans, "person", "people")} in the top 100. Bus factor ${bus.factor}: the highlighted ${plural(bus.factor, "person", "people")} wrote half of all commits.`
            : "All-time commits to the default branch."
        }
      />
      {resource.loading && !resource.data ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="p-5">
          <ResourceNote error={resource.error} onRetry={resource.reload} />
        </div>
      ) : (
        <ul className="grid gap-x-8 gap-y-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.slice(0, 30).map((person, index) => (
            <li key={person.login} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right font-mono text-[11px] text-fg-subtle">{index + 1}</span>
              <Avatar src={person.avatarUrl} alt="" size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <a href={person.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-fg hover:text-info-fg">
                    {person.login}
                  </a>
                  <span className="shrink-0 font-mono text-[11px] text-fg-muted tabular-nums">
                    {formatCompact(person.commits)} · {formatPercent(person.commits / total, 1)}
                  </span>
                </div>
                <Meter value={person.commits / people[0].commits} tone={bus && index < bus.factor ? "info" : "idle"} className="mt-1" />
              </div>
            </li>
          ))}
        </ul>
      )}
      {bots.length > 0 && (
        <p className="border-t border-line-soft px-5 py-3 text-xs text-fg-subtle">
          Bots: {bots.map((bot) => `${bot.login} (${formatCompact(bot.commits)})`).join(", ")}.
        </p>
      )}
    </Card>
  );
}
