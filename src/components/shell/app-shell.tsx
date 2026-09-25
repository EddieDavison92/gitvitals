"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

export type Crumb = { label: React.ReactNode; href?: string };

/**
 * Sidebar + top bar layout. The sidebar is fixed on large screens and a
 * drawer below that; `sidebar` receives a callback that closes the drawer.
 */
export function AppShell({
  sidebar,
  crumbs,
  actions,
  palette,
  children,
}: {
  sidebar: (onNavigate?: () => void) => React.ReactNode;
  crumbs: Crumb[];
  actions?: React.ReactNode;
  /** Rendered once per page (not per sidebar instance). */
  palette?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="min-h-screen bg-canvas text-fg lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-line lg:block">{sidebar()}</aside>
      {palette}

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-[fade-in_120ms_ease-out] dark:bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line shadow-xl">{sidebar(() => setOpen(false))}</aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 grid size-8 place-items-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg lg:hidden"
          >
            <Icon name="menu" className="size-4" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <span key={index} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <span className="text-fg-subtle">/</span>}
                  {crumb.href && !last ? (
                    <Link href={crumb.href} className="truncate text-fg-muted transition-colors hover:text-fg">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`truncate ${last ? "font-medium text-fg" : "text-fg-muted"}`}>{crumb.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-4 py-4 text-xs text-fg-subtle lg:px-6">
          Data comes from the GitHub API, requested by your browser. Not affiliated with GitHub.{" "}
          <a href="https://github.com/EddieDavison92/gitvitals" className="text-fg-muted hover:text-fg">
            Source
          </a>
        </footer>
      </div>
    </div>
  );
}

/** Standard padded content column. */
export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`w-full space-y-5 px-4 py-6 lg:px-6 ${className}`}>{children}</div>;
}
