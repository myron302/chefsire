// client/src/hooks/useNearbyBites.ts
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
  // Keep any vendor-specific blobs for later use (map markers, etc.)
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
  /** NEW: de-duplicate cross-source results when source === "both" */
  dedupe?: boolean;
};

type HookState<T> = {
  data: T | null;
  isLoading: boolean;
  error: any;
};

function parseLL(ll?: string): { lat?: number; lng?: number } {
  if (!ll) return {};
  const [latStr, lngStr] = ll.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  return { lat, lng };
}

/** Haversine distance in meters */
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3; // meters
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

  const s =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

/** Normalize names for fuzzy equal */
function normName(name?: string) {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Are these likely the same venue? — basic rule: similar name AND within X meters */
function isSameVenue(a: BaseItem, b: BaseItem, maxMeters = 120) {
  const na = normName(a.name);
  const nb = normName(b.name);
  if (!na || !nb) return false;

  // quick name check
  if (na === nb) {
    // ok
  } else {
    // require strong prefix overlap to avoid unrelated merges
    if (!(na.startsWith(nb) || nb.startsWith(na))) return false;
  }

  const la = a.location?.lat;
  const loa = a.location?.lng;
  const lb = b.location?.lat;
  const lob = b.location?.lng;

  if (typeof la === "number" && typeof loa === "number" && typeof lb === "number" && typeof lob === "number") {
    const d = haversine({ lat: la, lng: loa }, { lat: lb, lng: lob });
    if (d > maxMeters) return false;
  } else {
    // If we lack coordinates, try locality/region fallback — still allow match if names are equal.
    if (na !== nb) return false;
  }

  return true;
}

/** Merge two BaseItems (prefer higher rating, pick non-null fields) */
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
    source: "fsq", // arbitrary — merged; you can tag 'both' if you add type
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

/** De-duplicate a combined list (fsq + google) */
function dedupeList(items: BaseItem[]): BaseItem[] {
  const fsq = items.filter((x) => x.source === "fsq");
  const ggl = items.filter((x) => x.source === "google");

  const usedG = new Set<number>();
  const merged: BaseItem[] = [];

  for (const f of fsq) {
    let mergedOne: BaseItem | null = null;
    for (let i = 0; i < ggl.length; i++) {
      if (usedG.has(i)) continue;
      const g = ggl[i];
      if (isSameVenue(f, g)) {
        mergedOne = mergeItems(f, g);
        usedG.add(i);
        break;
      }
    }
    merged.push(mergedOne || f);
  }

  // add leftover google items
  ggl.forEach((g, i) => {
    if (!usedG.has(i)) merged.push(g);
  });

  return merged;
}

/** Map FSQ API payload to BaseItem */
function mapFsq(item: any): BaseItem {
  const lat = item?.geocodes?.main?.latitude ?? item?.geocodes?.roof?.latitude ?? null;
  const lng = item?.geocodes?.main?.longitude ?? item?.geocodes?.roof?.longitude ?? null;
  const rating = typeof item?.rating === "number" ? item.rating : item?.rating ?? null;

  return {
    id: String(item.fsq_id || item.id || item._id || item.ref || Math.random()),
    source: "fsq",
    name: item.name || "",
    rating: rating ?? null,
    price: item.price ?? null,
    categories: item.categories?.map((c: any) => ({ id: c?.id, title: c?.name, name: c?.name })) || [],
    location: {
      address: item.location?.address ?? null,
      locality: item.location?.locality ?? null,
      region: item.location?.region ?? null,
      country: item.location?.country ?? null,
      lat,
      lng,
    },
    geocodes: item.geocodes,
    _raw: item,
  };
}

/** Map Google Places API payload to BaseItem */
function mapGoogle(item: any): BaseItem {
  const loc =
    item?.geometry?.location ||
    item?.geocodes?.location ||
    item?.geocodes?.geometry?.location;

  const lat = typeof loc?.lat === "number" ? loc.lat : null;
  const lng = typeof loc?.lng === "number" ? loc.lng : null;

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
    _raw: item,
  };
}

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
    if (q) params.set("q", q);
    if (near) params.set("near", near);
    if (ll) params.set("ll", ll);
    if (limit) params.set("limit", String(limit));

    try {
      if (source === "fsq") {
        const r = await fetch(`/fsq/search?${params}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`FSQ ${r.status}`);
        const js = await r.json();
        const list = (js?.results || js?.data || js || []).map(mapFsq);
        setState({ data: list, isLoading: false, error: null });
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

      // BOTH: fetch concurrently
      const [rf, rg] = await Promise.all([
        fetch(`/fsq/search?${params}`, { signal: ctrl.signal }),
        fetch(`/google/search?${params}`, { signal: ctrl.signal }),
      ]);
      if (!rf.ok) throw new Error(`FSQ ${rf.status}`);
      if (!rg.ok) throw new Error(`Google ${rg.status}`);

      const [jf, jg] = await Promise.all([rf.json(), rg.json()]);
      const fsqList: BaseItem[] = (jf?.results || jf?.data || jf || []).map(mapFsq);
      const gglList: BaseItem[] = (jg?.results || jg?.data || jg || []).map(mapGoogle);

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

  return {
    data,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
  };
}
