"use client";

import { Icon } from "@/components/icon";
import { BADGE, DOT } from "@/components/ui/tones";
import { formatDuration } from "@/lib/format";
import { elapsedMs, isActiveRun, runTone, statusLabel } from "@/lib/run-status";
import type { ActionsRun } from "@/lib/types";
import { useNow } from "@/lib/use-now";

export function StatusBadge({ run, className = "" }: { run: ActionsRun; className?: string }) {
  const tone = runTone(run);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE[tone]} ${className}`}
    >
      {isActiveRun(run) && <span className={`size-1.5 animate-pulse rounded-full ${DOT[tone]}`} />}
      {statusLabel(run)}
    </span>
  );
}

export function StatusDot({ run }: { run: ActionsRun }) {
  const tone = runTone(run);
  return (
    <span className="relative flex size-2 shrink-0">
      {isActiveRun(run) && <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${DOT[tone]}`} />}
      <span className={`relative size-2 rounded-full ${DOT[tone]}`} />
    </span>
  );
}

/** Re-run marker: shows the attempt number when a run was retried. */
export function AttemptBadge({ run }: { run: ActionsRun }) {
  if (run.attempt <= 1) return null;
  return (
    <span
      title={`Attempt ${run.attempt}`}
      className="inline-flex items-center gap-0.5 rounded border border-warn-line bg-warn-soft px-1 font-mono text-[10px] font-semibold text-warn-fg"
    >
      <Icon name="retry" className="size-2.5" />
      {run.attempt}
    </span>
  );
}

/** Run duration that counts up once a second while the run is active. */
export function LiveDuration({ run }: { run: ActionsRun }) {
  const active = isActiveRun(run);
  const now = useNow(1000, active);
  return <>{formatDuration(active ? elapsedMs(run, now) : run.durationMs)}</>;
}
