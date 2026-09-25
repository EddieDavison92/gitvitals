"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { formatRelativeTime, formatTime } from "@/lib/format";
import type { ResourceError } from "@/lib/resource-store";
import { useNow } from "@/lib/use-now";
import { BADGE, DOT, TEXT, type Tone } from "./tones";

// ── Layout ─────────────────────────────────────────────────

/** Page title row: title, optional description, and controls on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bordered surface with an optional header row. */
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const hasBody = children !== undefined && children !== null && children !== false;
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      {(title || actions) && (
        <header className={`flex h-[52px] shrink-0 items-center justify-between gap-3 px-4 ${hasBody ? "border-b border-line" : ""}`}>
          <div className="min-w-0">
            {title && <h2 className="truncate text-[13px] font-medium leading-5 text-fg">{title}</h2>}
            {description && <p className="truncate text-xs leading-4 text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2 text-xs">{actions}</div>}
        </header>
      )}
      {hasBody && <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>}
    </section>
  );
}

/** Grid of stat cells separated by hairlines. */
export function StatGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-px overflow-hidden rounded-lg border border-line bg-line ${className}`}>{children}</div>
  );
}

export function StatCell({
  label,
  value,
  sub,
  tone,
  href,
  loading = false,
  error = null,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  href?: string;
  loading?: boolean;
  error?: ResourceError | null;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs text-fg-muted">
        {tone && <span className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />}
        <span className="truncate">{label}</span>
      </p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-20" />
      ) : error ? (
        <ResourceNote error={error} className="mt-1 min-h-7" />
      ) : (
        <p className="mt-1 truncate text-xl font-semibold leading-7 tracking-tight text-fg tabular-nums">{value}</p>
      )}
      <p className="mt-0.5 truncate text-xs leading-4 text-fg-muted">{!loading && !error && sub ? sub : "\u00a0"}</p>
    </>
  );
  const className = "min-w-0 bg-surface px-4 py-3";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:bg-surface-2`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ── Controls ───────────────────────────────────────────────

const BUTTON_BASE =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50";
export const BUTTON = `${BUTTON_BASE} h-8 px-2.5 text-[13px]`;
/** Compact button for top bars, panel headers and table footers. */
export const BUTTON_SM = `${BUTTON_BASE} h-7 px-2 text-xs`;
export const BUTTON_GHOST =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-50";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 items-center rounded-md border border-line bg-surface p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          title={option.title}
          className={`h-full rounded-[5px] px-2.5 text-xs font-medium transition-colors ${
            value === option.value ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
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
    <label className="block text-xs text-fg-muted">
      <span className="mb-1 block">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-8 w-full appearance-none truncate rounded-md border border-line bg-surface pl-2.5 pr-8 text-[13px] outline-none transition-colors hover:border-fg-subtle focus:border-info focus-visible:outline-none ${
            value === "all" ? "text-fg-muted" : "text-fg"
          }`}
        >
          <option value="all">{allLabel}</option>
          {options.map((option) => {
            const { value: optionValue, label: optionLabel } = typeof option === "string" ? { value: option, label: option } : option;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <Icon name="chevron-down" className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
      </span>
    </label>
  );
}

// ── Tables ─────────────────────────────────────────────────

export const TH = "px-4 py-2 text-left text-xs font-medium text-fg-muted";
export const TD = "px-4 py-2 text-[13px]";
export const TR = "border-t border-line-soft transition-colors hover:bg-surface-2";

// ── Status ─────────────────────────────────────────────────

export function Badge({ children, tone = "idle", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium ${BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Dot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative flex size-2 shrink-0">
      {pulse && <span className={`absolute inset-0 animate-ping rounded-full opacity-50 ${DOT[tone]}`} />}
      <span className={`relative size-2 rounded-full ${DOT[tone]}`} />
    </span>
  );
}

export function EmptyState({
  title,
  children,
  icon,
  className = "py-12",
}: {
  title: string;
  children?: React.ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={`px-6 text-center ${className}`}>
      {icon && <Icon name={icon} className="mx-auto mb-3 size-5 text-fg-subtle" />}
      <p className="text-[13px] font-medium text-fg">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-[13px] text-fg-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-3 ${className}`} />;
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
        <button type="button" onClick={onRetry} className="font-medium text-info-fg hover:underline">
          Retry
        </button>
      )}
    </div>
  );
}

// ── Misc ───────────────────────────────────────────────────

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-[10px] leading-4 text-fg-subtle">{children}</kbd>
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

export function Avatar({ src, alt, size = 20, className = "rounded-full" }: { src: string; alt: string; size?: number; className?: string }) {
  return (
    <Image
      src={`${src}${src.includes("?") ? "&" : "?"}s=${size * 2}`}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 bg-surface-3 ${className}`}
    />
  );
}

/** Thin share bar, 0–1. */
export function Meter({ value, tone = "info", className = "" }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div className={`h-full rounded-full ${DOT[tone]}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function TextLink({ href, children, external = false }: { href: string; children: React.ReactNode; external?: boolean }) {
  const className = "text-xs font-medium text-fg-muted transition-colors hover:text-fg";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${className} inline-flex items-center gap-1`}>
      {children}
      <Icon name="arrow-up-right" className="size-3" />
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
