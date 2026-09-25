"use client";

import { Icon } from "@/components/icon";
import { BUTTON, FilterSelect, Panel, RelativeTime, SegmentedControl } from "@/components/ui/primitives";
import type { DashboardState } from "@/lib/dashboard-state";
import { PERIOD_OPTIONS } from "@/lib/periods";

export type FilterOptions = {
  workflows: string[];
  branches: string[];
  actors: string[];
  prs: number[];
};

export type RefreshStatus = {
  fetchedAt: number | null;
  loading: boolean;
  liveCount: number;
  refreshMs: number;
  onRefresh: () => void;
};

const FILTER_KEYS = ["workflow", "branch", "actor", "pr"] as const;

export function activeFilterCount(state: DashboardState) {
  return FILTER_KEYS.filter((key) => state[key] !== "all").length;
}

function cadence(ms: number) {
  return ms < 60_000 ? `${ms / 1000} seconds` : ms === 60_000 ? "minute" : `${ms / 60_000} minutes`;
}

/** Page-header controls: refresh status, period and the filter toggle. */
export function ActionsControls({
  state,
  update,
  status,
  filtersOpen,
  onToggleFilters,
}: {
  state: DashboardState;
  update: (patch: Partial<DashboardState>) => void;
  status: RefreshStatus;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}) {
  const active = activeFilterCount(state);
  return (
    <>
      <button
        type="button"
        onClick={status.onRefresh}
        disabled={status.loading}
        title={`Refreshes every ${cadence(status.refreshMs)}${status.liveCount > 0 ? " while runs are active" : ""}. Click to refresh now.`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-default"
      >
        {status.liveCount > 0 && !status.loading ? (
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-50" />
            <span className="relative size-2 rounded-full bg-ok" />
          </span>
        ) : (
          <Icon name="refresh" className={`size-3.5 ${status.loading ? "animate-spin" : ""}`} />
        )}
        {status.loading ? (
          "Updating"
        ) : status.liveCount > 0 ? (
          <span className="text-ok-fg">Live · {status.liveCount} running</span>
        ) : status.fetchedAt ? (
          <RelativeTime value={status.fetchedAt} prefix="Updated " />
        ) : (
          "Not loaded"
        )}
      </button>
      <SegmentedControl
        label="Period"
        value={state.period}
        onChange={(period) => update({ period })}
        options={PERIOD_OPTIONS.map((option) => ({ value: option.value, label: option.shortLabel, title: option.label }))}
      />
      <button type="button" onClick={onToggleFilters} aria-expanded={filtersOpen} className={`${BUTTON} aria-expanded:bg-surface-2 aria-expanded:text-fg`}>
        <Icon name="filter" className="size-3.5" />
        Filters
        {active > 0 && <span className="rounded bg-info px-1 font-mono text-[10px] leading-4 text-white">{active}</span>}
      </button>
    </>
  );
}

export function FilterPanel({
  state,
  update,
  options,
  onClear,
}: {
  state: DashboardState;
  update: (patch: Partial<DashboardState>) => void;
  options: FilterOptions;
  onClear: () => void;
}) {
  return (
    <Panel
      title="Filters"
      actions={
        activeFilterCount(state) > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-fg-muted hover:text-fg">
            Clear all
          </button>
        )
      }
      bodyClassName="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <FilterSelect label="Workflow" value={state.workflow} onChange={(workflow) => update({ workflow })} options={options.workflows} allLabel="All workflows" />
      <FilterSelect label="Branch" value={state.branch} onChange={(branch) => update({ branch })} options={options.branches} allLabel="All branches" />
      <FilterSelect label="Actor" value={state.actor} onChange={(actor) => update({ actor })} options={options.actors} allLabel="All actors" />
      <FilterSelect
        label="Pull request"
        value={state.pr}
        onChange={(pr) => update({ pr })}
        options={options.prs.map((pr) => ({ value: String(pr), label: `#${pr}` }))}
        allLabel="All pull requests"
      />
    </Panel>
  );
}
