import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "Repository vital signs on gitvitals";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return ogCard({
    eyebrow: "gitvitals",
    muted: `${owner}/`,
    title: repo,
    subtitle: "Activity, pull requests, issues, releases and CI health",
  });
}
