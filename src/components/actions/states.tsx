import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { formatTime } from "@/lib/format";
import type { LoadError } from "@/lib/repo-store";

export function describeError(error: LoadError) {
  switch (error.kind) {
    case "rate_limited":
      return `GitHub's hourly request limit is used up until ${formatTime(error.resetAt)}. Add a token to raise it.`;
    case "not_found":
      return "Not found. If the repository is private, add a token that can read it.";
    case "bad_token":
      return "GitHub rejected the saved token. Replace or remove it.";
    case "other":
      return `Couldn't load from GitHub: ${error.message}.`;
  }
}

export function ActionsError({ error }: { error: LoadError }) {
  return (
    <EmptyState icon="warning" tone="warn" title="Couldn't load workflow runs" className="min-h-96">
      {error.kind === "not_found" ? "This repository has Actions disabled, or it's private." : describeError(error)}
    </EmptyState>
  );
}

export function ActionsLoading() {
  const block = "rounded-2xl border border-line";
  return (
    <div aria-busy="true">
      <div className="h-12 border-b border-line bg-surface-2" />
      <div className="mx-auto max-w-[1480px] space-y-5 px-4 py-7 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className={`h-12 ${block}`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className={`h-32 ${block}`} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className={`h-96 ${block}`} />
          <Skeleton className={`h-96 ${block}`} />
        </div>
      </div>
    </div>
  );
}
