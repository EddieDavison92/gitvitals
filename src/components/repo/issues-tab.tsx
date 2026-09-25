"use client";

import { ChartCard, SERIES } from "@/components/ui/charts";
import { Card, EmptyState, Meter, ResourceNote, SectionHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { formatCount, formatPercent, formatSpan } from "@/lib/format";
import { authorMix, bucketAges, bucketDurations, closeDurations, cohorts, durationSummary, largerSample, topAuthors, topLabels } from "@/lib/insights";
import { useFlow, useIssues, useOldestOpen } from "@/lib/repo-data";
import { useToken } from "@/lib/token-store";
import type { RepoMeta } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { AuthorMixCard, BucketChart, CohortChart, ItemList, SampleNote, type Series } from "./flow-parts";

const STATES: Series[] = [
  { key: "completed", label: "Completed", color: SERIES.ok },
  { key: "notPlanned", label: "Not planned", color: SERIES.idle },
  { key: "open", label: "Still open", color: SERIES.info },
];

export function IssuesTab({ owner, repo, meta }: { owner: string; repo: string; meta: RepoMeta | null }) {
  const now = useNow(60_000);
  const hasToken = useToken() !== null;
  const issues = useIssues(owner, repo);
  const flow = useFlow(owner, repo);
  const oldest = useOldestOpen(owner, repo, "issue");

  if (meta && !meta.hasIssues) {
    return <EmptyState icon="issue" title="Issues are turned off for this repository" className="min-h-96" />;
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

  return (
    <div className="space-y-6">
      <Card className="grid gap-6 p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-6">
        <Stat label="Open" value={flow.data ? formatCount(flow.data.openIssues) : "–"} loading={flowLoading} tone="info" />
        <Stat label="Opened, 30 days" value={flow.data ? formatCount(flow.data.openedIssues) : "–"} loading={flowLoading} />
        <Stat label="Completed, 30 days" value={flow.data ? formatCount(flow.data.completed.total) : "–"} loading={flowLoading} tone="ok" />
        <Stat
          label="Median time to close"
          value={close30 ? formatSpan(close30.median) : "–"}
          loading={flowLoading}
          detail={close30 ? `90% within ${formatSpan(close30.p90)}` : "None completed in 30 days"}
        />
        <Stat
          label="Not planned"
          value={closed.length > 0 ? formatPercent(closed.filter((issue) => issue.notPlanned).length / closed.length) : "–"}
          loading={sampleLoading}
          detail="Of closed issues"
        />
        <Stat
          label="Unlabelled"
          value={open.length > 0 ? formatPercent(unlabeled / open.length) : "–"}
          loading={sampleLoading}
          detail="Of open issues in the sample"
        />
      </Card>
      <ResourceNote error={flow.data ? null : flow.error} onRetry={flow.reload} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard title="Issues opened" description="Grouped by when they were opened, coloured by how they ended up.">
          {sampleLoading ? (
            <Skeleton className="m-2 h-64" />
          ) : (
            <CohortChart cohorts={cohorts(sample, stateOf, STATES.map((item) => item.key), 26, now)} series={STATES} />
          )}
        </ChartCard>
        <ChartCard title="Time to close" description="How long completed issues stayed open.">
          {sampleLoading && flowLoading ? (
            <Skeleton className="m-2 h-56" />
          ) : (
            <BucketChart buckets={bucketDurations(largerSample(closeDurations(sample), flow.data?.completed.durations ?? []))} color={SERIES.ok} />
          )}
        </ChartCard>
      </div>
      <SampleNote count={sample.length} noun="issues" since={sample.at(-1)?.createdAt ?? null} hasToken={hasToken} />
      <ResourceNote error={issues.data ? null : issues.error} onRetry={issues.reload} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeader title="Open issue labels" description="Most common labels on open issues in the sample." icon="tag" />
          {sampleLoading ? (
            <Skeleton className="m-5 h-40" />
          ) : labels.length === 0 ? (
            <p className="px-5 py-6 text-sm text-fg-muted">No labels on open issues.</p>
          ) : (
            <ul className="space-y-2.5 px-5 py-4">
              {labels.map((label) => (
                <li key={label.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: label.color }} />
                      <span className="truncate text-fg-2">{label.name}</span>
                    </span>
                    <span className="font-mono text-xs text-fg-muted">{label.count}</span>
                  </div>
                  <Meter value={label.count / labels[0].count} tone="idle" className="mt-1" />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <ChartCard title="Open issue age" description="How long open issues in the sample have waited.">
          {sampleLoading ? (
            <Skeleton className="m-2 h-56" />
          ) : (
            <BucketChart buckets={bucketAges(open.map((issue) => issue.createdAt), now)} color={SERIES.warn} />
          )}
        </ChartCard>
        <AuthorMixCard
          title="Who opens issues"
          description="Authors in the sample, by their relationship to the repo."
          mix={authorMix(sample)}
          top={topAuthors(sample, 8)}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <ItemList
          title="Waiting longest"
          description="The oldest issues that are still open."
          icon="clock"
          resource={oldest}
          now={now}
          empty="No open issues."
          items={oldest.data ?? []}
        />
        <ItemList
          title="Most discussed"
          description="Open issues in the sample with the most comments."
          icon="issue"
          resource={issues}
          now={now}
          empty="No open issues in the sample."
          items={[...open].sort((a, b) => b.comments - a.comments).slice(0, 10)}
        />
      </div>
    </div>
  );
}
