// client/src/hooks/useNearbyBites.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type BaseItem = {
  id: string;
  name: string;
  rating?: number | null;
  price?: number | null;
  categories?: { title?: string; name?: string }[];
  location?: {
    address?: string | null;
    locality?: string | null;
    region?: string | null;
    country?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  geometry?: any;
  _raw?: any;
};

type NearbyOpts = {
  q: string;
  near?: string;
  ll?: string; // "lat,lng"
  limit?: number;
};

type HookState<T> = { data: T | null; isLoading: boolean; error: any };

// All API calls go through /api
const API_PREFIX = "/api";

function mapGoogle(item: any): BaseItem {
  const loc =
    item?.geometry?.location ||
    item?.geocodes?.location ||
    item?.geocodes?.geometry?.location;
  const lat = typeof loc?.lat === "number" ? loc.lat : null;
  const lng = typeof loc?.lng === "number" ? loc.lng : null;

  // carry through first photo_reference if present (your backend also attaches __photoRef)
  const _raw = { ...item };
  const ref = item?.photos?.[0]?.photo_reference || item?.photo_reference || item?.__photoRef;
  if (typeof ref === "string" && ref.length > 0) (_raw as any).__photoRef = ref;

  return {
    id: String(item.place_id || item.id || Math.random()),
    name: item.name || "",
    rating: typeof item.rating === "number" ? item.rating : null,
    price: typeof item.price_level === "number" ? item.price_level : null,
    categories: (item.types || []).map((t: string) => ({ title: t, name: t })),
    location: {
      address: item.formatted_address ?? null,
      locality: item.vicinity ?? null,
      region: null,
      country: null,
      lat,
      lng,
    },
    geometry: item.geometry,
    _raw,
  };
}

export function useNearbyBites(opts: NearbyOpts) {
  const { q, near, ll, limit = 50 } = opts;
  const [state, setState] = useState<HookState<BaseItem[]>>({
    data: null,
    isLoading: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetcher = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (near) params.set("near", near);
    if (ll) params.set("ll", ll);
    params.set("limit", String(limit));

    try {
      const r = await fetch(`${API_PREFIX}/google/search?${params}`, {
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`Google ${r.status}`);
      const js = await r.json();
      const list = (js?.results || js?.data || js || []).map(mapGoogle);
      setState({ data: list, isLoading: false, error: null });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setState({ data: null, isLoading: false, error: err });
    }
  }, [q, near, ll, limit]);

  useEffect(() => {
    fetcher();
    return () => abortRef.current?.abort();
  }, [fetcher]);

  const refetch = useCallback(() => fetcher(), [fetcher]);
  const data = useMemo(() => state.data ?? [], [state.data]);

  return { data, isLoading: state.isLoading, error: state.error, refetch };
}
