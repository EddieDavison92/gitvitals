import { Icon } from "@/components/icon";
import { RecentRepos } from "@/components/recent-repos";
import { RepoPicker } from "@/components/repo-picker";
import { TokenSettings } from "@/components/token-settings";

const EXAMPLES = ["cli/cli", "astral-sh/uv", "dbt-labs/dbt-core", "wnl-icb-analytics/dbt-analytics"];

const POINTS = [
  {
    title: "Nothing to install",
    body: "Your browser reads the public GitHub API directly. There's no server, account or database.",
  },
  {
    title: "Failure-first",
    body: "Recent failures show the failed job, the step and any error annotations, linked to the run.",
  },
  {
    title: "Token optional",
    body: "Anonymous use gets 60 requests an hour. A read-only token raises that to 5,000 and adds private repos.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f6f9] text-slate-950">
      <header className="border-b border-white/10 bg-[#0b1220] text-white">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/10 text-sky-300 shadow-inner">
              <Icon name="workflow" className="size-5" />
            </div>
            <p className="text-sm font-semibold tracking-tight sm:text-base">Actions observability</p>
          </div>
          <TokenSettings />
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 pb-16 pt-20 sm:pt-28">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">GitHub Actions</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          How reliable is a repo&apos;s CI?
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Success rates, recent failures and run durations for any public repository&apos;s
          workflows.
        </p>

        <div className="mt-8">
          <RepoPicker />
        </div>
        <div className="mt-4">
          <RecentRepos examples={EXAMPLES} />
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Tip: swap <span className="font-mono">github.com</span> for this site&apos;s address in any
          repo URL.
        </p>
      </section>

      <section className="mx-auto grid max-w-4xl gap-3 px-5 pb-20 sm:grid-cols-3">
        {POINTS.map((point) => (
          <div
            key={point.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04]"
          >
            <p className="text-sm font-semibold text-slate-900">{point.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">{point.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Not affiliated with GitHub.{" "}
        <a
          href="https://github.com/EddieDavison92/gh-actions-observability"
          className="font-medium text-slate-500 hover:text-slate-700"
        >
          Source
        </a>
      </footer>
    </main>
  );
}
