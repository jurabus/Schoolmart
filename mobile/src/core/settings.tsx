import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sb } from './supabase';
import { readJSON, writeJSON } from './storage';

// Same keys and defaults as the website (js/common.js), so admin → Settings controls both.
export const DEFAULT_SETTINGS = {
  store_name: 'SchoolMart',
  logo_url: '',
  banner_url: '',
  accent_color: '#b45309',

  hero_title: 'Welcome to SchoolMart',
  hero_subtitle: 'Browse our categories and order in minutes.',
  categories_heading: 'Shop by category',
  empty_list: 'Nothing here yet.',
  lbl_home: 'Home',
  not_found_page: 'Sorry, this page could not be found.',

  currency: 'EGP',
  delivery_fee: 0 as number | string,

  nav_track: 'Track order',
  btn_order: 'Add to cart',
  btn_preorder: 'Pre-order',
  btn_unavailable: 'Currently unavailable',
  badge_preorder: 'Pre-order',
  badge_unavailable: 'Unavailable',
  preorder_note: 'This item is available for pre-order and will be delivered once in stock.',
  quantity_label: 'Quantity',
  added_to_cart: 'Added to cart',

  cart_title: 'Your cart',
  empty_cart: 'Your cart is empty.',
  continue_shopping: 'Continue shopping',
  checkout_button: 'Checkout',
  removed_items_notice: 'Some items were removed from your cart because they are no longer available.',
  label_subtotal: 'Subtotal',
  label_delivery: 'Delivery',
  label_total: 'Total',

  checkout_title: 'Checkout',
  checkout_note: 'We will contact you on this number to confirm your order.',
  place_order_button: 'Place order',
  f_first_name: 'First name',
  f_last_name: 'Last name',
  f_phone: 'Phone number',
  f_address: 'Delivery address',
  err_required: 'Please fill in all fields.',
  err_phone: 'Please enter a valid phone number.',

  confirm_title: 'Thank you! Your order has been placed.',
  confirm_message: 'Save your order code below. You will need it with your phone number to track your order.',
  your_order_code: 'Your order code',
  copy_code: 'Copy code',
  copied: 'Copied',

  track_title: 'Track your order',
  track_help: 'Enter the phone number you ordered with and the order code from your confirmation.',
  f_order_code: 'Order code',
  track_button: 'Find my order',
  not_found_message: 'No order found with these details.',
  rate_limited_message: 'Too many attempts. Please wait 15 minutes and try again.',

  lbl_order_code: 'Order code',
  lbl_date: 'Date',
  lbl_name: 'Name',
  status_new: 'Received',
  status_confirmed: 'Confirmed',
  status_delivered: 'Delivered',
  status_cancelled: 'Cancelled',

  footer_text: '© SchoolMart. All rights reserved.',
  contact_phone: '',
  contact_email: '',
  contact_address: '',

  // App-only: module ids switched off remotely, comma separated (e.g. "orders").
  app_disabled_modules: '',
};

export type Settings = typeof DEFAULT_SETTINGS;
type Ctx = { S: Settings; accent: string; deliveryFee: number; ready: boolean; reload: () => Promise<void> };

const CACHE_KEY = 'settings_cache_v1';
const SettingsContext = createContext<Ctx | null>(null);

function merge(saved: Record<string, unknown>): Settings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(saved || {})) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    // Empty values fall back to defaults, except images/contact where empty means "none".
    if ((v !== null && v !== '') || k.endsWith('_url') || k.startsWith('contact_')) out[k] = v ?? '';
  }
  return out as Settings;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start from the last cached copy so the app opens instantly, then refresh.
  const [S, setS] = useState<Settings>(() => merge(readJSON(CACHE_KEY, {})));
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const { data } = await sb.from('settings').select('data').eq('id', 1).maybeSingle();
    if (data?.data) {
      writeJSON(CACHE_KEY, data.data);
      setS(merge(data.data as Record<string, unknown>));
    }
    setReady(true);
  }, []);

  useEffect(() => { reload().catch(() => setReady(true)); }, [reload]);

  const value = useMemo<Ctx>(() => {
    const accent = /^#[0-9a-f]{6}$/i.test(String(S.accent_color)) ? S.accent_color : DEFAULT_SETTINGS.accent_color;
    const fee = Math.max(0, Number(S.delivery_fee) || 0);
    return { S, accent, deliveryFee: fee, ready, reload };
  }, [S, ready, reload]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const c = useContext(SettingsContext);
  if (!c) throw new Error('useSettings must be used inside SettingsProvider');
  return c;
}
