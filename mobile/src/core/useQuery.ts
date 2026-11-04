import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal data-loading hook: { data, error, loading, reload }.
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const d = await run();
      if (alive.current) setData(d);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    reload();
    return () => { alive.current = false; };
  }, [reload]);

  return { data, error, loading, reload };
}

// Supabase returns { data, error }; turn errors into exceptions for useQuery.
export async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}
