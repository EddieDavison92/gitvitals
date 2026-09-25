"use client";

import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ANIMATION_MS as ANIMATION_MS, CHART_HEIGHT as HEIGHT, ChartCard, CURSOR, EmptyChart, GRID, LineLegend, SERIES, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { formatDuration, formatDurationAxis, formatShortDate } from "@/lib/format";
import type { DayStat, WorkflowStat } from "@/lib/stats";

export function Trends({ daily, workflows }: { daily: DayStat[]; workflows: WorkflowStat[] }) {
  const busiest = [...workflows].sort((a, b) => b.runs - a.runs).slice(0, 6);
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ChartCard title="Daily success rate" description="Bars show failed runs" action={<LineLegend items={[{ label: "Success", color: SERIES.info }]} />}>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <ComposedChart data={daily} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="day" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={26} />
              <YAxis yAxisId="rate" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={TICK} axisLine={false} tickLine={false} />
              <YAxis yAxisId="failures" orientation="right" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<ReliabilityTooltip />} cursor={CURSOR} />
              <Bar yAxisId="failures" dataKey="failed" fill="var(--chart-bar)" radius={[2, 2, 0, 0]} maxBarSize={14} animationDuration={ANIMATION_MS} />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="successRate"
                stroke={SERIES.info}
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{ r: 3, fill: SERIES.info, strokeWidth: 0 }}
                animationDuration={ANIMATION_MS}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart height={HEIGHT}>No completed runs.</EmptyChart>
        )}
      </ChartCard>

      <ChartCard
        title="Run duration"
        description="Daily median and 95th percentile"
        action={<LineLegend items={[{ label: "p50", color: SERIES.info }, { label: "p95", color: "var(--chart-p95)", dashed: true }]} />}
      >
        {daily.some((day) => day.p50Minutes !== null) ? (
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <LineChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="day" tickFormatter={formatShortDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={26} />
              <YAxis tickFormatter={formatDurationAxis} tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<DurationTrendTooltip />} />
              <Line type="monotone" dataKey="p95Minutes" stroke="var(--chart-p95)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls animationDuration={ANIMATION_MS} />
              <Line type="monotone" dataKey="p50Minutes" stroke={SERIES.info} strokeWidth={2} dot={false} connectNulls animationDuration={ANIMATION_MS} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart height={HEIGHT}>No completed runs.</EmptyChart>
        )}
      </ChartCard>

      <ChartCard title="Median duration by workflow" description="Busiest six workflows">
        {busiest.length > 0 ? (
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <BarChart data={busiest} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid {...GRID} horizontal={false} />
              <XAxis type="number" tickFormatter={formatDurationAxis} tick={TICK} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="workflow"
                width={120}
                tick={<WorkflowTick />}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<WorkflowDurationTooltip />} cursor={CURSOR} />
              <Bar dataKey="medianMinutes" fill={SERIES.neutral} radius={[0, 2, 2, 0]} maxBarSize={16} animationDuration={ANIMATION_MS} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart height={HEIGHT}>No completed runs.</EmptyChart>
        )}
      </ChartCard>
    </div>
  );
}

/** Single-line workflow label; recharts wraps long category ticks at spaces otherwise. */
function WorkflowTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const value = payload?.value ?? "";
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={TICK.fontSize} fill="var(--fg-muted)">
      <title>{value}</title>
      {value.length > 18 ? `${value.slice(0, 17)}…` : value}
    </text>
  );
}

function ReliabilityTooltip({ active, payload, label }: TooltipProps<DayStat>) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-medium text-fg">{formatShortDate(String(label))}</p>
      <p className="mt-0.5 text-fg-2">{day.successRate === null ? "No passes or failures" : `${day.successRate}% success`}</p>
      <p className="text-fg-muted">
        {day.successful} passed · {day.failed} failed
      </p>
    </div>
  );
}

function WorkflowDurationTooltip({ active, payload }: TooltipProps<WorkflowStat>) {
  const stat = payload?.[0]?.payload;
  if (!active || !stat) return null;
  return (
    <div className={`${TOOLTIP} max-w-64`}>
      <p className="truncate font-medium text-fg">{stat.workflow}</p>
      <p className="mt-0.5 text-fg-muted">
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
      <p className="font-medium text-fg">{formatShortDate(String(label))}</p>
      <p className="mt-0.5 text-fg-2">Median {formatDuration(day.p50Minutes * 60_000)}</p>
      <p className="text-fg-muted">p95 {formatDuration((day.p95Minutes ?? 0) * 60_000)}</p>
    </div>
  );
}
