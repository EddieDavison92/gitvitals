import type { Metadata } from "next";
import { CompareView } from "@/components/compare/compare-view";
import { SiteShell } from "@/components/shell/site-shell";
import { parseCompareRepos } from "@/lib/compare";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const repos = parseCompareRepos((await searchParams).repos);
  const title = repos.length > 1 ? `${repos.join(" vs ")} · gitvitals` : "Compare repositories · gitvitals";
  return { title, description: "Side-by-side vital signs for GitHub repositories." };
}

export default async function ComparePage({ searchParams }: Props) {
  const repos = parseCompareRepos((await searchParams).repos);
  return (
    <SiteShell section="compare" crumbs={[{ label: "Compare" }]}>
      <CompareView initial={repos} />
    </SiteShell>
  );
}
