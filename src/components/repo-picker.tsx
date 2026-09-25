"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { parseRepo } from "@/lib/parse-repo";

/** Repo input accepting `owner/repo` or any GitHub URL; navigates to its overview. */
export function RepoPicker() {
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

  return (
    <form onSubmit={submit}>
      <div className="flex gap-2">
        <label
          className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border bg-surface px-3 transition-colors focus-within:border-info ${
            invalid ? "border-bad-line" : "border-line"
          }`}
        >
          <Icon name="search" className="size-4 shrink-0 text-fg-subtle" />
          <span className="sr-only">Repository</span>
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
            placeholder="owner/repo or https://github.com/owner/repo"
            aria-invalid={invalid}
            autoFocus
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-[13px] text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
        </label>
        <button type="submit" className="h-10 shrink-0 rounded-md bg-fg px-4 text-[13px] font-medium text-surface transition-opacity hover:opacity-90">
          Open
        </button>
      </div>
      {invalid && <p className="mt-2 text-xs text-bad-fg">Enter a repo as owner/repo or paste its GitHub URL.</p>}
    </form>
  );
}
