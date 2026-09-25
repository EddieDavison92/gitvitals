"use client";

import { useEffect, useRef, useState } from "react";
import { BUTTON_SM } from "@/components/ui/primitives";
import { useRateLimits } from "@/lib/rate-limit";
import { setToken, useToken } from "@/lib/token-store";
import type { RateLimit } from "@/lib/types";

const NEW_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?name=gitvitals&description=Read-only%20access%20for%20gitvitals&actions=read&contents=read&issues=read&pull_requests=read&metadata=read";

function formatReset(resetAt: number) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(resetAt));
}

function isLow(limit: RateLimit | null) {
  return limit !== null && limit.remaining < Math.min(10, limit.limit / 5);
}

function LimitRow({ label, limit, period }: { label: string; limit: RateLimit | null; period: string }) {
  if (!limit) return null;
  const share = limit.limit === 0 ? 0 : limit.remaining / limit.limit;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono tabular-nums text-fg-2">
          {limit.remaining}/{limit.limit}
          <span className="text-fg-subtle"> {period}</span>
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${isLow(limit) ? "bg-warn" : "bg-fg-subtle"}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-fg-subtle">Resets at {formatReset(limit.resetAt)}</p>
    </div>
  );
}

/** Sidebar control for the optional GitHub token, showing remaining API requests. */
export function TokenSettings() {
  const token = useToken();
  const { core, search } = useRateLimits();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const low = isLow(core);
  const share = core && core.limit > 0 ? core.remaining / core.limit : null;

  return (
    <div ref={panelRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-surface-3"
        title="GitHub API usage and token"
      >
        <span className={`size-1.5 shrink-0 rounded-full ${token ? "bg-ok" : "bg-fg-subtle"}`} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-xs ${low ? "text-warn-fg" : "text-fg-muted"}`}>
            {token ? "Token" : "No token"}
            {core && (
              <span className="font-mono tabular-nums">
                {" "}
                · {core.remaining}/{core.limit}
              </span>
            )}
          </span>
          {share !== null && (
            <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-surface-3">
              <span className={`block h-full ${low ? "bg-warn" : "bg-fg-subtle"}`} style={{ width: `${share * 100}%` }} />
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-lg border border-line bg-surface p-3.5 text-fg-2 shadow-xl shadow-black/15">
          <div>
            <p className="text-[13px] font-medium text-fg">GitHub API</p>
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              Without a token GitHub allows 60 requests an hour per IP. A token raises that to 5,000, samples more history,
              and unlocks private repos and traffic for repos you can push to. It stays in this browser and is only sent to
              api.github.com.
            </p>
          </div>
          <LimitRow label="Requests" limit={core} period="per hour" />
          <LimitRow label="Searches" limit={search} period="per minute" />

          {token ? (
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="font-mono text-xs text-fg-muted">
                {token.slice(0, 11)}…{token.slice(-4)}
              </span>
              <button type="button" onClick={() => setToken(null)} className={`${BUTTON_SM} hover:text-bad-fg`}>
                Remove
              </button>
            </div>
          ) : (
            <form
              className="space-y-2 border-t border-line pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim()) {
                  setToken(draft.trim());
                  setDraft("");
                  setOpen(false);
                }
              }}
            >
              <input
                type="password"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="github_pat_…"
                aria-label="GitHub token"
                autoComplete="off"
                spellCheck={false}
                className="h-8 w-full rounded-md border border-line bg-surface-2 px-2.5 font-mono text-xs text-fg outline-none placeholder:text-fg-subtle focus:border-info"
              />
              <div className="flex items-center justify-between gap-3">
                <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="text-xs text-info-fg hover:underline">
                  Create a read-only token
                </a>
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="h-7 rounded-md bg-fg px-2.5 text-xs font-medium text-surface disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
