import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { isUuid } from './supabase';
import { readJSON, writeJSON } from './storage';

export interface CartLine { id: string; qty: number }
type Ctx = {
  lines: CartLine[];
  count: number;
  add: (id: string, qty: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  replace: (lines: CartLine[]) => void;
  clear: () => void;
};

const KEY = 'cart_v1';
export const clampQty = (v: unknown) => Math.max(1, Math.min(999, Math.floor(Number(v)) || 1));

const valid = (l: unknown): l is CartLine =>
  !!l && isUuid((l as CartLine).id) && Number.isInteger((l as CartLine).qty) &&
  (l as CartLine).qty > 0 && (l as CartLine).qty <= 999;

const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    const saved = readJSON<unknown>(KEY, []);
    return Array.isArray(saved) ? saved.filter(valid) : [];
  });

  const commit = useCallback((next: CartLine[]) => { writeJSON(KEY, next); setLines(next); }, []);

  const value = useMemo<Ctx>(() => ({
    lines,
    count: lines.reduce((a, l) => a + l.qty, 0),
    add: (id, qty) => {
      const found = lines.find(l => l.id === id);
      commit(found
        ? lines.map(l => (l.id === id ? { ...l, qty: clampQty(l.qty + qty) } : l))
        : [...lines, { id, qty: clampQty(qty) }]);
    },
    setQty: (id, qty) => commit(lines.map(l => (l.id === id ? { ...l, qty: clampQty(qty) } : l))),
    remove: id => commit(lines.filter(l => l.id !== id)),
    replace: next => commit(next.filter(valid)),
    clear: () => commit([]),
  }), [lines, commit]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}
