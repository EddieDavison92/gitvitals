import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { RecentRepos } from "@/components/recent-repos";
import { RepoPicker } from "@/components/repo-picker";
import { SiteFooter, SiteHeader } from "@/components/site-header";

const EXAMPLES = ["astral-sh/uv", "vercel/next.js", "dbt-labs/dbt-core", "cli/cli"];

const POINTS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "pulse",
    title: "Is it maintained?",
    body: "A verdict from a year of commits, release cadence, merge times and CI on the default branch.",
  },
  {
    icon: "git-merge",
    title: "How fast does it move?",
    body: "Time to merge and to close issues, weekly throughput by outcome, and what's been waiting longest.",
  },
  {
    icon: "people",
    title: "Who builds it?",
    body: "Top contributors, bus factor, and how much work comes from maintainers, outside contributors and bots.",
  },
  {
    icon: "workflow",
    title: "Is CI green?",
    body: "Workflow health on main, failures with their cause, durations, and live updates while runs are active.",
  },
  {
    icon: "compare",
    title: "Compare before you depend",
    body: "Put up to four repositories side by side and see which is healthier on every measure.",
  },
  {
    icon: "lock",
    title: "Free and private",
    body: "Runs in your browser against GitHub's API. No account; an optional token stays on your device.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas text-fg">
      <SiteHeader showPicker={false} />

      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_400px_at_50%_-10%,var(--info-soft),transparent)]"
        />
        <div className="relative mx-auto max-w-2xl px-5 pb-16 pt-20 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-info-fg">Free · no sign-in</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Vital signs for any GitHub repo</h1>
          <p className="mt-4 text-base leading-7 text-fg-muted">
            See whether a project is alive, how quickly it merges and ships, who maintains it and whether CI is green. Paste a
            repository to start.
          </p>

          <div className="mt-8">
            <RepoPicker />
          </div>
          <div className="mt-4">
            <RecentRepos examples={EXAMPLES} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-subtle">
            <Link href="/compare" className="flex items-center gap-1.5 font-medium text-info-fg hover:underline">
              <Icon name="compare" className="size-3.5" />
              Compare repositories
            </Link>
            <span>
              Tip: swap <span className="font-mono text-fg-muted">github.com</span> for this site&apos;s address in any repo URL.
            </span>
          </div>
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

      <SiteFooter />
    </main>
  );
}
