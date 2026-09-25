"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import type { DashboardState } from "@/lib/dashboard-state";
import { formatTime } from "@/lib/format";
import { getPeriodMs, PERIOD_OPTIONS } from "@/lib/periods";
import { toLoadError, useRepoRuns, type LoadError } from "@/lib/repo-store";
import { isFailedRun } from "@/lib/run-status";
import { branchHealth, dailyTrend, inferDefaultBranch, summarizeRuns, workflowStats } from "@/lib/stats";
import type { ActionsRun, RepoMeta } from "@/lib/types";
import { Overview } from "./overview";
import { RecentFailures, ReliabilityWatch } from "./panels";
import { RunDrawer } from "./run-drawer";
import { RunExplorer, runMatchesView } from "./run-explorer";
import { ActionsError, ActionsLoading, describeError } from "./states";
import { Toolbar } from "./toolbar";
import { Trends } from "./trends";
import { EmptyState } from "@/components/ui/primitives";
import { useDashboardState } from "./use-dashboard-state";

const PAGE_SIZE = 25;
const RECENT_FAILURE_WINDOW_MS = 48 * 60 * 60_000;
const EMPTY_RUNS: ActionsRun[] = [];

function uniqueSorted<T>(values: T[], compare: (a: T, b: T) => number) {
  return Array.from(new Set(values)).sort(compare);
}

