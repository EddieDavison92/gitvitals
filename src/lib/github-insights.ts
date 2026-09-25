import { GitHubError, type Fetcher } from "./github";

/** GitHub's statistics endpoints answer 202 while they compute; callers retry later. */
export class StatsPendingError extends Error {
  constructor() {
    super("GitHub is still computing these statistics.");
  }
}

/** Stats payload, or null when GitHub won't compute it (repos with 10,000+ commits get 422). */
async function stats<T>(get: Fetcher, path: string): Promise<T | null> {
  try {
    const data = await get.maybe<T>(path);
    if (data === null || (typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 0)) {
      throw new StatsPendingError();
    }
    return data;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 422) return null;
    throw error;
  }
}

function isBotLogin(login: string, type?: string) {
  return type === "Bot" || login.endsWith("[bot]");
}

// ── Languages ──────────────────────────────────────────────

/** Bytes of code per language, largest first. */
export async function fetchLanguages(get: Fetcher, repo: string) {
  const raw = await get<Record<string, number>>(`/repos/${repo}/languages`);
  return Object.entries(raw)
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}
export type Language = Awaited<ReturnType<typeof fetchLanguages>>[number];

// ── Commit statistics ──────────────────────────────────────

export type CommitWeek = {
  /** Unix seconds for the start of the week (Sunday). */
  week: number;
  total: number;
  /** Commits per day, Sunday first. */
  days: number[];
};

/** Commits per week for the last 52 weeks, oldest first. */
export async function fetchCommitActivity(get: Fetcher, repo: string): Promise<CommitWeek[]> {
  return (await stats<CommitWeek[]>(get, `/repos/${repo}/stats/commit_activity`)) ?? [];
}

/** Commits by weekday (Sunday = 0) and hour, as a 7×24 grid. */
export async function fetchPunchCard(get: Fetcher, repo: string): Promise<number[][]> {
  const raw = (await stats<Array<[number, number, number]>>(get, `/repos/${repo}/stats/punch_card`)) ?? [];
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const [day, hour, commits] of raw) grid[day][hour] = commits;
  return grid;
}

/** Weekly commits for the last 52 weeks: everyone, and the repo owner alone. */
export async function fetchParticipation(get: Fetcher, repo: string) {
  return (await stats<{ all: number[]; owner: number[] }>(get, `/repos/${repo}/stats/participation`)) ?? { all: [], owner: [] };
}
export type Participation = Awaited<ReturnType<typeof fetchParticipation>>;

/** Weekly lines added and deleted; null for repos too large for GitHub to compute. */
export async function fetchCodeFrequency(get: Fetcher, repo: string) {
  const raw = await stats<Array<[number, number, number]>>(get, `/repos/${repo}/stats/code_frequency`);
  return raw?.map(([week, additions, deletions]) => ({ week, additions, deletions: Math.abs(deletions) })) ?? null;
}
export type CodeWeek = NonNullable<Awaited<ReturnType<typeof fetchCodeFrequency>>>[number];

// ── Contributors ───────────────────────────────────────────

/** Top 100 contributors by all-time commits to the default branch. */
export async function fetchContributors(get: Fetcher, repo: string) {
  const raw =
    (await get.maybe<Array<{ login: string; avatar_url: string; html_url: string; contributions: number; type: string }>>(
      `/repos/${repo}/contributors?per_page=100`,
    )) ?? [];
  return raw.map((person) => ({
    login: person.login,
    avatarUrl: person.avatar_url,
    url: person.html_url,
    commits: person.contributions,
    isBot: isBotLogin(person.login, person.type),
  }));
}
export type Contributor = Awaited<ReturnType<typeof fetchContributors>>[number];

// ── Community profile ──────────────────────────────────────

export async function fetchCommunity(get: Fetcher, repo: string) {
  type File = { url?: string; html_url?: string } | null;
  const raw = await get<{
    health_percentage: number;
    description: string | null;
    documentation: string | null;
    files: Record<string, File>;
  }>(`/repos/${repo}/community/profile`);
  const has = (key: string) => Boolean(raw.files?.[key]);
  const link = (key: string) => raw.files?.[key]?.html_url ?? null;
  return {
    healthPercentage: raw.health_percentage,
    items: [
      { key: "readme", label: "README", present: has("readme"), url: link("readme") },
      { key: "license", label: "Licence", present: has("license"), url: link("license") },
      { key: "contributing", label: "Contributing guide", present: has("contributing"), url: link("contributing") },
      { key: "code_of_conduct", label: "Code of conduct", present: has("code_of_conduct") || has("code_of_conduct_file"), url: link("code_of_conduct_file") ?? link("code_of_conduct") },
      { key: "issue_template", label: "Issue templates", present: has("issue_template"), url: link("issue_template") },
      { key: "pull_request_template", label: "Pull request template", present: has("pull_request_template"), url: link("pull_request_template") },
      { key: "description", label: "Description", present: Boolean(raw.description), url: null },
    ],
  };
}
export type Community = Awaited<ReturnType<typeof fetchCommunity>>;

