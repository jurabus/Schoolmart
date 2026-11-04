import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { PRODUCT_COLUMNS, sb, type Product } from '@/core/supabase';
import { useCart } from '@/core/cart';

export interface PricedLine { id: string; qty: number; p: Product }

/**
 * Loads current product data (price, name, mode) for everything in the cart.
 * Removes items that were deleted, hidden, made unavailable, or moved to another supplier.
 * Prices shown here are for display only; the server recalculates them at checkout.
 */
export function useCartProducts() {
  const cart = useCart();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const ids = cart.lines.map(l => l.id).join(',');

  const load = useCallback(async () => {
    const list = ids ? ids.split(',') : [];
    if (!list.length) { setProducts({}); setLoading(false); return; }
    setError(null);
    const { data, error: e } = await sb.from('products').select(PRODUCT_COLUMNS).in('id', list);
    if (e) { setError(e.message); setLoading(false); return; }
    const map: Record<string, Product> = {};
    for (const p of (data as unknown as Product[])) {
      if (p.mode !== 'unavailable' && p.business_id === cart.businessId) map[p.id] = p;
    }
    setProducts(map);
    const keep = cart.lines.filter(l => map[l.id]);
    if (keep.length !== cart.lines.length) { setRemoved(true); cart.replaceLines(keep); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, cart.businessId]);

  // Runs on focus and whenever the set of cart items changes.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lines: PricedLine[] = cart.lines.filter(l => products[l.id]).map(l => ({ ...l, p: products[l.id] }));
  const subtotal = lines.reduce((a, l) => a + Number(l.p.price) * l.qty, 0);
  return { lines, subtotal, loading, error, removed, reload: load };
}
