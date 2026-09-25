import { describe, expect, it } from "vitest";
import { formatCompact, formatDuration, formatPercent, formatRelativeTime, formatSpan } from "./format";

describe("formatSpan", () => {
  it.each([
    [5 * 60_000, "5 minutes"],
    [3 * 3_600_000, "3 hours"],
    [3 * 86_400_000, "3 days"],
    [21 * 86_400_000, "3 weeks"],
    [120 * 86_400_000, "4 months"],
    [800 * 86_400_000, "2 years"],
    [0, "1 minute"],
  ])("%d ms → %s", (ms, text) => {
    expect(formatSpan(ms)).toBe(text);
  });
});

describe("formatters", () => {
  it("formats run durations", () => {
    expect(formatDuration(65_000)).toBe("1m 5s");
    expect(formatDuration(3_600_000)).toBe("1h");
  });

  it("formats compact counts", () => {
    expect(formatCompact(1234)).toBe("1.2K");
    expect(formatPercent(0.0004, 1)).toBe("<0.1%");
    expect(formatPercent(0.5)).toBe("50%");
  });

  it("says just now for recent times", () => {
    expect(formatRelativeTime(1_000, 10_000)).toBe("just now");
    expect(formatRelativeTime(0, 2 * 3_600_000)).toBe("2 hours ago");
    expect(formatRelativeTime(0, 90 * 86_400_000)).toBe("3 months ago");
    expect(formatRelativeTime(0, 764 * 86_400_000)).toBe("2 years ago");
  });
});
