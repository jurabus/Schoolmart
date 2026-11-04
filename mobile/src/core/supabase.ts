import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

// Customers never sign in, so no auth session is stored on the device.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export type Mode = 'order' | 'preorder' | 'unavailable';

export interface Category { id: string; title: string; image_url: string | null }
export interface Subcategory { id: string; title: string; image_url: string | null; category_id: string }
export interface Product {
  id: string; name: string; description: string; image_url: string | null;
  price: number; mode: Mode; subcategory_id?: string;
}

export interface OrderItem {
  position: number; product_name: string; product_description: string;
  mode: Mode; unit_price: number; quantity: number; line_total: number;
}
export interface Order {
  order_code: string; first_name: string; last_name: string; phone: string; address: string;
  status: 'new' | 'confirmed' | 'delivered' | 'cancelled';
  subtotal: number; delivery_fee: number; total: number; created_at: string;
}
export type LookupResult =
  | { order: Order; items: OrderItem[]; error?: undefined }
  | { error: 'not_found' | 'rate_limited'; order?: undefined; items?: undefined };

export const isUuid = (s: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s ?? ''));

export async function lookupOrder(phone: string, code: string): Promise<LookupResult> {
  const { data, error } = await sb.rpc('lookup_order', { p_phone: phone, p_code: code });
  if (error || !data) return { error: 'not_found' };
  return data as LookupResult;
}
