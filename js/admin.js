import {
  sb, configured, esc, money, loadSettings, applyTheme, toast, imageBox, fmtDate,
  SETTINGS_FIELDS, DEFAULT_SETTINGS, STATUSES, statusLabel, orderHtml, NOT_CONFIGURED_HTML,
  makeSignupClient, canonicalPhone, phoneEmail,
} from './common.js';

const root = document.getElementById('admin');
const dialog = document.getElementById('dlg');
let S = { ...DEFAULT_SETTINGS };
let view;
let loggedIn = false;

// ---------------------------------------------------------------- session / idle logout
const IDLE_MS = 30 * 60 * 1000;
const LA_KEY = 'admin_last_active';
let idleTimer;
let lastTouch = 0;

function touch() {
  const now = Date.now();
  if (now - lastTouch < 10000) return;
  lastTouch = now;
  try { localStorage.setItem(LA_KEY, String(now)); } catch { /* ignore */ }
}
function resetIdle() {
  if (!loggedIn) return;
  touch();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => logout('You were signed out after 30 minutes of inactivity.'), IDLE_MS);
}
['click', 'keydown', 'pointermove', 'touchstart', 'scroll'].forEach(ev =>
  document.addEventListener(ev, resetIdle, { passive: true }));

async function logout(msg = '') {
  loggedIn = false;
  clearTimeout(idleTimer);
  try { dialog.close(); } catch { /* ignore */ }
  await sb.auth.signOut();
  showLogin(msg);
}

async function isAdmin() {
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}

function fail(err) {
  console.error(err);
  toast((err && err.message) || 'Something went wrong.', 'error');
}

// ---------------------------------------------------------------- login
function showLogin(msg = '') {
  root.innerHTML = `<div class="login-wrap">
    <form class="card form login" id="login" novalidate>
      <h1>Admin sign in</h1>
      ${msg ? `<p class="notice">${esc(msg)}</p>` : ''}
      <label>Email<input type="email" name="email" required autocomplete="username"></label>
      <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
      <p class="form-error" hidden></p>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>
    </form></div>`;
  const form = document.getElementById('login');
  const err = form.querySelector('.form-error');
  form.onsubmit = async e => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({
      email: form.email.value.trim(), password: form.password.value,
    });
    if (error) {
      btn.disabled = false;
      err.textContent = 'Invalid email or password.';
      err.hidden = false;
      return;
    }
    if (!(await isAdmin())) {
      await sb.auth.signOut();
      btn.disabled = false;
      err.textContent = 'This account does not have admin access.';
      err.hidden = false;
      return;
    }
    showApp();
  };
}

// ---------------------------------------------------------------- shell
const TABS = [
  { id: 'orders', label: 'Orders', fn: () => ordersView() },
  { id: 'businesses', label: 'Businesses', fn: () => businessesView() },
  { id: 'customers', label: 'Customers', fn: () => customersView() },
  { id: 'products', label: 'Products', fn: () => entityView('products') },
  { id: 'subcategories', label: 'Subcategories', fn: () => entityView('subcategories') },
  { id: 'categories', label: 'Categories', fn: () => entityView('categories') },
  { id: 'settings', label: 'Settings', fn: () => settingsView() },
];

function showApp() {
  loggedIn = true;
  resetIdle();
  root.innerHTML = `
    <header class="topbar admin-bar">
      <span class="brand"><span>${esc(S.store_name)}</span><span class="muted small">Admin</span></span>
      <nav class="tabs">
        ${TABS.map(t => `<a class="tab" href="#${t.id}" data-tab="${t.id}">${t.label}</a>`).join('')}
        <a class="tab" href="./" target="_blank" rel="noopener">View store ↗</a>
        <button class="tab" id="logout" type="button">Log out</button>
      </nav>
    </header>
    <main class="container" id="view"></main>`;
  view = document.getElementById('view');
  document.getElementById('logout').onclick = () => logout();
  routeAdmin();
}

