import { parseRepo } from "./parse-repo";

export const MAX_COMPARE = 4;

/** Parses `?repos=a/b,c/d` (or repeated params) into unique `owner/repo` names, at most MAX_COMPARE. */
export function parseCompareRepos(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  const repos = raw
    .split(",")
    .map((item) => parseRepo(item))
    .filter((item): item is { owner: string; repo: string } => item !== null)
    .map((item) => `${item.owner}/${item.repo}`);
  const unique = repos.filter((name, index) => repos.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
  return unique.slice(0, MAX_COMPARE);
}
