"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import { BUTTON, EmptyState, Kbd, Panel, RelativeTime, TD, TH, TR } from "@/components/ui/primitives";
import type { RunView } from "@/lib/dashboard-state";
import { formatCount } from "@/lib/format";
import { failureHeadline, isActiveRun, isFailedRun, isPassedRun } from "@/lib/run-status";
import type { ActionsRun } from "@/lib/types";
import { AttemptBadge, LiveDuration, StatusBadge, StatusDot } from "./run-ui";

const VIEWS: Array<{ value: RunView; label: string }> = [
  { value: "all", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "successful", label: "Passed" },
];

export function runMatchesView(run: ActionsRun, view: RunView) {
  if (view === "failed") return isFailedRun(run);
  if (view === "running") return isActiveRun(run);
  if (view === "successful") return isPassedRun(run);
  return true;
}

export function RunExplorer({
  scopedRuns,
  runs,
  view,
  onViewChange,
  query,
  onQueryChange,
  visibleCount,
  onLoadMore,
  hasFilters,
  onClear,
  onOpenRun,
  onSelectPr,
}: {
  /** Runs in the period and filters, before the view and search apply. */
  scopedRuns: ActionsRun[];
  /** Runs after the view and search. */
  runs: ActionsRun[];
  view: RunView;
  onViewChange: (view: RunView) => void;
  query: string;
  onQueryChange: (query: string) => void;
  visibleCount: number;
  onLoadMore: () => void;
  hasFilters: boolean;
  onClear: () => void;
  onOpenRun: (run: ActionsRun) => void;
  onSelectPr: (pr: number) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search unless the user is already typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || target.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const visible = runs.slice(0, visibleCount);

  return (
    <Panel
      title="Runs"
      actions={
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Status" className="hidden items-center gap-0.5 sm:flex">
            {VIEWS.map((option) => {
              const count = scopedRuns.filter((run) => runMatchesView(run, option.value)).length;
              const selected = view === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onViewChange(option.value)}
                  aria-pressed={selected}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors ${
                    selected ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {option.label}
                  <span className="font-mono text-[11px] text-fg-subtle tabular-nums">{formatCount(count)}</span>
                </button>
              );
            })}
          </div>
          <label className="relative block">
            <span className="sr-only">Search runs</span>
            <Icon name="search" className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") event.currentTarget.blur();
              }}
              placeholder="Search runs"
              className="h-7 w-44 rounded-md border border-line bg-surface-2 pl-7 pr-7 text-xs text-fg outline-none placeholder:text-fg-subtle focus:w-60 focus:border-info focus:bg-surface focus-visible:outline-none sm:w-52"
            />
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
              <Kbd>/</Kbd>
            </span>
          </label>
        </div>
      }
    >
      {runs.length === 0 ? (
        <EmptyState icon="search" title="No matching runs">
          Try a different status, search term, period or filter.
          {(query || hasFilters || view !== "all") && (
            <button type="button" onClick={onClear} className="mt-2 block w-full text-info-fg hover:underline">
              Clear all filters
            </button>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={`${TH} w-28`}>Status</th>
                  <th className={TH}>Run</th>
                  <th className={TH}>Branch</th>
                  <th className={`${TH} hidden lg:table-cell`}>Actor</th>
                  <th className={`${TH} text-right`}>Duration</th>
                  <th className={`${TH} text-right`}>Updated</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {visible.map((run) => (
                  <RunRow key={run.id} run={run} onOpen={onOpenRun} onSelectPr={onSelectPr} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden">
            {visible.map((run) => (
              <RunMobileRow key={run.id} run={run} onOpen={onOpenRun} />
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2">
            <p className="text-xs text-fg-muted">
              {formatCount(visible.length)} of {formatCount(runs.length)}
            </p>
            {visible.length < runs.length && (
              <button type="button" onClick={onLoadMore} className={`${BUTTON} h-7 text-xs`}>
                Show more
              </button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

function RunSubtitle({ run }: { run: ActionsRun }) {
  const headline = isFailedRun(run) ? failureHeadline(run) : null;
  return <span className={`block truncate text-xs ${headline ? "text-bad-fg" : "text-fg-muted"}`}>{headline ?? run.name}</span>;
}

function RunRow({ run, onOpen, onSelectPr }: { run: ActionsRun; onOpen: (run: ActionsRun) => void; onSelectPr: (pr: number) => void }) {
  return (
    <tr className={`${TR} group cursor-pointer`} onClick={() => onOpen(run)}>
      <td className={TD}>
        <StatusBadge run={run} />
      </td>
      <td className={`${TD} max-w-md`}>
        {/* Keyboard target; the click bubbles to the row's handler. */}
        <button type="button" className="block w-full min-w-0 text-left">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium text-fg">{run.workflowName}</span>
            <span className="shrink-0 font-mono text-xs text-fg-subtle">#{run.runNumber}</span>
            <AttemptBadge run={run} />
          </span>
          <RunSubtitle run={run} />
        </button>
      </td>
      <td className={`${TD} max-w-48`}>
        <span className="block truncate font-mono text-xs text-fg-2">{run.branch}</span>
        {run.prNumbers[0] && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectPr(run.prNumbers[0]);
            }}
            className="text-[11px] text-fg-muted hover:text-fg hover:underline"
          >
            #{run.prNumbers[0]}
          </button>
        )}
      </td>
      <td className={`${TD} hidden max-w-36 truncate text-fg-muted lg:table-cell`}>{run.actor}</td>
      <td className={`${TD} whitespace-nowrap text-right font-mono text-xs text-fg-muted tabular-nums`}>
        <LiveDuration run={run} />
      </td>
      <td className={`${TD} whitespace-nowrap text-right text-xs text-fg-muted`}>
        <RelativeTime value={run.updatedAt} />
      </td>
      <td className="pr-3">
        <a
          href={run.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Open ${run.workflowName} run ${run.runNumber} on GitHub`}
          title="Open on GitHub"
          className="grid size-6 place-items-center rounded text-fg-subtle opacity-0 transition hover:bg-surface-3 hover:text-fg group-hover:opacity-100"
        >
          <Icon name="arrow-up-right" className="size-3.5" />
        </a>
      </td>
    </tr>
  );
}

function RunMobileRow({ run, onOpen }: { run: ActionsRun; onOpen: (run: ActionsRun) => void }) {
  return (
    <li className="border-t border-line-soft first:border-t-0">
      <button type="button" onClick={() => onOpen(run)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left">
        <span className="pt-1.5">
          <StatusDot run={run} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-fg">{run.workflowName}</span>
            <span className="shrink-0 font-mono text-xs text-fg-subtle">#{run.runNumber}</span>
            <AttemptBadge run={run} />
          </span>
          <RunSubtitle run={run} />
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-fg-muted">
            <span className="max-w-40 truncate font-mono">{run.branch}</span>
            <span className="font-mono">
              <LiveDuration run={run} />
            </span>
            <RelativeTime value={run.updatedAt} />
          </span>
        </span>
      </button>
    </li>
  );
}
