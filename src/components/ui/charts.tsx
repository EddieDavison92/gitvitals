"use client";

import { Panel } from "./primitives";

export const CHART_ANIMATION_MS = 180;
export const TICK = { fontSize: 11, fill: "var(--chart-axis)" };
export const GRID = { stroke: "var(--chart-grid)" };
export const TOOLTIP = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg shadow-black/10";
export const CURSOR = { fill: "var(--surface-3)", opacity: 0.6 };

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

/** A panel holding a chart; the body is padded to fit axes. */
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
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel title={title} description={description} actions={action} className={className} bodyClassName="px-2 pb-2 pt-3 sm:px-3">
      {children}
    </Panel>
  );
}

export function EmptyChart({ height = 240, children = "Nothing to chart yet." }: { height?: number; children?: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-4 text-center text-[13px] text-fg-muted" style={{ height }}>
      {children}
    </div>
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
    <div className={`flex items-end gap-px ${className}`} style={{ height }} aria-hidden="true">
      {values.map((value, index) => (
        <div
          key={index}
          className="min-w-0 flex-1 rounded-[1px]"
          style={{ height: `${Math.max(value > 0 ? 6 : 2, (value / max) * 100)}%`, background: value > 0 ? color : "var(--line)" }}
        />
      ))}
    </div>
  );
}
