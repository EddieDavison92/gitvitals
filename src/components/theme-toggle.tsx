"use client";

import { Icon, type IconName } from "@/components/icon";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";

const NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
const ICON: Record<ThemePreference, IconName> = { system: "monitor", light: "sun", dark: "moon" };
const LABEL: Record<ThemePreference, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

/** Cycles system → light → dark. */
export function ThemeToggle() {
  const preference = useThemePreference();
  return (
    <button
      type="button"
      onClick={() => setThemePreference(NEXT[preference])}
      title={`${LABEL[preference]} (click to change)`}
      aria-label={`${LABEL[preference]}. Switch to ${LABEL[NEXT[preference]].toLowerCase()}`}
      className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
    >
      <Icon name={ICON[preference]} className="size-4" />
    </button>
  );
}
