import type { RunTone } from "@/lib/run-status";

export type Tone = RunTone | "info";

/** Status badge: soft tint and coloured text. */
export const BADGE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok-fg",
  bad: "bg-bad-soft text-bad-fg",
  warn: "bg-warn-soft text-warn-fg",
  info: "bg-info-soft text-info-fg",
  idle: "bg-idle-soft text-idle-fg",
};

export const DOT: Record<Tone, string> = {
  ok: "bg-ok",
  bad: "bg-bad",
  warn: "bg-warn",
  info: "bg-info",
  idle: "bg-idle",
};

export const TEXT: Record<Tone, string> = {
  ok: "text-ok-fg",
  bad: "text-bad-fg",
  warn: "text-warn-fg",
  info: "text-info-fg",
  idle: "text-fg-muted",
};

/** Green at 95%+, amber at 85%+, red below; idle when there's no rate. */
export function rateTone(rate: number | null): Tone {
  if (rate === null) return "idle";
  return rate >= 95 ? "ok" : rate >= 85 ? "warn" : "bad";
}
