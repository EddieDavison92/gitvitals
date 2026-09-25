"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ANIMATION_MS, CURSOR, EmptyChart, GRID, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { Badge, Meter, Panel, ResourceNote, Skeleton } from "@/components/ui/primitives";
import type { Tone } from "@/components/ui/tones";
import { formatPercent, formatRelativeTime, formatShortDate, plural } from "@/lib/format";
import type { AuthorKind } from "@/lib/github-insights";
import type { ResourceState } from "@/lib/resource-store";

export type Series = { key: string; label: string; color: string };

export function SeriesLegend({ series }: { series: Series[] }) {
  return (
    <span className="flex items-center gap-3 text-[11px] text-fg-muted">
      {series.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </span>
  );
}

/** Stacked bars of items opened per day or week, split by their current state. */
export function CohortChart({
  cohorts,
  series,
  height = 240,
}: {
  cohorts: { unit: "day" | "week"; rows: Array<Record<string, number | string>> };
  series: Series[];
  height?: number;
}) {
  const { unit, rows } = cohorts;
  if (rows.length === 0) return <EmptyChart height={height}>Nothing opened in the sampled period.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="period" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={30} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<CohortTooltip series={series} unit={unit} />} cursor={CURSOR} />
        {series.map((item) => (
          <Bar key={item.key} dataKey={item.key} name={item.label} stackId="cohort" fill={item.color} maxBarSize={28} animationDuration={CHART_ANIMATION_MS} />
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
      <p className="font-medium text-fg">
        {unit === "week" ? "Week of " : ""}
        {formatShortDate(String(row.period))} · {total} opened
      </p>
      {series.map((item) => (
        <p key={item.key} className="mt-0.5 flex items-center gap-1.5 text-fg-muted">
          <span className="size-2 rounded-sm" style={{ background: item.color }} />
          {row[item.key]} {item.label.toLowerCase()}
        </p>
      ))}
    </div>
  );
}

/** Histogram of duration buckets (from bucketDurations). */
export function BucketChart({
  buckets,
  color,
  height = 240,
}: {
  buckets: Array<{ label: string; short: string; count: number }>;
  color: string;
  height?: number;
}) {
  if (buckets.every((bucket) => bucket.count === 0)) return <EmptyChart height={height}>Nothing to measure yet.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="short" tick={TICK} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<BucketTooltip />} cursor={CURSOR} />
        <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} maxBarSize={44} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BucketTooltip({ active, payload }: TooltipProps<{ label: string; count: number }>) {
  const bucket = payload?.[0]?.payload;
  if (!active || !bucket) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-medium text-fg">{bucket.label}</p>
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

/** Who opens items: maintainers, community, first-timers and bots, plus the most active authors. */
export function AuthorMixPanel({
  title,
  mix,
  top,
}: {
  title: string;
  mix: Record<AuthorKind, number>;
  top: Array<{ author: string; kind: AuthorKind; count: number }>;
}) {
  const total = Object.values(mix).reduce((sum, value) => sum + value, 0);
  return (
    <Panel title={title} description="Authors in the sample">
      {total === 0 ? (
        <p className="p-4 text-[13px] text-fg-muted">No authors in the sample.</p>
      ) : (
        <>
          <ul className="space-y-3 p-4">
            {(Object.keys(KIND_LABEL) as AuthorKind[]).map((kind) => (
              <li key={kind}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-fg-2">{KIND_LABEL[kind].label}</span>
                  <span className="font-mono text-xs text-fg-muted tabular-nums">
                    {mix[kind]} <span className="text-fg-subtle">{formatPercent(mix[kind] / total)}</span>
                  </span>
                </div>
                <Meter value={mix[kind] / total} tone={KIND_LABEL[kind].tone} className="mt-1.5" />
              </li>
            ))}
          </ul>
          {top.length > 0 && (
            <div className="border-t border-line-soft px-4 py-3">
              <p className="text-xs text-fg-muted">Most active</p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {top.map((author) => (
                  <li key={author.author}>
                    <a
                      href={`https://github.com/${author.author.replace("[bot]", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded border border-line px-1.5 py-px text-xs text-fg-2 transition-colors hover:border-fg-subtle"
                    >
                      {author.author}
                      <span className="font-mono text-[11px] text-fg-subtle">{author.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
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

/** Linked list of issues or pull requests with author, labels and age. */
export function ItemList({
  title,
  description,
  resource,
  items,
  now,
  empty,
}: {
  title: string;
  description?: string;
  resource: ResourceState<unknown>;
  items: ListItem[];
  now: number;
  empty: string;
}) {
  return (
    <Panel title={title} description={description}>
      {resource.loading && resource.data === null ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
      ) : resource.data === null ? (
        <ResourceNote error={resource.error} className="p-4" />
      ) : items.length === 0 ? (
        <p className="p-4 text-[13px] text-fg-muted">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.number} className="border-t border-line-soft first:border-t-0">
              <a href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 px-4 py-2 transition-colors hover:bg-surface-2">
                <span className="w-14 shrink-0 pt-px font-mono text-xs text-fg-subtle tabular-nums">#{item.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] text-fg">{item.title}</span>
                    {item.draft && <Badge>Draft</Badge>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                    <span>{item.author}</span>
                    {item.meta && <span>{item.meta}</span>}
                    {item.comments !== undefined && item.comments > 0 && <span>{plural(item.comments, "comment")}</span>}
                    {item.labels?.slice(0, 3).map((label) => (
                      <span key={label.name} className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full" style={{ background: label.color }} />
                        {label.name}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 pt-px text-xs text-fg-subtle" title={new Date(item.time ?? item.createdAt).toLocaleString("en-GB")}>
                  {formatRelativeTime(item.time ?? item.createdAt, now)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** How much data a sample covers. */
export function sampleDescription(count: number, noun: string, since: string | null) {
  if (count === 0 || !since) return undefined;
  return `${count} most recent ${noun}, since ${formatShortDate(since.slice(0, 10))}`;
}
