export type IconName =
  | "activity"
  | "arrow-up-right"
  | "branch"
  | "check"
  | "chevron"
  | "clock"
  | "filter"
  | "pulse"
  | "refresh"
  | "search"
  | "warning"
  | "workflow"
  | "x";

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    activity: (
      <path d="M4 12h3l2-7 4 14 2-7h5" />
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
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
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
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
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
      {paths[name]}
    </svg>
  );
}
