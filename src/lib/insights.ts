import type { AuthorKind, CommitWeek, Contributor, Issue, Language, Pull, Release } from "./github-insights";
import { median, percentile } from "./stats";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export type Tone = "ok" | "bad" | "warn" | "info" | "idle";

// ── Activity ───────────────────────────────────────────────

export type ActivityLevel = "archived" | "very-active" | "active" | "occasional" | "quiet" | "dormant" | "unknown";

const ACTIVITY: Record<ActivityLevel, { label: string; tone: Tone }> = {
  archived: { label: "Archived", tone: "idle" },
  "very-active": { label: "Very active", tone: "ok" },
  active: { label: "Active", tone: "ok" },
  occasional: { label: "Occasional activity", tone: "info" },
  quiet: { label: "Quiet", tone: "warn" },
  dormant: { label: "Dormant", tone: "bad" },
  unknown: { label: "Activity unknown", tone: "idle" },
};

/**
 * Activity from commits per week (last 52 weeks, oldest first). Levels by how
 * many of the last 12 weeks had commits: 10+ very active, 6+ active, 1+
 * occasional; none in 12 weeks but some in the year is quiet; none all year is dormant.
 */
export function activityLevel(weeks: CommitWeek[], archived = false) {
  const last12 = weeks.slice(-12);
  const activeWeeks12 = last12.filter((week) => week.total > 0).length;
  const commits12 = last12.reduce((sum, week) => sum + week.total, 0);
  const commits52 = weeks.reduce((sum, week) => sum + week.total, 0);
  const lastActive = [...weeks].reverse().find((week) => week.total > 0);

  let level: ActivityLevel;
  if (archived) level = "archived";
  else if (weeks.length === 0) level = "unknown";
  else if (activeWeeks12 >= 10) level = "very-active";
  else if (activeWeeks12 >= 6) level = "active";
  else if (activeWeeks12 >= 1) level = "occasional";
  else if (commits52 > 0) level = "quiet";
  else level = "dormant";

  return {
    level,
    ...ACTIVITY[level],
    activeWeeks12,
    commits12,
    commits52,
    /** Start of the most recent week with commits, in ms. */
    lastActiveWeek: lastActive ? lastActive.week * 1000 : null,
  };
}

// ── Contributors ───────────────────────────────────────────

/**
 * Bus factor: the fewest people (bots excluded) who account for at least half
 * of all commits. 1 means one person wrote most of the code.
 */
export function busFactor(contributors: Contributor[]) {
  const humans = contributors.filter((person) => !person.isBot).sort((a, b) => b.commits - a.commits);
  const total = humans.reduce((sum, person) => sum + person.commits, 0);
  if (total === 0) return null;
  let running = 0;
  let factor = 0;
  for (const person of humans) {
    running += person.commits;
    factor += 1;
    if (running >= total / 2) break;
  }
  return { factor, topShare: humans[0].commits / total, humans: humans.length, total };
}

// ── Releases ───────────────────────────────────────────────

export function releaseCadence(releases: Release[], now: number) {
  const sorted = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const latest = sorted[0] ?? null;
  const latestStable = sorted.find((release) => !release.prerelease) ?? null;
  const gaps = sorted
    .slice(0, -1)
    .map((release, index) => (Date.parse(release.publishedAt) - Date.parse(sorted[index + 1].publishedAt)) / DAY);
  return {
    latest,
    latestStable,
    daysSinceLatest: latest ? (now - Date.parse(latest.publishedAt)) / DAY : null,
    medianGapDays: gaps.length > 0 ? median(gaps) : null,
    lastYear: sorted.filter((release) => now - Date.parse(release.publishedAt) < 365 * DAY).length,
  };
}

const VERSION = /(\d+)\.(\d+)(?:\.(\d+))?/;

function parseVersion(tag: string) {
  const match = VERSION.exec(tag);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : null;
}

/** Semver bump between two tags, or null when either isn't a version or they're equal. */
export function semverBump(previous: string, next: string): "major" | "minor" | "patch" | null {
  const a = parseVersion(previous);
  const b = parseVersion(next);
  if (!a || !b) return null;
  if (a[0] !== b[0]) return "major";
  if (a[1] !== b[1]) return "minor";
  if (a[2] !== b[2]) return "patch";
  return null;
}

