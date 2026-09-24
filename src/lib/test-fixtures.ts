import type { ActionsRun } from "./types";

/** Minimal run for tests; override what the test cares about. */
export function makeRun(overrides: Partial<ActionsRun> = {}): ActionsRun {
  return {
    id: 1,
    attempt: 1,
    name: "Run",
    workflowName: "CI",
    branch: "main",
    event: "push",
    status: "completed",
    conclusion: "success",
    url: "https://github.com/o/r/actions/runs/1",
    actor: "octocat",
    runNumber: 1,
    prNumbers: [],
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:05:00Z",
    startedAt: "2026-09-01T10:00:00Z",
    durationMs: 300_000,
    failureSummary: null,
    failurePoints: [],
    ...overrides,
  };
}
