import Storage from 'expo-sqlite/kv-store';

// Keeps the login session on the device (SQLite key-value store).
export const authStorage = {
  getItem: (key: string) => Storage.getItem(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
  removeItem: async (key: string) => { await Storage.removeItem(key); },
};
