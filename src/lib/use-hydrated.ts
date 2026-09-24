"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true once client-only values (localStorage) are readable. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
