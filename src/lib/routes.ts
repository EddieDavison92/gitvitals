export type RepoTab = "overview" | "activity" | "pulls" | "issues" | "releases" | "actions" | "traffic";

export const TABS: Array<{ tab: RepoTab; slug: string; label: string }> = [
  { tab: "overview", slug: "", label: "Overview" },
  { tab: "activity", slug: "activity", label: "Activity" },
  { tab: "pulls", slug: "pulls", label: "Pull requests" },
  { tab: "issues", slug: "issues", label: "Issues" },
  { tab: "releases", slug: "releases", label: "Releases" },
  { tab: "actions", slug: "actions", label: "Actions" },
  { tab: "traffic", slug: "traffic", label: "Traffic" },
];

export function tabPath(owner: string, repo: string, tab: RepoTab) {
  const slug = TABS.find((item) => item.tab === tab)?.slug;
  return `/${owner}/${repo}${slug ? `/${slug}` : ""}`;
}

/**
 * Maps the path after /owner/repo to a tab. Canonical slugs render directly;
 * GitHub-style paths (so swapping github.com works) redirect to the closest tab.
 */
export function resolveRepoPath(rest: string[] = []): { tab: RepoTab; redirect: string | null } {
  const [first, second, third] = rest;
  const canonical = TABS.find((item) => item.slug === (first ?? ""));
  if (canonical && rest.length <= 1) return { tab: canonical.tab, redirect: null };

  const to = (tab: RepoTab, query = "") => {
    const slug = TABS.find((item) => item.tab === tab)!.slug;
    return { tab, redirect: `${slug ? `/${slug}` : ""}${query}` };
  };

  if (first === "actions" && second === "runs" && /^\d+$/.test(third ?? "")) return to("actions", `?run=${third}`);
  if (first === "actions") return to("actions");
  if (first === "graphs" && second === "traffic") return to("traffic");
  if (first === "pulse" || first === "graphs" || first === "commits" || first === "network") return to("activity");
  if (first === "pull" || first === "pulls") return to("pulls");
  if (first === "issues") return to("issues");
  if (first === "releases" || first === "tags") return to("releases");
  return to("overview");
}
