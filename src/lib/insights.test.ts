import { describe, expect, it } from "vitest";
import type { CommitWeek, Contributor, Issue, Pull, Release } from "./github-insights";
import {
  activityLevel,
  authorMix,
  bucketDurations,
  busFactor,
  closeDurations,
  languageShares,
  mergeDurations,
  punchCardSummary,
  releaseCadence,
  semverBump,
  topLabels,
  cohorts,
  weekStart,
} from "./insights";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 24, 12); // Thursday

const weeks = (totals: number[]): CommitWeek[] =>
  totals.map((total, index) => ({ week: index * 604_800, total, days: [total, 0, 0, 0, 0, 0, 0] }));

describe("activityLevel", () => {
  it.each([
    [Array(12).fill(3), "very-active"],
    [[...Array(6).fill(0), ...Array(6).fill(1)], "active"],
    [[...Array(11).fill(0), 1], "occasional"],
    [[5, ...Array(51).fill(0)], "quiet"],
    [Array(52).fill(0), "dormant"],
    [[], "unknown"],
  ])("classifies %j as %s", (totals, level) => {
    expect(activityLevel(weeks(totals)).level).toBe(level);
  });

  it("reports archived repos as archived regardless of commits", () => {
    expect(activityLevel(weeks(Array(12).fill(5)), true).level).toBe("archived");
  });

  it("finds the most recent active week", () => {
    expect(activityLevel(weeks([1, 0, 2, 0])).lastActiveWeek).toBe(2 * 604_800_000);
  });
});

describe("busFactor", () => {
  const person = (login: string, commits: number, isBot = false): Contributor => ({
    login,
    commits,
    isBot,
    avatarUrl: "",
    url: "",
  });

  it("counts people covering half the commits, ignoring bots", () => {
    const result = busFactor([person("dependabot[bot]", 900, true), person("a", 50), person("b", 30), person("c", 20)]);
    expect(result).toMatchObject({ factor: 1, humans: 3, total: 100, topShare: 0.5 });
    expect(busFactor([person("a", 30), person("b", 30), person("c", 40)])?.factor).toBe(2);
  });

  it("is null without human commits", () => {
    expect(busFactor([])).toBeNull();
  });
});

describe("releaseCadence", () => {
  const release = (tag: string, daysAgo: number, prerelease = false): Release => ({
    tag,
    name: tag,
    url: "",
    prerelease,
    publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
    author: null,
    assets: 0,
    downloads: 0,
  });

  it("measures time since the latest release and the median gap", () => {
    const cadence = releaseCadence([release("v1.2.0", 30), release("v1.3.0-rc1", 2, true), release("v1.1.0", 60)], NOW);
    expect(cadence.latest?.tag).toBe("v1.3.0-rc1");
    expect(cadence.latestStable?.tag).toBe("v1.2.0");
    expect(cadence.daysSinceLatest).toBeCloseTo(2);
    expect(cadence.medianGapDays).toBeCloseTo(29);
    expect(cadence.lastYear).toBe(3);
  });
});

describe("semverBump", () => {
  it.each([
    ["v1.2.3", "v2.0.0", "major"],
    ["1.2.3", "1.3.0", "minor"],
    ["v1.2.3", "v1.2.4", "patch"],
    ["release-5", "v1.0.0", null],
    ["v1.2", "v1.2.0", null],
  ])("%s → %s is %s", (a, b, bump) => {
    expect(semverBump(a, b)).toBe(bump);
  });
});

