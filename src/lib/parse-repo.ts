const OWNER = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const REPO = /^[\w.-]{1,100}$/;

export function isValidRepo(owner: string, repo: string) {
  return OWNER.test(owner) && REPO.test(repo) && repo !== "." && repo !== "..";
}

/**
 * Accepts `owner/repo`, a github.com URL (any subpath) or an SSH remote.
 * Returns null when the input doesn't name a repo.
 */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^git@github\.com:/i, "")
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/[?#].*$/, "");
  const [owner, rawRepo] = cleaned.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");
  return owner && repo && isValidRepo(owner, repo) ? { owner, repo } : null;
}