// ── Releases ───────────────────────────────────────────────

export async function fetchReleases(get: Fetcher, repo: string, perPage: number) {
  const raw = await get<
    Array<{
      tag_name: string;
      name: string | null;
      html_url: string;
      draft: boolean;
      prerelease: boolean;
      published_at: string | null;
      created_at: string;
      author: { login: string } | null;
      assets: Array<{ download_count: number }>;
    }>
  >(`/repos/${repo}/releases?per_page=${perPage}`);
  return raw
    .filter((release) => !release.draft)
    .map((release) => ({
      tag: release.tag_name,
      name: release.name || release.tag_name,
      url: release.html_url,
      prerelease: release.prerelease,
      publishedAt: release.published_at ?? release.created_at,
      author: release.author?.login ?? null,
      assets: release.assets.length,
      downloads: release.assets.reduce((sum, asset) => sum + asset.download_count, 0),
    }));
}
export type Release = Awaited<ReturnType<typeof fetchReleases>>[number];

// ── Pull requests and issues ───────────────────────────────

/** How the author relates to the repo: maintainers vs outside contributors vs bots. */
export type AuthorKind = "maintainer" | "contributor" | "first-timer" | "bot";

function authorKind(association: string, login: string, type?: string): AuthorKind {
  if (isBotLogin(login, type)) return "bot";
  if (["OWNER", "MEMBER", "COLLABORATOR"].includes(association)) return "maintainer";
  if (["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER"].includes(association)) return "first-timer";
  return "contributor";
}

type RawUser = { login: string; type?: string } | null;
type RawLabel = { name: string; color: string };

/** Most recently created pull requests (any state), up to `pages` × 100. */
export async function fetchPulls(get: Fetcher, repo: string, pages: number) {
  const pulls = [];
  for (let page = 1; page <= pages; page += 1) {
    const raw = await get<
      Array<{
        number: number;
        title: string;
        html_url: string;
        state: "open" | "closed";
        draft?: boolean;
        created_at: string;
        closed_at: string | null;
        merged_at: string | null;
        user: RawUser;
        author_association: string;
        labels: RawLabel[];
      }>
    >(`/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
    pulls.push(
      ...raw.map((pr) => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.merged_at ? ("merged" as const) : pr.state,
        draft: pr.draft ?? false,
        createdAt: pr.created_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
        author: pr.user?.login ?? "ghost",
        authorKind: authorKind(pr.author_association, pr.user?.login ?? "ghost", pr.user?.type),
        labels: pr.labels.map((label) => label.name),
      })),
    );
    if (raw.length < 100) break;
  }
  return pulls;
}
export type Pull = Awaited<ReturnType<typeof fetchPulls>>[number];

/**
 * Most recently created issues (any state), up to `pages` × 100. Uses search
 * because the issues endpoint mixes in pull requests, which can crowd issues
 * out of a page entirely on busy repos.
 */
export async function fetchIssues(get: Fetcher, repo: string, pages: number) {
  const issues = [];
  const q = encodeURIComponent(`repo:${repo} is:issue`);
  for (let page = 1; page <= pages; page += 1) {
    const { items: raw } = await get<{
      items: Array<{
        number: number;
        title: string;
        html_url: string;
        state: "open" | "closed";
        state_reason?: string | null;
        created_at: string;
        closed_at: string | null;
        comments: number;
        user: RawUser;
        author_association: string;
        labels: RawLabel[];
      }>;
    }>(`/search/issues?q=${q}&sort=created&order=desc&per_page=100&page=${page}`);
    issues.push(
      ...raw.map((issue) => ({
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          notPlanned: issue.state_reason === "not_planned",
          createdAt: issue.created_at,
          closedAt: issue.closed_at,
          comments: issue.comments,
          author: issue.user?.login ?? "ghost",
          authorKind: authorKind(issue.author_association, issue.user?.login ?? "ghost", issue.user?.type),
          labels: issue.labels.map((label) => ({ name: label.name, color: `#${label.color}` })),
        })),
    );
    if (raw.length < 100) break;
  }
  return issues;
}
export type Issue = Awaited<ReturnType<typeof fetchIssues>>[number];

