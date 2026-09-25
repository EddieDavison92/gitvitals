/** localStorage helpers. Every key is scoped under "gv:"; per-repo keys include the lower-case repo key. */

export const RECENT_REPOS_KEY = "gv:recent";
const MAX_REPOS = 8;
/** Prefixes of per-repo keys, cleared when a repo drops off the recent list. */
const REPO_PREFIXES = ["gv:runs:", "gv:r:"];

export function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable or full. */
export function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage blocked.
  }
}

export function repoKey(owner: string, repo: string) {
  return `${owner}/${repo}`.toLowerCase();
}

/** Parses the stored recent-repo list (`owner/repo`, newest first). */
export function parseRecentRepos(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function clearRepo(key: string) {
  try {
    const storage = window.localStorage;
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const stored = storage.key(index);
      if (stored && REPO_PREFIXES.some((prefix) => stored === `${prefix}${key}` || stored.startsWith(`${prefix}${key}:`))) {
        doomed.push(stored);
      }
    }
    doomed.forEach((stored) => storage.removeItem(stored));
  } catch {
    // Storage blocked.
  }
}

/** Moves a repo to the front of the recent list, clearing data for repos that fall off it. */
export function touchRecentRepo(displayName: string) {
  const key = displayName.toLowerCase();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_REPOS_KEY);
  } catch {
    return;
  }
  const recent = parseRecentRepos(raw).filter((name) => name.toLowerCase() !== key);
  if (raw !== null && parseRecentRepos(raw)[0] === displayName) return;
  recent.slice(MAX_REPOS - 1).forEach((name) => clearRepo(name.toLowerCase()));
  writeJSON(RECENT_REPOS_KEY, [displayName, ...recent.slice(0, MAX_REPOS - 1)]);
  // "storage" events only reach other tabs; tell this one too.
  if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("gv:recent"));
}
