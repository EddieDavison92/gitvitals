"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseRepo } from "@/lib/parse-repo";

/** Repo input accepting `owner/repo` or any GitHub URL; navigates to its dashboard. */
export function RepoPicker({ variant = "hero" }: { variant?: "hero" | "compact" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseRepo(value);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setValue("");
    router.push(`/${parsed.owner}/${parsed.repo}`);
  };

  if (variant === "compact") {
    return (
      <form onSubmit={submit} className="hidden lg:block">
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          placeholder="Switch repo: owner/repo"
          aria-label="Switch repository"
          aria-invalid={invalid}
          spellCheck={false}
          className={`h-8 w-56 rounded-lg border bg-white/5 px-3 text-xs text-white outline-none transition placeholder:text-slate-500 focus:w-72 focus:bg-white/10 ${
            invalid ? "border-rose-400/60" : "border-white/10 focus:border-sky-400/60"
          }`}
        />
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-white p-2 shadow-lg shadow-slate-950/[0.06] transition focus-within:ring-4 ${
          invalid ? "border-rose-300 focus-within:ring-rose-100" : "border-slate-200 focus-within:border-sky-300 focus-within:ring-sky-100"
        }`}
      >
        <span className="pl-2 font-mono text-sm text-slate-400">github.com/</span>
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          placeholder="owner/repo"
          aria-label="Repository"
          aria-invalid={invalid}
          autoFocus
          spellCheck={false}
          className="h-10 min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-900 outline-none placeholder:text-slate-300"
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          View runs
        </button>
      </div>
      {invalid && (
        <p className="mt-2 pl-2 text-xs text-rose-600">
          Enter a repo as owner/repo or paste its GitHub URL.
        </p>
      )}
    </form>
  );
}
