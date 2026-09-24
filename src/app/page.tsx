import { Icon, type IconName } from "@/components/icon";
import { RecentRepos } from "@/components/recent-repos";
import { RepoPicker } from "@/components/repo-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { TokenSettings } from "@/components/token-settings";

const EXAMPLES = ["cli/cli", "astral-sh/uv", "dbt-labs/dbt-core", "wnl-icb-analytics/dbt-analytics"];

const POINTS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "branch",
    title: "Is main broken?",
    body: "Each workflow's latest result on the default branch, how long it's been failing and why.",
  },
  {
    icon: "warning",
    title: "Failure-first",
    body: "Failed job, step and error annotations for recent failures, plus a drawer with every job's steps and timings.",
  },
  {
    icon: "pulse",
    title: "Live while runs are active",
    body: "Polls faster while workflows are queued or running, and backs off when nothing is happening.",
  },
  {
    icon: "clock",
    title: "Trends",
    body: "Daily success rate, median and p95 durations, queue time and runs that only passed on re-run.",
  },
  {
    icon: "workflow",
    title: "Nothing to install",
    body: "Your browser reads the GitHub API directly. No server, account or database; links are shareable.",
  },
  {
    icon: "lock",
    title: "Token optional",
    body: "60 requests an hour without one. A read-only token raises that to 5,000 and adds private repos.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas text-fg">
      <header className="border-b border-white/10 bg-chrome text-white">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/10 text-sky-300 shadow-inner">
              <Icon name="workflow" className="size-5" />
            </div>
            <p className="text-sm font-semibold tracking-tight sm:text-base">Actions observability</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <TokenSettings />
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_380px_at_50%_-10%,var(--info-soft),transparent)]"
        />
        <div className="relative mx-auto max-w-2xl px-5 pb-16 pt-20 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-info-fg">GitHub Actions</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">How reliable is a repo&apos;s CI?</h1>
          <p className="mt-4 text-base leading-7 text-fg-muted">
            Success rates, failures and durations for any repository&apos;s workflows, loaded straight from
            GitHub in your browser.
          </p>

          <div className="mt-8">
            <RepoPicker />
          </div>
          <div className="mt-4">
            <RecentRepos examples={EXAMPLES} />
          </div>

          <p className="mt-6 text-xs text-fg-subtle">
            Tip: swap <span className="font-mono text-fg-muted">github.com</span> for this site&apos;s address in any
            repo or run URL.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl flex-1 gap-3 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
        {POINTS.map((point) => (
          <div key={point.title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="grid size-8 place-items-center rounded-lg border border-info-line bg-info-soft text-info-fg">
              <Icon name={point.icon} className="size-4" />
            </div>
            <p className="mt-3 text-sm font-semibold text-fg">{point.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-fg-muted">{point.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-fg-subtle">
        Not affiliated with GitHub. MIT licensed.{" "}
        <a
          href="https://github.com/EddieDavison92/gh-actions-observability"
          className="font-medium text-fg-muted hover:text-fg"
        >
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
