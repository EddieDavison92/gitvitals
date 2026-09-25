"use client";

import { Icon } from "@/components/icon";
import { Badge, Panel, RelativeTime, StatCell, StatGrid } from "@/components/ui/primitives";
import { DOT, rateTone, type Tone } from "@/components/ui/tones";
import { formatCount, formatDuration, formatRate, plural } from "@/lib/format";
import { failureHeadline } from "@/lib/run-status";
import type { RunSummary, WorkflowHealth } from "@/lib/stats";
import type { ActionsRun } from "@/lib/types";

/** One-line state of CI for the page header. */
export function headline(summary: RunSummary, health: WorkflowHealth[], branch: string | null, liveCount: number) {
  const failing = health.filter((item) => item.failing).length;
  if (failing > 0) return { text: `${plural(failing, "workflow")} failing on ${branch}`, tone: "bad" as Tone };
  if (liveCount > 0) return { text: `${plural(liveCount, "run")} in progress`, tone: "warn" as Tone };
  if (branch && health.length > 0) return { text: `All workflows passing on ${branch}`, tone: "ok" as Tone };
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
  onOpenRun,
  onSelectWorkflow,
}: {
  summary: RunSummary;
  successRateDelta: number | null;
  recentFailures: number;
  health: WorkflowHealth[];
  branch: string | null;
  onOpenRun: (run: ActionsRun) => void;
  onSelectWorkflow: (workflow: string) => void;
}) {
  return (
    <>
      {branch && health.length > 0 && <BranchHealth branch={branch} health={health} onOpenRun={onOpenRun} onSelectWorkflow={onSelectWorkflow} />}
      <StatGrid className="grid-cols-2 xl:grid-cols-4">
        <StatCell
          label="Success rate"
          tone={rateTone(summary.successRate)}
          value={formatRate(summary.successRate)}
          sub={
            successRateDelta === null
              ? `${plural(summary.successful + summary.failed, "run")} passed or failed`
              : `${successRateDelta >= 0 ? "+" : ""}${successRateDelta} pts on the previous period`
          }
        />
        <StatCell
          label="Failed runs"
          tone={summary.failed > 0 ? "bad" : undefined}
          value={formatCount(summary.failed)}
          sub={summary.failed === 0 ? "None this period" : `${recentFailures} in the last 48 hours`}
        />
        <StatCell
          label="Runs"
          value={formatCount(summary.total)}
          sub={[summary.active > 0 ? `${summary.active} running` : null, summary.passedOnRerun > 0 ? `${summary.passedOnRerun} passed only on re-run` : null]
            .filter(Boolean)
            .join(" · ") || "None running"}
        />
        <StatCell label="Median duration" value={formatDuration(summary.medianDurationMs)} sub={`95% finish within ${formatDuration(summary.p95DurationMs)}`} />
      </StatGrid>
    </>
  );
}

function BranchHealth({
  branch,
  health,
  onOpenRun,
  onSelectWorkflow,
}: {
  branch: string;
  health: WorkflowHealth[];
  onOpenRun: (run: ActionsRun) => void;
  onSelectWorkflow: (workflow: string) => void;
}) {
  const failing = health.filter((item) => item.failing);
  const passing = health.filter((item) => !item.failing);
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Icon name="branch" className="size-3.5 text-fg-subtle" />
          <span className="font-mono">{branch}</span>
        </span>
      }
      actions={
        <span className={failing.length > 0 ? "text-bad-fg" : "text-ok-fg"}>
          {failing.length > 0 ? `${failing.length} of ${health.length} workflows failing` : `${health.length} workflows passing`}
        </span>
      }
    >
      {failing.length > 0 && (
        <table className="w-full">
          <tbody>
            {failing.map((item) => (
              <tr key={item.workflow} className="border-b border-line-soft">
                <td className="w-0 whitespace-nowrap py-2 pl-4 pr-3">
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${DOT.bad}`} />
                    <button type="button" onClick={() => onSelectWorkflow(item.workflow)} className="text-[13px] font-medium text-fg hover:underline">
                      {item.workflow}
                    </button>
                  </span>
                </td>
                <td className="w-0 whitespace-nowrap px-3 py-2">
                  <Badge tone="bad">
                    {item.streak}
                    {item.streakComplete ? "" : "+"} in a row
                  </Badge>
                </td>
                <td className="w-0 whitespace-nowrap px-3 py-2 text-xs text-fg-muted">
                  since <RelativeTime value={item.failingSince} />
                </td>
                <td className="max-w-0 py-2 pl-3 pr-4">
                  <button type="button" onClick={() => onOpenRun(item.latest)} className="flex w-full min-w-0 items-center gap-1 text-left text-xs text-fg-muted hover:text-fg">
                    <span className="shrink-0 font-mono">#{item.latest.runNumber}</span>
                    <span className="truncate">{failureHeadline(item.latest) ?? item.latest.name}</span>
                    <Icon name="chevron" className="size-3 shrink-0" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {passing.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {passing.map((item) => (
            <button
              key={item.workflow}
              type="button"
              onClick={() => onSelectWorkflow(item.workflow)}
              title={`Last passed ${new Date(item.latest.updatedAt).toLocaleString("en-GB")}`}
              className="inline-flex items-center gap-1.5 rounded border border-line px-1.5 py-0.5 text-xs text-fg-2 transition-colors hover:border-fg-subtle"
            >
              <span className={`size-1.5 rounded-full ${DOT.ok}`} />
              {item.workflow}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
