import { describe, expect, it } from "vitest";
import { isValidRepo, parseRepo } from "./parse-repo";

describe("parseRepo", () => {
  it.each([
    ["cli/cli", "cli", "cli"],
    ["  astral-sh/uv  ", "astral-sh", "uv"],
    ["https://github.com/vercel/next.js", "vercel", "next.js"],
    ["github.com/vercel/next.js/actions/runs/123?check_suite_focus=true", "vercel", "next.js"],
    ["https://www.github.com/a/b#readme", "a", "b"],
    ["git@github.com:EddieDavison92/gh-actions-observability.git", "EddieDavison92", "gh-actions-observability"],
    ["https://github.com/owner/repo.git", "owner", "repo"],
  ])("parses %s", (input, owner, repo) => {
    expect(parseRepo(input)).toEqual({ owner, repo });
  });

  it.each(["", "cli", "https://gitlab.com/a/b", "-bad/repo", "owner/..", "a b/c"])(
    "rejects %s",
    (input) => {
      expect(parseRepo(input)).toBeNull();
    },
  );
});

describe("isValidRepo", () => {
  it("allows dots, underscores and hyphens in repo names", () => {
    expect(isValidRepo("owner", "my_repo.js-2")).toBe(true);
  });

  it("rejects owners longer than 39 characters", () => {
    expect(isValidRepo("a".repeat(40), "repo")).toBe(false);
  });
});
