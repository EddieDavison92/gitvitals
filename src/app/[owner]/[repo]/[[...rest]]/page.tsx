import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionsDashboard } from "@/components/dashboard/dashboard";
import { parseDashboardState } from "@/lib/dashboard-state";
import { isValidRepo } from "@/lib/parse-repo";

type Props = {
  params: Promise<{ owner: string; repo: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  const title = `${owner}/${repo} · Actions observability`;
  const description = `GitHub Actions success rate, failures and durations for ${owner}/${repo}.`;
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

  // Pasted GitHub paths land on the dashboard; a run link opens that run.
  if (rest?.length || cleanRepo !== repo) {
    const runId = rest?.[0] === "actions" && rest[1] === "runs" && /^\d+$/.test(rest[2] ?? "") ? rest[2] : null;
    redirect(`/${owner}/${cleanRepo}${runId ? `?run=${runId}` : ""}`);
  }

  return (
    <ActionsDashboard
      key={`${owner}/${repo}`.toLowerCase()}
      owner={owner}
      repo={repo}
      initialState={parseDashboardState(await searchParams)}
    />
  );
}
