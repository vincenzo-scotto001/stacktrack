import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async loader and track loading / error / data.
 * `reload()` re-runs it; `setData` lets callers apply optimistic updates.
 */
export default function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const seq = useRef(0);

  const run = useCallback(async ({ quiet = false } = {}) => {
    seq.current += 1;
    const mine = seq.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (mine === seq.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (mine === seq.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
