import type { RunTone } from "@/lib/run-status";

export type Tone = RunTone | "info";

/** Soft badge: tinted background, border and text. */
export const BADGE: Record<Tone, string> = {
  ok: "border-ok-line bg-ok-soft text-ok-fg",
  bad: "border-bad-line bg-bad-soft text-bad-fg",
  warn: "border-warn-line bg-warn-soft text-warn-fg",
  info: "border-info-line bg-info-soft text-info-fg",
  idle: "border-idle-line bg-idle-soft text-idle-fg",
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
  idle: "text-fg-subtle",
};

/** Green at 95%+, amber at 85%+, red below; idle when there's no rate. */
export function rateTone(rate: number | null): Tone {
  if (rate === null) return "idle";
  return rate >= 95 ? "ok" : rate >= 85 ? "warn" : "bad";
}
