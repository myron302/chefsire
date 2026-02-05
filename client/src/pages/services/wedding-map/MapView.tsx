import React, { useEffect, useRef, useState } from "react";

/**
 * Google Maps loader (BiteMap-compatible)
 * - Reuses existing window.google if BiteMap already injected it
 * - Otherwise tries, in order:
 *   1) window.GMAPS_KEY
 *   2) import.meta.env.VITE_GOOGLE_MAPS_API_KEY
 *   3) GET /api/google/maps-script
 *
 * IMPORTANT FIXES:
 * - Map is created ONCE (no reset on rerenders)
 * - Markers are diff-synced (no blinking on load-more / click)
 * - onIdle supported (for "Search this area" button)
 * - Center only pans on "big" center changes (prevents snap-back loop)
 */

type LatLng = { lat: number; lng: number };

export type MarkerInput = {
  id: number | string;
  position: LatLng;
  title?: string;
  category?: string;
  vendor?: any;
};

type Props = {
  center: LatLng;
  zoom?: number;
  markers: MarkerInput[];
  onMarkerClick?: (m: MarkerInput) => void;
  fitToMarkers?: boolean;
  onIdle?: (map: any) => void;
};

declare global {
  interface Window {
    google?: any;
    GMAPS_KEY?: string;
    GMAPS_MAP_ID?: string;
  }
}

const GMAPS_SCRIPT_SELECTOR = 'script[src*="maps.googleapis.com/maps/api/js"]';
let gmapsLoadPromise: Promise<void> | null = null;

async function getGmapsKey(): Promise<string | null> {
  if (typeof window !== "undefined") {
    const k = window.GMAPS_KEY;
    if (k && String(k).trim()) return String(k).trim();
  }
  try {
    const viteKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY;
    if (viteKey && String(viteKey).trim()) return String(viteKey).trim();
  } catch {
    /* ignore */
  }
  try {
    const resp = await fetch("/api/google/maps-script");
    if (resp.ok) {
      const txt = (await resp.text()).trim();
      if (txt) return txt;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getMapId(): string | null {
  const winMapId = (typeof window !== "undefined" && window.GMAPS_MAP_ID) || null;
  const envMapId = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_MAP_ID || null;
  const id = (winMapId || envMapId || "").trim();
  return id || null;
}

function waitForGoogle(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    let waited = 0;
    const step = 50;
    const iv = setInterval(() => {
      waited += step;
      if (window.google?.maps) {
        clearInterval(iv);
        resolve();
      } else if (waited >= timeoutMs) {
        clearInterval(iv);
        reject(new Error("Google Maps failed to load"));
      }
    }, step);
  });
}

async function ensureGoogleMapsLoaded(): Promise<void> {
  if (window.google?.maps) return;

  const existing = document.querySelector<HTMLScriptElement>(GMAPS_SCRIPT_SELECTOR);
  if (existing) {
    await waitForGoogle();
    return;
  }

  if (gmapsLoadPromise) {
    await gmapsLoadPromise;
    return;
  }

  gmapsLoadPromise = (async () => {
    const key = await getGmapsKey();
    if (!key) throw new Error("Google Maps key not detected");

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(key)}` +
      `&v=weekly&libraries=marker,places&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    await waitForGoogle();

    try {
      await Promise.all([
        window.google.maps.importLibrary("maps"),
        window.google.maps.importLibrary("marker"),
      ]);
    } catch {
      /* older builds still work */
    }
  })();

  await gmapsLoadPromise;
}

export default function MapView({
  center,
  zoom = 12,
  markers,
  onMarkerClick,
  fitToMarkers = true,
  onIdle,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  // Marker instances keyed by id (diff sync = no blink)
  const markerObjsRef = useRef<Map<string, any>>(new Map());

  const idleListenerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Track last center we *accepted* (prevents snap-back loop)
  const lastAppliedCenterRef = useRef<LatLng | null>(null);

  // 1) Create map ONCE
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureGoogleMapsLoaded();
        if (cancelled) return;

        const gm = window.google;
        if (!gm?.maps) throw new Error("Google Maps not available");

        const mapId = getMapId();

        if (!mapRef.current && mapDivRef.current) {
          const mapOptions: any = { center, zoom };
          if (mapId) mapOptions.mapId = mapId;

          let MapCtor: any = gm.maps.Map;
          try {
            const libs = await gm.maps.importLibrary?.("maps");
            if (libs?.Map) MapCtor = libs.Map;
          } catch {
            /* ignore */
          }

          mapRef.current = new MapCtor(mapDivRef.current, mapOptions);

          // Idle listener ONCE (for "Search this area")
          idleListenerRef.current = mapRef.current.addListener("idle", () => {
            onIdle?.(mapRef.current);
          });

          lastAppliedCenterRef.current = { ...center };
          setError(null);
        }
      } catch (e: any) {
        setError(e?.message || "Map failed to load");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Diff-sync markers (no wipe + redraw)
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const gm = window.google;

    const incomingIds = new Set(markers.map((m) => String(m.id)));

    // Remove markers not in incoming set
    markerObjsRef.current.forEach((mk, id) => {
      if (!incomingIds.has(id)) {
        try {
          mk.setMap?.(null);
          mk.map = null;
        } catch {
          /* ignore */
        }
        markerObjsRef.current.delete(id);
      }
    });

    // Add new markers
    for (const m of markers) {
      const id = String(m.id);
      if (markerObjsRef.current.has(id)) continue;

      const marker = new gm.maps.Marker({
        map: mapRef.current,
        position: m.position,
        title: m.title || "",
        animation: gm.maps.Animation.DROP,
      });

      marker.addListener("click", () => onMarkerClick?.(m));
      markerObjsRef.current.set(id, marker);
    }

    // Fit bounds only if asked (and only when markers meaningfully change)
    if (fitToMarkers && markers.length > 1) {
      const bounds = new gm.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend(new gm.maps.LatLng(m.position.lat, m.position.lng)));
      mapRef.current.fitBounds(bounds, { top: 64, bottom: 64, left: 64, right: 64 });
    } else if (markers.length === 1) {
      mapRef.current.setCenter(markers[0].position);
      mapRef.current.setZoom(14);
    }
  }, [markers, onMarkerClick, fitToMarkers]);

  // 3) Prevent snap-back: only pan when center changed “a lot” (new search)
  useEffect(() => {
    if (!mapRef.current) return;

    const curr = mapRef.current.getCenter?.();
    if (!curr) return;

    const latDiff = Math.abs(curr.lat() - center.lat);
    const lngDiff = Math.abs(curr.lng() - center.lng);

    // Only treat as "new search location" if it's a meaningful move
    const BIG_MOVE = 0.02; // ~1-2 miles-ish depending on latitude
    if (latDiff > BIG_MOVE || lngDiff > BIG_MOVE) {
      mapRef.current.panTo(center);
      lastAppliedCenterRef.current = { ...center };
    }
  }, [center]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapDivRef} className="w-full h-full" />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="max-w-md text-center p-6 rounded-lg border bg-card shadow-sm">
            <h3 className="font-semibold mb-2">Google Maps not detected</h3>
            <p className="text-sm text-muted-foreground">
              Make sure either <code>window.GMAPS_KEY</code> or <code>VITE_GOOGLE_MAPS_API_KEY</code> is set,
              or that <code>/api/google/maps-script</code> returns your key. Then refresh.
            </p>
            <p className="text-xs text-muted-foreground mt-3">Error: {error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
