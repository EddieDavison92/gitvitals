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
  return relativeFormat.format(Math.round(hours / 24), "day");
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
