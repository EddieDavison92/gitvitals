"use client";

import { useEffect, useRef, useState } from "react";
import { useRateLimit } from "@/lib/repo-store";
import { setToken, useToken } from "@/lib/token-store";

const NEW_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?name=gh-actions-observability&actions=read";

function formatReset(resetAt: number) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(resetAt));
}

/** Header button with a popover for the optional GitHub token and the current rate limit. */
export function TokenSettings() {
  const token = useToken();
  const rateLimit = useRateLimit();
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

  const low = rateLimit !== null && rateLimit.remaining < Math.min(10, rateLimit.limit / 5);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
          low
            ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
        }`}
      >
        <span className={`size-1.5 rounded-full ${token ? "bg-emerald-400" : "bg-slate-500"}`} />
        {token ? "Token" : "Add token"}
        {rateLimit && (
          <span className="hidden font-mono text-[10px] text-slate-400 sm:inline">
            {rateLimit.remaining}/{rateLimit.limit}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl shadow-slate-950/20">
          <p className="text-sm font-semibold text-slate-950">GitHub token (optional)</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Without a token GitHub allows 60 requests an hour per IP. A token raises that to 5,000
            and lets you view private repos. It stays in this browser and is only sent to
            api.github.com.
          </p>

          {rateLimit && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${low ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600"}`}>
              {rateLimit.remaining} of {rateLimit.limit} requests left, resets at {formatReset(rateLimit.resetAt)}.
            </p>
          )}

          {token ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-slate-500">
                {token.slice(0, 11)}…{token.slice(-4)}
              </span>
              <button
                type="button"
                onClick={() => setToken(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <form
              className="mt-3 space-y-2"
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
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
              <div className="flex items-center justify-between gap-3">
                <a
                  href={NEW_TOKEN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-sky-700 hover:text-sky-800"
                >
                  Create a read-only token
                </a>
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
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
