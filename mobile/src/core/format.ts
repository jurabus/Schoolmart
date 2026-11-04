export function money(n: unknown, currency: string) {
  const v = Number(n || 0);
  const s = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${s} ${currency || ''}`.trim();
}

export function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (x: number) => String(x).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const safeUrl = (u: unknown) => {
  const s = String(u ?? '').trim();
  return /^https:\/\/\S+$/i.test(s) ? s : '';
};

export const digits = (s: string) => s.replace(/\D/g, '');
