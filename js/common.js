import { createClient } from './vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Anti-clickjacking: refuse to render inside another site's frame.
if (window.top !== window.self) {
  document.documentElement.hidden = true;
  try { window.top.location = window.location.href; } catch { /* cross-origin */ }
}

export const configured =
  /^https:\/\/\S+$/.test(SUPABASE_URL) && !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('PASTE_');

export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// A second, throw-away client (no stored session) used by the admin page to create
// business logins without signing the admin out.
export const makeSignupClient = () => configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-signup-tmp' } })
  : null;

// MUST match public.canonical_phone() / phone_email() in supabase/migrations/002_marketplace.sql
export function canonicalPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0') && d.length === 11) return '20' + d.slice(1);
  return d;
}
export const phoneEmail = p => `u${canonicalPhone(p)}@schoolmart.pro`;

export const STATUSES = ['new', 'confirmed', 'delivered', 'cancelled'];

// Every customer-facing text lives here as a default.
// The admin panel (Settings) overrides any of these.
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
  delivery_fee: 0,

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

  suppliers_heading: 'Suppliers',
  supplier_label: 'Sold by',
  search_placeholder: 'Search school supplies',
  search_view_all: 'View all results',
  search_no_results: 'No items match your search.',
  search_recent: 'Recent searches',
  nav_account: 'Account',
  nav_orders: 'Orders',
  my_orders_title: 'My orders',
  no_orders: 'You have no orders yet.',
  login_title: 'Log in',
  login_button: 'Log in',
  register_title: 'Create account',
  register_button: 'Create account',
  f_password: 'Password',
  f_confirm_password: 'Confirm password',
  login_required: 'Log in or create an account to place your order.',
  edit_profile: 'Edit profile',
  change_password: 'Change password',
  logout: 'Log out',
  delete_account: 'Delete account',
  delete_account_confirm: 'This permanently deletes your account and profile. Past orders stay with the supplier for their records.',
  new_cart_title: 'Start a new cart?',
  new_cart_message: 'Your cart has items from {store}. Adding this item will clear your current cart.',
  app_disabled_modules: '',

  footer_text: '© SchoolMart. All rights reserved.',
  contact_phone: '',
  contact_email: '',
  contact_address: '',
};

