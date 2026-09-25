"use client";

import { ChartCard, ChartSkeleton, SERIES } from "@/components/ui/charts";
import { EmptyState, Meter, PageHeader, Panel, ResourceNote, Skeleton, StatCell, StatGrid } from "@/components/ui/primitives";
import { formatCount, formatPercent, formatSpan } from "@/lib/format";
import { authorMix, bucketAges, bucketDurations, closeDurations, cohorts, durationSummary, largerSample, topAuthors, topLabels } from "@/lib/insights";
import { useFlow, useIssues, useOldestOpen } from "@/lib/repo-data";
import { useToken } from "@/lib/token-store";
import type { RepoMeta } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { AuthorMixPanel, BucketChart, CohortChart, ItemList, sampleDescription, SeriesLegend, type Series } from "./flow-parts";

/** "+12 open issues in 30 days" style summary of net backlog change. */
/** Opened minus completed over 30 days; "not planned" closures aren't counted. */
function openedVsCompleted(delta: number) {
  if (delta === 0) return "As many completed as opened";
  return delta > 0 ? `${formatCount(delta)} more opened than completed` : `${formatCount(-delta)} more completed than opened`;
}

const STATES: Series[] = [
  { key: "completed", label: "Completed", color: SERIES.ok },
  { key: "notPlanned", label: "Not planned", color: SERIES.idle },
  { key: "open", label: "Open", color: SERIES.info },
];

export function IssuesTab({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const now = useNow(60_000);
  const hasToken = useToken() !== null;
  const issues = useIssues(owner, repo);
  const flow = useFlow(owner, repo);
  const oldest = useOldestOpen(owner, repo, "issue");

  if (meta && !meta.hasIssues) {
    return (
      <>
        <PageHeader title="Issues" />
        <EmptyState icon="issue" title="Issues are turned off for this repository" className="py-24" />
      </>
    );
  }

  const sample = issues.data ?? [];
  const close30 = durationSummary(flow.data?.completed.durations ?? []);
  const closed = sample.filter((issue) => issue.state === "closed");
  const open = sample.filter((issue) => issue.state === "open");
  const labels = topLabels(sample, 10);
  const unlabeled = open.filter((issue) => issue.labels.length === 0).length;
  const flowLoading = flow.loading && !flow.data;
  const sampleLoading = issues.loading && !issues.data;
  const stateOf = (issue: (typeof sample)[number]) => (issue.state === "open" ? "open" : issue.notPlanned ? "notPlanned" : "completed");
  const sampleNote = sampleDescription(sample.length, "issues", sample.at(-1)?.createdAt ?? null);

  return (
    <>
      <PageHeader
        title="Issues"
        description={`Counts cover the last 30 days; charts use ${sampleNote ?? "recent issues"}.${hasToken ? "" : " Add a token to sample 300."}`}
      />

      <StatGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCell
          label="Open"
          value={flow.data ? formatCount(flow.data.openIssues) : "–"}
          loading={flowLoading}
          error={flow.data ? null : flow.error}
          sub={flow.data ? openedVsCompleted(flow.data.openedIssues - flow.data.completed.total) : undefined}
        />
        <StatCell
          label="Opened, 30 days"
          value={flow.data ? formatCount(flow.data.openedIssues) : "–"}
          loading={flowLoading}
          sub={flow.data ? `About ${formatCount(Math.round(flow.data.openedIssues / 4.3))} a week` : undefined}
        />
        <StatCell
          label="Completed, 30 days"
          value={flow.data ? formatCount(flow.data.completed.total) : "–"}
          loading={flowLoading}
          sub={flow.data && flow.data.openedIssues > 0 ? `${formatPercent(flow.data.completed.total / flow.data.openedIssues)} of the number opened` : undefined}
        />
        <StatCell
          label="Median time to close"
          value={close30 ? formatSpan(close30.median) : "–"}
          loading={flowLoading}
          sub={close30 ? `90% within ${formatSpan(close30.p90)}` : "None completed in 30 days"}
        />
        <StatCell
          label="Not planned"
          value={closed.length > 0 ? formatPercent(closed.filter((issue) => issue.notPlanned).length / closed.length) : "–"}
          loading={sampleLoading}
          sub="Of closed issues"
        />
        <StatCell label="Unlabelled" value={open.length > 0 ? formatPercent(unlabeled / open.length) : "–"} loading={sampleLoading} sub="Of open issues in the sample" />
      </StatGrid>
      <ResourceNote error={issues.data ? null : issues.error} onRetry={issues.reload} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard title="Opened" description="By when they were opened, split by outcome" action={<SeriesLegend series={STATES} />}>
          {sampleLoading ? (
            <ChartSkeleton />
          ) : (
            <CohortChart cohorts={cohorts(sample, stateOf, STATES.map((item) => item.key), 26, now)} series={STATES} />
          )}
        </ChartCard>
        <ChartCard title="Time to close" description="How long completed issues were open">
          {sampleLoading && flowLoading ? (
            <ChartSkeleton />
          ) : (
            <BucketChart buckets={bucketDurations(largerSample(closeDurations(sample), flow.data?.completed.durations ?? []))} color={SERIES.info} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Labels on open issues" description="In the sample">
          {sampleLoading ? (
            <Skeleton className="m-4 h-40" />
          ) : labels.length === 0 ? (
            <p className="p-4 text-[13px] text-fg-muted">No labels on open issues.</p>
          ) : (
            <ul className="py-1">
              {labels.slice(0, 8).map((label) => (
                <li key={label.name} className="flex h-8 items-center gap-3 px-4 text-[13px]">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: label.color }} />
                  <span className="w-32 shrink-0 truncate text-fg-2">{label.name}</span>
                  <Meter value={label.count / labels[0].count} tone="idle" className="flex-1" />
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-fg-muted tabular-nums">{label.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <ChartCard title="Open issue age" description="How long open issues in the sample have waited">
          {sampleLoading ? <ChartSkeleton /> : <BucketChart buckets={bucketAges(open.map((issue) => issue.createdAt), now)} color={SERIES.neutral} />}
        </ChartCard>
        <AuthorMixPanel title="Who opens issues" mix={authorMix(sample)} top={topAuthors(sample, 8)} loading={sampleLoading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ItemList
          title="Waiting longest"
          description="Oldest issues still open"
          resource={oldest}
          now={now}
          empty="No open issues."
          items={oldest.data ?? []}
        />
        <ItemList
          title="Most discussed"
          description="Open issues in the sample by comment count"
          resource={issues}
          now={now}
          empty="No open issues in the sample."
          items={[...open].sort((a, b) => b.comments - a.comments).slice(0, 10)}
        />
      </div>
    </>
  );
}
