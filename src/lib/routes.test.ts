import { describe, expect, it } from "vitest";
import { resolveRepoPath, tabPath } from "./routes";

describe("resolveRepoPath", () => {
  it.each([
    [[], "overview"],
    [["activity"], "activity"],
    [["pulls"], "pulls"],
    [["actions"], "actions"],
    [["traffic"], "traffic"],
  ])("renders %j directly as %s", (rest, tab) => {
    expect(resolveRepoPath(rest)).toEqual({ tab, redirect: null });
  });

  it.each([
    [["actions", "runs", "123", "job", "9"], "/actions?run=123"],
    [["actions", "workflows", "ci.yml"], "/actions"],
    [["pulse"], "/activity"],
    [["graphs", "contributors"], "/activity"],
    [["graphs", "traffic"], "/traffic"],
    [["pull", "42", "files"], "/pulls"],
    [["issues", "7"], "/issues"],
    [["releases", "tag", "v1.0.0"], "/releases"],
    [["tree", "main", "src"], ""],
    [["overview"], ""],
  ])("redirects %j to %s", (rest, redirect) => {
    expect(resolveRepoPath(rest).redirect).toBe(redirect);
  });
});

describe("tabPath", () => {
  it("omits the slug for the overview", () => {
    expect(tabPath("o", "r", "overview")).toBe("/o/r");
    expect(tabPath("o", "r", "issues")).toBe("/o/r/issues");
  });
});