// Layout of the admin "Settings" page: [key, label, type]
export const SETTINGS_FIELDS = [
  { group: 'Branding', fields: [
    ['store_name', 'Store name', 'text'],
    ['logo_url', 'Logo', 'image'],
    ['banner_url', 'Homepage banner background', 'image'],
    ['accent_color', 'Accent color', 'color'],
  ]},
  { group: 'Homepage', fields: [
    ['hero_title', 'Banner title', 'text'],
    ['hero_subtitle', 'Banner subtitle', 'textarea'],
    ['categories_heading', 'Categories heading', 'text'],
    ['empty_list', 'Empty list message', 'text'],
    ['lbl_home', 'Breadcrumb "Home" label', 'text'],
    ['not_found_page', 'Page not found message', 'text'],
  ]},
  { group: 'Prices & delivery', fields: [
    ['currency', 'Currency label (e.g. EGP, AED)', 'text'],
    ['delivery_fee', 'Delivery fee (0 = free / not shown)', 'number'],
  ]},
  { group: 'Product page & buttons', fields: [
    ['nav_track', 'Header "Track order" link', 'text'],
    ['btn_order', 'Order button', 'text'],
    ['btn_preorder', 'Pre-order button', 'text'],
    ['btn_unavailable', 'Unavailable button', 'text'],
    ['badge_preorder', 'Pre-order badge', 'text'],
    ['badge_unavailable', 'Unavailable badge', 'text'],
    ['preorder_note', 'Pre-order note', 'textarea'],
    ['quantity_label', 'Quantity label', 'text'],
    ['added_to_cart', '"Added to cart" message', 'text'],
  ]},
  { group: 'Cart', fields: [
    ['cart_title', 'Cart title', 'text'],
    ['empty_cart', 'Empty cart message', 'text'],
    ['continue_shopping', 'Continue shopping button', 'text'],
    ['checkout_button', 'Checkout button', 'text'],
    ['removed_items_notice', 'Removed items notice', 'textarea'],
    ['label_subtotal', 'Subtotal label', 'text'],
    ['label_delivery', 'Delivery label', 'text'],
    ['label_total', 'Total label', 'text'],
  ]},
  { group: 'Checkout & confirmation', fields: [
    ['checkout_title', 'Checkout title', 'text'],
    ['checkout_note', 'Checkout note', 'textarea'],
    ['place_order_button', 'Place order button', 'text'],
    ['f_first_name', 'First name label', 'text'],
    ['f_last_name', 'Last name label', 'text'],
    ['f_phone', 'Phone label', 'text'],
    ['f_address', 'Address label', 'text'],
    ['err_required', 'Missing fields error', 'text'],
    ['err_phone', 'Invalid phone error', 'text'],
    ['confirm_title', 'Confirmation title', 'text'],
    ['confirm_message', 'Confirmation message', 'textarea'],
    ['your_order_code', '"Your order code" label', 'text'],
    ['copy_code', 'Copy code button', 'text'],
    ['copied', '"Copied" message', 'text'],
  ]},
  { group: 'Order tracking', fields: [
    ['track_title', 'Tracking page title', 'text'],
    ['track_help', 'Tracking help text', 'textarea'],
    ['f_order_code', 'Order code label', 'text'],
    ['track_button', 'Find order button', 'text'],
    ['not_found_message', 'Order not found message', 'text'],
    ['rate_limited_message', 'Too many attempts message', 'text'],
    ['lbl_order_code', 'Order code heading', 'text'],
    ['lbl_date', 'Date label', 'text'],
    ['lbl_name', 'Name label', 'text'],
    ['status_new', 'Status: new', 'text'],
    ['status_confirmed', 'Status: confirmed', 'text'],
    ['status_delivered', 'Status: delivered', 'text'],
    ['status_cancelled', 'Status: cancelled', 'text'],
  ]},
  { group: 'App: suppliers & search', fields: [
    ['suppliers_heading', 'Suppliers heading', 'text'],
    ['supplier_label', '"Sold by" label', 'text'],
    ['search_placeholder', 'Search box placeholder', 'text'],
    ['search_view_all', '"View all results" button', 'text'],
    ['search_no_results', 'No search results message', 'text'],
    ['search_recent', '"Recent searches" heading', 'text'],
    ['new_cart_title', 'New cart dialog title', 'text'],
    ['new_cart_message', 'New cart dialog message ({store} = current supplier)', 'textarea'],
  ]},
  { group: 'App: accounts', fields: [
    ['nav_account', 'Account tab', 'text'],
    ['nav_orders', 'Orders tab', 'text'],
    ['my_orders_title', '"My orders" title', 'text'],
    ['no_orders', 'No orders message', 'text'],
    ['login_title', 'Log in title', 'text'],
    ['login_button', 'Log in button', 'text'],
    ['register_title', 'Create account title', 'text'],
    ['register_button', 'Create account button', 'text'],
    ['f_password', 'Password label', 'text'],
    ['f_confirm_password', 'Confirm password label', 'text'],
    ['login_required', 'Log in required (checkout) message', 'textarea'],
    ['edit_profile', 'Edit profile', 'text'],
    ['change_password', 'Change password', 'text'],
    ['logout', 'Log out', 'text'],
    ['delete_account', 'Delete account', 'text'],
    ['delete_account_confirm', 'Delete account warning', 'textarea'],
  ]},
  { group: 'App: advanced', fields: [
    ['app_disabled_modules', 'Switch off app modules (comma separated ids, e.g. orders,search)', 'text'],
  ]},
  { group: 'Footer & contact', fields: [
    ['footer_text', 'Footer text', 'textarea'],
    ['contact_phone', 'Contact phone', 'text'],
    ['contact_email', 'Contact email', 'text'],
    ['contact_address', 'Contact address', 'text'],
  ]},
];

