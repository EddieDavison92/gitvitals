import { describe, expect, it } from "vitest";
import { parseCompareRepos } from "./compare";

describe("parseCompareRepos", () => {
  it("parses a comma-separated list, dropping invalid and duplicate entries", () => {
    expect(parseCompareRepos("astral-sh/uv, https://github.com/python-poetry/poetry,nope,ASTRAL-SH/UV")).toEqual([
      "astral-sh/uv",
      "python-poetry/poetry",
    ]);
  });

  it("accepts repeated params and caps the list at four", () => {
    expect(parseCompareRepos(["a/1,a/2", "a/3,a/4,a/5"])).toEqual(["a/1", "a/2", "a/3", "a/4"]);
    expect(parseCompareRepos(undefined)).toEqual([]);
  });
});