export function ActionsDashboard({
  owner,
  repo,
  meta,
  initialState,
}: {
  owner: string;
  repo: string;
  meta: RepoMeta | null;
  initialState: DashboardState;
}) {
  const [state, update] = useDashboardState(initialState);
  const [showAllFailures, setShowAllFailures] = useState(false);
  const [pagination, setPagination] = useState({ key: "", count: PAGE_SIZE });
  const [runLoadError, setRunLoadError] = useState<{ id: number; error: LoadError } | null>(null);
  const attemptedRuns = useRef(new Set<number>());

  const {
    runs: loadedRuns,
    fetchedAt,
    truncated,
    coveredSince,
    liveCount,
    refreshMs,
    loading,
    error,
    hasToken,
    refresh,
    enrich,
    loadRun,
  } = useRepoRuns(owner, repo, state.period);

  const runs = useMemo(
    () => [...(loadedRuns ?? EMPTY_RUNS)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [loadedRuns],
  );

  // Periods end at the last fetch so numbers don't drift between refreshes.
  const periodEnd = fetchedAt ?? 0;
  const periodMs = getPeriodMs(state.period);
  const currentStartMs = periodMs ? periodEnd - periodMs : null;
  const previousStartMs = periodMs && currentStartMs !== null ? currentStartMs - periodMs : null;

  const currentPeriodRuns = useMemo(
    () => (currentStartMs === null ? runs : runs.filter((run) => Date.parse(run.updatedAt) >= currentStartMs)),
    [currentStartMs, runs],
  );
  const previousPeriodRuns = useMemo(() => {
    if (currentStartMs === null || previousStartMs === null) return EMPTY_RUNS;
    return runs.filter((run) => {
      const updated = Date.parse(run.updatedAt);
      return updated >= previousStartMs && updated < currentStartMs;
    });
  }, [currentStartMs, previousStartMs, runs]);

  const options = useMemo(
    () => ({
      workflows: uniqueSorted(currentPeriodRuns.map((run) => run.workflowName), (a, b) => a.localeCompare(b)),
      branches: uniqueSorted(currentPeriodRuns.map((run) => run.branch), (a, b) => a.localeCompare(b)),
      actors: uniqueSorted(currentPeriodRuns.map((run) => run.actor), (a, b) => a.localeCompare(b)),
      prs: uniqueSorted(currentPeriodRuns.flatMap((run) => run.prNumbers), (a, b) => b - a),
    }),
    [currentPeriodRuns],
  );

  // Filters from a shared link may not exist in this period; ignore them until they do.
  const filters = {
    workflow: options.workflows.includes(state.workflow) ? state.workflow : "all",
    branch: options.branches.includes(state.branch) ? state.branch : "all",
    actor: options.actors.includes(state.actor) ? state.actor : "all",
    pr: options.prs.includes(Number(state.pr)) ? state.pr : "all",
  };
  const hasFilters = Object.values(filters).some((value) => value !== "all");

  const matchesFilters = useCallback(
    (run: ActionsRun) =>
      (filters.workflow === "all" || run.workflowName === filters.workflow) &&
      (filters.branch === "all" || run.branch === filters.branch) &&
      (filters.actor === "all" || run.actor === filters.actor) &&
      (filters.pr === "all" || run.prNumbers.includes(Number(filters.pr))),
    [filters.workflow, filters.branch, filters.actor, filters.pr],
  );

  const scopedRuns = useMemo(() => currentPeriodRuns.filter(matchesFilters), [currentPeriodRuns, matchesFilters]);
  const summary = useMemo(() => summarizeRuns(scopedRuns), [scopedRuns]);
  const previousSummary = useMemo(
    () => summarizeRuns(previousPeriodRuns.filter(matchesFilters)),
    [previousPeriodRuns, matchesFilters],
  );

  // Loaded runs may stop short of a period's start when the page cap was hit.
  const coveredSinceMs = truncated && coveredSince ? Date.parse(coveredSince) : null;
  const isLoadedFrom = (startMs: number | null) =>
    coveredSinceMs === null || (startMs !== null && coveredSinceMs <= startMs);
  const successRateDelta =
    state.period === "all" ||
    summary.successRate === null ||
    previousSummary.successRate === null ||
    !isLoadedFrom(previousStartMs)
      ? null
      : summary.successRate - previousSummary.successRate;

  const explorerRuns = useMemo(() => {
    const query = state.q.trim().toLowerCase();
    return scopedRuns.filter((run) => {
      if (!runMatchesView(run, state.view)) return false;
      if (!query) return true;
      return [run.workflowName, run.name, run.branch, run.actor, run.runNumber, run.event, ...run.prNumbers]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [state.q, state.view, scopedRuns]);

  // Any filter change resets the table to its first page.
  const paginationKey = [filters.workflow, filters.branch, filters.actor, filters.pr, state.period, state.q, state.view].join("|");
  const visibleRunCount = pagination.key === paginationKey ? pagination.count : PAGE_SIZE;

  const recentFailures = useMemo(
    () => scopedRuns.filter((run) => isFailedRun(run) && Date.parse(run.updatedAt) >= periodEnd - RECENT_FAILURE_WINDOW_MS),
    [periodEnd, scopedRuns],
  );
  const visibleFailures = showAllFailures ? recentFailures : recentFailures.slice(0, 5);

  const stats = useMemo(() => workflowStats(scopedRuns), [scopedRuns]);
  const daily = useMemo(() => dailyTrend(scopedRuns), [scopedRuns]);

  // Default-branch health uses every loaded run: it's the current state, not the period's.
  const defaultBranch = meta?.defaultBranch ?? inferDefaultBranch(runs);
  const health = useMemo(() => (defaultBranch ? branchHealth(runs, defaultBranch) : []), [runs, defaultBranch]);

  // Failure summaries cost two requests each, so only load what's on screen.
  // Anonymous visitors get the failures panel and broken default-branch workflows;
  // with a token, failed table rows too.
  const enrichTargets = useMemo(() => {
    const brokenOnBranch = health.filter((item) => item.failing).map((item) => item.latest);
    const targets = [...brokenOnBranch, ...visibleFailures];
    if (hasToken) targets.push(...explorerRuns.slice(0, visibleRunCount).filter(isFailedRun));
    return targets;
  }, [explorerRuns, hasToken, health, visibleFailures, visibleRunCount]);
  useEffect(() => {
    enrich(enrichTargets);
  }, [enrich, enrichTargets]);

  // A run opened from a shared link may be outside the loaded window; fetch it once.
  const selectedRun = state.run === null ? null : (runs.find((run) => run.id === state.run) ?? null);
  const runsLoaded = loadedRuns !== null;
  useEffect(() => {
    const id = state.run;
    if (id === null || !runsLoaded || selectedRun || attemptedRuns.current.has(id)) return;
    attemptedRuns.current.add(id);
    loadRun(id).catch((failure) => setRunLoadError({ id, error: toLoadError(failure) }));
  }, [state.run, runsLoaded, selectedRun, loadRun]);

  const openRun = useCallback((run: ActionsRun) => update({ run: run.id }), [update]);
  const closeRun = useCallback(() => update({ run: null }), [update]);
  const clearFilters = () => {
    update({ workflow: "all", branch: "all", actor: "all", pr: "all", q: "", view: "all" });
    setShowAllFailures(false);
  };

  if (!loadedRuns) {
    return error ? <ActionsError error={error} /> : <ActionsLoading />;
  }

  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === state.period)?.label ?? "";
  const drawer =
    state.run !== null ? (
      <RunDrawer
        owner={owner}
        repo={repo}
        run={selectedRun}
        runError={runLoadError?.id === state.run ? runLoadError.error : null}
        onClose={closeRun}
        onSelectBranch={(branch) => update({ branch, run: null })}
      />
    ) : null;

  return (
    <>
      <Toolbar
        state={{ ...state, ...filters }}
        update={update}
        options={options}
        onClear={clearFilters}
        status={{ fetchedAt, loading, liveCount, refreshMs, onRefresh: refresh }}
      />

      <div className="mx-auto max-w-[1480px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {error && (
          <Banner tone="warn" icon="warning">
            {describeError(error)} Showing runs loaded {fetchedAt ? formatTime(fetchedAt) : "earlier"}.
          </Banner>
        )}
        {!isLoadedFrom(currentStartMs) && coveredSince && (
          <Banner tone="idle" icon="clock">
            Only runs since {formatTime(coveredSince)} are loaded ({runs.length} runs).
            {hasToken ? " That's the most this dashboard fetches." : " Add a token to load up to 1,000 runs."}
          </Banner>
        )}

        {runs.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState icon="workflow" title="No workflow runs found">
              {state.period === "all" ? (
                "This repository hasn't run any GitHub Actions workflows."
              ) : (
                <>
                  Nothing ran in the last {periodLabel.replace("Last ", "").toLowerCase()} or the period before.
                  <button
                    type="button"
                    onClick={() => update({ period: "all" })}
                    className="mt-3 block w-full text-xs font-semibold text-info-fg hover:underline"
                  >
                    Load the latest runs instead
                  </button>
                </>
              )}
            </EmptyState>
          </div>
        ) : (
          <>
            <Overview
              summary={summary}
              successRateDelta={successRateDelta}
              recentFailures={recentFailures.length}
              health={health}
              branch={defaultBranch}
              liveCount={liveCount}
              periodLabel={periodLabel}
              filtered={hasFilters}
              onOpenRun={openRun}
              onSelectWorkflow={(workflow) => update({ workflow })}
            />

            <section aria-label="Attention" className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
              <RecentFailures
                failures={recentFailures}
                showAll={showAllFailures}
                onToggleShowAll={() => setShowAllFailures((current) => !current)}
                onOpenRun={openRun}
              />
              <ReliabilityWatch stats={stats} selected={filters.workflow} onSelect={(workflow) => update({ workflow })} />
            </section>

            <Trends daily={daily} workflows={stats} />

            <RunExplorer
              scopedRuns={scopedRuns}
              runs={explorerRuns}
              view={state.view}
              onViewChange={(view) => update({ view })}
              query={state.q}
              onQueryChange={(q) => update({ q })}
              visibleCount={visibleRunCount}
              onLoadMore={() => setPagination({ key: paginationKey, count: visibleRunCount + PAGE_SIZE })}
              hasFilters={hasFilters}
              onClear={clearFilters}
              onOpenRun={openRun}
              onSelectPr={(pr) => update({ pr: String(pr) })}
            />
          </>
        )}

        <footer className="flex flex-col justify-between gap-2 border-t border-line py-4 text-xs text-fg-subtle sm:flex-row">
          <span>
            Loaded from the GitHub API in your browser. Refreshes every{" "}
            {refreshMs < 60_000 ? `${refreshMs / 1000} seconds` : refreshMs === 60_000 ? "minute" : `${refreshMs / 60_000} minutes`}
            {liveCount > 0 ? " while runs are active" : ""}.
          </span>
          <span>Duration is workflow elapsed time, not billed job-minutes.</span>
        </footer>
      </div>
      {drawer}
    </>
  );
}

function Banner({ tone, icon, children }: { tone: "warn" | "idle"; icon: "warning" | "clock"; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
        tone === "warn" ? "border-warn-line bg-warn-soft text-warn-fg" : "border-line bg-surface text-fg-muted"
      }`}
    >
      <Icon name={icon} className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
