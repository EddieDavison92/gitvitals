"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ANIMATION_MS, CHART_HEIGHT, ChartCard, ChartSkeleton, GRID, LineLegend, SERIES, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { EmptyState, PageHeader, Panel, ResourceNote, Skeleton, StatCell, StatGrid, TD, TH, TR } from "@/components/ui/primitives";
import { formatCompact, formatCount, formatShortDate } from "@/lib/format";
import { useTraffic } from "@/lib/repo-data";
import { useToken } from "@/lib/token-store";
import type { RepoMeta } from "@/lib/types";

type Day = { day: string; count: number; uniques: number };

const LEGEND = [
  { label: "Total", color: SERIES.info },
  { label: "Unique", color: SERIES.neutral, dashed: true },
];
const perDay = (count: number) => `About ${formatCompact(count / 14)} a day`;

export function TrafficTab({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const hasToken = useToken() !== null;
  const canPush = meta?.canPush ?? false;
  const traffic = useTraffic(owner, repo, canPush);

  if (meta && !canPush) {
    return (
      <>
        <PageHeader title="Traffic" />
        <EmptyState icon="lock" title="Traffic needs push access" className="py-24">
          GitHub only shares views, clones and referrers with people who can push to the repository.
          {hasToken ? " The saved token can't push here." : " Add a token with push access to see them."}
        </EmptyState>
      </>
    );
  }

  const data = traffic.data;
  const loading = !data && (traffic.loading || !meta);

  return (
    <>
      <PageHeader title="Traffic" description="Views, clones and referrers over the last 14 days." />

      <StatGrid className="grid-cols-2 xl:grid-cols-4">
        <StatCell label="Views" value={data ? formatCount(data.views.count) : "–"} loading={loading} error={data ? null : traffic.error} sub={data && perDay(data.views.count)} />
        <StatCell label="Unique visitors" value={data ? formatCount(data.views.uniques) : "–"} loading={loading} sub="Distinct visitors in 14 days" />
        <StatCell label="Clones" value={data ? formatCount(data.clones.count) : "–"} loading={loading} sub={data && perDay(data.clones.count)} />
        <StatCell label="Unique cloners" value={data ? formatCount(data.clones.uniques) : "–"} loading={loading} sub="Distinct cloners in 14 days" />
      </StatGrid>
      <ResourceNote error={data ? null : traffic.error} onRetry={traffic.reload} />

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Views" description="Per day" action={<LineLegend items={LEGEND} />}>
          {data ? <DailyChart days={data.views.days} /> : <ChartSkeleton />}
        </ChartCard>
        <ChartCard title="Clones" description="Per day" action={<LineLegend items={LEGEND} />}>
          {data ? <DailyChart days={data.clones.days} /> : <ChartSkeleton />}
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Referring sites">
          <SourceTable loading={loading} rows={(data?.referrers ?? []).map((row) => ({ key: row.referrer, label: row.referrer, count: row.count, uniques: row.uniques }))} />
        </Panel>
        <Panel title="Popular content">
          <SourceTable
            loading={loading}
            rows={(data?.paths ?? []).map((row) => ({
              key: row.path,
              label: row.path.replace(`/${owner}/${repo}`, "") || "/",
              href: `https://github.com${row.path}`,
              count: row.count,
              uniques: row.uniques,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

function DailyChart({ days }: { days: Day[] }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={days} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<DayTooltip />} />
        <Line type="monotone" dataKey="count" stroke={SERIES.info} strokeWidth={2} dot={false} animationDuration={CHART_ANIMATION_MS} />
        <Line type="monotone" dataKey="uniques" stroke={SERIES.neutral} strokeWidth={1.5} strokeDasharray="4 4" dot={false} animationDuration={CHART_ANIMATION_MS} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DayTooltip({ active, payload }: TooltipProps<Day>) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-medium text-fg">{formatShortDate(day.day)}</p>
      <p className="mt-0.5 text-fg-muted">
        {formatCount(day.count)} total · {formatCount(day.uniques)} unique
      </p>
    </div>
  );
}

function SourceTable({
  loading,
  rows,
}: {
  loading: boolean;
  rows: Array<{ key: string; label: string; href?: string; count: number; uniques: number }>;
}) {
  if (loading) return <Skeleton className="m-4 h-40" />;
  if (rows.length === 0) return <p className="p-4 text-[13px] text-fg-muted">Nothing recorded in the last 14 days.</p>;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className={TH}>Source</th>
          <th className={`${TH} text-right`}>Total</th>
          <th className={`${TH} text-right`}>Unique</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className={TR}>
            <td className={`${TD} max-w-xs truncate text-fg-2`}>
              {row.href ? (
                <a href={row.href} target="_blank" rel="noreferrer" className="hover:underline">
                  {row.label}
                </a>
              ) : (
                row.label
              )}
            </td>
            <td className={`${TD} text-right font-mono text-fg-muted tabular-nums`}>{formatCount(row.count)}</td>
            <td className={`${TD} text-right font-mono text-fg-muted tabular-nums`}>{formatCount(row.uniques)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
