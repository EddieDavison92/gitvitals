"use client";

import Image from "next/image";
import { Icon, type IconName } from "@/components/icon";
import { formatRelativeTime, formatTime } from "@/lib/format";
import type { ResourceError } from "@/lib/resource-store";
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
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  icon?: IconName;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-4 sm:px-5">
      <div className="flex min-w-0 gap-3">
        {icon && (
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg-muted">
            <Icon name={icon} className="size-4" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className={`${eyebrow ? "mt-0.5" : ""} text-base font-semibold text-fg`}>{title}</h2>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Page section title with optional eyebrow and trailing content. */
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
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
    <kbd className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[10px] text-fg-subtle">{children}</kbd>
  );
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

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-surface-3 ${className}`} />;
}

/** Headline number with a label, an optional tone dot and a detail line. */
export function Stat({
  label,
  value,
  detail,
  tone,
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
        {tone && <span className={`size-1.5 rounded-full ${DOT[tone]}`} />}
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1 truncate font-mono text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      )}
      {detail && !loading && <p className="mt-0.5 truncate text-xs text-fg-muted">{detail}</p>}
    </div>
  );
}

export function describeResourceError(error: ResourceError) {
  switch (error.kind) {
    case "pending":
      return "GitHub is computing these statistics. They'll appear shortly.";
    case "rate_limited":
      return `GitHub's request limit is used up until ${formatTime(error.resetAt)}. Add a token to raise it.`;
    case "not_found":
      return "Not available for this repository.";
    case "forbidden":
      return "GitHub didn't allow this request.";
    case "bad_token":
      return "GitHub rejected the saved token. Replace or remove it.";
    case "other":
      return `Couldn't load from GitHub: ${error.message}.`;
  }
}

/** Inline status for a resource that has no data to show yet. */
export function ResourceNote({
  error,
  onRetry,
  className = "",
}: {
  error: ResourceError | null;
  onRetry?: () => void;
  className?: string;
}) {
  if (!error) return null;
  const pending = error.kind === "pending";
  return (
    <div className={`flex items-center gap-2 text-xs ${pending ? "text-fg-muted" : TEXT.warn} ${className}`}>
      <Icon name={pending ? "clock" : "warning"} className={`size-3.5 shrink-0 ${pending ? "animate-pulse" : ""}`} />
      <span>{describeResourceError(error)}</span>
      {onRetry && error.kind !== "rate_limited" && (
        <button type="button" onClick={onRetry} className="font-semibold text-info-fg hover:underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Avatar({ src, alt, size = 24, className = "" }: { src: string; alt: string; size?: number; className?: string }) {
  return (
    <Image
      src={`${src}${src.includes("?") ? "&" : "?"}s=${size * 2}`}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 rounded-full bg-surface-3 ${className}`}
    />
  );
}

/** Horizontal share bar, 0–1. */
export function Meter({ value, tone = "info", className = "" }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div className={`h-full rounded-full ${DOT[tone]}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Pill({ children, tone = "idle", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}
