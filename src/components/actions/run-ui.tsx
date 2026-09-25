"use client";

import { Icon } from "@/components/icon";
import { Badge, Dot } from "@/components/ui/primitives";
import { formatDuration } from "@/lib/format";
import { elapsedMs, isActiveRun, runTone, statusLabel } from "@/lib/run-status";
import type { ActionsRun } from "@/lib/types";
import { useNow } from "@/lib/use-now";

export function StatusBadge({ run, className = "" }: { run: ActionsRun; className?: string }) {
  const tone = runTone(run);
  return (
    <Badge tone={tone} className={className}>
      {isActiveRun(run) && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {statusLabel(run)}
    </Badge>
  );
}

export function StatusDot({ run }: { run: ActionsRun }) {
  return <Dot tone={runTone(run)} pulse={isActiveRun(run)} />;
}

/** Re-run marker: shows the attempt number when a run was retried. */
export function AttemptBadge({ run }: { run: ActionsRun }) {
  if (run.attempt <= 1) return null;
  return (
    <span title={`Attempt ${run.attempt}`} className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[11px] text-warn-fg">
      <Icon name="retry" className="size-3" />
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
