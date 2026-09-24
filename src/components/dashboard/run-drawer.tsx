"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { failureMessages } from "@/lib/github";
import { formatDuration, formatTime, plural } from "@/lib/format";
import { useRunJobs, type LoadError } from "@/lib/repo-store";
import { failureHeadline, isActiveRun, isFailedRun, queueMs, spanMs, statusLabel, toneOf } from "@/lib/run-status";
import type { ActionsRun, RunJob, RunJobs } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { describeError } from "./states";
import { BADGE, DOT, TEXT } from "./tones";
import { AttemptBadge, LiveDuration, RelativeTime, StatusBadge } from "./ui";

/** Side panel with a run's details, jobs, steps and failure annotations. */
export function RunDrawer({
  owner,
  repo,
  run,
  runError,
  onClose,
  onSelectBranch,
}: {
  owner: string;
  repo: string;
  /** Null while a run from the URL is still loading. */
  run: ActionsRun | null;
  runError: LoadError | null;
  onClose: () => void;
  onSelectBranch: (branch: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { jobs, error: jobsError, loading } = useRunJobs(owner, repo, run);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-drawer-title"
        className="relative flex h-full w-full max-w-[640px] flex-col border-l border-line bg-canvas shadow-2xl animate-[drawer-in_180ms_ease-out]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {run && <StatusBadge run={run} />}
            <p id="run-drawer-title" className="truncate text-sm font-semibold text-fg">
              {run ? (
                <>
                  {run.workflowName}
                  <span className="ml-1.5 font-mono text-xs font-medium text-fg-subtle">#{run.runNumber}</span>
                </>
              ) : (
                "Loading run…"
              )}
            </p>
            {run && <AttemptBadge run={run} />}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {run && (
              <a
                href={run.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-info-fg hover:bg-info-soft"
              >
                GitHub
                <Icon name="arrow-up-right" className="size-3.5" />
              </a>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"
            >
              <Icon name="x" className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {runError ? (
            <p className={`rounded-xl border px-4 py-3 text-sm ${BADGE.warn}`}>{describeError(runError)}</p>
          ) : !run ? (
            <DrawerSkeleton />
          ) : (
            <>
              <RunFacts run={run} onSelectBranch={onSelectBranch} />
              {isFailedRun(run) && failureHeadline(run) && (
                <div className={`rounded-xl border px-4 py-3 ${BADGE.bad}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">Why it failed</p>
                  <p className="mt-1 text-sm font-medium">{failureHeadline(run)}</p>
                </div>
              )}
              <JobsSection run={run} jobs={jobs} error={jobsError} loading={loading && !jobs} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function RunFacts({ run, onSelectBranch }: { run: ActionsRun; onSelectBranch: (branch: string) => void }) {
  const queue = queueMs(run);
  const facts: Array<[string, React.ReactNode]> = [
    [
      "Branch",
      <button key="branch" type="button" onClick={() => onSelectBranch(run.branch)} className="truncate font-mono text-info-fg hover:underline">
        {run.branch}
      </button>,
    ],
    ["Event", run.event.replaceAll("_", " ")],
    ["Triggered by", run.actor],
    [
      "Pull request",
      run.prNumbers.length > 0
        ? run.prNumbers.map((pr) => (
            <a key={pr} href={`${run.url.split("/actions/")[0]}/pull/${pr}`} target="_blank" rel="noreferrer" className="mr-2 text-info-fg hover:underline">
              #{pr}
            </a>
          ))
        : "–",
    ],
    ["Started", <RelativeTime key="started" value={run.startedAt} />],
    ["Duration", <LiveDuration key="duration" run={run} />],
    ["Queued for", queue === null ? "–" : formatDuration(queue)],
    ["Attempt", run.attempt > 1 ? `${run.attempt} (re-run)` : "1"],
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold leading-snug tracking-tight text-fg">{run.name}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fg-subtle">{label}</dt>
            <dd className="mt-0.5 truncate text-sm text-fg-2">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function JobsSection({
  run,
  jobs,
  error,
  loading,
}: {
  run: ActionsRun;
  jobs: RunJobs | null;
  error: LoadError | null;
  loading: boolean;
}) {
  const now = useNow(1000, isActiveRun(run));
  if (error) return <p className={`rounded-xl border px-4 py-3 text-sm ${BADGE.warn}`}>{describeError(error)}</p>;
  if (loading || !jobs) return <DrawerSkeleton rows={4} />;
  if (jobs.jobs.length === 0) {
    return <p className="text-sm text-fg-muted">No jobs ran for this attempt.</p>;
  }

  // Waterfall bounds: first job start to last job end (or now while running).
  const starts = jobs.jobs.map((job) => (job.startedAt ? new Date(job.startedAt).getTime() : NaN)).filter(Number.isFinite);
  const ends = jobs.jobs.map((job) => (job.completedAt ? new Date(job.completedAt).getTime() : now));
  const windowStart = starts.length ? Math.min(...starts) : now;
  const windowMs = Math.max(1, Math.max(...ends) - windowStart);
  const failed = jobs.jobs.filter((job) => job.conclusion === "failure").length;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">Jobs</h3>
        <p className="text-xs text-fg-muted">
          {plural(jobs.jobs.length, "job")}
          {failed > 0 && <span className={TEXT.bad}> · {failed} failed</span>}
        </p>
      </div>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {jobs.jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            annotations={jobs.annotations[job.id]}
            now={now}
            offset={job.startedAt ? (new Date(job.startedAt).getTime() - windowStart) / windowMs : 0}
            width={(spanMs(job.startedAt, job.completedAt, now) ?? 0) / windowMs}
          />
        ))}
      </ul>
    </section>
  );
}

function JobRow({
  job,
  annotations,
  now,
  offset,
  width,
}: {
  job: RunJob;
  annotations: RunJobs["annotations"][number] | undefined;
  now: number;
  offset: number;
  width: number;
}) {
  const tone = toneOf(job.status, job.conclusion);
  const [open, setOpen] = useState(tone === "bad" || tone === "warn");
  const duration = spanMs(job.startedAt, job.completedAt, now);
  const messages = failureMessages(annotations ?? []);

  return (
    <li className="border-b border-line-soft last:border-b-0">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="w-full px-4 py-3 text-left hover:bg-surface-2">
        <span className="flex items-center gap-2.5">
          <Icon name="chevron" className={`size-3.5 shrink-0 text-fg-subtle transition ${open ? "rotate-90" : ""}`} />
          <span className={`size-2 shrink-0 rounded-full ${DOT[tone]} ${tone === "warn" ? "animate-pulse" : ""}`} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{job.name}</span>
          <span className="shrink-0 font-mono text-[11px] text-fg-muted tabular-nums">
            {duration === null ? statusLabel(job) : formatDuration(duration)}
          </span>
        </span>
        <span className="mt-2 ml-6 block h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <span
            className={`block h-full rounded-full ${DOT[tone]} opacity-70`}
            style={{ marginLeft: `${Math.min(offset, 1) * 100}%`, width: `${Math.max(Math.min(width, 1 - offset), 0.01) * 100}%` }}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 pl-10">
          {messages.length > 0 && (
            <ul className={`space-y-1.5 rounded-lg border px-3 py-2.5 text-xs ${BADGE.bad}`}>
              {messages.slice(0, 5).map((message) => (
                <li key={message} className="font-mono leading-5 break-words">
                  {message}
                </li>
              ))}
            </ul>
          )}
          {job.steps.length > 0 ? (
            <ol className="space-y-1">
              {job.steps.map((step) => {
                const stepTone = toneOf(step.status, step.conclusion);
                const stepDuration = spanMs(step.startedAt, step.completedAt, now);
                return (
                  <li key={step.number} className={`flex items-center gap-2 text-xs ${stepTone === "bad" ? "font-medium text-bad-fg" : "text-fg-2"}`}>
                    <span className={`size-1.5 shrink-0 rounded-full ${DOT[stepTone]}`} />
                    <span className="min-w-0 flex-1 truncate">{step.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-fg-subtle tabular-nums">
                      {step.conclusion === "skipped" ? "skipped" : stepDuration === null ? "" : formatDuration(stepDuration)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-xs text-fg-muted">{job.status === "queued" ? "Waiting for a runner." : "No steps reported."}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
            {job.runnerName && <span>Runner {job.runnerName}</span>}
            {job.labels.length > 0 && <span className="font-mono">{job.labels.join(", ")}</span>}
            {job.startedAt && <span title={formatTime(job.startedAt)}>Started {formatTime(job.startedAt)}</span>}
            <a href={job.url} target="_blank" rel="noreferrer" className="font-semibold text-info-fg hover:underline">
              Logs
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

function DrawerSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-surface-3" />
      ))}
    </div>
  );
}
