import {
  sb, configured, esc, money, loadSettings, applyTheme, toast, imageBox, safeUrl,
  isUuid, orderHtml, totalsHtml, NOT_CONFIGURED_HTML, DEFAULT_SETTINGS,
} from './common.js';

const app = document.getElementById('app');
let S = {};

// ---------------------------------------------------------------- cart
const CART_KEY = 'store_cart_v1';

function getCart() {
  try {
    const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(c)
      ? c.filter(x => x && isUuid(x.id) && Number.isInteger(x.qty) && x.qty > 0 && x.qty <= 999)
      : [];
  } catch { return []; }
}
function saveCart(c) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch { /* storage blocked */ }
  updateBadge();
}
function addToCart(id, qty) {
  const c = getCart();
  const it = c.find(x => x.id === id);
  if (it) it.qty = Math.min(999, it.qty + qty); else c.push({ id, qty });
  saveCart(c);
}
function updateBadge() {
  const n = getCart().reduce((a, x) => a + x.qty, 0);
  const b = document.getElementById('cart-count');
  b.textContent = n > 99 ? '99+' : String(n);
  b.hidden = n === 0;
}
const clampQty = v => Math.max(1, Math.min(999, parseInt(v, 10) || 1));

async function fetchCartLines() {
  let cart = getCart();
  if (!cart.length) return { lines: [], removed: false };
  const { data, error } = await sb.from('products')
    .select('id,name,description,image_url,price,mode').in('id', cart.map(x => x.id));
  if (error) throw error;
  const byId = new Map(data.map(p => [p.id, p]));
  const keep = cart.filter(x => byId.has(x.id) && byId.get(x.id).mode !== 'unavailable');
  const removed = keep.length !== cart.length;
  if (removed) saveCart(keep);
  return { lines: keep.map(x => ({ ...x, p: byId.get(x.id) })), removed };
}
const subtotalOf = lines => lines.reduce((a, l) => a + Number(l.p.price) * l.qty, 0);

// ---------------------------------------------------------------- shared UI
function renderChrome() {
  applyTheme(S);
  document.title = S.store_name;
  const logo = document.getElementById('brand-logo');
  const u = safeUrl(S.logo_url);
  if (u) { logo.src = u; logo.alt = S.store_name; logo.hidden = false; } else logo.hidden = true;
  document.getElementById('brand-name').textContent = S.store_name;
  document.getElementById('nav-track').textContent = S.nav_track;
  const contact = [S.contact_phone, S.contact_email, S.contact_address].filter(Boolean);
  document.getElementById('footer').innerHTML =
    `<p class="pre">${esc(S.footer_text)}</p>` +
    (contact.length ? `<p class="footer-contact">${contact.map(esc).join(' · ')}</p>` : '') +
    `<p><a href="privacy.html">Privacy policy</a></p>`;
  updateBadge();
}

function crumbs(list) {
  return `<nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/">${esc(S.lbl_home)}</a>
    ${list.map(c => c.href ? `<span>›</span><a href="${c.href}">${esc(c.label)}</a>` : `<span>›</span><span>${esc(c.label)}</span>`).join('')}
  </nav>`;
}

function modeBadge(mode) {
  if (mode === 'preorder') return `<span class="tag tag-pre">${esc(S.badge_preorder)}</span>`;
  if (mode === 'unavailable') return `<span class="tag tag-off">${esc(S.badge_unavailable)}</span>`;
  return '';
}

function cardGrid(items, href, title, extra = () => '') {
  if (!items.length) return `<p class="empty">${esc(S.empty_list)}</p>`;
  return `<div class="grid">${items.map(it => `
    <a class="card tile" href="${href(it)}">
      ${imageBox(it.image_url, title(it))}
      <div class="tile-body"><h3>${esc(title(it))}</h3>${extra(it)}</div>
    </a>`).join('')}</div>`;
}

function qtyControl(id, val) {
  return `<div class="qty">
    <button type="button" class="qty-btn" data-for="${id}" data-step="-1" aria-label="Decrease">−</button>
    <input id="${id}" type="number" min="1" max="999" value="${val}" inputmode="numeric" aria-label="${esc(S.quantity_label)}">
    <button type="button" class="qty-btn" data-for="${id}" data-step="1" aria-label="Increase">+</button>
  </div>`;
}
function bindQty(scope, onChange) {
  scope.querySelectorAll('.qty-btn').forEach(b => {
    b.onclick = () => {
      const inp = document.getElementById(b.dataset.for);
      inp.value = clampQty(Number(inp.value) + Number(b.dataset.step));
      onChange && onChange(inp);
    };
  });
  scope.querySelectorAll('.qty input').forEach(inp => {
    inp.onchange = () => { inp.value = clampQty(inp.value); onChange && onChange(inp); };
  });
}

