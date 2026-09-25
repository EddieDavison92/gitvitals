"use client";

import { Card } from "./primitives";

export const CHART_ANIMATION_MS = 180;
export const TICK = { fontSize: 11, fill: "var(--fg-subtle)" };
export const GRID = { strokeDasharray: "3 3", stroke: "var(--chart-grid)" };
export const TOOLTIP = "rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl shadow-black/10";
export const CURSOR = { fill: "var(--surface-3)" };

/** Series colours that read in both themes. */
export const SERIES = {
  ok: "var(--ok)",
  bad: "var(--bad)",
  warn: "var(--warn)",
  info: "var(--chart-line)",
  idle: "var(--idle)",
  neutral: "var(--chart-neutral)",
};

export type TooltipProps<T> = { active?: boolean; payload?: Array<{ payload: T }>; label?: string | number };

export function ChartCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-2 pb-3 pt-1 sm:px-4">{children}</div>
    </Card>
  );
}

export function EmptyChart({ height = 260, children = "Nothing to chart yet." }: { height?: number; children?: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-4 text-center text-sm text-fg-subtle" style={{ height }}>
      {children}
    </div>
  );
}

/** Minimal SVG line for inline trends; no axes. */
export function Sparkline({
  values,
  width = 160,
  height = 36,
  stroke = "var(--chart-line)",
  fill = true,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  className?: string;
}) {
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden="true" />;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [index * step, height - 2 - (value / max) * (height - 4)] as const);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {fill && <path d={`${line} L${width},${height} L0,${height} Z`} fill={stroke} opacity={0.12} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Tiny vertical bars for weekly counts. */
export function MiniBars({
  values,
  height = 36,
  color = "var(--chart-line)",
  className = "",
}: {
  values: number[];
  height?: number;
  color?: string;
  className?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={`flex items-end gap-[2px] ${className}`} style={{ height }} aria-hidden="true">
      {values.map((value, index) => (
        <div
          key={index}
          className="min-w-0 flex-1 rounded-[2px]"
          style={{ height: `${Math.max(value > 0 ? 8 : 3, (value / max) * 100)}%`, background: value > 0 ? color : "var(--surface-3)" }}
        />
      ))}
    </div>
  );
}
