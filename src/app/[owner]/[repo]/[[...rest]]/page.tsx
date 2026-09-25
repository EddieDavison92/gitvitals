import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RepoShell } from "@/components/repo/repo-shell";
import { parseDashboardState } from "@/lib/dashboard-state";
import { isValidRepo } from "@/lib/parse-repo";
import { resolveRepoPath, TABS } from "@/lib/routes";

type Props = {
  params: Promise<{ owner: string; repo: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, rest } = await params;
  const { tab } = resolveRepoPath(rest);
  const section = tab === "overview" ? "" : ` · ${TABS.find((item) => item.tab === tab)?.label}`;
  const title = `${owner}/${repo}${section} · gitvitals`;
  const description = `Activity, pull requests, issues, releases and CI health for ${owner}/${repo}.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RepoPage({ params, searchParams }: Props) {
  const { owner, repo, rest } = await params;
  const cleanRepo = repo.replace(/\.git$/i, "");
  if (!isValidRepo(owner, cleanRepo)) notFound();

  const { tab, redirect: target } = resolveRepoPath(rest);
  if (target !== null || cleanRepo !== repo) redirect(`/${owner}/${cleanRepo}${target ?? ""}`);

  return (
    <RepoShell
      key={`${owner}/${repo}`.toLowerCase()}
      owner={owner}
      repo={repo}
      tab={tab}
      actionsState={parseDashboardState(tab === "actions" ? await searchParams : {})}
    />
  );
}
