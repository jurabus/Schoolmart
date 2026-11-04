import { readJSON, writeJSON } from './storage';

// Orders placed on THIS device, so customers can re-open them without retyping.
// Only the code and phone are kept; full details are always fetched securely.
export interface RecentOrder { code: string; phone: string; at: string }
const KEY = 'recent_orders_v1';

export const getRecentOrders = (): RecentOrder[] => {
  const v = readJSON<unknown>(KEY, []);
  return Array.isArray(v) ? (v as RecentOrder[]).filter(o => o && typeof o.code === 'string' && typeof o.phone === 'string') : [];
};

export function addRecentOrder(o: RecentOrder) {
  writeJSON(KEY, [o, ...getRecentOrders().filter(x => x.code !== o.code)].slice(0, 20));
}

export function removeRecentOrder(code: string) {
  writeJSON(KEY, getRecentOrders().filter(x => x.code !== code));
}
