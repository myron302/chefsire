import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Source = "fsq" | "google" | "both";
export type PlaceSource = "fsq" | "google";

export type BaseItem = {
  id: string;
  source: PlaceSource;
  name: string;
  rating?: number | null;
  price?: number | null;
  categories?: { id?: string; title?: string; name?: string }[];
  location?: {
    address?: string | null;
    locality?: string | null;
    region?: string | null;
    country?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  geocodes?: any;
  geometry?: any;
  _raw?: any;
};

type NearbyOpts = {
  q: string;
  near?: string;
  ll?: string; // "lat,lng"
  source: Source;
  limit?: number;
  /** When source === "both", merge obvious duplicates (name + distance) */
  dedupe?: boolean;
};

// ---------- helpers ----------
function normName(name?: string) {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function isSameVenue(a: BaseItem, b: BaseItem, maxMeters = 120) {
  const na = normName(a.name);
  const nb = normName(b.name);
  if (!na || !nb) return false;
  if (na !== nb && !(na.startsWith(nb) || nb.startsWith(na))) return false;
  const la = a.location?.lat, loa = a.location?.lng;
  const lb = b.location?.lat, lob = b.location?.lng;
  if (typeof la === "number" && typeof loa === "number" && typeof lb === "number" && typeof lob === "number") {
    return haversine({ lat: la, lng: loa }, { lat: lb, lng: lob }) <= maxMeters;
  }
  return na === nb;
}
function mergeItems(a: BaseItem, b: BaseItem): BaseItem {
  const pick = <T,>(...vals: (T | null | undefined)[]) => vals.find((v) => v != null) ?? undefined;
  const categories =
    a.categories?.length || b.categories?.length
      ? (a.categories || []).concat(b.categories || [])
      : undefined;
  const lat = pick(a.location?.lat, b.location?.lat);
  const lng = pick(a.location?.lng, b.location?.lng);
  return {
    id: `${a.id}__${b.id}`,
    source: "fsq", // arbitrary for merged rows; UI is source-agnostic
    name: pick(a.name, b.name) || "",
    rating: pick(a.rating, b.rating) ?? null,
    price: pick(a.price, b.price) ?? null,
    categories,
    location: {
      address: pick(a.location?.address, b.location?.address) ?? null,
      locality: pick(a.location?.locality, b.location?.locality) ?? null,
      region: pick(a.location?.region, b.location?.region) ?? null,
      country: pick(a.location?.country, b.location?.country) ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
    },
    geocodes: pick(a.geocodes, b.geocodes),
    geometry: pick(a.geometry, b.geometry),
    _raw: { a: a._raw, b: b._raw },
  };
}
function dedupeList(items: BaseItem[]): BaseItem[] {
  const fsq = items.filter((x) => x.source === "fsq");
  const ggl = items.filter((x) => x.source === "google");
  const usedG = new Set<number>();
  const merged: BaseItem[] = [];
  for (const f of fsq) {
    let m: BaseItem | null = null;
    for (let i = 0; i < ggl.length; i++) {
      if (usedG.has(i)) continue;
      const g = ggl[i];
      if (isSameVenue(f, g)) {
        m = mergeItems(f, g);
        usedG.add(i);
        break;
      }
    }
    merged.push(m || f);
  }
  ggl.forEach((g, i) => {
    if (!usedG.has(i)) merged.push(g);
  });
  return merged;
}
function mapFsq(item: any): BaseItem {
  const lat = item?.geocodes?.main?.latitude ?? item?.geocodes?.roof?.latitude ?? null;
  const lng = item?.geocodes?.main?.longitude ?? item?.geocodes?.roof?.longitude ?? null;
  return {
    id: String(item.fsq_id || item.id || Math.random()),
    source: "fsq",
    name: item.name || "",
    rating: typeof item.rating === "number" ? item.rating : null,
    price: typeof item.price === "number" ? item.price : null,
    categories: item.categories?.map((c: any) => ({ id: c?.id, title: c?.name, name: c?.name })) || [],
    location: {
      address: item.location?.address ?? null,
      locality: item.location?.locality ?? null,
      region: item.location?.region ?? null,
      country: item.location?.country ?? null,
      lat, lng,
    },
    geocodes: item.geocodes,
    _raw: item,
  };
}
function mapGoogle(item: any): BaseItem {
  const loc =
    item?.geometry?.location ||
    item?.geocodes?.location ||
    item?.geocodes?.geometry?.location;
  const lat = typeof loc?.lat === "number" ? loc.lat : null;
  const lng = typeof loc?.lng === "number" ? loc.lng : null;

  // capture a photo_reference if present (first photo)
  let __photoRef: string | null = null;
  const ref = item?.photos?.[0]?.photo_reference || item?.photo_reference;
  if (typeof ref === "string" && ref.length > 0) __photoRef = ref;

  const _raw = { ...item };
  if (__photoRef) (_raw as any).__photoRef = __photoRef;

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
      lat, lng,
    },
    geometry: item.geometry,
    _raw,
  };
}

type HookState<T> = { data: T | null; isLoading: boolean; error: any };

// All API calls go through /api
const API_PREFIX = "/api";

export function useNearbyBites(opts: NearbyOpts) {
  const { q, near, ll, source, limit = 50, dedupe = false } = opts;
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
    if (q) { params.set("q", q); params.set("query", q); params.set("keyword", q); }
    if (near) { params.set("near", near); params.set("location", near); }
    if (ll) params.set("ll", ll);
    if (limit) params.set("limit", String(limit));

    try {
      if (source === "fsq") {
        const r = await fetch(`${API_PREFIX}/fsq/search?${params}`, { signal: ctrl.signal });
        if (!r.ok) { setState({ data: [], isLoading: false, error: null }); return; }
        const js = await r.json();
        const list = (js?.results || js?.data || js || []).map(mapFsq);
        setState({ data: list, isLoading: false, error: null });
        return;
      }

      if (source === "google") {
        const r = await fetch(`${API_PREFIX}/google/search?${params}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`Google ${r.status}`);
        const js = await r.json();
        const list = (js?.results || js?.data || js || []).map(mapGoogle);
        setState({ data: list, isLoading: false, error: null });
        return;
      }

      // BOTH
      const [rf, rg] = await Promise.allSettled([
        fetch(`${API_PREFIX}/fsq/search?${params}`, { signal: ctrl.signal }),
        fetch(`${API_PREFIX}/google/search?${params}`, { signal: ctrl.signal }),
      ]);

      let fsqList: BaseItem[] = [];
      let gglList: BaseItem[] = [];

      if (rf.status === "fulfilled" && rf.value.ok) {
        const jf = await rf.value.json();
        fsqList = (jf?.results || jf?.data || jf || []).map(mapFsq);
      }
      if (rg.status === "fulfilled" && rg.value.ok) {
        const jg = await rg.value.json();
        gglList = (jg?.results || jg?.data || jg || []).map(mapGoogle);
      }

      const combined = fsqList.concat(gglList);
      const final = dedupe ? dedupeList(combined) : combined;
      setState({ data: final, isLoading: false, error: null });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setState({ data: null, isLoading: false, error: err });
    }
  }, [q, near, ll, source, limit, dedupe]);

  useEffect(() => {
    fetcher();
    return () => abortRef.current?.abort();
  }, [fetcher]);

  const refetch = useCallback(() => fetcher(), [fetcher]);
  const data = useMemo(() => state.data ?? [], [state.data]);

  return { data, isLoading: state.isLoading, error: state.error, refetch };
}
