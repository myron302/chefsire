// inside useNearbyBites:
const fetcher = useCallback(async () => {
  abortRef.current?.abort();
  const ctrl = new AbortController();
  abortRef.current = ctrl;
  setState((s) => ({ ...s, isLoading: true, error: null }));

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (near) params.set("near", near);
  if (ll) params.set("ll", ll);
  if (limit) params.set("limit", String(limit));

  try {
    if (source === "fsq") {
      // if no FSQ key, throw or fallback
      // or return empty
      setState({ data: [], isLoading: false, error: null });
      return;
    }

    if (source === "google") {
      const r = await fetch(`/google/search?${params}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`Google ${r.status}`);
      const js = await r.json();
      const list = (js?.results || js?.data || js || []).map(mapGoogle);
      setState({ data: list, isLoading: false, error: null });
      return;
    }

    // BOTH: but if FSQ disabled, just do Google
    const rG = await fetch(`/google/search?${params}`, { signal: ctrl.signal });
    if (!rG.ok) throw new Error(`Google ${rG.status}`);
    const jG = await rG.json();
    const gList: BaseItem[] = (jG?.results || jG?.data || jG || []).map(mapGoogle);
    setState({ data: gList, isLoading: false, error: null });
  } catch (err: any) {
    if (err?.name === "AbortError") return;
    setState({ data: null, isLoading: false, error: err });
  }
}, [q, near, ll, source, limit]);