// ── Durations and ages ─────────────────────────────────────

/** Milliseconds from open to merge for merged pull requests. */
export function mergeDurations(pulls: Pull[]) {
  return pulls
    .filter((pr) => pr.mergedAt)
    .map((pr) => Date.parse(pr.mergedAt!) - Date.parse(pr.createdAt))
    .filter((ms) => ms >= 0);
}

/** Milliseconds from open to close for issues closed as completed (not "not planned"). */
export function closeDurations(issues: Issue[]) {
  return issues
    .filter((issue) => issue.closedAt && !issue.notPlanned)
    .map((issue) => Date.parse(issue.closedAt!) - Date.parse(issue.createdAt))
    .filter((ms) => ms >= 0);
}

/** The larger of two duration samples: more data beats a narrower window. */
export function largerSample(a: number[], b: number[]) {
  return a.length >= b.length ? a : b;
}

export function durationSummary(values: number[]) {
  return values.length === 0 ? null : { median: median(values), p90: percentile(values, 90), count: values.length };
}

const BUCKETS: Array<{ label: string; short: string; max: number }> = [
  { label: "Under an hour", short: "<1h", max: HOUR },
  { label: "1 hour to 1 day", short: "<1d", max: DAY },
  { label: "1 day to 1 week", short: "<1w", max: WEEK },
  { label: "1 week to 1 month", short: "<1mo", max: 30 * DAY },
  { label: "1 to 6 months", short: "<6mo", max: 182 * DAY },
  { label: "Over 6 months", short: "6mo+", max: Infinity },
];

/** Counts per duration bucket, from under an hour to over six months. */
export function bucketDurations(values: number[]) {
  return BUCKETS.map((bucket, index) => ({
    label: bucket.label,
    short: bucket.short,
    count: values.filter((value) => value < bucket.max && (index === 0 || value >= BUCKETS[index - 1].max)).length,
  }));
}

/** Age buckets for items still open. */
export function bucketAges(createdAt: string[], now: number) {
  return bucketDurations(createdAt.map((value) => now - Date.parse(value)));
}

// ── Weekly cohorts ─────────────────────────────────────────

/** Monday 00:00 UTC of the week containing `time`. */
export function weekStart(time: number) {
  const date = new Date(time);
  const day = (date.getUTCDay() + 6) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day);
}

function dayStart(time: number) {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Items opened per period, split by their state now. Built from a sample of
 * the most recently created items, so periods before the oldest sampled item
 * are dropped rather than shown as empty. Busy repos whose sample spans under
 * three weeks get daily periods instead of weekly ones.
 */
export function cohorts<T extends { createdAt: string }>(
  items: T[],
  stateOf: (item: T) => string,
  states: string[],
  maxWeeks: number,
  now: number,
) {
  if (items.length === 0) return { unit: "week" as const, rows: [] };
  const oldest = Math.min(...items.map((item) => Date.parse(item.createdAt)));
  const unit = now - oldest < 21 * DAY ? ("day" as const) : ("week" as const);
  const [startOf, step] = unit === "day" ? [dayStart, DAY] : [weekStart, WEEK];
  const first = Math.max(startOf(now) - (maxWeeks * WEEK - step), startOf(oldest));
  const rows = new Map<number, Record<string, number>>();
  for (let period = first; period <= startOf(now); period += step) {
    rows.set(period, Object.fromEntries(states.map((state) => [state, 0])));
  }
  for (const item of items) {
    const row = rows.get(startOf(Date.parse(item.createdAt)));
    const state = stateOf(item);
    if (row && state in row) row[state] += 1;
  }
  return {
    unit,
    rows: Array.from(rows, ([period, counts]) => ({ period: new Date(period).toISOString().slice(0, 10), ...counts })),
  };
}

// ── People ─────────────────────────────────────────────────

export function authorMix(items: Array<{ authorKind: AuthorKind }>) {
  const counts: Record<AuthorKind, number> = { maintainer: 0, contributor: 0, "first-timer": 0, bot: 0 };
  for (const item of items) counts[item.authorKind] += 1;
  return counts;
}

export function topAuthors(items: Array<{ author: string; authorKind: AuthorKind }>, limit: number) {
  const counts = new Map<string, { author: string; kind: AuthorKind; count: number }>();
  for (const item of items) {
    const entry = counts.get(item.author) ?? { author: item.author, kind: item.authorKind, count: 0 };
    entry.count += 1;
    counts.set(item.author, entry);
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author))
    .slice(0, limit);
}

