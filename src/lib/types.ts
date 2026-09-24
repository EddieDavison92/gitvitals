export type RunStatus = "queued" | "in_progress" | "completed";

export type RunConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "stale"
  | "startup_failure"
  | null;

export type ActionsRun = {
  id: number;
  attempt: number;
  name: string;
  workflowName: string;
  branch: string;
  event: string;
  status: RunStatus;
  conclusion: RunConclusion;
  url: string;
  actor: string;
  runNumber: number;
  prNumbers: number[];
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  durationMs: number;
  failureSummary: string | null;
  failurePoints: string[];
};

export type FailureDetail = {
  summary: string;
  points: string[];
};

export type ActionsHistoryResponse = {
  owner: string;
  repo: string;
  generatedAt: string | null;
  runs: ActionsRun[];
};

export type RepoMeta = {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  isArchived: boolean;
  stars: number;
  avatarUrl: string;
  htmlUrl: string;
};

export type JobStep = {
  name: string;
  number: number;
  status: RunStatus;
  conclusion: RunConclusion;
  startedAt: string | null;
  completedAt: string | null;
};

export type RunJob = {
  id: number;
  name: string;
  status: RunStatus;
  conclusion: RunConclusion;
  url: string;
  startedAt: string | null;
  completedAt: string | null;
  runnerName: string | null;
  labels: string[];
  steps: JobStep[];
};

export type Annotation = {
  level: "notice" | "warning" | "failure";
  message: string;
  title: string | null;
  /** `path:line`, or null for annotations not tied to a file. */
  location: string | null;
};

export type RunJobs = {
  jobs: RunJob[];
  /** Keyed by job id; only fetched for failed jobs. */
  annotations: Record<number, Annotation[]>;
};

export type RateLimit = {
  limit: number;
  remaining: number;
  resetAt: number;
};
