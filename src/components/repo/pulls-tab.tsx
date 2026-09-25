"use client";

import { SERIES } from "@/components/ui/charts";
import { ChartCard } from "@/components/ui/charts";
import { Card, ResourceNote, Skeleton, Stat } from "@/components/ui/primitives";
import { formatCount, formatPercent, formatSpan } from "@/lib/format";
import { authorMix, bucketDurations, cohorts, durationSummary, largerSample, mergeDurations, topAuthors } from "@/lib/insights";
import { useFlow, useOldestOpen, usePulls } from "@/lib/repo-data";
import { useToken } from "@/lib/token-store";
import { useNow } from "@/lib/use-now";
import { AuthorMixCard, BucketChart, CohortChart, ItemList, SampleNote, type Series } from "./flow-parts";

const STATES: Series[] = [
  { key: "merged", label: "Merged", color: SERIES.ok },
  { key: "closed", label: "Closed unmerged", color: SERIES.idle },
  { key: "open", label: "Still open", color: SERIES.info },
];

export function PullsTab({ owner, repo }: { owner: string; repo: string }) {
  const now = useNow(60_000);
  const hasToken = useToken() !== null;
  const pulls = usePulls(owner, repo);
  const flow = useFlow(owner, repo);
  const oldest = useOldestOpen(owner, repo, "pr");

  const sample = pulls.data ?? [];
  const merge30 = durationSummary(flow.data?.merged.durations ?? []);
  const sampleMerges = mergeDurations(sample);
  const humans = sample.filter((pr) => pr.authorKind !== "bot");
  const outside = humans.filter((pr) => pr.authorKind !== "maintainer").length;
  const decided = sample.filter((pr) => pr.state !== "open");
  const mergeRate = decided.length > 0 ? decided.filter((pr) => pr.state === "merged").length / decided.length : null;
  const oldestSampled = sample.at(-1)?.createdAt ?? null;
  const flowLoading = flow.loading && !flow.data;
  const sampleLoading = pulls.loading && !pulls.data;

  return (
    <div className="space-y-6">
      <Card className="grid gap-6 p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-6">
        <Stat label="Open" value={flow.data ? formatCount(flow.data.openPulls) : "–"} loading={flowLoading} tone="info" />
        <Stat label="Merged, 30 days" value={flow.data ? formatCount(flow.data.merged.total) : "–"} loading={flowLoading} tone="ok" />
        <Stat
          label="Median time to merge"
          value={merge30 ? formatSpan(merge30.median) : "–"}
          loading={flowLoading}
          detail={merge30 ? `90% within ${formatSpan(merge30.p90)}` : "Nothing merged in 30 days"}
        />
        <Stat
          label="Merge rate"
          value={mergeRate === null ? "–" : formatPercent(mergeRate)}
          loading={sampleLoading}
          detail="Of closed pull requests"
        />
        <Stat
          label="From outside"
          value={humans.length > 0 ? formatPercent(outside / humans.length) : "–"}
          loading={sampleLoading}
          detail="Authors who aren't maintainers"
        />
        <Stat
          label="From bots"
          value={sample.length > 0 ? formatPercent((sample.length - humans.length) / sample.length) : "–"}
          loading={sampleLoading}
          detail="Dependabot, Renovate and others"
        />
      </Card>
      <ResourceNote error={flow.data ? null : flow.error} onRetry={flow.reload} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard title="Pull requests opened" description="Grouped by when they were opened, coloured by what happened to them.">
          {sampleLoading ? (
            <Skeleton className="m-2 h-64" />
          ) : (
            <CohortChart cohorts={cohorts(sample, (pr) => pr.state, STATES.map((item) => item.key), 26, now)} series={STATES} />
          )}
        </ChartCard>
        <ChartCard title="Time to merge" description="How long merged pull requests stayed open.">
          {sampleLoading && flowLoading ? (
            <Skeleton className="m-2 h-56" />
          ) : (
            <BucketChart buckets={bucketDurations(largerSample(sampleMerges, flow.data?.merged.durations ?? []))} color={SERIES.ok} />
          )}
        </ChartCard>
      </div>
      <SampleNote count={sample.length} noun="pull requests" since={oldestSampled} hasToken={hasToken} />
      <ResourceNote error={pulls.data ? null : pulls.error} onRetry={pulls.reload} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <AuthorMixCard
          title="Who opens pull requests"
          description="Authors in the sample, by their relationship to the repo."
          mix={authorMix(sample)}
          top={topAuthors(sample, 10)}
        />
        <ItemList
          title="Waiting longest"
          description="The oldest pull requests that are still open."
          icon="clock"
          resource={oldest}
          now={now}
          empty="No open pull requests."
          items={(oldest.data ?? []).map((pr) => ({ ...pr, meta: pr.authorKind === "bot" ? "bot" : undefined }))}
        />
      </div>

      <ItemList
        title="Recently merged"
        icon="git-merge"
        resource={pulls}
        now={now}
        empty="Nothing merged in the sample."
        items={sample
          .filter((pr) => pr.mergedAt)
          .sort((a, b) => b.mergedAt!.localeCompare(a.mergedAt!))
          .slice(0, 10)
          .map((pr) => ({
            ...pr,
            labels: undefined,
            time: pr.mergedAt!,
            meta: `open for ${formatSpan(Date.parse(pr.mergedAt!) - Date.parse(pr.createdAt))}`,
          }))}
      />
    </div>
  );
}
