export type IconName =
  | "activity"
  | "archive"
  | "arrow-up-right"
  | "branch"
  | "check"
  | "chevron"
  | "chevron-down"
  | "clock"
  | "filter"
  | "lock"
  | "monitor"
  | "moon"
  | "pulse"
  | "refresh"
  | "retry"
  | "search"
  | "star"
  | "sun"
  | "warning"
  | "workflow"
  | "x";

const PATHS: Record<IconName, React.ReactNode> = {
  activity: <path d="M4 12h3l2-7 4 14 2-7h5" />,
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="19" r="2" />
      <path d="M6 7v10M8 8c4 0 3-2 8-2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  pulse: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7 12h2l1.5-4 3 8 1.5-4h2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.9-3M4 5v3h3" />
      <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-3h-3" />
    </>
  ),
  retry: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 4v4h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.5.7-4 3.8 1 5.5-4.9-2.7L7.1 19l1-5.5-4-3.8 5.5-.7Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 4.2 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  workflow: (
    <>
      <rect x="3" y="4" width="6" height="6" rx="2" />
      <rect x="15" y="14" width="6" height="6" rx="2" />
      <path d="M9 7h3a4 4 0 0 1 4 4v3M6 10v4a3 3 0 0 0 3 3h6" />
    </>
  ),
  x: <path d="m7 7 10 10M17 7 7 17" />,
};

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
