"use client";

import { AppShell, PageBody, type Crumb } from "./app-shell";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";

/** Shell for pages outside a repo (home, compare); server components can use it directly. */
export function SiteShell({
  section,
  crumbs,
  children,
}: {
  section: "home" | "compare";
  crumbs: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <AppShell
      sidebar={(onNavigate) => <Sidebar current={null} section={section} onNavigate={onNavigate} />}
      crumbs={crumbs}
      palette={<CommandPalette current={null} />}
    >
      <PageBody>{children}</PageBody>
    </AppShell>
  );
}
