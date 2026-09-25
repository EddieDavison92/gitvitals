import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CACHE_VERSION, mergeRuns, readCache, writeCache, type RepoCache } from "./run-cache";
import { RECENT_REPOS_KEY, touchRecentRepo } from "./storage";
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

describe("storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.assign(globalThis, {
      window: {
        localStorage: {
          get length() {
            return store.size;
          },
          key: (index: number) => Array.from(store.keys())[index] ?? null,
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
    version: CACHE_VERSION,
    runs,
    details: {},
    fetchedAt: 0,
    coveredSince: "2026-08-01T00:00:00Z",
    truncated: false,
    pageCap: 3,
  });

  it("round-trips a cache", () => {
    writeCache("o/r", cache());
    expect(readCache("o/r")?.runs).toHaveLength(1);
  });

  it("narrows coverage when trimming to 1,000 runs", () => {
    const runs = Array.from({ length: 1001 }, (_, i) =>
      makeRun({ id: i, createdAt: new Date(Date.UTC(2026, 8, 1) - i * 60_000).toISOString() }),
    );
    writeCache("o/r", cache(runs));
    const saved = readCache("o/r");
    expect(saved?.runs).toHaveLength(1000);
    expect(saved?.coveredSince).toBe(runs[999].createdAt);
    expect(saved?.truncated).toBe(true);
  });

  it("keeps eight recent repos and clears data for the ones that drop off", () => {
    writeCache("o/r0", cache());
    store.set("gv:r:o/r0:meta", "{}");
    for (let i = 0; i < 9; i += 1) touchRecentRepo(`o/r${i}`);
    expect(JSON.parse(store.get(RECENT_REPOS_KEY) ?? "[]")).toHaveLength(8);
    expect(readCache("o/r0")).toBeNull();
    expect(store.has("gv:r:o/r0:meta")).toBe(false);
  });
});