/** Most used labels on open issues. */
export function topLabels(issues: Issue[], limit: number) {
  const counts = new Map<string, { name: string; color: string; count: number }>();
  for (const issue of issues) {
    if (issue.state !== "open") continue;
    for (const label of issue.labels) {
      const entry = counts.get(label.name) ?? { ...label, count: 0 };
      entry.count += 1;
      counts.set(label.name, entry);
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ── Punch card ─────────────────────────────────────────────

/** Busiest weekday/hour, weekend share and per-day totals from a 7×24 grid (Sunday first). */
export function punchCardSummary(grid: number[][]) {
  let peak = { day: 0, hour: 0, commits: 0 };
  const byDay = grid.map((hours) => hours.reduce((sum, value) => sum + value, 0));
  grid.forEach((hours, day) =>
    hours.forEach((commits, hour) => {
      if (commits > peak.commits) peak = { day, hour, commits };
    }),
  );
  const total = byDay.reduce((sum, value) => sum + value, 0);
  return { peak, byDay, total, weekendShare: total === 0 ? 0 : (byDay[0] + byDay[6]) / total };
}

// ── Languages ──────────────────────────────────────────────

// GitHub linguist colours for common languages; others get a neutral grey.
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Rust: "#dea584", Go: "#00ADD8",
  Java: "#b07219", Kotlin: "#A97BFF", Swift: "#F05138", "Objective-C": "#438eff", C: "#555555",
  "C++": "#f34b7d", "C#": "#178600", Ruby: "#701516", PHP: "#4F5D95", Scala: "#c22d40",
  Elixir: "#6e4a7e", Erlang: "#B83998", Haskell: "#5e5086", OCaml: "#ef7a08", Clojure: "#db5855",
  Dart: "#00B4AB", Lua: "#000080", R: "#198CE7", Julia: "#a270ba", Perl: "#0298c3",
  Shell: "#89e051", PowerShell: "#012456", Batchfile: "#C1F12E", HTML: "#e34c26", CSS: "#563d7c",
  SCSS: "#c6538c", Vue: "#41b883", Svelte: "#ff3e00", Astro: "#ff5a03", MDX: "#fcb32c",
  "Jupyter Notebook": "#DA5B0B", Dockerfile: "#384d54", Makefile: "#427819", CMake: "#DA3434",
  HCL: "#844FBA", Nix: "#7e7eff", Zig: "#ec915c", Solidity: "#AA6746", TeX: "#3D6117",
  PLpgSQL: "#336790", TSQL: "#e38c00", SQL: "#e38c00", Jinja: "#a52a22", Starlark: "#76d275",
  Assembly: "#6E4C13", Groovy: "#4298b8", Nim: "#ffc200", Crystal: "#000100", "F#": "#b845fc",
};

export function languageColor(name: string) {
  return LANGUAGE_COLORS[name] ?? "#8b949e";
}

/** Language shares, largest first; anything past `limit` is grouped as "Other". */
export function languageShares(languages: Language[], limit = 6) {
  const total = languages.reduce((sum, language) => sum + language.bytes, 0);
  if (total === 0) return [];
  const top = languages.slice(0, limit).map((language) => ({
    name: language.name,
    share: language.bytes / total,
    color: languageColor(language.name),
  }));
  const rest = languages.slice(limit).reduce((sum, language) => sum + language.bytes, 0);
  return rest > 0 ? [...top, { name: "Other", share: rest / total, color: "#6e7681" }] : top;
}