// ── Search counts ──────────────────────────────────────────

type SearchItem = {
  created_at: string;
  closed_at: string | null;
  user: RawUser;
  pull_request?: { merged_at: string | null };
};

function search(get: Fetcher, repo: string, qualifiers: string, perPage: number) {
  const q = encodeURIComponent(`repo:${repo} ${qualifiers}`);
  return get<{ total_count: number; items: SearchItem[] }>(`/search/issues?q=${q}&per_page=${perPage}&sort=updated&order=desc`);
}

/** Total matching issues/PRs for a search qualifier. Uses the separate search rate limit. */
export async function searchCount(get: Fetcher, repo: string, qualifiers: string) {
  return (await search(get, repo, qualifiers, 1)).total_count;
}

/**
 * Throughput over the last `days`: counts plus merge and close times for up to
 * 100 recently merged PRs and completed issues. Five search requests, which
 * count against the separate search limit (10 a minute anonymously).
 */
export async function fetchFlow(get: Fetcher, repo: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const span = (start: string, end: string | null | undefined) => (end ? Date.parse(end) - Date.parse(start) : -1);

  const [merged, completed, openIssues, openPulls, openedIssues] = await Promise.all([
    search(get, repo, `is:pr is:merged merged:>=${since}`, 100),
    search(get, repo, `is:issue is:closed reason:completed closed:>=${since}`, 100),
    searchCount(get, repo, "is:issue is:open"),
    searchCount(get, repo, "is:pr is:open"),
    searchCount(get, repo, `is:issue created:>=${since}`),
  ]);

  return {
    days,
    openIssues,
    openPulls,
    openedIssues,
    merged: {
      total: merged.total_count,
      byBots: merged.items.filter((item) => isBotLogin(item.user?.login ?? "", item.user?.type)).length,
      durations: merged.items.map((item) => span(item.created_at, item.pull_request?.merged_at)).filter((ms) => ms >= 0),
    },
    completed: {
      total: completed.total_count,
      durations: completed.items.map((item) => span(item.created_at, item.closed_at)).filter((ms) => ms >= 0),
    },
  };
}
export type Flow = Awaited<ReturnType<typeof fetchFlow>>;

// ── Traffic (push access only) ─────────────────────────────

export async function fetchTraffic(get: Fetcher, repo: string) {
  type Series = { count: number; uniques: number; views?: Day[]; clones?: Day[] };
  type Day = { timestamp: string; count: number; uniques: number };
  const [views, clones, referrers, paths] = await Promise.all([
    get<Series>(`/repos/${repo}/traffic/views`),
    get<Series>(`/repos/${repo}/traffic/clones`),
    get<Array<{ referrer: string; count: number; uniques: number }>>(`/repos/${repo}/traffic/popular/referrers`),
    get<Array<{ path: string; title: string; count: number; uniques: number }>>(`/repos/${repo}/traffic/popular/paths`),
  ]);
  const days = (series: Day[] | undefined) =>
    (series ?? []).map((day) => ({ day: day.timestamp.slice(0, 10), count: day.count, uniques: day.uniques }));
  return {
    views: { count: views.count, uniques: views.uniques, days: days(views.views) },
    clones: { count: clones.count, uniques: clones.uniques, days: days(clones.clones) },
    referrers,
    paths,
  };
}
export type Traffic = Awaited<ReturnType<typeof fetchTraffic>>;

/** The oldest still-open issues or pull requests (one search request). */
export async function fetchOldestOpen(get: Fetcher, repo: string, kind: "issue" | "pr", limit = 10) {
  const q = encodeURIComponent(`repo:${repo} is:${kind} is:open`);
  const raw = await get<{
    total_count: number;
    items: Array<{
      number: number;
      title: string;
      html_url: string;
      created_at: string;
      updated_at: string;
      comments: number;
      draft?: boolean;
      user: RawUser;
      author_association: string;
      labels: RawLabel[];
    }>;
  }>(`/search/issues?q=${q}&sort=created&order=asc&per_page=${limit}`);
  return raw.items.map((item) => ({
    number: item.number,
    title: item.title,
    url: item.html_url,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    comments: item.comments,
    draft: item.draft ?? false,
    author: item.user?.login ?? "ghost",
    authorKind: authorKind(item.author_association, item.user?.login ?? "ghost", item.user?.type),
    labels: item.labels.map((label) => ({ name: label.name, color: `#${label.color}` })),
  }));
}
export type OpenItem = Awaited<ReturnType<typeof fetchOldestOpen>>[number];
