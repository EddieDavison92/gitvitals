import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, parseDashboardState, serializeDashboardState } from "./dashboard-state";

describe("dashboard state", () => {
  it("round-trips non-default values", () => {
    const state = { ...DEFAULT_STATE, period: "30d" as const, workflow: "CI build", pr: "12", view: "failed" as const, run: 42 };
    const query = serializeDashboardState(state);
    expect(query).toBe("period=30d&workflow=CI+build&pr=12&view=failed&run=42");
    expect(parseDashboardState(Object.fromEntries(new URLSearchParams(query)))).toEqual(state);
  });

  it("omits defaults", () => {
    expect(serializeDashboardState(DEFAULT_STATE)).toBe("");
  });

  it("falls back to defaults for invalid values", () => {
    expect(parseDashboardState({ period: "1y", view: "weird", pr: "abc", run: "-3", branch: "  " })).toEqual(DEFAULT_STATE);
  });

  it("takes the first of repeated params", () => {
    expect(parseDashboardState({ period: ["24h", "7d"] }).period).toBe("24h");
  });
});
