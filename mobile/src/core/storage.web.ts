// Web build only (used for previews): browser localStorage instead of SQLite.
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
