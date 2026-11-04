import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { isUuid } from './supabase';
import { readJSON, writeJSON } from './storage';

/**
 * Talabat-style cart: items from ONE supplier at a time.
 * Adding from another supplier returns a conflict so the screen can ask
 * "Start a new cart?" before replacing it.
 */
export interface CartLine { id: string; qty: number }
interface CartState { businessId: string | null; businessName: string; lines: CartLine[] }
export interface CartProductRef { id: string; business_id: string; businessName: string }
export type AddResult = { ok: true } | { ok: false; conflictWith: string };

type Ctx = CartState & {
  count: number;
  add: (p: CartProductRef, qty: number) => AddResult;
  startNewCart: (p: CartProductRef, qty: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  replaceLines: (lines: CartLine[]) => void;
  clear: () => void;
};

const KEY = 'cart_v2';
const EMPTY: CartState = { businessId: null, businessName: '', lines: [] };
export const clampQty = (v: unknown) => Math.max(1, Math.min(999, Math.floor(Number(v)) || 1));

const validLine = (l: unknown): l is CartLine =>
  !!l && isUuid((l as CartLine).id) && Number.isInteger((l as CartLine).qty) &&
  (l as CartLine).qty > 0 && (l as CartLine).qty <= 999;

function load(): CartState {
  const s = readJSON<Partial<CartState>>(KEY, EMPTY);
  const lines = Array.isArray(s.lines) ? s.lines.filter(validLine) : [];
  if (!lines.length || !isUuid(s.businessId)) return EMPTY;
  return { businessId: s.businessId as string, businessName: String(s.businessName || ''), lines };
}

const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(load);

  const commit = useCallback((next: CartState) => {
    const clean = next.lines.length ? next : EMPTY;
    writeJSON(KEY, clean);
    setState(clean);
  }, []);

  const value = useMemo<Ctx>(() => {
    const addTo = (base: CartState, p: CartProductRef, qty: number): CartState => {
      const found = base.lines.find(l => l.id === p.id);
      const lines = found
        ? base.lines.map(l => (l.id === p.id ? { ...l, qty: clampQty(l.qty + qty) } : l))
        : [...base.lines, { id: p.id, qty: clampQty(qty) }];
      return { businessId: p.business_id, businessName: p.businessName || base.businessName, lines };
    };
    return {
      ...state,
      count: state.lines.reduce((a, l) => a + l.qty, 0),
      add: (p, qty) => {
        if (state.lines.length && state.businessId && state.businessId !== p.business_id) {
          return { ok: false, conflictWith: state.businessName };
        }
        commit(addTo(state, p, qty));
        return { ok: true };
      },
      startNewCart: (p, qty) => commit(addTo(EMPTY, p, qty)),
      setQty: (id, qty) => commit({ ...state, lines: state.lines.map(l => (l.id === id ? { ...l, qty: clampQty(qty) } : l)) }),
      remove: id => commit({ ...state, lines: state.lines.filter(l => l.id !== id) }),
      replaceLines: lines => commit({ ...state, lines: lines.filter(validLine) }),
      clear: () => commit(EMPTY),
    };
  }, [state, commit]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}
