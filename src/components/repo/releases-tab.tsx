"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ANIMATION_MS, CHART_HEIGHT, ChartCard, ChartSkeleton, CURSOR, EmptyChart, GRID, SERIES, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { Badge, EmptyState, PageHeader, Panel, ResourceNote, Skeleton, StatCell, StatGrid, TD, TH, TR } from "@/components/ui/primitives";
import type { Tone } from "@/components/ui/tones";
import { formatCompact, formatCount, formatPercent, formatRelativeTime, formatSpan } from "@/lib/format";
import type { Release } from "@/lib/github-insights";
import { releaseCadence, semverBump } from "@/lib/insights";
import { useReleases } from "@/lib/repo-data";
import { useNow } from "@/lib/use-now";

type Bump = ReturnType<typeof semverBump>;
const BUMP: Record<NonNullable<Bump> | "first" | "other", { label: string; color: string; tone: Tone }> = {
  major: { label: "Major", color: SERIES.bad, tone: "bad" },
  minor: { label: "Minor", color: SERIES.info, tone: "info" },
  patch: { label: "Patch", color: SERIES.ok, tone: "ok" },
  first: { label: "First", color: SERIES.idle, tone: "idle" },
  other: { label: "Other", color: SERIES.idle, tone: "idle" },
};
const DAY = 86_400_000;
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });
const monthYearFormat = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

type Row = Release & { bump: keyof typeof BUMP; gapDays: number | null };

/** Newest first, with each release's bump and gap from the previous release. */
function annotate(releases: Release[]): Row[] {
  const sorted = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return sorted.map((release, index) => {
    const previous = sorted[index + 1];
    const bump = previous ? (semverBump(previous.tag, release.tag) ?? "other") : "first";
    return {
      ...release,
      bump,
      gapDays: previous ? (Date.parse(release.publishedAt) - Date.parse(previous.publishedAt)) / DAY : null,
    };
  });
}

