import { useEffect, useRef, useState } from 'react';
import { normalizeQuery, searchProducts, SUGGEST_LIMIT, type SearchHit } from './engine';

/**
 * Live suggestions for every keystroke.
 * - 90 ms debounce (fast typists don't flood the server; single keystrokes still feel instant)
 * - cached queries render with no delay
 * - out-of-order responses are dropped, so the list always matches what's typed
 */
export function useSuggestions(query: string) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const nq = normalizeQuery(query);
    const my = ++seq.current;
    if (!nq) { setHits([]); setLoading(false); setError(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchProducts(nq, SUGGEST_LIMIT);
        if (my === seq.current) { setHits(rows); setError(false); }
      } catch {
        if (my === seq.current) setError(true);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 90);
    return () => clearTimeout(t);
  }, [query]);

  return { hits, loading, error };
}
