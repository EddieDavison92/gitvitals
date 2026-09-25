export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatDurationAxis(minutes: number) {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${Math.round(minutes / 60)}h`;
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(value: string | number | null) {
  if (value === null) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : timeFormat.format(date);
}

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(value: string | number | null, now = Date.now()) {
  if (value === null) return "not yet";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "unknown";
  const seconds = Math.round((time - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormat.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 45) return relativeFormat.format(days, "day");
  if (Math.abs(days) < 548) return relativeFormat.format(Math.round(days / 30.44), "month");
  return relativeFormat.format(Math.round(days / 365.25), "year");
}

const shortDateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Formats a `YYYY-MM-DD` day key. */
export function formatShortDate(day: string) {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? day : shortDateFormat.format(date);
}

export function formatRate(rate: number | null) {
  return rate === null ? "–" : `${rate}%`;
}

const countFormat = new Intl.NumberFormat("en-GB");

export function formatCount(value: number) {
  return countFormat.format(value);
}

export function plural(count: number, noun: string, pluralNoun = `${noun}s`) {
  return `${formatCount(count)} ${count === 1 ? noun : pluralNoun}`;
}

/** Human span for longer durations: "40 minutes", "5 hours", "3 days", "6 weeks", "4 months", "2 years". */
export function formatSpan(ms: number) {
  const minutes = ms / 60_000;
  const unit = (value: number, noun: string) => plural(Math.max(1, Math.round(value)), noun);
  if (minutes < 90) return unit(minutes, "minute");
  const hours = minutes / 60;
  if (hours < 48) return unit(hours, "hour");
  const days = hours / 24;
  if (days < 14) return unit(days, "day");
  if (days < 70) return unit(days / 7, "week");
  if (days < 548) return unit(days / 30.44, "month");
  return unit(days / 365.25, "year");
}

const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Compact number: 1.2K, 34K, 1.5M (en-US, so "m" can't be misread as minutes). */
export function formatCompact(value: number) {
  return compactFormat.format(value);
}

/** Share (0–1) as a percentage; non-zero shares that round to nothing show as "<0.1%". */
export function formatPercent(share: number, digits = 0) {
  const minimum = 10 ** -digits;
  if (share > 0 && share * 100 < minimum) return `<${minimum}%`;
  return `${(share * 100).toFixed(digits)}%`;
}
