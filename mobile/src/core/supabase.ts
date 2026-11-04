import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { authStorage } from './authStorage';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground (Supabase's React Native guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') sb.auth.startAutoRefresh();
    else sb.auth.stopAutoRefresh();
  });
}

export type Mode = 'order' | 'preorder' | 'unavailable';
export type OrderStatus = 'new' | 'confirmed' | 'delivered' | 'cancelled';
export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'delivered', 'cancelled'];

export interface Category { id: string; title: string; image_url: string | null }
export interface Subcategory { id: string; title: string; image_url: string | null; category_id: string }
export interface Business {
  id: string; name: string; image_url: string | null; description: string;
  address: string; contact_phone: string; active: boolean;
}
export interface Product {
  id: string; name: string; description: string; image_url: string | null;
  price: number; mode: Mode; business_id: string; subcategory_id?: string; visible?: boolean;
  businesses?: { name: string } | null;
}
export interface Customer { user_id: string; first_name: string; last_name: string; phone: string; address: string }

export interface OrderItem {
  position: number; product_name: string; product_description: string;
  mode: Mode; unit_price: number; quantity: number; line_total: number;
}
export interface Order {
  id?: string; order_code: string; first_name: string; last_name: string; phone: string; address: string;
  status: OrderStatus; subtotal: number; delivery_fee: number; total: number; created_at: string;
  business_name?: string | null;
}
export type LookupResult =
  | { order: Order; items: OrderItem[]; error?: undefined }
  | { error: 'not_found' | 'rate_limited'; order?: undefined; items?: undefined };

export const PRODUCT_COLUMNS = 'id,name,description,image_url,price,mode,business_id,businesses(name)';
export const BUSINESS_COLUMNS = 'id,name,image_url,description,address,contact_phone,active';

export const isUuid = (s: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s ?? ''));

export async function lookupOrder(phone: string, code: string): Promise<LookupResult> {
  const { data, error } = await sb.rpc('lookup_order', { p_phone: phone, p_code: code });
  if (error || !data) return { error: 'not_found' };
  return data as LookupResult;
}

/** Loads one order the signed-in user may see (their own, or their business's). */
export async function fetchOrder(id: string): Promise<{ order: Order; items: OrderItem[] } | null> {
  const { data, error } = await sb.from('orders')
    .select('id,order_code,first_name,last_name,phone,address,status,subtotal,delivery_fee,total,created_at,businesses(name),order_items(position,product_name,product_description,mode,unit_price,quantity,line_total)')
    .eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { order_items, businesses, ...o } = data as unknown as Order & { order_items: OrderItem[]; businesses: { name: string } | null };
  return { order: { ...o, business_name: businesses?.name ?? null }, items: order_items || [] };
}

/** Friendly text for errors coming from the server. */
export function friendlyError(message: string | undefined): string {
  const m = String(message || '');
  if (/invalid login credentials/i.test(m)) return 'Wrong phone number or password.';
  if (/already registered|already exists|duplicate key/i.test(m)) return 'An account with this phone number already exists.';
  if (/password should be at least|weak password/i.test(m)) return 'Please choose a stronger password (at least 8 characters).';
  if (/failed to fetch|network request failed|network/i.test(m)) return 'No connection. Please check your internet and try again.';
  if (/database error saving new user/i.test(m)) return 'We could not create your account. Please check your details and try again.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
  return m || 'Something went wrong. Please try again.';
}
