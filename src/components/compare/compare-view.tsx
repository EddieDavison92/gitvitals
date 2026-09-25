"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Avatar, Badge, BUTTON, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { formatCount, formatRate, formatRelativeTime, formatSpan } from "@/lib/format";
import { activityLevel, busFactor, durationSummary, releaseCadence } from "@/lib/insights";
import { MAX_COMPARE } from "@/lib/compare";
import { parseRepo } from "@/lib/parse-repo";
import {
  useBranchRuns,
  useCommitActivity,
  useCommunity,
  useContributors,
  useFlow,
  useReleases,
  useRepoMeta,
} from "@/lib/repo-data";
import { branchHealth, summarizeRuns } from "@/lib/stats";
import { useNow } from "@/lib/use-now";

const SUGGESTIONS = [
  ["astral-sh/uv", "python-poetry/poetry"],
  ["vitejs/vite", "webpack/webpack"],
  ["biomejs/biome", "eslint/eslint"],
  ["pnpm/pnpm", "yarnpkg/berry"],
];

/** Metrics for one repo, computed from the same cached resources as the overview. */
function useRepoVitals(fullName: string | undefined) {
  const [owner = "", repo = ""] = fullName?.split("/") ?? [];
  const enabled = Boolean(fullName);
  const now = useNow(60_000);
  const meta = useRepoMeta(owner, repo, enabled);
  const commits = useCommitActivity(owner, repo, enabled);
  const releases = useReleases(owner, repo, 10, enabled);
  const flow = useFlow(owner, repo, enabled);
  const contributors = useContributors(owner, repo, enabled);
  const community = useCommunity(owner, repo, enabled);
  const runs = useBranchRuns(owner, repo, enabled ? (meta.data?.defaultBranch ?? null) : null);

  const health = meta.data && runs.data ? branchHealth(runs.data, meta.data.defaultBranch) : null;
  return {
    fullName,
    now,
    meta,
    commits,
    releases,
    flow,
    contributors,
    community,
    runs,
    activity: commits.data ? activityLevel(commits.data, meta.data?.isArchived ?? false) : null,
    cadence: releases.data ? releaseCadence(releases.data, now) : null,
    merge: flow.data ? durationSummary(flow.data.merged.durations) : undefined,
    close: flow.data ? durationSummary(flow.data.completed.durations) : undefined,
    bus: contributors.data ? busFactor(contributors.data) : undefined,
    ci: health ? { failing: health.filter((item) => item.failing).length, total: health.length, rate: summarizeRuns(runs.data ?? []).successRate } : null,
  };
}
type Vitals = ReturnType<typeof useRepoVitals>;

type Row = {
  group: string;
  label: string;
  /** Whether this repo's inputs are still loading. */
  loading: (v: Vitals) => boolean;
  render: (v: Vitals) => React.ReactNode;
  /** Secondary line under the value. */
  detail?: (v: Vitals) => React.ReactNode;
  /** Comparable number; null when not applicable. */
  score?: (v: Vitals) => number | null;
  better?: "higher" | "lower";
};

