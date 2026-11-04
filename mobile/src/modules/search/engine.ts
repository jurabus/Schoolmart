import { sb, type Mode } from '@/core/supabase';
import { readJSON, writeJSON } from '@/core/storage';

export interface SearchHit {
  id: string; name: string; snippet: string; image_url: string | null;
  price: number; mode: Mode; business_id: string; business_name: string;
}

export const SUGGEST_LIMIT = 5;
export const PAGE_SIZE = 20;

export const normalizeQuery = (q: string) => q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);

// Small in-memory cache: retyping or deleting a letter shows results instantly.
const cache = new Map<string, SearchHit[]>();
const CACHE_MAX = 150;

export async function searchProducts(q: string, limit: number, offset = 0): Promise<SearchHit[]> {
  const nq = normalizeQuery(q);
  if (!nq) return [];
  const key = `${nq}|${limit}|${offset}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; } // refresh LRU position
  const { data, error } = await sb.rpc('search_products', { p_q: nq, p_limit: limit, p_offset: offset });
  if (error) throw new Error(error.message);
  const rows = (data || []) as SearchHit[];
  cache.set(key, rows);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return rows;
}

// Recent searches (kept on this device only).
const RECENT_KEY = 'recent_searches_v1';
export const getRecent = (): string[] => {
  const v = readJSON<unknown>(RECENT_KEY, []);
  return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 8) : [];
};
export function addRecent(q: string) {
  const t = q.trim();
  if (!t) return;
  writeJSON(RECENT_KEY, [t, ...getRecent().filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 8));
}
export const clearRecent = () => writeJSON(RECENT_KEY, []);
