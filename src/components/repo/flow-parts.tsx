"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon } from "@/components/icon";
import { CHART_ANIMATION_MS, CURSOR, EmptyChart, GRID, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { Card, Meter, Pill, ResourceNote, SectionHeader, Skeleton } from "@/components/ui/primitives";
import type { Tone } from "@/components/ui/tones";
import { formatPercent, formatRelativeTime, formatShortDate, plural } from "@/lib/format";
import type { AuthorKind } from "@/lib/github-insights";
import type { ResourceState } from "@/lib/resource-store";

export type Series = { key: string; label: string; color: string };

/** Stacked bars of items opened per day or week, split by their current state. */
export function CohortChart({
  cohorts,
  series,
  height = 260,
}: {
  cohorts: { unit: "day" | "week"; rows: Array<Record<string, number | string>> };
  series: Series[];
  height?: number;
}) {
  const { unit, rows } = cohorts;
  if (rows.length === 0) return <EmptyChart height={height}>Nothing opened in the sampled period.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="period" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={30} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<CohortTooltip series={series} unit={unit} />} cursor={CURSOR} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--fg-muted)" }} />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId="cohort"
            fill={item.color}
            radius={index === series.length - 1 ? [3, 3, 0, 0] : undefined}
            animationDuration={CHART_ANIMATION_MS}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CohortTooltip({
  active,
  payload,
  series,
  unit,
}: TooltipProps<Record<string, number | string>> & { series: Series[]; unit: "day" | "week" }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const total = series.reduce((sum, item) => sum + Number(row[item.key] ?? 0), 0);
  return (
    <div className={TOOLTIP}>
      <p className="font-semibold text-fg">
        {unit === "week" ? "Week of " : ""}
        {formatShortDate(String(row.period))} · {total} opened
      </p>
      {series.map((item) => (
        <p key={item.key} className="mt-0.5 flex items-center gap-1.5 text-fg-muted">
          <span className="size-2 rounded-full" style={{ background: item.color }} />
          {row[item.key]} {item.label.toLowerCase()}
        </p>
      ))}
    </div>
  );
}

/** Histogram of duration buckets (from bucketDurations). */
export function BucketChart({ buckets, color, height = 220 }: { buckets: Array<{ label: string; short: string; count: number }>; color: string; height?: number }) {
  if (buckets.every((bucket) => bucket.count === 0)) return <EmptyChart height={height}>Nothing to measure yet.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={buckets} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="short" tick={TICK} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<BucketTooltip />} cursor={CURSOR} />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BucketTooltip({ active, payload }: TooltipProps<{ label: string; count: number }>) {
  const bucket = payload?.[0]?.payload;
  if (!active || !bucket) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-semibold text-fg">{bucket.label}</p>
      <p className="mt-0.5 text-fg-muted">{bucket.count}</p>
    </div>
  );
}

const KIND_LABEL: Record<AuthorKind, { label: string; tone: Tone }> = {
  maintainer: { label: "Maintainers", tone: "info" },
  contributor: { label: "Community", tone: "ok" },
  "first-timer": { label: "First-time contributors", tone: "warn" },
  bot: { label: "Bots", tone: "idle" },
};

/** Who opens items: maintainers, outside contributors, first-timers and bots, plus the top authors. */
export function AuthorMixCard({
  title,
  description,
  mix,
  top,
}: {
  title: string;
  description: string;
  mix: Record<AuthorKind, number>;
  top: Array<{ author: string; kind: AuthorKind; count: number }>;
}) {
  const total = Object.values(mix).reduce((sum, value) => sum + value, 0);
  return (
    <Card>
      <SectionHeader title={title} description={description} icon="people" />
      {total === 0 ? (
        <p className="px-5 py-6 text-sm text-fg-muted">No authors in the sample.</p>
      ) : (
        <div className="space-y-5 px-5 py-4">
          <ul className="space-y-2.5">
            {(Object.keys(KIND_LABEL) as AuthorKind[]).map((kind) => (
              <li key={kind}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-fg-2">{KIND_LABEL[kind].label}</span>
                  <span className="font-mono text-xs text-fg-muted tabular-nums">
                    {mix[kind]} · {formatPercent(mix[kind] / total)}
                  </span>
                </div>
                <Meter value={mix[kind] / total} tone={KIND_LABEL[kind].tone} className="mt-1" />
              </li>
            ))}
          </ul>
          {top.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Most active</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {top.map((author) => (
                  <li key={author.author}>
                    <a
                      href={`https://github.com/${author.author.replace("[bot]", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-fg-2 hover:border-info-line"
                    >
                      {author.author}
                      <span className="font-mono text-[10px] text-fg-subtle">{author.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export type ListItem = {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  author: string;
  draft?: boolean;
  comments?: number;
  labels?: Array<{ name: string; color: string }>;
  meta?: string;
  /** Time shown on the right; defaults to createdAt. */
  time?: string;
};

/** Linked list of issues or pull requests with age, author and labels. */
export function ItemList({
  title,
  description,
  icon,
  resource,
  items,
  now,
  empty,
}: {
  title: string;
  description?: string;
  icon: "issue" | "git-merge" | "clock";
  resource: ResourceState<unknown>;
  items: ListItem[];
  now: number;
  empty: string;
}) {
  return (
    <Card>
      <SectionHeader title={title} description={description} icon={icon} />
      {resource.loading && resource.data === null ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      ) : resource.data === null ? (
        <ResourceNote error={resource.error} className="p-5" />
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-fg-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((item) => (
            <li key={item.number}>
              <a href={item.url} target="_blank" rel="noreferrer" className="group flex items-start gap-3 px-5 py-3 hover:bg-surface-2">
                <span className="mt-0.5 w-12 shrink-0 font-mono text-xs text-fg-subtle">#{item.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg group-hover:text-info-fg">{item.title}</span>
                    {item.draft && <Pill>Draft</Pill>}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    <span>{item.author}</span>
                    {item.meta && <span>{item.meta}</span>}
                    {item.comments !== undefined && item.comments > 0 && <span>{plural(item.comments, "comment")}</span>}
                    {item.labels?.slice(0, 3).map((label) => (
                      <span key={label.name} className="flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ background: label.color }} />
                        {label.name}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-fg-subtle" title={new Date(item.time ?? item.createdAt).toLocaleString("en-GB")}>
                  {formatRelativeTime(item.time ?? item.createdAt, now)}
                </span>
                <Icon name="arrow-up-right" className="mt-0.5 size-3.5 shrink-0 text-fg-subtle opacity-0 transition group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Note on how much data a sample covers. */
export function SampleNote({ count, noun, since, hasToken }: { count: number; noun: string; since: string | null; hasToken: boolean }) {
  if (count === 0 || !since) return null;
  return (
    <p className="text-xs text-fg-subtle">
      Charts use the {count} most recent {noun}, opened since {formatShortDate(since.slice(0, 10))}.
      {!hasToken && count >= 90 && " Add a token to sample 300."}
    </p>
  );
}
