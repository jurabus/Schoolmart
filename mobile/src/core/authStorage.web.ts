// Web preview build: browser localStorage.
export const authStorage = {
  getItem: async (key: string) => { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } },
  setItem: async (key: string, value: string) => { try { globalThis.localStorage?.setItem(key, value); } catch { /* ignore */ } },
  removeItem: async (key: string) => { try { globalThis.localStorage?.removeItem(key); } catch { /* ignore */ } },
};
