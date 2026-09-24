import { PERIOD_OPTIONS, type PeriodFilter } from "./periods";

export type RunView = "all" | "failed" | "running" | "successful";

/** Dashboard view state, mirrored in the query string so links are shareable. */
export type DashboardState = {
  period: PeriodFilter;
  workflow: string;
  branch: string;
  actor: string;
  pr: string;
  view: RunView;
  q: string;
  /** Run open in the drawer. */
  run: number | null;
};

export const DEFAULT_STATE: DashboardState = {
  period: "7d",
  workflow: "all",
  branch: "all",
  actor: "all",
  pr: "all",
  view: "all",
  q: "",
  run: null,
};

const VIEWS: RunView[] = ["all", "failed", "running", "successful"];

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDashboardState(params: Params): DashboardState {
  const period = first(params.period);
  const view = first(params.view);
  const run = Number(first(params.run));
  const text = (key: keyof Params) => first(params[key])?.trim() || undefined;
  return {
    period: PERIOD_OPTIONS.some((option) => option.value === period) ? (period as PeriodFilter) : DEFAULT_STATE.period,
    workflow: text("workflow") ?? "all",
    branch: text("branch") ?? "all",
    actor: text("actor") ?? "all",
    pr: /^\d+$/.test(text("pr") ?? "") ? text("pr")! : "all",
    view: VIEWS.includes(view as RunView) ? (view as RunView) : "all",
    q: first(params.q) ?? "",
    run: Number.isSafeInteger(run) && run > 0 ? run : null,
  };
}

/** Query string for `state`, omitting defaults; empty when everything is default. */
export function serializeDashboardState(state: DashboardState) {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_STATE) as Array<keyof DashboardState>) {
    const value = state[key];
    if (value !== DEFAULT_STATE[key] && value !== null && value !== "") params.set(key, String(value));
  }
  return params.toString();
}