function notFound() {
  app.innerHTML = `<div class="empty-page"><p>${esc(S.not_found_page)}</p><a class="btn" href="#/">${esc(S.lbl_home)}</a></div>`;
}

// ---------------------------------------------------------------- pages
async function homePage() {
  const { data, error } = await sb.from('categories').select('id,title,image_url')
    .eq('visible', true).order('sort_order').order('created_at');
  if (error) throw error;
  const banner = safeUrl(S.banner_url);
  app.innerHTML = `
    <section class="hero ${banner ? 'has-bg' : ''}">
      ${banner ? `<img class="hero-bg" src="${esc(banner)}" alt="">` : ''}
      <div class="hero-inner">
        ${imageBox(S.logo_url, S.store_name, 'hero-logo')}
        <h1>${esc(S.hero_title)}</h1>
        ${S.hero_subtitle ? `<p class="pre">${esc(S.hero_subtitle)}</p>` : ''}
      </div>
    </section>
    <h2 class="section-title">${esc(S.categories_heading)}</h2>
    ${cardGrid(data, c => `#/c/${c.id}`, c => c.title)}`;
}

async function categoryPage(id) {
  if (!isUuid(id)) return notFound();
  const [cat, subs] = await Promise.all([
    sb.from('categories').select('id,title').eq('id', id).maybeSingle(),
    sb.from('subcategories').select('id,title,image_url').eq('category_id', id)
      .eq('visible', true).order('sort_order').order('created_at'),
  ]);
  if (cat.error) throw cat.error;
  if (subs.error) throw subs.error;
  if (!cat.data) return notFound();
  app.innerHTML = `${crumbs([{ label: cat.data.title }])}
    <h1 class="page-title">${esc(cat.data.title)}</h1>
    ${cardGrid(subs.data, s => `#/s/${s.id}`, s => s.title)}`;
}

