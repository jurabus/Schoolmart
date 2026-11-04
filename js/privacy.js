import { loadSettings, applyTheme, configured } from './common.js';

// Fills the store name and contact details from Admin → Settings.
(async () => {
  if (!configured) return;
  try {
    const S = await loadSettings();
    applyTheme(S);
    document.getElementById('brand-name').textContent = S.store_name;
    document.title = 'Privacy Policy · ' + S.store_name;
    document.getElementById('footer').firstElementChild.textContent = S.footer_text;
    const lines = [
      S.contact_email && ['Email', S.contact_email, 'mailto:' + S.contact_email],
      S.contact_phone && ['Phone', S.contact_phone, 'tel:' + S.contact_phone.replace(/[^\d+]/g, '')],
      S.contact_address && ['Address', S.contact_address, ''],
    ].filter(Boolean);
    if (!lines.length) return;
    const box = document.getElementById('contact-lines');
    box.textContent = '';
    for (const [label, value, href] of lines) {
      const row = document.createElement('div');
      row.append(label + ': ');
      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = value;
        row.append(a);
      } else row.append(value);
      box.append(row);
    }
  } catch { /* keep static fallback */ }
})();
