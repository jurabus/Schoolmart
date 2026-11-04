// MUST match public.canonical_phone() / public.phone_email() in supabase/migrations/002_marketplace.sql
export function canonicalPhone(p: string): string {
  const d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0') && d.length === 11) return '20' + d.slice(1); // Egyptian local 01XXXXXXXXX
  return d;
}

export const phoneEmail = (p: string) => `u${canonicalPhone(p)}@schoolmart.pro`;
export const isValidPhone = (p: string) => /^[0-9]{8,15}$/.test(canonicalPhone(p));
export const displayPhone = (canonical: string) => (canonical ? '+' + canonical : '');
