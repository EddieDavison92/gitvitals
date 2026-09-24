export type PeriodFilter = "24h" | "7d" | "30d" | "90d" | "all";

export const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string; shortLabel: string }> = [
  { value: "24h", label: "Last 24 hours", shortLabel: "24h" },
  { value: "7d", label: "Last 7 days", shortLabel: "7d" },
  { value: "30d", label: "Last 30 days", shortLabel: "30d" },
  { value: "90d", label: "Last 90 days", shortLabel: "90d" },
  { value: "all", label: "All fetched runs", shortLabel: "All" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<Exclude<PeriodFilter, "all">, number> = {
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "90d": 90 * DAY_MS,
};

export function getPeriodMs(period: PeriodFilter) {
  return period === "all" ? null : PERIOD_MS[period];
}

/** Fetch twice the period so the dashboard can compare against the previous one. */
export function getFetchSince(period: PeriodFilter, now = Date.now()) {
  const duration = getPeriodMs(period);
  return duration ? new Date(now - duration * 2).toISOString() : null;
}