function routeAdmin() {
  if (!loggedIn) return;
  const id = location.hash.slice(1) || 'orders';
  const tab = TABS.find(t => t.id === id) || TABS[0];
  document.querySelectorAll('.tab[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === tab.id));
  view.innerHTML = '<div class="loading" aria-busy="true"></div>';
  tab.fn().catch(fail);
}
window.addEventListener('hashchange', routeAdmin);

dialog.addEventListener('click', e => {
  if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
});

// ---------------------------------------------------------------- image upload
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function imageField(key, label, url) {
  return `<div class="image-field" data-key="${esc(key)}">
    <span class="field-label">${esc(label)}</span>
    <div class="image-row">
      <div class="image-preview">${imageBox(url, label, 'preview-img')}</div>
      <div class="image-actions">
        <label class="btn btn-sm">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
        <button type="button" class="btn btn-sm" data-clear>Remove</button>
        <p class="muted small img-status">JPG, PNG or WebP · max 5 MB</p>
      </div>
    </div>
    <input type="hidden" name="${esc(key)}" value="${esc(url || '')}">
  </div>`;
}

function bindImageFields(scope, folder) {
  scope.querySelectorAll('.image-field').forEach(box => {
    const hidden = box.querySelector('input[type=hidden]');
    const file = box.querySelector('input[type=file]');
    const status = box.querySelector('.img-status');
    const prev = box.querySelector('.image-preview');
    file.onchange = async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      if (!MIME_EXT[f.type]) { status.textContent = 'Only JPG, PNG or WebP images.'; return; }
      if (f.size > 5 * 1024 * 1024) { status.textContent = 'Image must be 5 MB or smaller.'; return; }
      status.textContent = 'Uploading…';
      const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${MIME_EXT[f.type]}`;
      const { error } = await sb.storage.from('images').upload(path, f, {
        contentType: f.type, cacheControl: '31536000', upsert: false,
      });
      if (error) { status.textContent = 'Upload failed: ' + error.message; return; }
      const { data } = sb.storage.from('images').getPublicUrl(path);
      hidden.value = data.publicUrl;
      prev.innerHTML = imageBox(data.publicUrl, '', 'preview-img');
      status.textContent = 'Uploaded — remember to save.';
    };
    box.querySelector('[data-clear]').onclick = () => {
      hidden.value = '';
      prev.innerHTML = imageBox('', box.dataset.key, 'preview-img');
      status.textContent = 'Image removed — remember to save.';
    };
  });
}

// ---------------------------------------------------------------- catalog (categories / subcategories / products)
const MODES = [['order', 'Order'], ['preorder', 'Pre-order'], ['unavailable', 'Unavailable']];
const modeOptions = cur => MODES.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('');

async function categoryOptions() {
  const { data, error } = await sb.from('categories').select('id,title').order('sort_order').order('created_at');
  if (error) throw error;
  return data.map(c => ({ id: c.id, label: c.title }));
}
async function subcategoryOptions() {
  const { data, error } = await sb.from('subcategories')
    .select('id,title,sort_order,categories(title,sort_order)').order('sort_order');
  if (error) throw error;
  return data
    .map(s => ({ id: s.id, label: `${s.categories ? s.categories.title : '?'} › ${s.title}`,
      cat: s.categories ? s.categories.title : '', k1: s.categories ? s.categories.sort_order : 0, k2: s.sort_order }))
    .sort((a, b) => (a.k1 - b.k1) || a.cat.localeCompare(b.cat) || (a.k2 - b.k2));
}

const ENTITIES = {
  categories: {
    title: 'Categories', single: 'category', nameKey: 'title', parent: null,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'visible', label: 'Visible on store', type: 'checkbox' },
    ],
  },
  subcategories: {
    title: 'Subcategories', single: 'subcategory', nameKey: 'title',
    parent: { key: 'category_id', label: 'Category', load: categoryOptions, missing: 'category' },
    fields: [
      { key: 'category_id', label: 'Category', type: 'parent', required: true },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'visible', label: 'Visible on store', type: 'checkbox' },
    ],
  },
  products: {
    title: 'Products', single: 'product', nameKey: 'name',
    parent: { key: 'subcategory_id', label: 'Subcategory', load: subcategoryOptions, missing: 'subcategory' },
    fields: [
      { key: 'business_id', label: 'Supplier', type: 'business', required: true },
      { key: 'subcategory_id', label: 'Subcategory', type: 'parent', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'price', label: 'Price', type: 'price', required: true },
      { key: 'mode', label: 'Ordering mode', type: 'mode' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'visible', label: 'Visible on store', type: 'checkbox' },
    ],
  },
};
const filters = { subcategories: '', products: '', productsBiz: '' };
let bizOptions = [];

async function entityView(name) {
  const E = ENTITIES[name];
  const opts = E.parent ? await E.parent.load() : [];
  if (E.parent && !opts.length) {
    view.innerHTML = `<div class="view-head"><h1>${E.title}</h1></div>
      <p class="notice">Add a ${E.parent.missing} first, then come back here.</p>`;
    return;
  }
  const filter = E.parent && opts.some(o => o.id === filters[name]) ? filters[name] : '';
  if (name === 'products') {
    const { data: bz, error: be } = await sb.from('businesses').select('id,name,active').order('sort_order').order('created_at');
    if (be) throw be;
    bizOptions = bz.map(b => ({ id: b.id, label: b.name + (b.active ? '' : ' (suspended)') }));
    if (!bizOptions.length) {
      view.innerHTML = '<div class="view-head"><h1>Products</h1></div><p class="notice">Add a business first (Businesses tab).</p>';
      return;
    }
  }
  const bizFilter = name === 'products' && bizOptions.some(o => o.id === filters.productsBiz) ? filters.productsBiz : '';
  let q = sb.from(name).select('*').order('sort_order').order('created_at');
  if (E.parent && filter) q = q.eq(E.parent.key, filter);
  if (bizFilter) q = q.eq('business_id', bizFilter);
  if (name === 'products') q = q.limit(500);
  const { data: rows, error } = await q;
  if (error) throw error;
  const optMap = new Map(opts.map(o => [o.id, o.label]));
  const bizMap = new Map(bizOptions.map(o => [o.id, o.label]));

  view.innerHTML = `
    <div class="view-head"><h1>${E.title}</h1><button class="btn btn-primary" id="add">+ Add ${E.single}</button></div>
    ${name === 'products' ? `<label class="filter">Supplier
      <select id="bfilter"><option value="">All suppliers</option>${bizOptions.map(o =>
        `<option value="${esc(o.id)}" ${o.id === bizFilter ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>` : ''}
    ${E.parent ? `<label class="filter">Show
      <select id="pfilter"><option value="">All</option>${opts.map(o =>
        `<option value="${esc(o.id)}" ${o.id === filter ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>` : ''}
    ${rows.length ? `<div class="admin-list">${rows.map((r, i) => `
      <div class="admin-row ${r.visible ? '' : 'is-hidden'}" data-i="${i}">
        ${imageBox(r.image_url, r[E.nameKey], 'thumb')}
        <div class="admin-row-main">
          <strong>${esc(r[E.nameKey])}</strong>
          ${r.visible ? '' : '<span class="tag tag-off">Hidden</span>'}
          ${E.parent ? `<div class="muted small">${name === 'products' ? esc(bizMap.get(r.business_id) || '—') + ' · ' : ''}${esc(optMap.get(r[E.parent.key]) || '—')}</div>` : ''}
        </div>
        ${name === 'products' ? `<div class="inline-edit">
          <label class="small">Price<input class="price-in" type="number" min="0" step="0.01" value="${esc(r.price)}"></label>
          <label class="small">Mode<select class="mode-in">${modeOptions(r.mode)}</select></label>
        </div>` : ''}
        <div class="row-actions">
          <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} title="Move up" aria-label="Move up">↑</button>
          <button class="icon-btn" data-act="down" ${i === rows.length - 1 ? 'disabled' : ''} title="Move down" aria-label="Move down">↓</button>
          <button class="btn btn-sm" data-act="toggle">${r.visible ? 'Hide' : 'Show'}</button>
          <button class="btn btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-sm btn-danger" data-act="del">Delete</button>
        </div>
      </div>`).join('')}</div>` : `<p class="empty">No ${E.title.toLowerCase()} yet.</p>`}
    ${E.parent && !filter && rows.length > 1 ? '<p class="muted small">Tip: choose a filter above to reorder items within one group.</p>' : ''}`;

  document.getElementById('add').onclick = () => openEntityForm(name, null, opts);
  const bf = document.getElementById('bfilter');
  if (bf) bf.onchange = () => { filters.productsBiz = bf.value; entityView(name).catch(fail); };
  const pf = document.getElementById('pfilter');
  if (pf) pf.onchange = () => { filters[name] = pf.value; entityView(name).catch(fail); };

  view.querySelectorAll('.admin-row').forEach(rowEl => {
    const r = rows[Number(rowEl.dataset.i)];
    rowEl.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = async () => {
        const act = btn.dataset.act;
        try {
          if (act === 'edit') return openEntityForm(name, r, opts);
          if (act === 'up' || act === 'down') return await moveRow(name, rows, rows.indexOf(r), act === 'up' ? -1 : 1);
          if (act === 'toggle') {
            const { error: e } = await sb.from(name).update({ visible: !r.visible }).eq('id', r.id);
            if (e) throw e;
            return entityView(name);
          }
          if (act === 'del') {
            const warn = name === 'categories' ? '\n\nAll its subcategories and products will also be deleted.'
              : name === 'subcategories' ? '\n\nAll its products will also be deleted.' : '';
            if (!confirm(`Delete "${r[E.nameKey]}"?${warn}\n\nPast orders are kept.`)) return;
            const { error: e } = await sb.from(name).delete().eq('id', r.id);
            if (e) throw e;
            toast('Deleted', 'ok');
            return entityView(name);
          }
        } catch (e) { fail(e); }
      };
    });
    const priceIn = rowEl.querySelector('.price-in');
    if (priceIn) priceIn.onchange = async () => {
      const v = Math.round(parseFloat(priceIn.value) * 100) / 100;
      if (!Number.isFinite(v) || v < 0) { priceIn.value = r.price; return toast('Enter a valid price', 'error'); }
      const { error: e } = await sb.from(name).update({ price: v }).eq('id', r.id);
      if (e) return fail(e);
      r.price = v; priceIn.value = v.toFixed(2);
      toast('Price saved', 'ok');
    };
    const modeIn = rowEl.querySelector('.mode-in');
    if (modeIn) modeIn.onchange = async () => {
      const { error: e } = await sb.from(name).update({ mode: modeIn.value }).eq('id', r.id);
      if (e) { modeIn.value = r.mode; return fail(e); }
      r.mode = modeIn.value;
      toast('Mode saved', 'ok');
    };
  });
}

async function moveRow(name, rows, idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= rows.length) return;
  const arr = rows.slice();
  [arr[idx], arr[j]] = [arr[j], arr[idx]];
  const changes = arr.map((r, k) => ({ id: r.id, old: r.sort_order, sort_order: (k + 1) * 10 }))
    .filter(c => c.old !== c.sort_order);
  const res = await Promise.all(changes.map(c => sb.from(name).update({ sort_order: c.sort_order }).eq('id', c.id)));
  const bad = res.find(x => x.error);
  if (bad) throw bad.error;
  await entityView(name);
}

function fieldHtml(f, r, opts) {
  const v = r[f.key];
  const req = f.required ? 'required' : '';
  switch (f.type) {
    case 'text':
      return `<label>${esc(f.label)}<input name="${f.key}" value="${esc(v ?? '')}" maxlength="200" ${req}></label>`;
    case 'textarea':
      return `<label>${esc(f.label)}<textarea name="${f.key}" rows="5" maxlength="5000">${esc(v ?? '')}</textarea></label>`;
    case 'price':
      return `<label>${esc(f.label)} (${esc(S.currency)})<input name="${f.key}" type="number" min="0" step="0.01" value="${esc(v ?? 0)}" ${req}></label>`;
    case 'mode':
      return `<label>${esc(f.label)}<select name="${f.key}">${modeOptions(v || 'order')}</select></label>`;
    case 'business':
      return `<label>${esc(f.label)}<select name="${f.key}" ${req}>${bizOptions.map(o =>
        `<option value="${esc(o.id)}" ${o.id === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    case 'parent':
      return `<label>${esc(f.label)}<select name="${f.key}" ${req}>${opts.map(o =>
        `<option value="${esc(o.id)}" ${o.id === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    case 'checkbox':
      return `<label class="check"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'image':
      return imageField(f.key, f.label, v);
    default:
      return '';
  }
}

function openEntityForm(name, row, opts) {
  const E = ENTITIES[name];
  const isNew = !row;
  const r = row ? { ...row } : { visible: true, mode: 'order', price: 0 };
  if (isNew && E.parent) r[E.parent.key] = filters[name] || (opts[0] && opts[0].id);
  if (isNew && name === 'products') r.business_id = filters.productsBiz || (bizOptions[0] && bizOptions[0].id);

  dialog.innerHTML = `<form class="form" id="ef" novalidate>
    <h2>${isNew ? 'Add' : 'Edit'} ${E.single}</h2>
    ${E.fields.map(f => fieldHtml(f, r, opts)).join('')}
    <p class="form-error" hidden></p>
    <div class="actions"><button type="button" class="btn" data-close>Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button></div>
  </form>`;
  bindImageFields(dialog, name);
  dialog.showModal();

  const form = document.getElementById('ef');
  const err = form.querySelector('.form-error');
  form.onsubmit = async e => {
    e.preventDefault();
    err.hidden = true;
    const vals = {};
    for (const f of E.fields) {
      const el = form.elements[f.key];
      if (f.type === 'checkbox') vals[f.key] = el.checked;
      else if (f.type === 'price') vals[f.key] = Math.round(parseFloat(el.value) * 100) / 100;
      else vals[f.key] = String(el.value ?? '').trim();
      if (f.type === 'image' && !vals[f.key]) vals[f.key] = null;
      if (f.required && (vals[f.key] === '' || vals[f.key] === null)) {
        err.textContent = `${f.label} is required.`; err.hidden = false; return;
      }
      if (f.type === 'price' && (!Number.isFinite(vals[f.key]) || vals[f.key] < 0)) {
        err.textContent = 'Enter a valid price (0 or more).'; err.hidden = false; return;
      }
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (isNew) {
        const { data: last } = await sb.from(name).select('sort_order').order('sort_order', { ascending: false }).limit(1);
        vals.sort_order = ((last && last[0] && last[0].sort_order) || 0) + 10;
        const { error } = await sb.from(name).insert(vals);
        if (error) throw error;
      } else {
        const { error } = await sb.from(name).update(vals).eq('id', row.id);
        if (error) throw error;
      }
      dialog.close();
      toast('Saved', 'ok');
      await entityView(name);
    } catch (ex) {
      btn.disabled = false;
      err.textContent = ex.message || 'Could not save.';
      err.hidden = false;
    }
  };
}

// ---------------------------------------------------------------- settings
async function settingsView() {
  S = await loadSettings();
  view.innerHTML = `<div class="view-head"><h1>Site settings</h1></div>
    <form id="sf" class="form settings-form" novalidate>
      ${SETTINGS_FIELDS.map(g => `<fieldset class="card"><legend>${esc(g.group)}</legend>
        ${g.fields.map(([k, label, type]) => {
          const v = S[k];
          if (type === 'image') return imageField(k, label, v);
          if (type === 'textarea') return `<label>${esc(label)}<textarea name="${k}" rows="3" maxlength="2000">${esc(v ?? '')}</textarea></label>`;
          if (type === 'number') return `<label>${esc(label)}<input name="${k}" type="number" min="0" step="0.01" value="${esc(v ?? 0)}"></label>`;
          if (type === 'color') return `<label>${esc(label)}<input name="${k}" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(v || '') ? v : DEFAULT_SETTINGS.accent_color)}"></label>`;
          return `<label>${esc(label)}<input name="${k}" value="${esc(v ?? '')}" maxlength="300"></label>`;
        }).join('')}
      </fieldset>`).join('')}
      <div class="sticky-save"><p class="form-error" hidden></p>
        <button class="btn btn-primary btn-lg" type="submit">Save settings</button></div>
    </form>`;
  bindImageFields(view, 'branding');

  const form = document.getElementById('sf');
  const err = form.querySelector('.form-error');
  form.onsubmit = async e => {
    e.preventDefault();
    err.hidden = true;
    const data = {};
    for (const g of SETTINGS_FIELDS) {
      for (const [k, label, type] of g.fields) {
        let v = String(form.elements[k].value ?? '').trim();
        if (type === 'number') {
          const n = Math.round(parseFloat(v || '0') * 100) / 100;
          if (!Number.isFinite(n) || n < 0) { err.textContent = `${label}: enter 0 or more.`; err.hidden = false; return; }
          data[k] = n;
        } else data[k] = v;
      }
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    const { data: saved, error } = await sb.from('settings')
      .update({ data, updated_at: new Date().toISOString() }).eq('id', 1).select('id');
    btn.disabled = false;
    if (error || !saved || !saved.length) return fail(error || { message: 'Not saved — check admin access.' });
    S = await loadSettings();
    applyTheme(S);
    toast('Settings saved', 'ok');
  };
}

// ---------------------------------------------------------------- orders
const orderFilter = { phone: '', code: '', name: '', status: '', business: '', from: '', to: '' };
let currentOrders = [];

async function ordersView() {
  const f = orderFilter;
  const { data: bz } = await sb.from('businesses').select('id,name').order('sort_order').order('created_at');
  const bizList = bz || [];
  view.innerHTML = `<div class="view-head"><h1>Orders</h1><button class="btn" id="csv">Export CSV</button></div>
    <form id="of" class="card filters">
      <input name="phone" placeholder="Phone" value="${esc(f.phone)}" inputmode="tel" dir="ltr">
      <input name="code" placeholder="Order code" value="${esc(f.code)}" dir="ltr">
      <input name="name" placeholder="Customer name" value="${esc(f.name)}">
      <select name="status"><option value="">Any status</option>${STATUSES.map(s =>
        `<option value="${s}" ${s === f.status ? 'selected' : ''}>${esc(statusLabel(s, S))}</option>`).join('')}</select>
      <select name="business"><option value="">All suppliers</option>${bizList.map(b =>
        `<option value="${esc(b.id)}" ${b.id === f.business ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      <label class="small">From<input type="date" name="from" value="${esc(f.from)}"></label>
      <label class="small">To<input type="date" name="to" value="${esc(f.to)}"></label>
      <div class="filter-actions"><button class="btn btn-primary" type="submit">Search</button>
        <button class="btn" type="button" id="reset">Reset</button></div>
    </form>
    <div id="orders-out"><div class="loading" aria-busy="true"></div></div>`;

  const form = document.getElementById('of');
  form.onsubmit = e => {
    e.preventDefault();
    for (const k of Object.keys(orderFilter)) orderFilter[k] = String(form.elements[k].value || '').trim();
    loadOrders().catch(fail);
  };
  document.getElementById('reset').onclick = () => {
    for (const k of Object.keys(orderFilter)) orderFilter[k] = '';
    ordersView().catch(fail);
  };
  document.getElementById('csv').onclick = exportCsv;
  await loadOrders();
}

async function loadOrders() {
  const out = document.getElementById('orders-out');
  const f = orderFilter;
  let q = sb.from('orders').select('*, order_items(*), businesses(name)').order('created_at', { ascending: false }).limit(500);
  if (/^[0-9a-f-]{36}$/i.test(f.business)) q = q.eq('business_id', f.business);
  const phone = f.phone.replace(/\D/g, '');
  if (phone) q = phone.startsWith('0') ? q.or(`phone.ilike.%${phone}%,phone.ilike.%${canonicalPhone(phone)}%`) : q.ilike('phone', `%${phone}%`);
  const code = f.code.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (code) q = q.ilike('order_code', `%${code}%`);
  const nm = f.name.replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (nm) q = q.or(`first_name.ilike."%${nm}%",last_name.ilike."%${nm}%"`);
  if (STATUSES.includes(f.status)) q = q.eq('status', f.status);
  if (f.from) q = q.gte('created_at', new Date(f.from + 'T00:00:00').toISOString());
  if (f.to) q = q.lte('created_at', new Date(f.to + 'T23:59:59.999').toISOString());

  const { data, error } = await q;
  if (error) throw error;
  currentOrders = data.map(o => ({ ...o, business_name: o.businesses ? o.businesses.name : '' }));
  if (!data.length) { out.innerHTML = '<p class="empty">No orders found.</p>'; return; }
  out.innerHTML = `<p class="muted small">${data.length} order${data.length === 1 ? '' : 's'}${data.length === 500 ? ' (latest 500 — narrow the filters to see older ones)' : ''}</p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Code</th><th>Date</th><th>Supplier</th><th>Customer</th><th>Phone</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${currentOrders.map((o, i) => `<tr>
        <td><strong dir="ltr">${esc(o.order_code)}</strong></td>
        <td>${esc(fmtDate(o.created_at))}</td>
        <td>${esc(o.business_name || '—')}</td>
        <td>${esc(o.first_name)} ${esc(o.last_name)}</td>
        <td dir="ltr">${esc(o.phone)}</td>
        <td>${o.order_items.reduce((a, it) => a + it.quantity, 0)}${o.order_items.some(it => it.mode === 'preorder') ? ' <span class="tag tag-pre">Pre</span>' : ''}</td>
        <td>${esc(money(o.total, S.currency))}</td>
        <td><span class="status status-${STATUSES.includes(o.status) ? o.status : 'new'}">${esc(statusLabel(o.status, S))}</span></td>
        <td><button class="btn btn-sm" data-i="${i}">View</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  out.querySelectorAll('[data-i]').forEach(b => { b.onclick = () => openOrder(currentOrders[Number(b.dataset.i)]); });
}

function openOrder(o) {
  dialog.innerHTML = `<div class="dlg-body">
    ${orderHtml(o, o.order_items, S)}
    <div class="form"><label>Status<select id="od-status">${STATUSES.map(s =>
      `<option value="${s}" ${s === o.status ? 'selected' : ''}>${esc(statusLabel(s, S))}</option>`).join('')}</select></label></div>
    <div class="actions">
      <button class="btn btn-danger" id="od-del" type="button">Delete</button>
      <span class="spacer"></span>
      <button class="btn" data-close type="button">Close</button>
      <button class="btn btn-primary" id="od-save" type="button">Save status</button>
    </div></div>`;
  dialog.showModal();
  document.getElementById('od-save').onclick = async () => {
    const status = document.getElementById('od-status').value;
    const { error } = await sb.from('orders').update({ status }).eq('id', o.id);
    if (error) return fail(error);
    dialog.close();
    toast('Status updated', 'ok');
    loadOrders().catch(fail);
  };
  document.getElementById('od-del').onclick = async () => {
    if (!confirm(`Permanently delete order ${o.order_code}?`)) return;
    const { error } = await sb.from('orders').delete().eq('id', o.id);
    if (error) return fail(error);
    dialog.close();
    toast('Order deleted', 'ok');
    loadOrders().catch(fail);
  };
}

function csvCell(v) {
  let s = String(v ?? '');
  // block spreadsheet formula injection, but keep plain numbers like +2010...
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d .]+$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  if (!currentOrders.length) return toast('No orders to export', 'error');
  const head = ['order_code', 'date', 'status', 'supplier', 'first_name', 'last_name', 'phone', 'address',
    'item_name', 'item_description', 'mode', 'unit_price', 'quantity', 'line_total',
    'order_subtotal', 'delivery_fee', 'order_total'];
  const rows = [head];
  for (const o of currentOrders) {
    const items = [...o.order_items].sort((a, b) => a.position - b.position);
    for (const it of items) {
      rows.push([o.order_code, new Date(o.created_at).toISOString(), o.status, o.business_name || '', o.first_name, o.last_name,
        o.phone, o.address, it.product_name, it.product_description, it.mode, it.unit_price, it.quantity,
        it.line_total, o.subtotal, o.delivery_fee, o.total]);
    }
  }
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- businesses (suppliers)
const MIN_PASSWORD = 8;
const isPhone = p => /^[0-9]{8,15}$/.test(canonicalPhone(p));

async function businessesView() {
  const { data, error } = await sb.rpc('admin_list_businesses');
  if (error) throw error;
  view.innerHTML = `
    <div class="view-head"><h1>Businesses</h1><button class="btn btn-primary" id="add">+ Add business</button></div>
    <p class="muted small">Each business logs into the SchoolMart app with its phone number and password, manages its own products and sees only its own orders.</p>
    ${data.length ? `<div class="admin-list">${data.map((b, i) => `
      <div class="admin-row ${b.active ? '' : 'is-hidden'}" data-i="${i}">
        ${imageBox(b.image_url, b.name, 'thumb')}
        <div class="admin-row-main">
          <strong>${esc(b.name)}</strong>
          ${b.active ? '' : '<span class="tag tag-off">Suspended</span>'}
          <div class="muted small">${b.login_phone ? 'Login: <span dir="ltr">+' + esc(b.login_phone) + '</span>' : '<span class="tag tag-pre">No login yet</span>'}
            · ${esc(b.product_count)} products · ${esc(b.order_count)} orders</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" data-act="orders">Orders</button>
          <button class="btn btn-sm" data-act="products">Products</button>
          <button class="btn btn-sm" data-act="edit">Edit</button>
        </div>
      </div>`).join('')}</div>` : '<p class="empty">No businesses yet.</p>'}`;

  document.getElementById('add').onclick = () => openBusinessForm(null);
  view.querySelectorAll('.admin-row').forEach(row => {
    const b = data[Number(row.dataset.i)];
    row.querySelector('[data-act="edit"]').onclick = () => openBusinessForm(b);
    row.querySelector('[data-act="orders"]').onclick = () => { for (const k of Object.keys(orderFilter)) orderFilter[k] = ''; orderFilter.business = b.id; location.hash = '#orders'; };
    row.querySelector('[data-act="products"]').onclick = () => { filters.productsBiz = b.id; location.hash = '#products'; };
  });
}

/** Creates the phone+password login (if needed), then links it to the business. */
async function ensureBusinessLogin(phone, password) {
  const client = makeSignupClient();
  const { error } = await client.auth.signUp({ email: phoneEmail(phone), password, options: { data: { account_type: 'business' } } });
  // "already registered" is fine when the login exists but isn't attached to anything yet: the RPC checks that.
  if (error && !/already registered|already exists/i.test(error.message)) throw error;
  await client.auth.signOut({ scope: 'local' }).catch(() => {});
}

function openBusinessForm(b) {
  const isNew = !b;
  const r = b || { active: true };
  dialog.innerHTML = `<form class="form" id="bf" novalidate>
    <h2>${isNew ? 'Add business' : 'Edit business'}</h2>
    <label>Business name<input name="name" value="${esc(r.name || '')}" maxlength="120" required></label>
    ${imageField('image_url', 'Logo / photo', r.image_url)}
    <label>Description<textarea name="description" rows="3" maxlength="2000">${esc(r.description || '')}</textarea></label>
    <label>Address<input name="address" value="${esc(r.address || '')}" maxlength="500"></label>
    <label>Public contact phone (optional)<input name="contact_phone" value="${esc(r.contact_phone || '')}" maxlength="30" dir="ltr"></label>
    ${isNew ? '' : `<label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Active (uncheck to suspend: hides products and blocks new orders)</label>`}
    <fieldset class="card" style="padding:14px;display:flex;flex-direction:column;gap:12px">
      <legend style="font-weight:800;padding:0 6px">App login</legend>
      ${!isNew && r.login_phone ? `<p class="muted small" style="margin:0">Login phone: <strong dir="ltr">+${esc(r.login_phone)}</strong>. Leave the password empty to keep it.</p>
        <label>New password<input name="password" type="password" autocomplete="new-password" placeholder="At least ${MIN_PASSWORD} characters"></label>`
      : `<label>Login phone number<input name="login_phone" type="tel" inputmode="tel" dir="ltr" required placeholder="01XXXXXXXXX"></label>
        <label>Password<input name="password" type="password" autocomplete="new-password" required placeholder="At least ${MIN_PASSWORD} characters"></label>
        <p class="muted small" style="margin:0">Share these with the business owner. They log in from the Account tab in the app.</p>`}
    </fieldset>
    <p class="form-error" hidden></p>
    <div class="actions">
      ${isNew ? '' : '<button type="button" class="btn btn-danger" id="bdel">Delete business</button><span class="spacer"></span>'}
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="submit" class="btn btn-primary">${isNew ? 'Create business' : 'Save'}</button>
    </div>
  </form>`;
  bindImageFields(dialog, 'businesses');
  dialog.showModal();
  const form = document.getElementById('bf');
  const err = form.querySelector('.form-error');
  const showErr = m => { err.textContent = m; err.hidden = false; };

  form.onsubmit = async e => {
    e.preventDefault();
    err.hidden = true;
    const v = k => String(form.elements[k] ? form.elements[k].value : '').trim();
    const name = v('name'), password = form.elements.password ? form.elements.password.value : '';
    if (!name) return showErr('Business name is required.');
    const needsLogin = isNew || !r.login_phone;
    const loginPhone = needsLogin ? v('login_phone') : r.login_phone;
    if (needsLogin && !isPhone(loginPhone)) return showErr('Enter a valid login phone number.');
    if ((needsLogin || password) && password.length < MIN_PASSWORD) return showErr(`Password must be at least ${MIN_PASSWORD} characters.`);
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (needsLogin) {
        await ensureBusinessLogin(loginPhone, password);
        const { error } = await sb.rpc('admin_create_business', {
          p_login_phone: loginPhone, p_name: name, p_image_url: v('image_url') || null, p_description: v('description'),
          p_address: v('address'), p_contact_phone: v('contact_phone'), p_business_id: isNew ? null : r.id,
        });
        if (error) throw error;
      }
      if (!isNew) {
        const { error } = await sb.from('businesses').update({
          name, image_url: v('image_url') || null, description: v('description'), address: v('address'),
          contact_phone: v('contact_phone'), active: form.elements.active.checked,
        }).eq('id', r.id);
        if (error) throw error;
        if (password && r.login_phone) {
          const { error: pe } = await sb.rpc('admin_business_set_password', { p_business: r.id, p_password: password });
          if (pe) throw pe;
        }
      }
      dialog.close();
      toast(isNew ? 'Business created' : 'Saved', 'ok');
      businessesView().catch(fail);
    } catch (ex) {
      btn.disabled = false;
      showErr(ex.message || 'Could not save.');
    }
  };

  const del = document.getElementById('bdel');
  if (del) del.onclick = async () => {
    if (!confirm(`Delete "${r.name}"?\n\nIts ${r.product_count} products and its app login will be deleted. Past orders are kept.`)) return;
    const { error } = await sb.rpc('admin_delete_business', { p_business: r.id });
    if (error) return fail(error);
    dialog.close();
    toast('Business deleted', 'ok');
    businessesView().catch(fail);
  };
}

// ---------------------------------------------------------------- customers
const custFilter = { q: '' };
const CUST_PAGE = 50;
let custRows = [];

async function customersView() {
  view.innerHTML = `
    <div class="view-head"><h1>Customers</h1></div>
    <form id="cf" class="card filters">
      <input name="q" placeholder="Search by name or phone" value="${esc(custFilter.q)}">
      <div class="filter-actions"><button class="btn btn-primary" type="submit">Search</button>
        <button class="btn" type="button" id="creset">Reset</button></div>
    </form>
    <div id="cust-out"><div class="loading" aria-busy="true"></div></div>`;
  const form = document.getElementById('cf');
  form.onsubmit = e => { e.preventDefault(); custFilter.q = form.elements.q.value.trim(); loadCustomers(true).catch(fail); };
  document.getElementById('creset').onclick = () => { custFilter.q = ''; customersView().catch(fail); };
  await loadCustomers(true);
}

async function loadCustomers(reset) {
  const out = document.getElementById('cust-out');
  const from = reset ? 0 : custRows.length;
  let q = sb.from('customers').select('user_id,first_name,last_name,phone,address,created_at')
    .order('created_at', { ascending: false }).range(from, from + CUST_PAGE - 1);
  const term = custFilter.q.replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (term) {
    const digits = term.replace(/\D/g, '');
    const parts = [`first_name.ilike."%${term}%"`, `last_name.ilike."%${term}%"`];
    if (digits.length >= 3) parts.push(`phone.ilike."%${digits}%"`, `phone.ilike."%${canonicalPhone(digits)}%"`);
    q = q.or(parts.join(','));
  }
  const { data, error } = await q;
  if (error) throw error;
  custRows = reset ? data : custRows.concat(data);
  if (!custRows.length) { out.innerHTML = '<p class="empty">No customers found.</p>'; return; }
  out.innerHTML = `<p class="muted small">${custRows.length} shown</p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Joined</th><th></th></tr></thead>
      <tbody>${custRows.map((c, i) => `<tr>
        <td><strong>${esc(c.first_name)} ${esc(c.last_name)}</strong></td>
        <td dir="ltr">+${esc(c.phone)}</td>
        <td>${esc(c.address)}</td>
        <td>${esc(fmtDate(c.created_at))}</td>
        <td><button class="btn btn-sm" data-i="${i}">Edit</button></td>
      </tr>`).join('')}</tbody></table></div>
    ${data.length === CUST_PAGE ? '<div class="actions" style="justify-content:center;margin-top:12px"><button class="btn" id="cmore">Load more</button></div>' : ''}`;
  out.querySelectorAll('[data-i]').forEach(b => { b.onclick = () => openCustomerForm(custRows[Number(b.dataset.i)]); });
  const more = document.getElementById('cmore');
  if (more) more.onclick = () => loadCustomers(false).catch(fail);
}

function openCustomerForm(c) {
  dialog.innerHTML = `<form class="form" id="cuf" novalidate>
    <h2>Edit customer</h2>
    <div class="row2">
      <label>First name<input name="first" value="${esc(c.first_name)}" maxlength="60" required></label>
      <label>Last name<input name="last" value="${esc(c.last_name)}" maxlength="60" required></label>
    </div>
    <label>Phone (login)<input name="phone" value="+${esc(c.phone)}" maxlength="20" dir="ltr" required></label>
    <label>Address<textarea name="address" rows="2" maxlength="500" required>${esc(c.address)}</textarea></label>
    <label>New password (optional)<input name="password" type="password" autocomplete="new-password" placeholder="Leave empty to keep the current one"></label>
    <p class="form-error" hidden></p>
    <div class="actions">
      <button type="button" class="btn btn-danger" id="cdel">Delete account</button>
      <button type="button" class="btn" id="corders">Orders</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button>
    </div>
  </form>`;
  dialog.showModal();
  const form = document.getElementById('cuf');
  const err = form.querySelector('.form-error');
  const showErr = m => { err.textContent = m; err.hidden = false; };
  form.onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    const f = { first: form.elements.first.value.trim(), last: form.elements.last.value.trim(), phone: form.elements.phone.value.trim(),
      address: form.elements.address.value.trim(), password: form.elements.password.value };
    if (!f.first || !f.last || !f.address) return showErr('Please fill in all fields.');
    if (!isPhone(f.phone)) return showErr('Enter a valid phone number.');
    if (f.password && f.password.length < MIN_PASSWORD) return showErr(`Password must be at least ${MIN_PASSWORD} characters.`);
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const { error } = await sb.rpc('admin_update_customer', { p_user: c.user_id, p_first_name: f.first, p_last_name: f.last, p_phone: f.phone, p_address: f.address });
      if (error) throw error;
      if (f.password) {
        const { error: pe } = await sb.rpc('admin_set_password', { p_user: c.user_id, p_password: f.password });
        if (pe) throw pe;
      }
      dialog.close(); toast('Customer saved', 'ok'); loadCustomers(true).catch(fail);
    } catch (ex) { btn.disabled = false; showErr(ex.message || 'Could not save.'); }
  };
  document.getElementById('corders').onclick = () => {
    dialog.close();
    for (const k of Object.keys(orderFilter)) orderFilter[k] = '';
    orderFilter.phone = c.phone; location.hash = '#orders';
  };
  document.getElementById('cdel').onclick = async () => {
    if (!confirm(`Permanently delete ${c.first_name} ${c.last_name}'s account?\n\nTheir past orders are kept for the suppliers.`)) return;
    const { error } = await sb.rpc('admin_delete_customer', { p_user: c.user_id });
    if (error) return fail(error);
    dialog.close(); toast('Account deleted', 'ok'); loadCustomers(true).catch(fail);
  };
}

// ---------------------------------------------------------------- start
async function init() {
  if (!configured) { root.innerHTML = NOT_CONFIGURED_HTML; return; }
  S = await loadSettings();
  applyTheme(S);
  document.title = 'Admin · ' + S.store_name;

  const { data } = await sb.auth.getSession();
  let last = 0;
  try { last = Number(localStorage.getItem(LA_KEY) || 0); } catch { /* ignore */ }
  if (data.session && last && Date.now() - last > IDLE_MS) {
    await sb.auth.signOut();
    return showLogin('Your session expired. Please sign in again.');
  }
  if (data.session && await isAdmin()) return showApp();
  if (data.session) await sb.auth.signOut();
  showLogin();
}

init().catch(fail).finally(() => { window.__appStarted = true; });
