import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionsDashboard } from "@/components/actions-dashboard";
import { isValidRepo } from "@/lib/parse-repo";

type Props = { params: Promise<{ owner: string; repo: string; rest?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return {
    title: `${owner}/${repo} · Actions observability`,
    description: `GitHub Actions success rate, failures and durations for ${owner}/${repo}.`,
  };
}

export default async function RepoPage({ params }: Props) {
  const { owner, repo, rest } = await params;
  const cleanRepo = repo.replace(/\.git$/i, "");
  if (!isValidRepo(owner, cleanRepo)) notFound();
  // Pasted GitHub paths like /owner/repo/actions/runs/1 land on the repo dashboard.
  if (rest?.length || cleanRepo !== repo) redirect(`/${owner}/${cleanRepo}`);

  return <ActionsDashboard key={`${owner}/${repo}`.toLowerCase()} owner={owner} repo={repo} />;
}