export async function loadSettings() {
  if (!sb) return { ...DEFAULT_SETTINGS };
  const { data } = await sb.from('settings').select('data').eq('id', 1).maybeSingle();
  const saved = (data && data.data) || {};
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(saved)) {
    if (saved[k] !== null && saved[k] !== '' || k.endsWith('_url') || k.startsWith('contact_')) out[k] = saved[k];
  }
  return out;
}

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function safeUrl(u) {
  u = String(u || '').trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
}

export const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

export function money(n, currency) {
  const v = Number(n || 0);
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
}

export function fmtDate(iso) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(iso || ''); }
}

export function applyTheme(S) {
  if (/^#[0-9a-f]{6}$/i.test(S.accent_color || '')) {
    document.documentElement.style.setProperty('--accent', S.accent_color);
  }
}

const initial = s => (String(s || '?').trim()[0] || '?').toUpperCase();

export function imageBox(url, label, cls = 'card-img') {
  const u = safeUrl(url);
  return u
    ? `<img class="${cls}" src="${esc(u)}" alt="${esc(label)}" loading="lazy">`
    : `<div class="${cls} ph" aria-hidden="true"><span>${esc(initial(label))}</span></div>`;
}

let toastTimer;
export function toast(msg, kind = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (kind ? ' toast-' + kind : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

export function statusLabel(status, S) {
  return S['status_' + status] || status;
}

export function totalsHtml(subtotal, fee, S) {
  const f = Number(fee || 0);
  return `<div class="totals">
    <div><span>${esc(S.label_subtotal)}</span><span>${esc(money(subtotal, S.currency))}</span></div>
    ${f > 0 ? `<div><span>${esc(S.label_delivery)}</span><span>${esc(money(f, S.currency))}</span></div>` : ''}
    <div class="grand"><span>${esc(S.label_total)}</span><span>${esc(money(Number(subtotal || 0) + f, S.currency))}</span></div>
  </div>`;
}

export function orderHtml(o, items, S) {
  const st = STATUSES.includes(o.status) ? o.status : 'new';
  const list = [...(items || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  return `<div class="card order">
    <div class="order-head">
      <div><div class="muted small">${esc(S.lbl_order_code)}</div><div class="order-code sm">${esc(o.order_code)}</div></div>
      <span class="status status-${st}">${esc(statusLabel(st, S))}</span>
    </div>
    <dl class="kv">
      ${o.business_name ? `<dt>${esc(S.supplier_label)}</dt><dd>${esc(o.business_name)}</dd>` : ''}
      <dt>${esc(S.lbl_date)}</dt><dd>${esc(fmtDate(o.created_at))}</dd>
      <dt>${esc(S.lbl_name)}</dt><dd>${esc(o.first_name)} ${esc(o.last_name)}</dd>
      <dt>${esc(S.f_phone)}</dt><dd dir="ltr">${esc(o.phone)}</dd>
      <dt>${esc(S.f_address)}</dt><dd class="pre">${esc(o.address)}</dd>
    </dl>
    <div class="items">${list.map(i => `
      <div class="item-row">
        <div class="item-main">
          <strong>${esc(i.product_name)}</strong>
          ${i.mode === 'preorder' ? `<span class="tag tag-pre">${esc(S.badge_preorder)}</span>` : ''}
          ${i.product_description ? `<div class="muted small clamp">${esc(i.product_description)}</div>` : ''}
        </div>
        <div class="item-qty">${esc(i.quantity)} × ${esc(money(i.unit_price, S.currency))}</div>
        <div class="item-total">${esc(money(i.line_total, S.currency))}</div>
      </div>`).join('')}
    </div>
    ${totalsHtml(o.subtotal, o.delivery_fee, S)}
  </div>`;
}

export const NOT_CONFIGURED_HTML = `<div class="card setup-msg">
  <h1>Almost there</h1>
  <p>Open <code>js/config.js</code> and paste your Supabase Project URL and anon/publishable key, then commit the change.</p>
</div>`;
