"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ANIMATION_MS, ChartCard, CURSOR, EmptyChart, GRID, SERIES, TICK, TOOLTIP, type TooltipProps } from "@/components/ui/charts";
import { Card, EmptyState, Pill, ResourceNote, SectionHeader, Skeleton, Stat } from "@/components/ui/primitives";
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

/** Newest first, with each release's bump and gap from the previous stable-or-pre release. */
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
      <EmptyState icon="tag" title="No releases published" className="min-h-96">
        This repository hasn&apos;t published any GitHub releases.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="grid gap-6 p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-6">
        <Stat
          label="Latest"
          value={<span className="font-mono">{cadence.latest?.tag ?? "–"}</span>}
          loading={loading}
          detail={cadence.latest ? formatRelativeTime(cadence.latest.publishedAt, now) : undefined}
          tone={cadence.daysSinceLatest === null ? "idle" : cadence.daysSinceLatest < 90 ? "ok" : "warn"}
        />
        <Stat
          label="Latest stable"
          value={<span className="font-mono">{cadence.latestStable?.tag ?? "–"}</span>}
          loading={loading}
          detail={cadence.latestStable ? formatRelativeTime(cadence.latestStable.publishedAt, now) : "No stable releases"}
        />
        <Stat
          label="Typical gap"
          value={cadence.medianGapDays === null ? "–" : formatSpan(cadence.medianGapDays * DAY)}
          loading={loading}
          detail="Median time between releases"
        />
        <Stat label="Last 12 months" value={formatCount(cadence.lastYear)} loading={loading} detail={cadence.lastYear >= 50 ? "At least; 50 sampled" : "Releases published"} />
        <Stat label="Downloads" value={formatCompact(downloads)} loading={loading} detail={`Assets across ${rows.length} releases`} />
        <Stat
          label="Pre-releases"
          value={rows.length > 0 ? formatPercent(rows.filter((release) => release.prerelease).length / rows.length) : "–"}
          loading={loading}
          detail="Of sampled releases"
        />
      </Card>
      <ResourceNote error={releases.data ? null : releases.error} onRetry={releases.reload} />

      <ChartCard title="Release timeline" description="Each dot is a release; size shows downloads, colour the semver bump.">
        {loading ? <Skeleton className="m-2 h-40" /> : <Timeline rows={rows} now={now} />}
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Days between releases" description="Gap before each release, oldest on the left.">
          {loading ? <Skeleton className="m-2 h-56" /> : <GapChart rows={rows} />}
        </ChartCard>
        <ChartCard title="Downloads per release" description="Total asset downloads.">
          {loading ? (
            <Skeleton className="m-2 h-56" />
          ) : downloads === 0 ? (
            <EmptyChart height={220}>These releases have no downloadable assets.</EmptyChart>
          ) : (
            <DownloadsChart rows={rows} />
          )}
        </ChartCard>
      </div>

      <Card>
        <SectionHeader title="Releases" description="Most recent 50." icon="tag" />
        {loading ? (
          <Skeleton className="m-5 h-64" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line-soft bg-surface-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-fg-subtle">
                  <th className="px-5 py-2.5">Release</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Published</th>
                  <th className="px-4 py-2.5 text-right">Gap</th>
                  <th className="px-4 py-2.5 text-right">Downloads</th>
                  <th className="hidden px-4 py-2.5 md:table-cell">Author</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((release) => (
                  <tr key={release.tag} className="hover:bg-surface-2">
                    <td className="max-w-md px-5 py-2.5">
                      <a href={release.url} target="_blank" rel="noreferrer" className="font-mono font-semibold text-fg hover:text-info-fg">
                        {release.tag}
                      </a>
                      {release.name !== release.tag && <span className="ml-2 truncate text-xs text-fg-muted">{release.name}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex gap-1">
                        <Pill tone={BUMP[release.bump].tone}>{BUMP[release.bump].label}</Pill>
                        {release.prerelease && <Pill tone="warn">Pre</Pill>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-fg-muted" title={dateFormat.format(new Date(release.publishedAt))}>
                      {formatRelativeTime(release.publishedAt, now)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs text-fg-muted">
                      {release.gapDays === null ? "–" : formatSpan(release.gapDays * DAY)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-fg-2">{release.downloads > 0 ? formatCompact(release.downloads) : "–"}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-fg-muted md:table-cell">{release.author ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Timeline({ rows, now }: { rows: Row[]; now: number }) {
  if (rows.length === 0) return <EmptyChart height={160}>No releases.</EmptyChart>;
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
    <div className="px-3 pb-2 pt-6">
      <div className={`relative ${hasPre ? "h-28" : "h-16"}`}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        {rows.map((release) => {
          const size = 8 + Math.sqrt(release.downloads / maxDownloads) * 22;
          return (
            <a
              key={release.tag}
              href={release.url}
              target="_blank"
              rel="noreferrer"
              title={`${release.tag} · ${dateFormat.format(new Date(release.publishedAt))}${release.downloads ? ` · ${formatCount(release.downloads)} downloads` : ""}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface transition hover:scale-125 hover:z-10"
              style={{
                left: `${x(Date.parse(release.publishedAt))}%`,
                top: release.prerelease ? "78%" : hasPre ? "38%" : "50%",
                width: size,
                height: size,
                background: BUMP[release.bump].color,
                opacity: release.prerelease ? 0.6 : 0.9,
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-2 h-4 text-[10px] text-fg-subtle">
        {ticks
          .filter((_, index) => index % step === 0)
          .map((tick, index) => (
            <span key={tick} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(tick)}%` }}>
              {(index === 0 || new Date(tick).getUTCMonth() === 0 ? monthYearFormat : monthFormat).format(new Date(tick))}
            </span>
          ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-fg-muted">
        {(["major", "minor", "patch", "other"] as const).map((bump) => (
          <span key={bump} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: BUMP[bump].color }} />
            {BUMP[bump].label}
          </span>
        ))}
        {hasPre && <span>Lower row: pre-releases</span>}
      </div>
    </div>
  );
}

type ChartRow = { tag: string; gapDays: number; downloads: number };

function GapChart({ rows }: { rows: Row[] }) {
  const data: ChartRow[] = [...rows]
    .reverse()
    .filter((release) => release.gapDays !== null)
    .map((release) => ({ tag: release.tag, gapDays: Number(release.gapDays!.toFixed(1)), downloads: release.downloads }));
  if (data.length === 0) return <EmptyChart height={220}>Needs at least two releases.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="tag" tick={false} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<ReleaseTooltip field="gap" />} cursor={CURSOR} />
        <Bar dataKey="gapDays" fill={SERIES.info} radius={[3, 3, 0, 0]} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DownloadsChart({ rows }: { rows: Row[] }) {
  const data: ChartRow[] = [...rows].reverse().map((release) => ({ tag: release.tag, gapDays: release.gapDays ?? 0, downloads: release.downloads }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: -6 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="tag" tick={false} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCompact} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<ReleaseTooltip field="downloads" />} cursor={CURSOR} />
        <Bar dataKey="downloads" fill={SERIES.neutral} radius={[3, 3, 0, 0]} animationDuration={CHART_ANIMATION_MS} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ReleaseTooltip({ active, payload, field }: TooltipProps<ChartRow> & { field: "gap" | "downloads" }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={TOOLTIP}>
      <p className="font-mono font-semibold text-fg">{row.tag}</p>
      <p className="mt-0.5 text-fg-muted">
        {field === "gap" ? `${formatSpan(row.gapDays * DAY)} after the previous release` : `${formatCount(row.downloads)} downloads`}
      </p>
    </div>
  );
}
