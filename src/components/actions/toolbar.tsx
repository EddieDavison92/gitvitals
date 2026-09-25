"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { RelativeTime } from "@/components/ui/primitives";
import type { DashboardState } from "@/lib/dashboard-state";
import { PERIOD_OPTIONS } from "@/lib/periods";
import { FilterSelect } from "@/components/ui/primitives";

export type FilterOptions = {
  workflows: string[];
  branches: string[];
  actors: string[];
  prs: number[];
};

const FILTER_KEYS = ["workflow", "branch", "actor", "pr"] as const;

export type RefreshStatus = {
  fetchedAt: number | null;
  loading: boolean;
  liveCount: number;
  refreshMs: number;
  onRefresh: () => void;
};

function cadence(ms: number) {
  return ms < 60_000 ? `${ms / 1000} seconds` : ms === 60_000 ? "minute" : `${ms / 60_000} minutes`;
}

export function Toolbar({
  state,
  update,
  options,
  onClear,
  status,
}: {
  state: DashboardState;
  update: (patch: Partial<DashboardState>) => void;
  options: FilterOptions;
  onClear: () => void;
  status: RefreshStatus;
}) {
  const activeFilters = FILTER_KEYS.filter((key) => state[key] !== "all").length;
  const [expanded, setExpanded] = useState(activeFilters > 0);

  return (
    <div className="sticky top-11 z-20 border-b border-line bg-surface-2/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 rounded-lg bg-surface-3 p-1" role="group" aria-label="Period">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update({ period: option.value })}
              aria-pressed={state.period === option.value}
              title={option.label}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                state.period === option.value
                  ? "bg-surface text-fg shadow-sm"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {option.shortLabel}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={status.onRefresh}
            disabled={status.loading}
            title={`Refreshes every ${cadence(status.refreshMs)}${status.liveCount > 0 ? " while runs are active" : ""}. Click to refresh now.`}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-fg-muted transition hover:bg-surface-3 hover:text-fg disabled:cursor-default"
          >
            {status.liveCount > 0 && !status.loading ? (
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-60" />
                <span className="relative size-2 rounded-full bg-ok" />
              </span>
            ) : (
              <Icon name="refresh" className={`size-3.5 ${status.loading ? "animate-spin" : ""}`} />
            )}
            <span className="hidden sm:inline">
              {status.loading ? (
                "Updating"
              ) : status.liveCount > 0 ? (
                <span className="font-medium text-ok-fg">Live · {status.liveCount} active</span>
              ) : status.fetchedAt ? (
                <RelativeTime value={status.fetchedAt} prefix="Updated " />
              ) : (
                "Not loaded"
              )}
            </span>
          </button>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-3 hover:text-fg sm:flex"
            >
              <Icon name="x" className="size-3.5" />
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              expanded || activeFilters > 0
                ? "border-info-line bg-info-soft text-info-fg"
                : "border-line bg-surface text-fg-muted hover:text-fg"
            }`}
          >
            <Icon name="filter" className="size-3.5" />
            Filters
            {activeFilters > 0 && (
              <span className="grid size-4 place-items-center rounded-full bg-info text-[9px] text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line-soft">
          <div className="mx-auto grid max-w-[1480px] gap-3 px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <FilterSelect
              label="Workflow"
              value={state.workflow}
              onChange={(workflow) => update({ workflow })}
              options={options.workflows}
              allLabel="All workflows"
            />
            <FilterSelect
              label="Branch"
              value={state.branch}
              onChange={(branch) => update({ branch })}
              options={options.branches}
              allLabel="All branches"
            />
            <FilterSelect
              label="Actor"
              value={state.actor}
              onChange={(actor) => update({ actor })}
              options={options.actors}
              allLabel="All actors"
            />
            <FilterSelect
              label="Pull request"
              value={state.pr}
              onChange={(pr) => update({ pr })}
              options={options.prs.map((pr) => ({ value: String(pr), label: `PR #${pr}` }))}
              allLabel="All pull requests"
            />
          </div>
        </div>
      )}
    </div>
  );
}
