import Link from "next/link";
import { Icon } from "@/components/icon";
import { RepoPicker } from "@/components/repo-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { TokenSettings } from "@/components/token-settings";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-sky-300 shadow-inner ${className}`}>
      <Icon name="activity" className="size-5" />
    </span>
  );
}

/** Dark top bar shared by every page. */
export function SiteHeader({ showPicker = true }: { showPicker?: boolean }) {
  return (
    <header className="border-b border-white/10 bg-chrome text-white">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="gitvitals home">
          <BrandMark />
          <span className="text-base font-semibold tracking-tight">
            git<span className="text-sky-300">vitals</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {showPicker && <RepoPicker variant="compact" />}
          <Link
            href="/compare"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:flex"
          >
            <Icon name="compare" className="size-3.5" />
            Compare
          </Link>
          <ThemeToggle />
          <TokenSettings />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line py-6 text-center text-xs text-fg-subtle">
      gitvitals reads the GitHub API from your browser. Not affiliated with GitHub.{" "}
      <a href="https://github.com/EddieDavison92/gitvitals" className="font-medium text-fg-muted hover:text-fg">
        Source
      </a>
    </footer>
  );
}
