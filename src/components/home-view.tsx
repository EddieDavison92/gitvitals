"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { RepoPicker } from "@/components/repo-picker";
import { Avatar, Badge, Panel, TD, TR } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/format";
import type { CommitWeek } from "@/lib/github-insights";
import { activityLevel } from "@/lib/insights";
import { peekResource } from "@/lib/resource-store";
import type { RepoMeta } from "@/lib/types";
import { useRecentRepos } from "@/lib/use-recent-repos";

const EXAMPLES = ["astral-sh/uv", "vercel/next.js", "dbt-labs/dbt-core", "cli/cli", "biomejs/biome"];

const SECTIONS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "home", title: "Overview", body: "Activity verdict, release cadence, merge and close times, CI on the default branch, bus factor." },
  { icon: "activity", title: "Activity", body: "Commit calendar, weekly commits, when people commit, code churn, contributors." },
  { icon: "git-merge", title: "Pull requests", body: "Throughput by outcome, time to merge, community and bot share, oldest open." },
  { icon: "issue", title: "Issues", body: "Opened and completed, time to close, labels, open issue age, most discussed." },
  { icon: "tag", title: "Releases", body: "Timeline by semver bump, gaps between releases, downloads." },
  { icon: "workflow", title: "Actions", body: "Branch health, failures with their cause, durations, run details. Live while runs are active." },
];

export function HomeView() {
  const recent = useRecentRepos();
  return (
    <div className="mx-auto max-w-3xl space-y-8 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Check a repository</h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          Activity, pull requests, issues, releases and CI health for any GitHub repository. It runs in your browser against the
          GitHub API, with no sign-in.
        </p>
        <div className="mt-5">
          <RepoPicker />
        </div>
        <p className="mt-2 text-xs text-fg-subtle">
          Or replace <span className="font-mono">github.com</span> with this site&apos;s address in any repo URL.
        </p>
      </div>

      {recent.length > 0 ? <RecentTable names={recent} /> : null}

      <Panel title="Examples" bodyClassName="flex flex-wrap gap-1.5 p-4">
        {EXAMPLES.map((name) => (
          <Link
            key={name}
            href={`/${name}`}
            className="rounded-md border border-line px-2 py-1 font-mono text-xs text-fg-2 transition-colors hover:border-fg-subtle hover:text-fg"
          >
            {name}
          </Link>
        ))}
        <Link href="/compare?repos=astral-sh/uv,python-poetry/poetry" className="rounded-md px-2 py-1 text-xs text-fg-muted hover:text-fg">
          Compare uv and Poetry →
        </Link>
      </Panel>

      <section>
        <h2 className="text-[13px] font-medium text-fg">What you get</h2>
        <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex gap-3 bg-surface p-4">
              <Icon name={section.icon} className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
              <div>
                <dt className="text-[13px] font-medium text-fg">{section.title}</dt>
                <dd className="mt-0.5 text-xs leading-5 text-fg-muted">{section.body}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function RecentTable({ names }: { names: string[] }) {
  return (
    <Panel title="Recently viewed">
      <table className="w-full">
        <tbody>
          {names.map((name) => {
            const [owner, repo] = name.split("/");
            const meta = peekResource<RepoMeta>(owner, repo, "meta");
            const weeks = peekResource<CommitWeek[]>(owner, repo, "commit-activity");
            const activity = weeks ? activityLevel(weeks, meta?.isArchived ?? false) : null;
            return (
              <tr key={name} className={`${TR} first:border-t-0`}>
                <td className={`${TD} w-full max-w-0`}>
                  <Link href={`/${name}`} className="flex min-w-0 items-center gap-2.5">
                    {meta ? <Avatar src={meta.avatarUrl} alt="" size={18} className="rounded" /> : <span className="size-[18px] shrink-0 rounded bg-surface-3" />}
                    <span className="shrink-0 font-medium text-fg">{name}</span>
                    <span className="truncate text-fg-muted">{meta?.description}</span>
                  </Link>
                </td>
                <td className={`${TD} whitespace-nowrap`}>{activity && <Badge tone={activity.tone}>{activity.label}</Badge>}</td>
                <td className={`${TD} whitespace-nowrap text-right text-xs text-fg-muted tabular-nums`}>
                  {meta && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="star" className="size-3" />
                      {formatCompact(meta.stars)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
