import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "gitvitals: vital signs for any GitHub repository";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "gitvitals",
    title: "Vital signs for any GitHub repo",
    subtitle: "Activity, pull requests, issues, releases and CI health.",
  });
}
