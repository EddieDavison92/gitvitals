"use client";

import { Icon, type IconName } from "@/components/icon";
import { formatDuration, formatRate, plural } from "@/lib/format";
import { failureHeadline } from "@/lib/run-status";
import type { RunSummary, WorkflowHealth } from "@/lib/stats";
import type { ActionsRun } from "@/lib/types";
import { BADGE, DOT, rateTone, TEXT, type Tone } from "@/components/ui/tones";
import { CARD, Eyebrow, RelativeTime } from "@/components/ui/primitives";

function headline(summary: RunSummary, failing: WorkflowHealth[], branch: string | null, liveCount: number, hasBranchRuns: boolean) {
  if (failing.length > 0) {
    return { text: `${plural(failing.length, "workflow")} failing on ${branch}`, tone: "bad" as Tone };
  }
  if (liveCount > 0) return { text: `${plural(liveCount, "run")} in progress`, tone: "warn" as Tone };
  if (branch && hasBranchRuns) return { text: `All workflows passing on ${branch}`, tone: "ok" as Tone };
  if (summary.total === 0) return { text: "No runs in this period", tone: "idle" as Tone };
  return summary.failed > 0
    ? { text: `${plural(summary.failed, "failed run")} this period`, tone: "bad" as Tone }
    : { text: "No failures this period", tone: "ok" as Tone };
}

export function Overview({
  summary,
  successRateDelta,
  recentFailures,
  health,
  branch,
  liveCount,
  periodLabel,
  filtered,
  onOpenRun,
  onSelectWorkflow,
}: {
  summary: RunSummary;
  successRateDelta: number | null;
  recentFailures: number;
  health: WorkflowHealth[];
  branch: string | null;
  liveCount: number;
  periodLabel: string;
  filtered: boolean;
  onOpenRun: (run: ActionsRun) => void;
  onSelectWorkflow: (workflow: string) => void;
}) {
  const failing = health.filter((item) => item.failing);
  const title = headline(summary, failing, branch, liveCount, health.length > 0);

  return (
    <section aria-labelledby="overview-heading" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Eyebrow tone="info">Current health</Eyebrow>
          <h2 id="overview-heading" className="mt-1 flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className={`size-2.5 shrink-0 rounded-full ${DOT[title.tone]}`} />
            {title.text}
          </h2>
        </div>
        <p className="hidden text-xs text-fg-muted sm:block">
          {periodLabel}
          {filtered ? " · filtered" : ""}
        </p>
      </div>

      {branch && health.length > 0 && (
        <BranchHealth branch={branch} health={health} failing={failing} onOpenRun={onOpenRun} onSelectWorkflow={onSelectWorkflow} />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon="pulse"
          label="Success rate"
          value={formatRate(summary.successRate)}
          detail={
            successRateDelta === null
              ? `${plural(summary.successful + summary.failed, "run")} passed or failed`
              : `${successRateDelta >= 0 ? "+" : ""}${successRateDelta} pts vs previous period`
          }
          tone={rateTone(summary.successRate)}
        />
        <MetricCard
          icon="warning"
          label="Failed"
          value={summary.failed}
          detail={summary.failed === 0 ? "No failed runs" : `${recentFailures} in the last 48 hours`}
          tone={summary.failed > 0 ? "bad" : "ok"}
        />
        <MetricCard
          icon="activity"
          label="Runs"
          value={summary.total}
          detail={[
            summary.active > 0 ? `${summary.active} active` : "None active",
            summary.passedOnRerun > 0 ? `${summary.passedOnRerun} passed on re-run` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          tone={summary.active > 0 ? "warn" : "idle"}
        />
        <MetricCard
          icon="clock"
          label="Median duration"
          value={formatDuration(summary.medianDurationMs)}
          detail={`95% finish within ${formatDuration(summary.p95DurationMs)}`}
          tone="idle"
        />
      </div>
    </section>
  );
}

function BranchHealth({
  branch,
  health,
  failing,
  onOpenRun,
  onSelectWorkflow,
}: {
  branch: string;
  health: WorkflowHealth[];
  failing: WorkflowHealth[];
  onOpenRun: (run: ActionsRun) => void;
  onSelectWorkflow: (workflow: string) => void;
}) {
  const passing = health.filter((item) => !item.failing);
  return (
    <div className={`${CARD} ${failing.length > 0 ? "border-bad-line" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
        <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fg">
          <Icon name="branch" className="size-3.5 text-fg-subtle" />
          {branch}
        </span>
        <span className={`text-xs font-medium ${failing.length > 0 ? TEXT.bad : TEXT.ok}`}>
          {failing.length > 0
            ? `${failing.length} of ${plural(health.length, "workflow")} failing`
            : `All ${plural(health.length, "workflow")} passing`}
        </span>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {passing.map((item) => (
            <button
              key={item.workflow}
              type="button"
              onClick={() => onSelectWorkflow(item.workflow)}
              title={`Last passed ${new Date(item.latest.updatedAt).toLocaleString("en-GB")}`}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] text-fg-muted transition hover:border-ok-line hover:text-fg"
            >
              <span className={`size-1.5 rounded-full ${DOT.ok}`} />
              {item.workflow}
            </button>
          ))}
        </div>
      </div>

      {failing.length > 0 && (
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {failing.map((item) => (
            <li key={item.workflow} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className={`size-2 shrink-0 rounded-full ${DOT.bad}`} />
                <button
                  type="button"
                  onClick={() => onSelectWorkflow(item.workflow)}
                  className="truncate text-sm font-semibold text-fg hover:text-info-fg"
                >
                  {item.workflow}
                </button>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE.bad}`}>
                  {item.streak}
                  {item.streakComplete ? "" : "+"} failed in a row
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-3 pl-4.5 text-xs text-fg-muted sm:pl-0">
                <span className="shrink-0">
                  Failing since <RelativeTime value={item.failingSince} />
                </span>
                <button
                  type="button"
                  onClick={() => onOpenRun(item.latest)}
                  className="flex min-w-0 items-center gap-1 font-medium text-info-fg hover:underline"
                >
                  <span className="truncate">
                    #{item.latest.runNumber}
                    {failureHeadline(item.latest) ? ` · ${failureHeadline(item.latest)}` : ""}
                  </span>
                  <Icon name="chevron" className="size-3.5 shrink-0" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-fg-subtle">{label}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
        </div>
        <div className={`grid size-9 place-items-center rounded-xl border ${BADGE[tone]}`}>
          <Icon name={icon} className="size-4.5" />
        </div>
      </div>
      <p className={`mt-3 text-xs ${tone === "bad" || tone === "ok" ? `font-medium ${TEXT[tone]}` : "text-fg-muted"}`}>
        {detail}
      </p>
    </div>
  );
}
