"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDuration, formatDurationAxis, formatShortDate } from "@/lib/format";
import type { DayStat, WorkflowStat } from "@/lib/stats";
import { CHART_ANIMATION_MS as ANIMATION_MS, ChartCard, CURSOR, EmptyChart, GRID, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { Eyebrow } from "@/components/ui/primitives";

export function Trends({ daily, workflows }: { daily: DayStat[]; workflows: WorkflowStat[] }) {
  const busiest = [...workflows].sort((a, b) => b.runs - a.runs).slice(0, 6);
  return (
    <section aria-labelledby="trends-heading">
      <div className="mb-3">
        <Eyebrow>Trends</Eyebrow>
        <h2 id="trends-heading" className="mt-1 text-xl font-semibold tracking-tight">
          Performance over time
        </h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <ChartCard title="Daily reliability" description="Success rate with failed-run volume.">
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={daily} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="day" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={26} />
                <YAxis yAxisId="rate" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={TICK} axisLine={false} tickLine={false} />
                <YAxis yAxisId="failures" orientation="right" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<ReliabilityTooltip />} cursor={CURSOR} />
                <Bar yAxisId="failures" dataKey="failed" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={ANIMATION_MS} />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="successRate"
                  stroke="var(--chart-line)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, fill: "var(--chart-line)", strokeWidth: 0 }}
                  animationDuration={ANIMATION_MS}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart>No completed runs to chart.</EmptyChart>
          )}
        </ChartCard>

        <ChartCard title="Median duration" description="Typical run time for the busiest workflows.">
          {busiest.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={busiest} layout="vertical" margin={{ top: 12, right: 10, bottom: 0, left: 12 }}>
                <CartesianGrid {...GRID} horizontal={false} />
                <XAxis type="number" tickFormatter={formatDurationAxis} tick={TICK} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="workflow"
                  width={112}
                  tick={{ ...TICK, fill: "var(--fg-muted)" }}
                  tickFormatter={(value: string) => (value.length > 17 ? `${value.slice(0, 16)}…` : value)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<WorkflowDurationTooltip />} cursor={{ fill: "var(--surface-3)" }} />
                <Bar dataKey="medianMinutes" fill="var(--chart-neutral)" radius={[0, 5, 5, 0]} animationDuration={ANIMATION_MS} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart>No completed runs to chart.</EmptyChart>
          )}
        </ChartCard>

        <div className="xl:col-span-2">
          <ChartCard title="Duration trend" description="Daily median and 95th percentile run time. Rising p95 means slow outliers.">
            {daily.some((day) => day.p50Minutes !== null) ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={daily} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid {...GRID} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={26} />
                  <YAxis tickFormatter={formatDurationAxis} tick={TICK} axisLine={false} tickLine={false} />
                  <Tooltip content={<DurationTrendTooltip />} />
                  <Line type="monotone" dataKey="p95Minutes" stroke="var(--chart-p95)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls animationDuration={ANIMATION_MS} />
                  <Line type="monotone" dataKey="p50Minutes" stroke="var(--chart-line)" strokeWidth={2.5} dot={false} connectNulls animationDuration={ANIMATION_MS} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={220}>No completed runs to chart.</EmptyChart>
            )}
          </ChartCard>
        </div>
      </div>
    </section>
  );
}

function ReliabilityTooltip({ active, payload, label }: TooltipProps<DayStat>) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-semibold text-fg">{formatShortDate(String(label))}</p>
      <p className="mt-1 text-info-fg">
        {day.successRate === null ? "No passes or failures" : `${day.successRate}% success`}
      </p>
      <p className="text-bad-fg">
        {day.failed} failed · {day.successful} passed
      </p>
    </div>
  );
}

function WorkflowDurationTooltip({ active, payload }: TooltipProps<WorkflowStat>) {
  const stat = payload?.[0]?.payload;
  if (!active || !stat) return null;
  return (
    <div className={`${TOOLTIP} max-w-64`}>
      <p className="truncate font-semibold text-fg">{stat.workflow}</p>
      <p className="mt-1 text-fg-muted">
        Median {formatDuration(stat.medianMinutes * 60_000)} · {stat.runs} runs
      </p>
    </div>
  );
}

function DurationTrendTooltip({ active, payload, label }: TooltipProps<DayStat>) {
  const day = payload?.[0]?.payload;
  if (!active || !day || day.p50Minutes === null) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-semibold text-fg">{formatShortDate(String(label))}</p>
      <p className="mt-1 text-info-fg">Median {formatDuration(day.p50Minutes * 60_000)}</p>
      <p className="text-fg-muted">p95 {formatDuration((day.p95Minutes ?? 0) * 60_000)}</p>
    </div>
  );
}
