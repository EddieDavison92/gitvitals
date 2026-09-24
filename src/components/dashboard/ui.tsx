"use client";

import { Icon, type IconName } from "@/components/icon";
import { formatDuration, formatRelativeTime, formatTime } from "@/lib/format";
import { elapsedMs, isActiveRun, runTone, statusLabel } from "@/lib/run-status";
import type { ActionsRun } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { BADGE, DOT, TEXT, type Tone } from "./tones";

export const CARD = "rounded-2xl border border-line bg-surface shadow-card";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`${CARD} overflow-hidden ${className}`}>{children}</div>;
}

export function Eyebrow({ children, tone = "idle" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${tone === "idle" ? "text-fg-subtle" : TEXT[tone]}`}>
      {children}
    </p>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: IconName;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-4 sm:px-5">
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg-muted">
          <Icon name={icon} className="size-4" />
        </div>
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-0.5 text-base font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ run, className = "" }: { run: ActionsRun; className?: string }) {
  const tone = runTone(run);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE[tone]} ${className}`}
    >
      {isActiveRun(run) && <span className={`size-1.5 animate-pulse rounded-full ${DOT[tone]}`} />}
      {statusLabel(run)}
    </span>
  );
}

export function StatusDot({ run }: { run: ActionsRun }) {
  const tone = runTone(run);
  return (
    <span className="relative flex size-2 shrink-0">
      {isActiveRun(run) && <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${DOT[tone]}`} />}
      <span className={`relative size-2 rounded-full ${DOT[tone]}`} />
    </span>
  );
}

/** Re-run marker: shows the attempt number when a run was retried. */
export function AttemptBadge({ run }: { run: ActionsRun }) {
  if (run.attempt <= 1) return null;
  return (
    <span
      title={`Attempt ${run.attempt}`}
      className="inline-flex items-center gap-0.5 rounded border border-warn-line bg-warn-soft px-1 font-mono text-[10px] font-semibold text-warn-fg"
    >
      <Icon name="retry" className="size-2.5" />
      {run.attempt}
    </span>
  );
}

/** Run duration that counts up once a second while the run is active. */
export function LiveDuration({ run }: { run: ActionsRun }) {
  const active = isActiveRun(run);
  const now = useNow(1000, active);
  return <>{formatDuration(active ? elapsedMs(run, now) : run.durationMs)}</>;
}

/** "5 minutes ago", refreshed every 30 seconds, with the exact time on hover. */
export function RelativeTime({ value, prefix = "" }: { value: string | number | null; prefix?: string }) {
  const now = useNow(30_000, value !== null);
  return (
    <time dateTime={value === null ? undefined : new Date(value).toISOString()} title={formatTime(value)}>
      {prefix}
      {formatRelativeTime(value, now)}
    </time>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-fg-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none transition focus:border-info focus:ring-2 focus:ring-info-soft"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => {
          const { value: optionValue, label: optionLabel } =
            typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function EmptyState({
  icon,
  tone = "idle",
  title,
  children,
  className = "min-h-64",
}: {
  icon: IconName;
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid place-items-center px-6 py-10 text-center ${className}`}>
      <div>
        <div className={`mx-auto grid size-11 place-items-center rounded-full border ${BADGE[tone]}`}>
          <Icon name={icon} className="size-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-fg">{title}</p>
        {children && <div className="mt-1 text-sm text-fg-muted">{children}</div>}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[10px] text-fg-subtle">
      {children}
    </kbd>
  );
}
