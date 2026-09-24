import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "Actions observability: GitHub Actions reliability for any repository";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Actions observability",
    title: "How reliable is a repo's CI?",
    subtitle: "Success rates, failures and durations for any GitHub repository.",
  });
}