async function subcategoryPage(id) {
  if (!isUuid(id)) return notFound();
  const [sub, prods] = await Promise.all([
    sb.from('subcategories').select('id,title,categories(id,title)').eq('id', id).maybeSingle(),
    sb.from('products').select('id,name,image_url,price,mode').eq('subcategory_id', id)
      .eq('visible', true).order('sort_order').order('created_at'),
  ]);
  if (sub.error) throw sub.error;
  if (prods.error) throw prods.error;
  if (!sub.data) return notFound();
  const cat = sub.data.categories;
  app.innerHTML = `${crumbs([...(cat ? [{ label: cat.title, href: `#/c/${cat.id}` }] : []), { label: sub.data.title }])}
    <h1 class="page-title">${esc(sub.data.title)}</h1>
    ${cardGrid(prods.data, p => `#/p/${p.id}`, p => p.name,
      p => `<div class="tile-meta"><span class="price">${esc(money(p.price, S.currency))}</span>${modeBadge(p.mode)}</div>`)}`;
}

async function productPage(id) {
  if (!isUuid(id)) return notFound();
  const { data: p, error } = await sb.from('products')
    .select('id,name,description,image_url,price,mode,subcategories(id,title,categories(id,title))')
    .eq('id', id).maybeSingle();
  if (error) throw error;
  if (!p) return notFound();
  const sub = p.subcategories;
  const cat = sub && sub.categories;
  const off = p.mode === 'unavailable';
  const label = off ? S.btn_unavailable : p.mode === 'preorder' ? S.btn_preorder : S.btn_order;
  app.innerHTML = `${crumbs([
      ...(cat ? [{ label: cat.title, href: `#/c/${cat.id}` }] : []),
      ...(sub ? [{ label: sub.title, href: `#/s/${sub.id}` }] : []),
      { label: p.name }])}
    <div class="product">
      <div class="product-media">${imageBox(p.image_url, p.name, 'product-img')}</div>
      <div class="product-info">
        <h1>${esc(p.name)}</h1>
        <div class="product-price"><span class="price lg">${esc(money(p.price, S.currency))}</span>${modeBadge(p.mode)}</div>
        ${p.mode === 'preorder' && S.preorder_note ? `<p class="note">${esc(S.preorder_note)}</p>` : ''}
        ${p.description ? `<p class="desc pre">${esc(p.description)}</p>` : ''}
        ${off ? '' : `<label class="qty-label">${esc(S.quantity_label)}</label>${qtyControl('qty', 1)}`}
        <button class="btn btn-primary btn-lg btn-block" id="add" ${off ? 'disabled' : ''}>${esc(label)}</button>
        <a class="btn btn-block view-cart" href="#/cart" hidden id="go-cart">${esc(S.cart_title)} →</a>
      </div>
    </div>`;
  if (!off) {
    bindQty(app);
    document.getElementById('add').onclick = () => {
      addToCart(p.id, clampQty(document.getElementById('qty').value));
      toast(S.added_to_cart, 'ok');
      document.getElementById('go-cart').hidden = false;
    };
  }
}

async function cartPage() {
  const { lines, removed } = await fetchCartLines();
  const notice = removed ? `<p class="notice">${esc(S.removed_items_notice)}</p>` : '';
  const draw = () => {
    const cart = getCart();
    const current = lines.filter(l => cart.some(c => c.id === l.id))
      .map(l => ({ ...l, qty: cart.find(c => c.id === l.id).qty }));
    if (!current.length) {
      app.innerHTML = `<h1 class="page-title">${esc(S.cart_title)}</h1>${notice}
        <div class="empty-page"><p>${esc(S.empty_cart)}</p><a class="btn btn-primary" href="#/">${esc(S.continue_shopping)}</a></div>`;
      return;
    }
    app.innerHTML = `<h1 class="page-title">${esc(S.cart_title)}</h1>${notice}
      <div class="cart-layout">
        <div class="card cart-list">${current.map(l => `
          <div class="cart-row">
            <a href="#/p/${l.id}" class="cart-thumb">${imageBox(l.p.image_url, l.p.name, 'thumb')}</a>
            <div class="cart-main">
              <a href="#/p/${l.id}" class="cart-name">${esc(l.p.name)}</a> ${modeBadge(l.p.mode)}
              <div class="muted small">${esc(money(l.p.price, S.currency))}</div>
            </div>
            <div class="cart-qty">${qtyControl('q-' + l.id, l.qty)}</div>
            <div class="cart-line">${esc(money(Number(l.p.price) * l.qty, S.currency))}</div>
            <button class="icon-btn remove" data-id="${l.id}" aria-label="Remove">✕</button>
          </div>`).join('')}
        </div>
        <div class="card cart-summary">
          ${totalsHtml(subtotalOf(current), S.delivery_fee, S)}
          <a class="btn btn-primary btn-lg btn-block" href="#/checkout">${esc(S.checkout_button)}</a>
          <a class="btn btn-block" href="#/">${esc(S.continue_shopping)}</a>
        </div>
      </div>`;
    bindQty(app, inp => {
      const id = inp.id.slice(2);
      const c = getCart();
      const it = c.find(x => x.id === id);
      if (it) { it.qty = clampQty(inp.value); saveCart(c); }
      draw();
    });
    app.querySelectorAll('.remove').forEach(b => {
      b.onclick = () => { saveCart(getCart().filter(x => x.id !== b.dataset.id)); draw(); };
    });
  };
  draw();
}

async function checkoutPage() {
  const { lines, removed } = await fetchCartLines();
  if (!lines.length) { location.hash = '#/cart'; return; }
  app.innerHTML = `<h1 class="page-title">${esc(S.checkout_title)}</h1>
    ${removed ? `<p class="notice">${esc(S.removed_items_notice)}</p>` : ''}
    <div class="cart-layout">
      <form id="co" class="card form" novalidate>
        <div class="row2">
          <label>${esc(S.f_first_name)}<input name="first" required maxlength="60" autocomplete="given-name"></label>
          <label>${esc(S.f_last_name)}<input name="last" required maxlength="60" autocomplete="family-name"></label>
        </div>
        <label>${esc(S.f_phone)}<input name="phone" type="tel" required maxlength="20" autocomplete="tel" inputmode="tel" dir="ltr"></label>
        <label>${esc(S.f_address)}<textarea name="address" required maxlength="500" rows="3" autocomplete="street-address"></textarea></label>
        ${S.checkout_note ? `<p class="muted small">${esc(S.checkout_note)}</p>` : ''}
        <p class="form-error" id="co-err" hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="co-btn">${esc(S.place_order_button)}</button>
      </form>
      <div class="card cart-summary">
        <div class="mini-items">${lines.map(l => `
          <div class="mini-row"><span>${esc(l.p.name)} × ${l.qty} ${modeBadge(l.p.mode)}</span>
          <span>${esc(money(Number(l.p.price) * l.qty, S.currency))}</span></div>`).join('')}
        </div>
        ${totalsHtml(subtotalOf(lines), S.delivery_fee, S)}
      </div>
    </div>`;

  const form = document.getElementById('co');
  const err = document.getElementById('co-err');
  const btn = document.getElementById('co-btn');
  const showErr = m => { err.textContent = m; err.hidden = false; };

  form.onsubmit = async e => {
    e.preventDefault();
    err.hidden = true;
    const f = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
    const digits = f.phone.replace(/\D/g, '');
    if (!f.first || !f.last || !f.address || !f.phone) return showErr(S.err_required);
    if (digits.length < 7 || digits.length > 15) return showErr(S.err_phone);

    btn.disabled = true;
    btn.textContent = '…';
    const { data, error } = await sb.rpc('place_order', {
      p_first_name: f.first, p_last_name: f.last, p_phone: f.phone, p_address: f.address,
      p_items: getCart().map(x => ({ product_id: x.id, quantity: x.qty })),
    });
    if (error) {
      btn.disabled = false;
      btn.textContent = S.place_order_button;
      return showErr(error.message || 'Something went wrong. Please try again.');
    }
    saveCart([]);
    try { sessionStorage.setItem('last_order', JSON.stringify({ code: data.order_code, phone: digits })); } catch { /* ignore */ }
    location.hash = '#/done';
  };
}

async function donePage() {
  let last = null;
  try { last = JSON.parse(sessionStorage.getItem('last_order') || 'null'); } catch { /* ignore */ }
  if (!last || !last.code) { location.hash = '#/'; return; }
  const { data } = await sb.rpc('lookup_order', { p_phone: last.phone, p_code: last.code });
  app.innerHTML = `<div class="card confirm">
      <div class="check" aria-hidden="true">✓</div>
      <h1>${esc(S.confirm_title)}</h1>
      <p>${esc(S.confirm_message)}</p>
      <p class="muted small">${esc(S.your_order_code)}</p>
      <p class="order-code">${esc(last.code)}</p>
      <button class="btn" id="copy">${esc(S.copy_code)}</button>
    </div>
    ${data && data.order ? orderHtml(data.order, data.items, S) : ''}`;
  document.getElementById('copy').onclick = () => {
    navigator.clipboard?.writeText(last.code).then(() => toast(S.copied, 'ok')).catch(() => {});
  };
}

function trackPage() {
  app.innerHTML = `<h1 class="page-title">${esc(S.track_title)}</h1>
    <form id="tf" class="card form narrow" novalidate>
      <p class="muted">${esc(S.track_help)}</p>
      <label>${esc(S.f_phone)}<input name="phone" type="tel" required maxlength="20" inputmode="tel" autocomplete="tel" dir="ltr"></label>
      <label>${esc(S.f_order_code)}<input name="code" required maxlength="12" autocapitalize="characters" autocomplete="off" dir="ltr" placeholder="XXXX-XXXX"></label>
      <p class="form-error" id="tf-err" hidden></p>
      <button class="btn btn-primary btn-lg btn-block" type="submit" id="tf-btn">${esc(S.track_button)}</button>
    </form>
    <div id="track-result"></div>`;
  const form = document.getElementById('tf');
  const err = document.getElementById('tf-err');
  const btn = document.getElementById('tf-btn');
  const out = document.getElementById('track-result');
  form.onsubmit = async e => {
    e.preventDefault();
    err.hidden = true;
    out.innerHTML = '';
    const phone = form.phone.value.trim();
    const code = form.code.value.trim();
    if (!phone || !code) { err.textContent = S.err_required; err.hidden = false; return; }
    btn.disabled = true;
    const { data, error } = await sb.rpc('lookup_order', { p_phone: phone, p_code: code });
    btn.disabled = false;
    if (error || !data) { err.textContent = S.not_found_message; err.hidden = false; return; }
    if (data.error === 'rate_limited') { err.textContent = S.rate_limited_message; err.hidden = false; return; }
    if (data.error || !data.order) { err.textContent = S.not_found_message; err.hidden = false; return; }
    out.innerHTML = orderHtml(data.order, data.items, S);
  };
}

// ---------------------------------------------------------------- router
async function route() {
  const parts = (location.hash.slice(1) || '/').split('/');
  const a = parts[1] || '';
  const b = parts[2] || '';
  window.scrollTo(0, 0);
  app.innerHTML = '<div class="loading" aria-busy="true"></div>';
  try {
    if (!a) return await homePage();
    if (a === 'c') return await categoryPage(b);
    if (a === 's') return await subcategoryPage(b);
    if (a === 'p') return await productPage(b);
    if (a === 'cart') return await cartPage();
    if (a === 'checkout') return await checkoutPage();
    if (a === 'done') return await donePage();
    if (a === 'track') return trackPage();
    return notFound();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty-page"><p>Something went wrong. Please refresh the page.</p><p class="muted small">${esc(e && e.message || e)}</p></div>`;
  } finally {
    window.__appStarted = true;
  }
}

async function init() {
  if (!configured) { app.innerHTML = NOT_CONFIGURED_HTML; return; }
  try { S = await loadSettings(); } catch (e) { console.error(e); S = { ...DEFAULT_SETTINGS }; }
  renderChrome();
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', updateBadge);
  route();
}

init();
