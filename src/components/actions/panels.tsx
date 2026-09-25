"use client";

import { EmptyState, Meter, Panel, RelativeTime, TD, TH, TR } from "@/components/ui/primitives";
import { rateTone, TEXT } from "@/components/ui/tones";
import { formatRate } from "@/lib/format";
import { failureHeadline } from "@/lib/run-status";
import type { WorkflowStat } from "@/lib/stats";
import type { ActionsRun } from "@/lib/types";
import { AttemptBadge, StatusDot } from "./run-ui";

const PREVIEW_COUNT = 6;

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
    <Panel
      title="Recent failures"
      description="Last 48 hours, newest first"
      actions={
        failures.length > PREVIEW_COUNT && (
          <button type="button" onClick={onToggleShowAll} className="text-xs text-fg-muted hover:text-fg">
            {showAll ? "Show fewer" : `Show all ${failures.length}`}
          </button>
        )
      }
    >
      {visible.length === 0 ? (
        <EmptyState icon="check" title="No failures in the last 48 hours" />
      ) : (
        <ul>
          {visible.map((run) => (
            <li key={run.id} className="border-t border-line-soft first:border-t-0">
              <button type="button" onClick={() => onOpenRun(run)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2">
                <span className="pt-1.5">
                  <StatusDot run={run} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-fg">{run.workflowName}</span>
                    <span className="shrink-0 font-mono text-xs text-fg-subtle">#{run.runNumber}</span>
                    <AttemptBadge run={run} />
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-bad-fg">{failureHeadline(run) ?? <span className="text-fg-muted">{run.name}</span>}</span>
                  <span className="mt-0.5 flex items-center gap-3 text-xs text-fg-muted">
                    <span className="truncate font-mono">{run.branch}</span>
                    <span className="shrink-0">{run.actor}</span>
                  </span>
                </span>
                <span className="shrink-0 pt-px text-xs text-fg-subtle">
                  <RelativeTime value={run.updatedAt} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
    <Panel title="Workflows" description="Worst first; click to filter">
      {stats.length === 0 ? (
        <EmptyState title="No workflow runs in this period" />
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Workflow</th>
              <th className={`${TH} text-right`}>Runs</th>
              <th className={`${TH} w-32`}>Success</th>
            </tr>
          </thead>
          <tbody>
            {stats.slice(0, 10).map((workflow) => {
              const tone = rateTone(workflow.successRate);
              const isSelected = selected === workflow.workflow;
              return (
                <tr
                  key={workflow.workflow}
                  onClick={() => onSelect(isSelected ? "all" : workflow.workflow)}
                  className={`${TR} cursor-pointer ${isSelected ? "bg-surface-2" : ""}`}
                >
                  <td className={`${TD} max-w-0`}>
                    <button type="button" aria-pressed={isSelected} className={`block w-full truncate text-left ${isSelected ? "font-medium text-fg" : "text-fg-2"}`}>
                      {workflow.workflow}
                    </button>
                    {(workflow.failed > 0 || workflow.passedOnRerun > 0) && (
                      <span className="block text-xs text-fg-muted">
                        {workflow.failed > 0 && <span className="text-bad-fg">{workflow.failed} failed</span>}
                        {workflow.failed > 0 && workflow.passedOnRerun > 0 && " · "}
                        {workflow.passedOnRerun > 0 && <span className="text-warn-fg">{workflow.passedOnRerun} passed on re-run</span>}
                      </span>
                    )}
                  </td>
                  <td className={`${TD} text-right font-mono text-fg-muted tabular-nums`}>{workflow.runs}</td>
                  <td className={TD}>
                    <span className="flex items-center gap-2">
                      <Meter value={(workflow.successRate ?? 0) / 100} tone={tone} className="flex-1" />
                      <span className={`w-9 text-right font-mono text-xs tabular-nums ${TEXT[tone]}`}>{formatRate(workflow.successRate)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