export function ReleasesTab({ owner, repo }: { owner: string; repo: string }) {
  const now = useNow(60_000);
  const releases = useReleases(owner, repo, 50);
  const rows = annotate(releases.data ?? []);
  const cadence = releaseCadence(releases.data ?? [], now);
  const downloads = rows.reduce((sum, release) => sum + release.downloads, 0);
  const loading = releases.loading && !releases.data;

  if (!loading && releases.data && rows.length === 0) {
    return (
      <>
        <PageHeader title="Releases" />
        <EmptyState icon="tag" title="No releases published" className="py-24">
          This repository hasn&apos;t published any GitHub releases.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Releases" description={`The ${rows.length || 50} most recent published releases.`} />

      <StatGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCell
          label="Latest"
          value={<span className="font-mono text-lg">{cadence.latest?.tag ?? "–"}</span>}
          loading={loading}
          error={releases.data ? null : releases.error}
          sub={cadence.latest ? formatRelativeTime(cadence.latest.publishedAt, now) : undefined}
          tone={cadence.daysSinceLatest === null ? undefined : cadence.daysSinceLatest < 90 ? "ok" : "warn"}
        />
        <StatCell
          label="Latest stable"
          value={<span className="font-mono text-lg">{cadence.latestStable?.tag ?? "–"}</span>}
          loading={loading}
          sub={cadence.latestStable ? formatRelativeTime(cadence.latestStable.publishedAt, now) : "No stable releases"}
        />
        <StatCell label="Typical gap" value={cadence.medianGapDays === null ? "–" : formatSpan(cadence.medianGapDays * DAY)} loading={loading} sub="Median time between releases" />
        <StatCell label="Last 12 months" value={formatCount(cadence.lastYear)} loading={loading} sub={cadence.lastYear >= 50 ? "At least; 50 sampled" : "Releases published"} />
        <StatCell label="Downloads" value={formatCompact(downloads)} loading={loading} sub={`Assets across ${rows.length} releases`} />
        <StatCell
          label="Pre-releases"
          value={rows.length > 0 ? formatPercent(rows.filter((release) => release.prerelease).length / rows.length) : "–"}
          loading={loading}
          sub="Of sampled releases"
        />
      </StatGrid>

      <ChartCard
        title="Timeline"
        description="Size shows downloads, colour the semver bump"
        action={
          <span className="flex items-center gap-3 text-[11px] text-fg-muted">
            {(["major", "minor", "patch", "other"] as const).map((bump) => (
              <span key={bump} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: BUMP[bump].color }} />
                {BUMP[bump].label}
              </span>
            ))}
          </span>
        }
      >
        {loading ? <Skeleton className="h-28" /> : <Timeline rows={rows} now={now} />}
      </ChartCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Days between releases" description="Gap before each release, oldest first">
          {loading ? <ChartSkeleton /> : <GapChart rows={rows} />}
        </ChartCard>
        <ChartCard title="Downloads per release" description="Total asset downloads">
          {loading ? (
            <ChartSkeleton />
          ) : downloads === 0 ? (
            <EmptyChart>These releases have no downloadable assets.</EmptyChart>
          ) : (
            <DownloadsChart rows={rows} />
          )}
        </ChartCard>
      </div>

      <Panel title="All releases">
        {loading ? (
          <Skeleton className="m-4 h-64" />
        ) : rows.length === 0 ? (
          <ResourceNote error={releases.error} onRetry={releases.reload} className="p-4" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Release</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Published</th>
                  <th className={`${TH} text-right`}>Gap</th>
                  <th className={`${TH} text-right`}>Downloads</th>
                  <th className={`${TH} hidden md:table-cell`}>Author</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((release) => (
                  <tr key={release.tag} className={TR}>
                    <td className={`${TD} max-w-md`}>
                      <a href={release.url} target="_blank" rel="noreferrer" className="font-mono font-medium text-fg hover:underline">
                        {release.tag}
                      </a>
                      {release.name !== release.tag && <span className="ml-2 truncate text-fg-muted">{release.name}</span>}
                    </td>
                    <td className={TD}>
                      <span className="flex gap-1">
                        <Badge tone={BUMP[release.bump].tone}>{BUMP[release.bump].label}</Badge>
                        {release.prerelease && <Badge tone="warn">Pre</Badge>}
                      </span>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-fg-muted`} title={dateFormat.format(new Date(release.publishedAt))}>
                      {formatRelativeTime(release.publishedAt, now)}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right text-fg-muted tabular-nums`}>
                      {release.gapDays === null ? "–" : formatSpan(release.gapDays * DAY)}
                    </td>
                    <td className={`${TD} text-right font-mono text-fg-2 tabular-nums`}>{release.downloads > 0 ? formatCompact(release.downloads) : "–"}</td>
                    <td className={`${TD} hidden text-fg-muted md:table-cell`}>{release.author ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function Timeline({ rows, now }: { rows: Row[]; now: number }) {
  if (rows.length === 0) return <EmptyChart height={120}>No releases.</EmptyChart>;
  const start = Date.parse(rows.at(-1)!.publishedAt);
  const span = Math.max(now - start, DAY);
  const maxDownloads = Math.max(...rows.map((release) => release.downloads), 1);
  const x = (time: number) => ((time - start) / span) * 100;
  const hasPre = rows.some((release) => release.prerelease);
  // Month ticks, thinned to at most ~8.
  const ticks: number[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= now) {
    if (cursor.getTime() >= start) ticks.push(cursor.getTime());
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const step = Math.ceil(ticks.length / 8);

  return (
    <div className="px-3 pb-1">
      <div className={`relative ${hasPre ? "h-24" : "h-14"}`}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        {rows.map((release) => {
          const size = 7 + Math.sqrt(release.downloads / maxDownloads) * 18;
          return (
            <a
              key={release.tag}
              href={release.url}
              target="_blank"
              rel="noreferrer"
              title={`${release.tag} · ${dateFormat.format(new Date(release.publishedAt))}${release.downloads ? ` · ${formatCount(release.downloads)} downloads` : ""}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-transform hover:z-10 hover:scale-125"
              style={{
                left: `${x(Date.parse(release.publishedAt))}%`,
                top: release.prerelease ? "80%" : hasPre ? "35%" : "50%",
                width: size,
                height: size,
                background: BUMP[release.bump].color,
                opacity: release.prerelease ? 0.55 : 0.9,
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-fg-subtle">
        {ticks
          .filter((_, index) => index % step === 0)
          .map((tick, index) => (
            <span key={tick} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(tick)}%` }}>
              {(index === 0 || new Date(tick).getUTCMonth() === 0 ? monthYearFormat : monthFormat).format(new Date(tick))}
            </span>
          ))}
      </div>
      {hasPre && <p className="mt-2 text-[11px] text-fg-subtle">Lower row: pre-releases</p>}
    </div>
  );
}

type ChartRow = { tag: string; gapDays: number; downloads: number };

function GapChart({ rows }: { rows: Row[] }) {
  const data: ChartRow[] = [...rows]
    .reverse()
    .filter((release) => release.gapDays !== null)
    .map((release) => ({ tag: release.tag, gapDays: Number(release.gapDays!.toFixed(1)), downloads: release.downloads }));
  if (data.length === 0) return <EmptyChart>Needs at least two releases.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="tag" tick={false} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<ReleaseTooltip field="gap" />} cursor={CURSOR} />
        <Bar dataKey="gapDays" fill={SERIES.info} radius={[2, 2, 0, 0]} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DownloadsChart({ rows }: { rows: Row[] }) {
  const data: ChartRow[] = [...rows].reverse().map((release) => ({ tag: release.tag, gapDays: release.gapDays ?? 0, downloads: release.downloads }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="tag" tick={false} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCompact} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<ReleaseTooltip field="downloads" />} cursor={CURSOR} />
        <Bar dataKey="downloads" fill={SERIES.neutral} radius={[2, 2, 0, 0]} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ReleaseTooltip({ active, payload, field }: TooltipProps<ChartRow> & { field: "gap" | "downloads" }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-mono font-medium text-fg">{row.tag}</p>
      <p className="mt-0.5 text-fg-muted">
        {field === "gap" ? `${formatSpan(row.gapDays * DAY)} after the previous release` : `${formatCount(row.downloads)} downloads`}
      </p>
    </div>
  );
}
