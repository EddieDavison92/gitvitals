import { describe, expect, it } from "vitest";
import { elapsedMs, queueMs, runTone, statusLabel } from "./run-status";
import {
  branchHealth,
  dailyTrend,
  inferDefaultBranch,
  percentile,
  successRateOf,
  summarizeRuns,
  workflowStats,
} from "./stats";
import { makeRun } from "./test-fixtures";

const at = (day: number, hour = 12) => new Date(Date.UTC(2026, 8, day, hour)).toISOString();

describe("percentile", () => {
  it("interpolates between ranks", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([10, 20, 30], 95)).toBeCloseTo(29);
    expect(percentile([], 50)).toBe(0);
  });
});

describe("successRateOf", () => {
  it("is null when nothing passed or failed", () => {
    expect(successRateOf(0, 0)).toBeNull();
    expect(successRateOf(3, 1)).toBe(75);
  });
});

describe("summarizeRuns", () => {
  it("excludes skipped and cancelled runs from the success rate and durations", () => {
    const summary = summarizeRuns([
      makeRun({ id: 1, conclusion: "success", durationMs: 60_000 }),
      makeRun({ id: 2, conclusion: "failure", durationMs: 120_000 }),
      makeRun({ id: 3, conclusion: "skipped", durationMs: 1_000 }),
      makeRun({ id: 4, conclusion: "cancelled", durationMs: 5_000 }),
      makeRun({ id: 5, status: "in_progress", conclusion: null }),
    ]);
    expect(summary).toMatchObject({ total: 5, successful: 1, failed: 1, active: 1, successRate: 50 });
    expect(summary.medianDurationMs).toBe(90_000);
  });

  it("counts runs that passed only after a re-run", () => {
    const summary = summarizeRuns([
      makeRun({ id: 1, attempt: 2, conclusion: "success" }),
      makeRun({ id: 2, attempt: 3, conclusion: "failure" }),
    ]);
    expect(summary).toMatchObject({ reruns: 2, passedOnRerun: 1 });
  });

  it("ignores re-run attempts for queue time", () => {
    const summary = summarizeRuns([
      makeRun({ id: 1, createdAt: at(1, 10), startedAt: new Date(Date.UTC(2026, 8, 1, 10, 0, 30)).toISOString() }),
      makeRun({ id: 2, attempt: 2, createdAt: at(1, 10), startedAt: at(1, 12) }),
    ]);
    expect(summary.medianQueueMs).toBe(30_000);
  });
});

describe("workflowStats", () => {
  it("puts the most-failing workflow first", () => {
    const stats = workflowStats([
      makeRun({ id: 1, workflowName: "Lint" }),
      makeRun({ id: 2, workflowName: "Test", conclusion: "failure" }),
      makeRun({ id: 3, workflowName: "Test" }),
    ]);
    expect(stats.map((stat) => [stat.workflow, stat.successRate])).toEqual([
      ["Test", 50],
      ["Lint", 100],
    ]);
  });
});

describe("dailyTrend", () => {
  it("groups completed runs by day with duration percentiles", () => {
    const trend = dailyTrend([
      makeRun({ id: 1, updatedAt: at(2), durationMs: 60_000 }),
      makeRun({ id: 2, updatedAt: at(2), conclusion: "failure", durationMs: 180_000 }),
      makeRun({ id: 3, updatedAt: at(1) }),
      makeRun({ id: 4, updatedAt: at(3), status: "in_progress", conclusion: null }),
    ]);
    expect(trend.map((day) => day.day)).toHaveLength(2);
    expect(trend[1]).toMatchObject({ successful: 1, failed: 1, successRate: 50, p50Minutes: 2 });
  });
});

describe("branchHealth", () => {
  it("reports a failing streak since the last pass", () => {
    const health = branchHealth(
      [
        makeRun({ id: 1, workflowName: "CI", createdAt: at(1) }),
        makeRun({ id: 2, workflowName: "CI", createdAt: at(2), conclusion: "failure" }),
        makeRun({ id: 3, workflowName: "CI", createdAt: at(3), conclusion: "skipped" }),
        makeRun({ id: 4, workflowName: "CI", createdAt: at(4), conclusion: "failure" }),
        makeRun({ id: 5, workflowName: "Docs", createdAt: at(4) }),
      ],
      "main",
    );
    expect(health.map((item) => [item.workflow, item.failing, item.streak])).toEqual([
      ["CI", true, 2],
      ["Docs", false, 0],
    ]);
    expect(health[0]).toMatchObject({ failingSince: at(2), streakComplete: true, latest: { id: 4 } });
  });

  it("ignores pull request runs from a fork's main branch", () => {
    const health = branchHealth(
      [makeRun({ id: 1, event: "pull_request", conclusion: "failure" }), makeRun({ id: 2, event: "push" })],
      "main",
    );
    expect(health).toHaveLength(1);
    expect(health[0].failing).toBe(false);
  });

  it("flags streaks that run past the loaded history", () => {
    const [ci] = branchHealth([makeRun({ conclusion: "failure" })], "main");
    expect(ci).toMatchObject({ failing: true, streakComplete: false });
  });
});

describe("inferDefaultBranch", () => {
  it("picks the most common push branch", () => {
    expect(
      inferDefaultBranch([
        makeRun({ id: 1, branch: "main" }),
        makeRun({ id: 2, branch: "main" }),
        makeRun({ id: 3, branch: "dev" }),
        makeRun({ id: 4, branch: "feature", event: "pull_request" }),
      ]),
    ).toBe("main");
    expect(inferDefaultBranch([])).toBeNull();
  });
});

describe("run status", () => {
  it("labels and tones conclusions", () => {
    expect([statusLabel(makeRun({ conclusion: "skipped" })), runTone(makeRun({ conclusion: "skipped" }))]).toEqual([
      "Skipped",
      "idle",
    ]);
    expect(runTone(makeRun({ conclusion: "timed_out" }))).toBe("bad");
    expect(runTone(makeRun({ status: "queued", conclusion: null }))).toBe("warn");
  });

  it("counts elapsed time up for active runs", () => {
    const run = makeRun({ status: "in_progress", conclusion: null, startedAt: at(1, 10) });
    expect(elapsedMs(run, Date.parse(at(1, 11)))).toBe(3_600_000);
    expect(queueMs(makeRun({ attempt: 2 }))).toBeNull();
  });
});
