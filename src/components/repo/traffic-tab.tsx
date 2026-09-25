"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ANIMATION_MS, ChartCard, GRID, SERIES, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { Card, EmptyState, ResourceNote, SectionHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { formatCount, formatShortDate } from "@/lib/format";
import { useTraffic } from "@/lib/repo-data";
import { useToken } from "@/lib/token-store";
import type { RepoMeta } from "@/lib/types";

type Day = { day: string; count: number; uniques: number };

export function TrafficTab({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const hasToken = useToken() !== null;
  const canPush = meta?.canPush ?? false;
  const traffic = useTraffic(owner, repo, canPush);

  if (meta && !canPush) {
    return (
      <EmptyState icon="lock" title="Traffic needs push access" className="min-h-96">
        GitHub only shares views, clones and referrers with people who can push to the repository.
        {hasToken ? " The saved token can't push here." : " Add a token with push access to see them."}
      </EmptyState>
    );
  }

  const data = traffic.data;
  const loading = !data && (traffic.loading || !meta);

  return (
    <div className="space-y-6">
      <Card className="grid gap-6 p-5 sm:grid-cols-4 sm:p-6">
        <Stat label="Views, 14 days" value={data ? formatCount(data.views.count) : "–"} loading={loading} tone="info" />
        <Stat label="Unique visitors" value={data ? formatCount(data.views.uniques) : "–"} loading={loading} />
        <Stat label="Clones, 14 days" value={data ? formatCount(data.clones.count) : "–"} loading={loading} tone="ok" />
        <Stat label="Unique cloners" value={data ? formatCount(data.clones.uniques) : "–"} loading={loading} />
      </Card>
      <ResourceNote error={data ? null : traffic.error} onRetry={traffic.reload} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Views" description="Daily page views and unique visitors.">
          {data ? <DailyChart days={data.views.days} /> : <Skeleton className="m-2 h-56" />}
        </ChartCard>
        <ChartCard title="Clones" description="Daily clones and unique cloners.">
          {data ? <DailyChart days={data.clones.days} /> : <Skeleton className="m-2 h-56" />}
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Referring sites" description="Top sources of visits, last 14 days." icon="arrow-up-right" />
          <Table
            loading={loading}
            rows={(data?.referrers ?? []).map((row) => ({ key: row.referrer, label: row.referrer, count: row.count, uniques: row.uniques }))}
          />
        </Card>
        <Card>
          <SectionHeader title="Popular content" description="Most viewed pages, last 14 days." icon="eye" />
          <Table
            loading={loading}
            rows={(data?.paths ?? []).map((row) => ({
              key: row.path,
              label: row.path.replace(`/${owner}/${repo}`, "") || "/",
              href: `https://github.com${row.path}`,
              count: row.count,
              uniques: row.uniques,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

function DailyChart({ days }: { days: Day[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={days} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<DayTooltip />} />
        <Line type="monotone" dataKey="count" stroke={SERIES.info} strokeWidth={2.5} dot={false} animationDuration={CHART_ANIMATION_MS} />
        <Line type="monotone" dataKey="uniques" stroke={SERIES.ok} strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={CHART_ANIMATION_MS} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DayTooltip({ active, payload }: TooltipProps<Day>) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-semibold text-fg">{formatShortDate(day.day)}</p>
      <p className="mt-0.5 text-info-fg">{formatCount(day.count)} total</p>
      <p className="text-ok-fg">{formatCount(day.uniques)} unique</p>
    </div>
  );
}

function Table({
  loading,
  rows,
}: {
  loading: boolean;
  rows: Array<{ key: string; label: string; href?: string; count: number; uniques: number }>;
}) {
  if (loading) return <Skeleton className="m-5 h-40" />;
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-fg-muted">Nothing recorded in the last 14 days.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-line-soft bg-surface-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-fg-subtle">
          <th className="px-5 py-2">Source</th>
          <th className="px-4 py-2 text-right">Total</th>
          <th className="px-5 py-2 text-right">Unique</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft">
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="max-w-xs truncate px-5 py-2 text-fg-2">
              {row.href ? (
                <a href={row.href} target="_blank" rel="noreferrer" className="hover:text-info-fg">
                  {row.label}
                </a>
              ) : (
                row.label
              )}
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs text-fg-muted">{formatCount(row.count)}</td>
            <td className="px-5 py-2 text-right font-mono text-xs text-fg-muted">{formatCount(row.uniques)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
