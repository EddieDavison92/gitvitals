import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeRuns, readCache, repoKey, writeCache, type RepoCache } from "./run-cache";
import { makeRun } from "./test-fixtures";

describe("mergeRuns", () => {
  it("keeps the most recently updated copy of a run", () => {
    const stale = makeRun({ id: 1, status: "in_progress", conclusion: null, updatedAt: "2026-09-01T10:01:00Z" });
    const fresh = makeRun({ id: 1, updatedAt: "2026-09-01T10:05:00Z" });
    expect(mergeRuns([fresh], [stale])).toEqual([fresh]);
    expect(mergeRuns([stale], [fresh])).toEqual([fresh]);
  });

  it("sorts newest-created first", () => {
    const older = makeRun({ id: 1, createdAt: "2026-09-01T10:00:00Z" });
    const newer = makeRun({ id: 2, createdAt: "2026-09-02T10:00:00Z" });
    expect(mergeRuns([older], [newer]).map((run) => run.id)).toEqual([2, 1]);
  });
});

describe("writeCache", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.assign(globalThis, {
      window: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => void store.set(key, value),
          removeItem: (key: string) => void store.delete(key),
        },
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  const cache = (runs = [makeRun()]): RepoCache => ({
    version: 1,
    runs,
    details: {},
    fetchedAt: 0,
    coveredSince: "2026-08-01T00:00:00Z",
    truncated: false,
    pageCap: 3,
  });

  it("round-trips a cache", () => {
    writeCache(repoKey("O", "R"), "O/R", cache());
    expect(readCache("o/r")?.runs).toHaveLength(1);
  });

  it("narrows coverage when trimming to 1,000 runs", () => {
    const runs = Array.from({ length: 1001 }, (_, i) =>
      makeRun({ id: i, createdAt: new Date(Date.UTC(2026, 8, 1) - i * 60_000).toISOString() }),
    );
    writeCache("o/r", "o/r", cache(runs));
    const saved = readCache("o/r");
    expect(saved?.runs).toHaveLength(1000);
    expect(saved?.coveredSince).toBe(runs[999].createdAt);
    expect(saved?.truncated).toBe(true);
  });

  it("keeps the eight most recent repos", () => {
    for (let i = 0; i < 9; i += 1) writeCache(`o/r${i}`, `o/r${i}`, cache());
    expect(readCache("o/r0")).toBeNull();
    expect(readCache("o/r8")).not.toBeNull();
    expect(JSON.parse(store.get("gao:recent") ?? "[]")).toHaveLength(8);
  });
});