const ROWS: Row[] = [
  { group: "Popularity", label: "Stars", loading: (v) => !v.meta.data, render: (v) => formatCount(v.meta.data?.stars ?? 0), score: (v) => v.meta.data?.stars ?? null, better: "higher" },
  { group: "Popularity", label: "Forks", loading: (v) => !v.meta.data, render: (v) => formatCount(v.meta.data?.forks ?? 0), score: (v) => v.meta.data?.forks ?? null, better: "higher" },
  { group: "Popularity", label: "Watchers", loading: (v) => !v.meta.data, render: (v) => formatCount(v.meta.data?.watchers ?? 0), score: (v) => v.meta.data?.watchers ?? null, better: "higher" },
  {
    group: "Activity",
    label: "Status",
    loading: (v) => !v.activity,
    render: (v) => v.activity && <Badge tone={v.activity.tone}>{v.activity.label}</Badge>,
  },
  { group: "Activity", label: "Commits, 12 weeks", loading: (v) => !v.activity, render: (v) => formatCount(v.activity?.commits12 ?? 0), score: (v) => v.activity?.commits12 ?? null, better: "higher" },
  { group: "Activity", label: "Commits, 52 weeks", loading: (v) => !v.activity, render: (v) => formatCount(v.activity?.commits52 ?? 0), score: (v) => v.activity?.commits52 ?? null, better: "higher" },
  { group: "Activity", label: "Active weeks (of 12)", loading: (v) => !v.activity, render: (v) => `${v.activity?.activeWeeks12 ?? 0}`, score: (v) => v.activity?.activeWeeks12 ?? null, better: "higher" },
  {
    group: "Releases",
    label: "Latest release",
    loading: (v) => !v.cadence,
    render: (v) => (v.cadence?.latest ? <span className="font-mono">{v.cadence.latest.tag}</span> : "None"),
    detail: (v) => v.cadence?.latest && formatRelativeTime(v.cadence.latest.publishedAt, v.now),
    score: (v) => (v.cadence?.daysSinceLatest ?? null),
    better: "lower",
  },
  {
    group: "Releases",
    label: "Typical gap",
    loading: (v) => !v.cadence,
    render: (v) => (v.cadence?.medianGapDays == null ? "–" : formatSpan(v.cadence.medianGapDays * 86_400_000)),
    score: (v) => v.cadence?.medianGapDays ?? null,
    better: "lower",
  },
  { group: "Throughput, 30 days", label: "Pull requests merged", loading: (v) => !v.flow.data, render: (v) => formatCount(v.flow.data?.merged.total ?? 0), score: (v) => v.flow.data?.merged.total ?? null, better: "higher" },
  { group: "Throughput, 30 days", label: "Median time to merge", loading: (v) => !v.flow.data, render: (v) => (v.merge ? formatSpan(v.merge.median) : "–"), score: (v) => v.merge?.median ?? null, better: "lower" },
  { group: "Throughput, 30 days", label: "Issues completed", loading: (v) => !v.flow.data, render: (v) => formatCount(v.flow.data?.completed.total ?? 0), score: (v) => v.flow.data?.completed.total ?? null, better: "higher" },
  { group: "Throughput, 30 days", label: "Median time to close", loading: (v) => !v.flow.data, render: (v) => (v.close ? formatSpan(v.close.median) : "–"), score: (v) => v.close?.median ?? null, better: "lower" },
  { group: "Backlog", label: "Open issues", loading: (v) => !v.flow.data, render: (v) => formatCount(v.flow.data?.openIssues ?? 0) },
  { group: "Backlog", label: "Open pull requests", loading: (v) => !v.flow.data, render: (v) => formatCount(v.flow.data?.openPulls ?? 0) },
  {
    group: "Health",
    label: "CI on default branch",
    loading: (v) => !v.meta.data || (v.runs.loading && !v.runs.data),
    render: (v) =>
      !v.ci || v.ci.total === 0 ? (
        "No workflows"
      ) : (
        <span className={v.ci.failing > 0 ? "text-bad-fg" : "text-ok-fg"}>{v.ci.failing > 0 ? `${v.ci.failing} failing` : "Passing"}</span>
      ),
    detail: (v) => v.ci && v.ci.total > 0 && `${formatRate(v.ci.rate)} of recent runs`,
    score: (v) => (v.ci && v.ci.total > 0 ? v.ci.rate : null),
    better: "higher",
  },
  { group: "Health", label: "Bus factor", loading: (v) => !v.contributors.data, render: (v) => (v.bus ? String(v.bus.factor) : "–"), score: (v) => v.bus?.factor ?? null, better: "higher" },
  { group: "Health", label: "Contributors (top 100)", loading: (v) => !v.contributors.data, render: (v) => formatCount(v.bus?.humans ?? 0), score: (v) => v.bus?.humans ?? null, better: "higher" },
  {
    group: "Health",
    label: "Community profile",
    loading: (v) => !v.community.data,
    render: (v) => (v.community.data ? `${v.community.data.healthPercentage}%` : "–"),
    score: (v) => v.community.data?.healthPercentage ?? null,
    better: "higher",
  },
  { group: "About", label: "Licence", loading: (v) => !v.meta.data, render: (v) => v.meta.data?.license ?? "None" },
  { group: "About", label: "Language", loading: (v) => !v.meta.data, render: (v) => v.meta.data?.language ?? "–" },
  {
    group: "About",
    label: "Age",
    loading: (v) => !v.meta.data,
    render: (v) => (v.meta.data ? formatSpan(v.now - Date.parse(v.meta.data.createdAt)) : "–"),
    score: (v) => (v.meta.data ? v.now - Date.parse(v.meta.data.createdAt) : null),
    better: "higher",
  },
];

