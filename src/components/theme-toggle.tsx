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
      className="grid size-8 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
    >
      <Icon name={ICON[preference]} className="size-4" />
    </button>
  );
}
