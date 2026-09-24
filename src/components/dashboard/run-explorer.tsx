"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import type { RunView } from "@/lib/dashboard-state";
import { formatCount } from "@/lib/format";
import { failureHeadline, isActiveRun, isFailedRun, isPassedRun } from "@/lib/run-status";
import type { ActionsRun } from "@/lib/types";
import { AttemptBadge, Card, EmptyState, Eyebrow, Kbd, LiveDuration, RelativeTime, StatusBadge, StatusDot } from "./ui";

const VIEWS: Array<{ value: RunView; label: string }> = [
  { value: "all", label: "All runs" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "successful", label: "Successful" },
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
    <section aria-labelledby="runs-heading">
      <Card>
        <div className="border-b border-line-soft px-4 py-4 sm:px-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <Eyebrow>Run explorer</Eyebrow>
              <h2 id="runs-heading" className="mt-1 text-xl font-semibold tracking-tight">
                Workflow history
              </h2>
            </div>
            <label className="relative block w-full lg:max-w-sm">
              <span className="sr-only">Search runs</span>
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") event.currentTarget.blur();
                }}
                placeholder="Search workflow, branch, PR, actor or commit"
                className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-10 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus:border-info focus:bg-surface focus:ring-2 focus:ring-info-soft"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:block">
                <Kbd>/</Kbd>
              </span>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-1 overflow-x-auto" role="group" aria-label="Status">
            {VIEWS.map((option) => {
              const count = scopedRuns.filter((run) => runMatchesView(run, option.value)).length;
              const selected = view === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onViewChange(option.value)}
                  aria-pressed={selected}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    selected ? "bg-fg text-surface" : "text-fg-muted hover:bg-surface-3 hover:text-fg"
                  }`}
                >
                  {option.label}
                  <span className={`font-mono text-[10px] ${selected ? "opacity-70" : "text-fg-subtle"}`}>
                    {formatCount(count)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {runs.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-soft bg-surface-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-fg-subtle">
                    <th className="px-5 py-2.5">Run</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Branch</th>
                    <th className="hidden px-4 py-2.5 lg:table-cell">Actor</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Updated</th>
                    <th className="w-10 px-4 py-2.5">
                      <span className="sr-only">Open on GitHub</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {visible.map((run) => (
                    <RunRow key={run.id} run={run} onOpen={onOpenRun} onSelectPr={onSelectPr} />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line-soft md:hidden">
              {visible.map((run) => (
                <RunMobileRow key={run.id} run={run} onOpen={onOpenRun} />
              ))}
            </ul>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-4 py-3 sm:flex-row sm:px-5">
              <p className="text-xs text-fg-muted">
                Showing {formatCount(visible.length)} of {formatCount(runs.length)} runs
              </p>
              {visible.length < runs.length && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg-2 shadow-card transition hover:bg-surface-3"
                >
                  Load 25 more
                  <Icon name="chevron-down" className="size-3.5" />
                </button>
              )}
            </div>
          </>
        ) : (
          <EmptyState icon="search" title="No matching runs">
            Try a different status, search term, period or filter.
            {(query || hasFilters || view !== "all") && (
              <button type="button" onClick={onClear} className="mt-3 block w-full text-xs font-semibold text-info-fg hover:underline">
                Clear all filters
              </button>
            )}
          </EmptyState>
        )}
      </Card>
    </section>
  );
}

function RunSubtitle({ run }: { run: ActionsRun }) {
  const headline = isFailedRun(run) ? failureHeadline(run) : null;
  return (
    <p className={`mt-0.5 truncate pl-4 text-xs ${headline ? "text-bad-fg" : "text-fg-muted"}`}>{headline ?? run.name}</p>
  );
}

function RunRow({
  run,
  onOpen,
  onSelectPr,
}: {
  run: ActionsRun;
  onOpen: (run: ActionsRun) => void;
  onSelectPr: (pr: number) => void;
}) {
  return (
    <tr className="group cursor-pointer transition hover:bg-surface-2" onClick={() => onOpen(run)}>
      <td className="max-w-md px-5 py-3">
        {/* Keyboard target; the click bubbles to the row's handler. */}
        <button type="button" className="block w-full min-w-0 text-left">
          <span className="flex items-center gap-2">
            <StatusDot run={run} />
            <span className="truncate text-sm font-semibold text-fg group-hover:text-info-fg">{run.workflowName}</span>
            <span className="shrink-0 font-mono text-[11px] text-fg-subtle">#{run.runNumber}</span>
            <AttemptBadge run={run} />
          </span>
          <RunSubtitle run={run} />
        </button>
      </td>
      <td className="px-4 py-3">
        <StatusBadge run={run} />
      </td>
      <td className="max-w-44 px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-fg-2">
          <Icon name="branch" className="size-3.5 shrink-0 text-fg-subtle" />
          <span className="truncate">{run.branch}</span>
        </div>
        {run.prNumbers[0] && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectPr(run.prNumbers[0]);
            }}
            className="mt-1 text-[10px] font-semibold text-info-fg hover:underline"
          >
            PR #{run.prNumbers[0]}
          </button>
        )}
      </td>
      <td className="hidden max-w-36 truncate px-4 py-3 text-xs text-fg-muted lg:table-cell">{run.actor}</td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-fg-muted tabular-nums">
        <LiveDuration run={run} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-fg-muted">
        <RelativeTime value={run.updatedAt} />
      </td>
      <td className="px-4 py-3">
        <a
          href={run.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Open ${run.workflowName} run ${run.runNumber} on GitHub`}
          title="Open on GitHub"
          className="grid size-7 place-items-center rounded-lg text-fg-subtle transition hover:bg-surface hover:text-info-fg hover:shadow-card"
        >
          <Icon name="arrow-up-right" className="size-3.5" />
        </a>
      </td>
    </tr>
  );
}

function RunMobileRow({ run, onOpen }: { run: ActionsRun; onOpen: (run: ActionsRun) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(run)} className="block w-full px-4 py-4 text-left">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <StatusDot run={run} />
              <span className="truncate text-sm font-semibold text-fg">{run.workflowName}</span>
              <span className="shrink-0 font-mono text-[11px] text-fg-subtle">#{run.runNumber}</span>
              <AttemptBadge run={run} />
            </span>
            <RunSubtitle run={run} />
          </span>
          <StatusBadge run={run} className="shrink-0" />
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-[11px] text-fg-muted">
          <span className="flex min-w-0 items-center gap-1">
            <Icon name="branch" className="size-3.5 shrink-0" />
            <span className="max-w-40 truncate">{run.branch}</span>
          </span>
          <span>{run.actor}</span>
          <span className="font-mono">
            <LiveDuration run={run} />
          </span>
          <RelativeTime value={run.updatedAt} />
        </span>
      </button>
    </li>
  );
}