export function CompareView({ initial }: { initial: string[] }) {
  const [repos, setRepos] = useState(initial.slice(0, MAX_COMPARE));
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const url = repos.length > 0 ? `/compare?repos=${repos.join(",")}` : "/compare";
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [repos]);

  // Fixed slots keep hook order stable as repos are added and removed.
  const slots = [useRepoVitals(repos[0]), useRepoVitals(repos[1]), useRepoVitals(repos[2]), useRepoVitals(repos[3])].slice(0, repos.length);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseRepo(draft);
    const name = parsed && `${parsed.owner}/${parsed.repo}`;
    if (!name || repos.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      setInvalid(true);
      return;
    }
    setRepos((current) => [...current, name].slice(0, MAX_COMPARE));
    setDraft("");
  };

  return (
    <>
      <PageHeader
        title="Compare repositories"
        description={`Up to ${MAX_COMPARE} repositories side by side; the best value in each row is marked.`}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {repos.map((name) => (
          <span key={name} className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface pl-2.5 pr-1 font-mono text-xs text-fg-2">
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => setRepos((current) => current.filter((existing) => existing !== name))}
              className="grid size-6 place-items-center rounded text-fg-subtle hover:bg-surface-3 hover:text-fg"
            >
              <Icon name="x" className="size-3" />
            </button>
          </span>
        ))}
        {repos.length < MAX_COMPARE && (
          <form onSubmit={add} className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(false);
              }}
              placeholder="Add owner/repo"
              aria-label="Add a repository"
              aria-invalid={invalid}
              spellCheck={false}
              className={`h-8 w-52 rounded-md border bg-surface px-2.5 font-mono text-xs text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none ${
                invalid ? "border-bad-line" : "border-line focus:border-info"
              }`}
            />
            <button type="submit" className={BUTTON}>
              Add
            </button>
          </form>
        )}
      </div>

      {repos.length === 0 ? (
        <Panel title="Suggestions" bodyClassName="flex flex-wrap gap-1.5 p-4">
          {SUGGESTIONS.map((pair) => (
            <button
              key={pair.join()}
              type="button"
              onClick={() => setRepos(pair)}
              className="rounded-md border border-line px-2 py-1 font-mono text-xs text-fg-2 transition-colors hover:border-fg-subtle hover:text-fg"
            >
              {pair.join(" vs ")}
            </button>
          ))}
        </Panel>
      ) : (
        <CompareTable slots={slots} />
      )}

      {repos.length >= 3 && (
        <p className="text-xs text-fg-subtle">
          Each repo uses five search requests. Without a token GitHub allows ten a minute, so some numbers fill in after a short wait.
        </p>
      )}
    </>
  );
}

function best(row: Row, slots: Vitals[]) {
  if (!row.score || !row.better || slots.length < 2) return null;
  const scores = slots.map((slot) => (row.loading(slot) ? null : row.score!(slot)));
  const valid = scores.filter((score): score is number => score !== null);
  if (valid.length < 2 || new Set(valid).size === 1) return null;
  const target = row.better === "higher" ? Math.max(...valid) : Math.min(...valid);
  return scores.map((score) => score === target);
}

function CompareTable({ slots }: { slots: Vitals[] }) {
  const groups = Array.from(new Set(ROWS.map((row) => row.group)));
  const columns = `minmax(150px, 200px) repeat(${slots.length}, minmax(180px, 1fr))`;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <div className="min-w-fit">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: columns }}>
          <div />
          {slots.map((slot) => (
            <ColumnHeader key={slot.fullName} slot={slot} />
          ))}
        </div>
        {groups.map((group) => (
          <div key={group}>
            <div className="border-b border-line-soft bg-surface-2 px-4 py-1.5 text-xs font-medium text-fg-muted">{group}</div>
            {ROWS.filter((row) => row.group === group).map((row) => {
              const winners = best(row, slots);
              return (
                <div key={row.label} className="grid border-b border-line-soft last:border-b-0" style={{ gridTemplateColumns: columns }}>
                  <div className="px-4 py-2 text-[13px] text-fg-muted">{row.label}</div>
                  {slots.map((slot, index) => (
                    <div key={slot.fullName} className="border-l border-line-soft px-4 py-2 text-[13px] leading-5 text-fg tabular-nums">
                      {row.loading(slot) ? (
                        <Skeleton className="my-0.5 h-4 w-16" />
                      ) : (
                        <>
                          <span className="flex items-center gap-2">
                            {row.render(slot)}
                            {winners?.[index] && <Icon name="check" className="size-3.5 shrink-0 text-ok-fg" />}
                          </span>
                          {row.detail?.(slot) && <span className="block text-xs text-fg-muted">{row.detail(slot)}</span>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnHeader({ slot }: { slot: Vitals }) {
  const meta = slot.meta.data;
  return (
    <div className="min-w-0 border-l border-line-soft px-4 py-3">
      <div className="flex items-center gap-2">
        {meta ? <Avatar src={meta.avatarUrl} alt="" size={20} className="rounded" /> : <Skeleton className="size-5" />}
        <Link href={`/${slot.fullName}`} className="min-w-0 truncate text-[13px] font-medium text-fg hover:underline">
          {slot.fullName}
        </Link>
      </div>
      {slot.meta.error && !meta ? (
        <Badge tone="warn" className="mt-1.5">
          {slot.meta.error.kind === "not_found" ? "Not found" : "Couldn't load"}
        </Badge>
      ) : (
        <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{meta?.description ?? "\u00a0"}</p>
      )}
    </div>
  );
}