describe("durations", () => {
  const pull = (created: number, merged: number | null): Pull => ({
    number: 1,
    title: "",
    url: "",
    state: merged === null ? "open" : "merged",
    draft: false,
    createdAt: new Date(created).toISOString(),
    closedAt: merged === null ? null : new Date(merged).toISOString(),
    mergedAt: merged === null ? null : new Date(merged).toISOString(),
    author: "a",
    authorKind: "contributor",
    labels: [],
  });

  it("measures merge times for merged pull requests only", () => {
    expect(mergeDurations([pull(0, DAY), pull(0, null)])).toEqual([DAY]);
  });

  it("skips issues closed as not planned", () => {
    const issue = (notPlanned: boolean): Issue => ({
      number: 1,
      title: "",
      url: "",
      state: "closed",
      notPlanned,
      createdAt: new Date(0).toISOString(),
      closedAt: new Date(DAY).toISOString(),
      comments: 0,
      author: "a",
      authorKind: "contributor",
      labels: [],
    });
    expect(closeDurations([issue(false), issue(true)])).toEqual([DAY]);
  });

  it("buckets durations from under an hour to over six months", () => {
    expect(bucketDurations([])[0]).toMatchObject({ label: "Under an hour", short: "<1h", count: 0 });
    const buckets = bucketDurations([60_000, 2 * 3_600_000, 2 * DAY, 200 * DAY]);
    expect(buckets.map((bucket) => bucket.count)).toEqual([1, 1, 1, 0, 0, 1]);
  });
});

describe("cohorts", () => {
  const monday = weekStart(NOW);
  const item = (daysAgo: number, state: string) => ({ createdAt: new Date(NOW - daysAgo * DAY).toISOString(), state });

  it("counts items per week by current state, starting at the oldest sampled week", () => {
    const result = cohorts([item(1, "open"), item(40, "merged"), item(39, "closed")], (entry) => entry.state, ["merged", "closed", "open"], 12, NOW);
    expect(result.unit).toBe("week");
    expect(result.rows[0]).toEqual({ period: new Date(weekStart(NOW - 40 * DAY)).toISOString().slice(0, 10), merged: 1, closed: 1, open: 0 });
    expect(result.rows.at(-1)).toEqual({ period: new Date(monday).toISOString().slice(0, 10), merged: 0, closed: 0, open: 1 });
  });

  it("switches to days when the sample spans under three weeks", () => {
    const result = cohorts([item(0, "open"), item(2, "merged")], (entry) => entry.state, ["merged", "open"], 12, NOW);
    expect(result.unit).toBe("day");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({ merged: 1, open: 0 });
  });

  it("starts weeks on Monday UTC", () => {
    expect(new Date(weekStart(NOW)).getUTCDay()).toBe(1);
  });
});

describe("people and labels", () => {
  it("mixes authors by kind", () => {
    expect(authorMix([{ authorKind: "bot" }, { authorKind: "maintainer" }, { authorKind: "bot" }])).toEqual({
      maintainer: 1,
      contributor: 0,
      "first-timer": 0,
      bot: 2,
    });
  });

  it("ranks labels on open issues", () => {
    const issue = (state: "open" | "closed", labels: string[]) =>
      ({ state, labels: labels.map((name) => ({ name, color: "#000" })) }) as Issue;
    expect(topLabels([issue("open", ["bug", "ui"]), issue("open", ["bug"]), issue("closed", ["ui", "ui"])], 5)).toEqual([
      { name: "bug", color: "#000", count: 2 },
      { name: "ui", color: "#000", count: 1 },
    ]);
  });
});

describe("punchCardSummary", () => {
  it("finds the busiest slot and weekend share", () => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    grid[2][14] = 10;
    grid[0][9] = 5;
    grid[6][20] = 5;
    expect(punchCardSummary(grid)).toMatchObject({ peak: { day: 2, hour: 14, commits: 10 }, total: 20, weekendShare: 0.5 });
  });
});

describe("languageShares", () => {
  it("groups small languages as Other", () => {
    const shares = languageShares(
      [
        { name: "TypeScript", bytes: 80 },
        { name: "CSS", bytes: 15 },
        { name: "Shell", bytes: 5 },
      ],
      2,
    );
    expect(shares.map((share) => [share.name, share.share])).toEqual([
      ["TypeScript", 0.8],
      ["CSS", 0.15],
      ["Other", 0.05],
    ]);
  });
});
