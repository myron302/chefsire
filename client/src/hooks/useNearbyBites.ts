import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** ---------- Public types (Google-only) ---------- */
export type PlaceSource = "google";

export type BaseItem = {
  id: string;
  source: PlaceSource;
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
  /** search keywords, e.g. "sushi", "pizza" */
  q: string;
  /** user-entered city/area, e.g. "Chicago, IL" (optional if ll provided) */
  near?: string;
  /** "lat,lng" string from GPS (optional; takes priority if both provided) */
  ll?: string;
  /** max results (defaults 50; server will clamp as needed) */
  limit?: number;
};

/** ---------- Small helpers ---------- */
function mapGoogle(item: any): BaseItem {
  const loc =
    item?.geometry?.location ||
    item?.geocodes?.location ||
    item?.geocodes?.geometry?.location;

  const lat = typeof loc?.lat === "number" ? loc.lat : null;
  const lng = typeof loc?.lng === "number" ? loc.lng : null;

  // keep first photo_reference if present (server also passes __photoRef)
  const ref = item?.photos?.[0]?.photo_reference || item?.photo_reference;
  const _raw = { ...item };
  if (typeof ref === "string" && ref.length > 0) (_raw as any).__photoRef = ref;

  return {
    id: String(item.place_id || item.id || Math.random()),
    source: "google",
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

type HookState<T> = { data: T | null; isLoading: boolean; error: any };

/** All API calls go through /api */
const API_PREFIX = "/api";

/** ---------- Main hook: Google-only nearby search ---------- */
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
    if (q) {
      params.set("q", q);
      params.set("query", q);
      params.set("keyword", q);
    }
    if (typeof limit === "number") params.set("limit", String(limit));

    if (ll && ll.includes(",")) {
      params.set("ll", ll);
    } else if (near && near.trim()) {
      params.set("near", near.trim());
      params.set("location", near.trim());
    }

    try {
      const r = await fetch(`${API_PREFIX}/google/search?${params.toString()}`, {
        signal: ctrl.signal,
      });

      const js = await r.json();

      // FIXED: Check for API errors in the response body
      if (!r.ok || js.error) {
        const errorMsg = js.message || js.error || `HTTP ${r.status}`;
        console.error("BiteMap API error:", errorMsg, js);
        setState({ 
          data: [], 
          isLoading: false, 
          error: new Error(errorMsg)
        });
        return;
      }

      // Handle ZERO_RESULTS from Google (not an error, just no results)
      if (js.status === "ZERO_RESULTS") {
        setState({ data: [], isLoading: false, error: null });
        return;
      }

      const list = (js?.results || js?.data || js || []).map(mapGoogle);
      setState({ data: list, isLoading: false, error: null });
      
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("BiteMap fetch error:", err);
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

/** ---------- Optional helper hook: "Use my location" button ---------- */
export function useUserLocation(timeoutMs: number = 10000) {
  const [ll, setLL] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "prompting" | "granted" | "denied" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    setError(null);

    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Geolocation is not supported by this browser.");
      return;
    }

    if ("permissions" in navigator && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: "geolocation" as PermissionName })
        .then((res: any) => {
          if (res.state === "denied") {
            setStatus("denied");
          } else {
            setStatus("prompting");
          }
        })
        .catch(() => {
          setStatus("prompting");
        });
    } else {
      setStatus("prompting");
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords || {};
        if (typeof latitude === "number" && typeof longitude === "number") {
          setLL(`${latitude},${longitude}`);
          setStatus("granted");
        } else {
          setStatus("error");
          setError("Invalid coordinates returned.");
        }
      },
      (err) => {
        if (err?.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("error");
        setError(err?.message || "Failed to get location.");
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 60_000,
      }
    );
  }, [timeoutMs]);

  return { ll, status, error, request };
}
