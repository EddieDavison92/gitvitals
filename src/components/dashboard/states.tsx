import Link from "next/link";
import { Icon } from "@/components/icon";
import { formatTime } from "@/lib/format";
import type { LoadError } from "@/lib/repo-store";
import { BADGE } from "./tones";

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

export function ErrorPage({
  header,
  error,
  owner,
  repo,
}: {
  header: React.ReactNode;
  error: LoadError;
  owner: string;
  repo: string;
}) {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      {header}
      <div className="mx-auto grid max-w-xl place-items-center px-6 py-24 text-center">
        <div className={`grid size-11 place-items-center rounded-full border ${BADGE.warn}`}>
          <Icon name="warning" className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Couldn&apos;t load {owner}/{repo}
        </h1>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{describeError(error)}</p>
        <Link
          href="/"
          className="mt-5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg-2 shadow-card hover:bg-surface-2"
        >
          Try another repository
        </Link>
      </div>
    </main>
  );
}

export function LoadingDashboard({ header }: { header: React.ReactNode }) {
  const block = "animate-pulse rounded-2xl border border-line bg-surface";
  return (
    <main className="min-h-screen bg-canvas text-fg" aria-busy="true">
      {header}
      <div className="h-14 border-b border-line bg-surface" />
      <div className="mx-auto max-w-[1480px] space-y-5 px-4 py-7 sm:px-6 lg:px-8">
        <div className="h-8 w-72 animate-pulse rounded-lg bg-surface-3" />
        <div className={`h-12 ${block}`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className={`h-32 ${block}`} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
          <div className={`h-96 ${block}`} />
          <div className={`h-96 ${block}`} />
        </div>
      </div>
    </main>
  );
}
