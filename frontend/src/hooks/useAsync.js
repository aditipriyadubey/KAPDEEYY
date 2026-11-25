
import { useCallback, useEffect, useRef, useState } from "react";

/** Runs an async loader on mount and exposes loading / error / reload. */
export default function useAsync(loader, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  const alive = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const data = await loader();

      if (alive.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (err) {
      if (alive.current) {
        setState({
          data: null,
          loading: false,
          error: err?.message || "Request failed",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    run();

    return () => {
      alive.current = false;
    };
  }, [run]);

  const setData = (updater) => {
    setState((s) => ({
      ...s,
      data:
        typeof updater === "function"
          ? updater(s.data)
          : updater,
    }));
  };

  return { ...state, reload: run, setData };
}
