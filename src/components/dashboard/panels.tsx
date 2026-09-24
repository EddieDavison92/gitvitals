"use client";

import { Icon } from "@/components/icon";
import { formatRate } from "@/lib/format";
import { failureHeadline } from "@/lib/run-status";
import type { WorkflowStat } from "@/lib/stats";
import type { ActionsRun } from "@/lib/types";
import { DOT, rateTone, TEXT } from "./tones";
import { AttemptBadge, Card, EmptyState, RelativeTime, SectionHeader } from "./ui";

const PREVIEW_COUNT = 5;

export function RecentFailures({
  failures,
  showAll,
  onToggleShowAll,
  onOpenRun,
}: {
  failures: ActionsRun[];
  showAll: boolean;
  onToggleShowAll: () => void;
  onOpenRun: (run: ActionsRun) => void;
}) {
  const visible = showAll ? failures : failures.slice(0, PREVIEW_COUNT);
  return (
    <Card>
      <SectionHeader
        eyebrow="Needs attention"
        title="Recent failures"
        description="Failed runs from the last 48 hours, newest first."
        icon="warning"
        action={
          failures.length > PREVIEW_COUNT ? (
            <button
              type="button"
              onClick={onToggleShowAll}
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-surface-2 hover:text-fg"
            >
              {showAll ? "Show fewer" : `View all ${failures.length}`}
            </button>
          ) : null
        }
      />
      {visible.length > 0 ? (
        <ul className="divide-y divide-line-soft">
          {visible.map((run) => (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => onOpenRun(run)}
                className="group grid w-full gap-3 px-4 py-4 text-left transition hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${DOT.bad}`} />
                    <p className="truncate text-sm font-semibold text-fg">
                      {run.workflowName}
                      <span className="ml-1.5 font-mono text-xs font-medium text-fg-subtle">#{run.runNumber}</span>
                    </p>
                    <AttemptBadge run={run} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 pl-4 text-sm leading-5 text-fg-2">
                    {failureHeadline(run) ?? <span className="text-fg-muted">{run.name}</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-xs text-fg-muted">
                    <span className="flex min-w-0 items-center gap-1">
                      <Icon name="branch" className="size-3.5 shrink-0" />
                      <span className="max-w-48 truncate">{run.branch}</span>
                    </span>
                    {run.prNumbers[0] && <span>PR #{run.prNumbers[0]}</span>}
                    <span>{run.actor}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 pl-4 sm:flex-col sm:items-end sm:justify-center sm:pl-0">
                  <span className="text-xs text-fg-muted">
                    <RelativeTime value={run.updatedAt} />
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-info-fg transition sm:opacity-0 sm:group-hover:opacity-100">
                    Details
                    <Icon name="chevron" className="size-3.5" />
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="check" tone="ok" title="No recent failures">
          Nothing has failed in this view during the last 48 hours.
        </EmptyState>
      )}
    </Card>
  );
}

export function ReliabilityWatch({
  stats,
  selected,
  onSelect,
}: {
  stats: WorkflowStat[];
  selected: string;
  onSelect: (workflow: string) => void;
}) {
  return (
    <Card>
      <SectionHeader
        eyebrow="By workflow"
        title="Reliability watch"
        description="Lowest-performing workflows in this view. Click to filter."
        icon="workflow"
      />
      {stats.length > 0 ? (
        <ul className="divide-y divide-line-soft px-4">
          {stats.slice(0, 6).map((workflow) => {
            const tone = rateTone(workflow.successRate);
            const isSelected = selected === workflow.workflow;
            return (
              <li key={workflow.workflow}>
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? "all" : workflow.workflow)}
                  aria-pressed={isSelected}
                  className="group w-full py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className={`truncate text-sm font-medium group-hover:text-info-fg ${isSelected ? "text-info-fg" : "text-fg"}`}>
                      {workflow.workflow}
                    </p>
                    <span className={`shrink-0 font-mono text-xs font-semibold ${TEXT[tone]}`}>
                      {formatRate(workflow.successRate)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={`h-full rounded-full ${DOT[tone]}`} style={{ width: `${workflow.successRate ?? 0}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-fg-subtle">
                    {workflow.runs} runs · {workflow.failed} failed
                    {workflow.passedOnRerun > 0 && (
                      <span className="text-warn-fg"> · {workflow.passedOnRerun} passed on re-run</span>
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-12 text-center text-sm text-fg-muted">No workflow data for this period.</p>
      )}
    </Card>
  );
}
