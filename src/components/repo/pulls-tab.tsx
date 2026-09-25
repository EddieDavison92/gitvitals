"use client";

import { ChartCard, ChartSkeleton, SERIES } from "@/components/ui/charts";
import { PageHeader, ResourceNote, StatCell, StatGrid } from "@/components/ui/primitives";
import { formatCount, formatPercent, formatSpan } from "@/lib/format";
import { authorMix, bucketDurations, cohorts, durationSummary, largerSample, mergeDurations, topAuthors } from "@/lib/insights";
import { useFlow, useOldestOpen, usePulls } from "@/lib/repo-data";
import { useToken } from "@/lib/token-store";
import { useNow } from "@/lib/use-now";
import { AuthorMixPanel, BucketChart, CohortChart, ItemList, sampleDescription, SeriesLegend, type Series } from "./flow-parts";

const STATES: Series[] = [
  { key: "merged", label: "Merged", color: SERIES.ok },
  { key: "closed", label: "Closed", color: SERIES.idle },
  { key: "open", label: "Open", color: SERIES.info },
];

export function PullsTab({ owner, repo }: { owner: string; repo: string }) {
  const now = useNow(60_000);
  const hasToken = useToken() !== null;
  const pulls = usePulls(owner, repo);
  const flow = useFlow(owner, repo);
  const oldest = useOldestOpen(owner, repo, "pr");

  const sample = pulls.data ?? [];
  const merge30 = durationSummary(flow.data?.merged.durations ?? []);
  const humans = sample.filter((pr) => pr.authorKind !== "bot");
  const outside = humans.filter((pr) => pr.authorKind !== "maintainer").length;
  const decided = sample.filter((pr) => pr.state !== "open");
  const mergeRate = decided.length > 0 ? decided.filter((pr) => pr.state === "merged").length / decided.length : null;
  const flowLoading = flow.loading && !flow.data;
  const sampleLoading = pulls.loading && !pulls.data;
  const sampleNote = sampleDescription(sample.length, "pull requests", sample.at(-1)?.createdAt ?? null);

  return (
    <>
      <PageHeader
        title="Pull requests"
        description={`Counts cover the last 30 days; charts use ${sampleNote ?? "recent pull requests"}.${hasToken ? "" : " Add a token to sample 300."}`}
      />

      <StatGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCell
          label="Open"
          value={flow.data ? formatCount(flow.data.openPulls) : "–"}
          loading={flowLoading}
          error={flow.data ? null : flow.error}
          sub={sample.length > 0 ? `${sample.filter((pr) => pr.state === "open" && pr.draft).length} drafts in the sample` : undefined}
        />
        <StatCell
          label="Merged, 30 days"
          value={flow.data ? formatCount(flow.data.merged.total) : "–"}
          loading={flowLoading}
          sub={flow.data ? `About ${formatCount(Math.round(flow.data.merged.total / 4.3))} a week` : undefined}
        />
        <StatCell
          label="Median time to merge"
          value={merge30 ? formatSpan(merge30.median) : "–"}
          loading={flowLoading}
          sub={merge30 ? `90% within ${formatSpan(merge30.p90)}` : "Nothing merged in 30 days"}
        />
        <StatCell label="Merge rate" value={mergeRate === null ? "–" : formatPercent(mergeRate)} loading={sampleLoading} sub="Of closed pull requests" />
        <StatCell label="From the community" value={humans.length > 0 ? formatPercent(outside / humans.length) : "–"} loading={sampleLoading} sub="Authors without write access" />
        <StatCell
          label="From bots"
          value={sample.length > 0 ? formatPercent((sample.length - humans.length) / sample.length) : "–"}
          loading={sampleLoading}
          sub="Dependabot, Renovate and others"
        />
      </StatGrid>
      <ResourceNote error={pulls.data ? null : pulls.error} onRetry={pulls.reload} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard title="Opened" description="By when they were opened, split by outcome" action={<SeriesLegend series={STATES} />}>
          {sampleLoading ? (
            <ChartSkeleton />
          ) : (
            <CohortChart cohorts={cohorts(sample, (pr) => pr.state, STATES.map((item) => item.key), 26, now)} series={STATES} />
          )}
        </ChartCard>
        <ChartCard title="Time to merge" description="How long merged pull requests were open">
          {sampleLoading && flowLoading ? (
            <ChartSkeleton />
          ) : (
            <BucketChart buckets={bucketDurations(largerSample(mergeDurations(sample), flow.data?.merged.durations ?? []))} color={SERIES.info} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <AuthorMixPanel title="Who opens pull requests" mix={authorMix(sample)} top={topAuthors(sample, 10)} loading={sampleLoading} />
        <ItemList
          title="Waiting longest"
          description="Oldest pull requests still open"
          resource={oldest}
          now={now}
          empty="No open pull requests."
          items={(oldest.data ?? []).map((pr) => ({ ...pr, meta: pr.authorKind === "bot" ? "bot" : undefined }))}
        />
      </div>

      <ItemList
        title="Recently merged"
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
    </>
  );
}
