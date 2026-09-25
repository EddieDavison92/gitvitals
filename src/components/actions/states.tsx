import { EmptyState, Panel, Skeleton } from "@/components/ui/primitives";
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
    <Panel>
      <EmptyState icon="warning" title="Couldn't load workflow runs" className="py-16">
        {error.kind === "not_found" ? "This repository has Actions disabled, or it's private." : describeError(error)}
      </EmptyState>
    </Panel>
  );
}

export function ActionsLoading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}
