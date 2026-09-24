import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "GitHub Actions reliability dashboard";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return ogCard({
    eyebrow: "GitHub Actions",
    muted: `${owner}/`,
    title: repo,
    subtitle: "Success rate, failures and durations",
  });
}
