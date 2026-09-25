"use client";

import { fetchBranchRuns, fetchRepoMeta } from "./github";
import {
  fetchCodeFrequency,
  fetchCommitActivity,
  fetchCommunity,
  fetchContributors,
  fetchIssues,
  fetchLanguages,
  fetchOldestOpen,
  fetchParticipation,
  fetchPulls,
  fetchPunchCard,
  fetchReleases,
  fetchFlow,
  fetchTraffic,
} from "./github-insights";
import { useResource, type Loader } from "./resource-store";
import { useToken } from "./token-store";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Each dataset: its cache name, loader and time-to-live. Anonymous cost:
 * overview ≈ 7 core requests + 5 searches; each other tab 1–4 more.
 */
const meta: Loader<Awaited<ReturnType<typeof fetchRepoMeta>>> = (get, repo) => {
  const [owner, name] = repo.split("/");
  return fetchRepoMeta(get, owner, name);
};
const languages: Loader<Awaited<ReturnType<typeof fetchLanguages>>> = (get, repo) => fetchLanguages(get, repo);
const commitActivity: Loader<Awaited<ReturnType<typeof fetchCommitActivity>>> = (get, repo) => fetchCommitActivity(get, repo);
const punchCard: Loader<Awaited<ReturnType<typeof fetchPunchCard>>> = (get, repo) => fetchPunchCard(get, repo);
const participation: Loader<Awaited<ReturnType<typeof fetchParticipation>>> = (get, repo) => fetchParticipation(get, repo);
const codeFrequency: Loader<Awaited<ReturnType<typeof fetchCodeFrequency>>> = (get, repo) => fetchCodeFrequency(get, repo);
const contributors: Loader<Awaited<ReturnType<typeof fetchContributors>>> = (get, repo) => fetchContributors(get, repo);
const community: Loader<Awaited<ReturnType<typeof fetchCommunity>>> = (get, repo) => fetchCommunity(get, repo);
const traffic: Loader<Awaited<ReturnType<typeof fetchTraffic>>> = (get, repo) => fetchTraffic(get, repo);

const releaseLoaders = new Map<number, Loader<Awaited<ReturnType<typeof fetchReleases>>>>();
function releasesLoader(perPage: number) {
  let loader = releaseLoaders.get(perPage);
  if (!loader) releaseLoaders.set(perPage, (loader = (get, repo) => fetchReleases(get, repo, perPage)));
  return loader;
}

const pullLoaders = new Map<number, Loader<Awaited<ReturnType<typeof fetchPulls>>>>();
function pullsLoader(pages: number) {
  let loader = pullLoaders.get(pages);
  if (!loader) pullLoaders.set(pages, (loader = (get, repo) => fetchPulls(get, repo, pages)));
  return loader;
}

const issueLoaders = new Map<number, Loader<Awaited<ReturnType<typeof fetchIssues>>>>();
function issuesLoader(pages: number) {
  let loader = issueLoaders.get(pages);
  if (!loader) issueLoaders.set(pages, (loader = (get, repo) => fetchIssues(get, repo, pages)));
  return loader;
}

const branchRunLoaders = new Map<string, Loader<Awaited<ReturnType<typeof fetchBranchRuns>>>>();
function branchRunsLoader(branch: string) {
  let loader = branchRunLoaders.get(branch);
  if (!loader) {
    branchRunLoaders.set(
      branch,
      (loader = (get, repo) => {
        const [owner, name] = repo.split("/");
        return fetchBranchRuns(get, owner, name, branch);
      }),
    );
  }
  return loader;
}

const oldestPulls: Loader<Awaited<ReturnType<typeof fetchOldestOpen>>> = (get, repo) => fetchOldestOpen(get, repo, "pr");
const oldestIssues: Loader<Awaited<ReturnType<typeof fetchOldestOpen>>> = (get, repo) => fetchOldestOpen(get, repo, "issue");
const flow: Loader<Awaited<ReturnType<typeof fetchFlow>>> = (get, repo) => fetchFlow(get, repo, 30);

export function useRepoMeta(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "meta", meta, { ttlMs: 30 * MINUTE, enabled });
}
export function useLanguages(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "languages", languages, { ttlMs: 24 * HOUR, enabled });
}
export function useCommitActivity(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "commit-activity", commitActivity, { ttlMs: 6 * HOUR, enabled });
}
export function usePunchCard(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "punch-card", punchCard, { ttlMs: 24 * HOUR, enabled });
}
export function useParticipation(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "participation", participation, { ttlMs: 6 * HOUR, enabled });
}
export function useCodeFrequency(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "code-frequency", codeFrequency, { ttlMs: 24 * HOUR, enabled });
}
export function useContributors(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "contributors", contributors, { ttlMs: 24 * HOUR, enabled });
}
export function useCommunity(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "community", community, { ttlMs: 24 * HOUR, enabled });
}
/** Last 30 days: open totals, merged PRs and completed issues with their durations. */
export function useFlow(owner: string, repo: string, enabled = true) {
  return useResource(owner, repo, "flow-30d", flow, { ttlMs: 30 * MINUTE, enabled });
}
export function useReleases(owner: string, repo: string, perPage: 10 | 50, enabled = true) {
  return useResource(owner, repo, `releases-${perPage}`, releasesLoader(perPage), { ttlMs: HOUR, enabled });
}
/** Recent pull requests: 100 anonymously, 300 with a token. */
export function usePulls(owner: string, repo: string) {
  const pages = useToken() ? 3 : 1;
  return useResource(owner, repo, `pulls-${pages}`, pullsLoader(pages), { ttlMs: 15 * MINUTE });
}
/** Recent issues via search: 100 anonymously, 300 with a token. */
export function useIssues(owner: string, repo: string) {
  const pages = useToken() ? 3 : 1;
  return useResource(owner, repo, `issues-search-${pages}`, issuesLoader(pages), { ttlMs: 15 * MINUTE });
}
/** Pass `enabled: false` to read whatever is cached without fetching. */
export function useBranchRuns(owner: string, repo: string, branch: string | null, enabled = true) {
  return useResource(owner, repo, `branch-runs-${branch}`, branchRunsLoader(branch ?? ""), {
    ttlMs: 5 * MINUTE,
    enabled: enabled && branch !== null,
  });
}
export function useTraffic(owner: string, repo: string, enabled: boolean) {
  return useResource(owner, repo, "traffic", traffic, { ttlMs: HOUR, enabled });
}
export function useOldestOpen(owner: string, repo: string, kind: "issue" | "pr") {
  return useResource(owner, repo, `oldest-open-${kind}`, kind === "pr" ? oldestPulls : oldestIssues, { ttlMs: HOUR });
}
