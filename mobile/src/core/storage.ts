import Storage from 'expo-sqlite/kv-store';

// Small JSON helpers on top of the on-device key-value store.
// Failures never crash the app: storage is a convenience, not a source of truth.
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    Storage.setItemSync(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
