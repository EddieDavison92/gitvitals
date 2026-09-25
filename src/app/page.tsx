import { HomeView } from "@/components/home-view";
import { SiteShell } from "@/components/shell/site-shell";

export default function Home() {
  return (
    <SiteShell section="home" crumbs={[{ label: "Home" }]}>
      <HomeView />
    </SiteShell>
  );
}
