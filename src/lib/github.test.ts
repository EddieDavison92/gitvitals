import { describe, expect, it } from "vitest";
import { fetchFailureDetail, fetchRuns, type Fetcher } from "./github";
import { makeRun } from "./test-fixtures";

function rawRun(id: number) {
  return {
    id,
    name: "CI",
    display_title: `Run ${id}`,
    head_branch: "main",
    event: "push",
    status: "completed",
    conclusion: "success",
    html_url: `https://github.com/o/r/actions/runs/${id}`,
    actor: { login: "octocat" },
    run_number: id,
    run_attempt: 1,
    pull_requests: [],
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:02:00Z",
    run_started_at: "2026-09-01T10:00:30Z",
  };
}

/** Fake fetcher serving `total` runs, 100 per page, recording requested paths. */
function pagedFetcher(total: number) {
  const paths: string[] = [];
  const get = (async (path: string) => {
    paths.push(path);
    const page = Number(new URL(path, "https://x").searchParams.get("page"));
    const ids = Array.from({ length: 100 }, (_, i) => (page - 1) * 100 + i + 1).filter((id) => id <= total);
    return { total_count: total, workflow_runs: ids.map(rawRun) };
  }) as Fetcher;
  return { get, paths };
}

describe("fetchRuns", () => {
  it("stops after the last page", async () => {
    const { get, paths } = pagedFetcher(250);
    const result = await fetchRuns(get, "o", "r", null, 10);
    expect(result.runs).toHaveLength(250);
    expect(result.truncated).toBe(false);
    expect(paths).toHaveLength(3);
  });

  it("marks results truncated at the page cap and keeps page order", async () => {
    const { get } = pagedFetcher(1000);
    const result = await fetchRuns(get, "o", "r", null, 3);
    expect(result.truncated).toBe(true);
    expect(result.runs.map((run) => run.id)).toEqual(Array.from({ length: 300 }, (_, i) => i + 1));
  });

  it("strips milliseconds from the created filter", async () => {
    const { get, paths } = pagedFetcher(1);
    await fetchRuns(get, "o", "r", "2026-09-01T10:00:00.123Z", 1);
    expect(decodeURIComponent(paths[0])).toContain("created=>=2026-09-01T10:00:00Z");
  });

  it("strips the job id from GitHub-managed dynamic workflow names", async () => {
    const get = (async () => ({
      total_count: 1,
      workflow_runs: [{ ...rawRun(1), event: "dynamic", name: "Graph Update: pip in / #1590783645" }],
    })) as unknown as Fetcher;
    const [run] = (await fetchRuns(get, "o", "r", null, 1)).runs;
    expect(run.workflowName).toBe("Graph Update: pip in /");
  });

  it("drops pull requests from other repositories", async () => {
    const get = (async () => ({
      total_count: 1,
      workflow_runs: [
        {
          ...rawRun(1),
          repository: { id: 1 },
          pull_requests: [
            { number: 141, base: { repo: { id: 2 } } },
            { number: 7, base: { repo: { id: 1 } } },
          ],
        },
      ],
    })) as unknown as Fetcher;
    const [run] = (await fetchRuns(get, "o", "r", null, 1)).runs;
    expect(run.prNumbers).toEqual([7]);
  });

  it("maps run fields", async () => {
    const { get } = pagedFetcher(1);
    const [run] = (await fetchRuns(get, "o", "r", null, 1)).runs;
    expect(run).toMatchObject({ id: 1, attempt: 1, actor: "octocat", durationMs: 90_000, name: "Run 1" });
  });
});

describe("fetchFailureDetail", () => {
  const failedRun = makeRun({ id: 7, attempt: 2, conclusion: "failure" });

  function detailFetcher(jobs: unknown[], annotations: unknown[] = []) {
    const paths: string[] = [];
    const get = (async (path: string) => {
      paths.push(path);
      return path.includes("/annotations") ? annotations : { jobs };
    }) as Fetcher;
    return { get, paths };
  }

  const failedJob = {
    id: 99,
    name: "test",
    conclusion: "failure",
    steps: [
      { name: "Checkout", number: 1, conclusion: "success" },
      { name: "Run tests", number: 2, conclusion: "failure" },
    ],
  };

  it("uses failure annotations and drops exit-code noise", async () => {
    const { get, paths } = detailFetcher(
      [failedJob],
      [
        { annotation_level: "failure", message: "Process completed with exit code 1.", path: ".github" },
        { annotation_level: "failure", message: "Expected 2 to be 3\nstack", path: "src/a.test.ts", start_line: 12 },
        { annotation_level: "warning", message: "Deprecated" },
      ],
    );
    const detail = await fetchFailureDetail(get, "o", "r", failedRun);
    expect(detail.summary).toBe("test: src/a.test.ts:12 Expected 2 to be 3");
    expect(paths[0]).toContain("/actions/runs/7/attempts/2/jobs");
  });

  it("falls back to the failed step", async () => {
    const { get } = detailFetcher([failedJob]);
    expect((await fetchFailureDetail(get, "o", "r", failedRun)).summary).toBe('test: Step "Run tests" failed.');
  });

  it("explains the failed job, not a sibling cancelled because of it", async () => {
    const cancelled = { ...failedJob, id: 98, name: "build", conclusion: "cancelled", steps: [] };
    const { get } = detailFetcher([cancelled, failedJob]);
    expect((await fetchFailureDetail(get, "o", "r", failedRun)).summary).toBe('test: Step "Run tests" failed.');
  });

  it("skips annotations for cancelled jobs", async () => {
    const { get, paths } = detailFetcher([{ ...failedJob, conclusion: "cancelled", steps: [] }]);
    expect((await fetchFailureDetail(get, "o", "r", failedRun)).summary).toBe("test: Cancelled.");
    expect(paths).toHaveLength(1);
  });

  it("makes no requests for startup failures", async () => {
    const { get, paths } = detailFetcher([]);
    const detail = await fetchFailureDetail(get, "o", "r", { ...failedRun, conclusion: "startup_failure" });
    expect(detail.summary).toMatch(/failed to start/);
    expect(paths).toHaveLength(0);
  });
});
