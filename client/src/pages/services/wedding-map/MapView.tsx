import React, { useEffect, useRef, useState } from "react";

/**
 * Google Maps loader (BiteMap-compatible)
 * - Reuses existing window.google if BiteMap already injected it
 * - Otherwise tries, in order:
 *   1) window.GMAPS_KEY
 *   2) import.meta.env.VITE_GOOGLE_MAPS_API_KEY
 *   3) GET /api/google/maps-script
 *
 * Improvements:
 * - Adds `loading=async` to remove the perf warning
 * - Uses importLibrary() and falls back to legacy Marker if no Map ID
 * - Advanced markers only when a valid Map ID is provided
 */

type LatLng = { lat: number; lng: number };

type MarkerInput = {
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
  onIdle?: (map: any) => void; // ✅ ADD
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
  } catch {}
  try {
    const resp = await fetch("/api/google/maps-script");
    if (resp.ok) {
      const txt = (await resp.text()).trim();
      if (txt) return txt;
    }
  } catch {}
  return null;
}

function getMapId(): string | null {
  const winMapId = (typeof window !== "undefined" && window.GMAPS_MAP_ID) || null;
  const envMapId = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_MAP_ID || null;
  const id = (winMapId || envMapId || "").trim();
  return id || null;
}

function waitForGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const maxTries = 200; // ~10s
    const iv = setInterval(() => {
      tries++;
      if (window.google?.maps) {
        clearInterval(iv);
        resolve();
      } else if (tries > maxTries) {
        clearInterval(iv);
        reject(new Error("Google Maps failed to load"));
      }
    }, 50);
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
    } catch {}
  })();

  await gmapsLoadPromise;
}

/** Small helper: avoid re-centering when user is just panning/zooming */
function isFar(a: LatLng, b: LatLng, threshold = 0.01) {
  // ~0.01 degrees ≈ 0.6 miles latitude-ish. Adjust if you want.
  return Math.abs(a.lat - b.lat) > threshold || Math.abs(a.lng - b.lng) > threshold;
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
  const markerObjsRef = useRef<any[]>([]);
  const idleListenerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ Effect A: Create map ONCE + attach idle listener ONCE
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
          let MapCtor: any = gm.maps.Map;
          try {
            const libs = await gm.maps.importLibrary?.("maps");
            if (libs?.Map) MapCtor = libs.Map;
          } catch {}

          const mapOptions: any = { center, zoom };
          if (mapId) mapOptions.mapId = mapId;

          mapRef.current = new MapCtor(mapDivRef.current, mapOptions);

          // idle listener once (no duplication)
          idleListenerRef.current = mapRef.current.addListener("idle", () => {
            onIdle?.(mapRef.current);
          });
        }

        setError(null);
      } catch (e: any) {
        setError(e?.message || "Map failed to load");
      }
    })();

    return () => {
      cancelled = true;
      try {
        idleListenerRef.current?.remove?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ ONLY ONCE

  // ✅ Effect B: Update markers only when markers list changes (no map reset)
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const gm = window.google;

    // Clear old markers
    markerObjsRef.current.forEach((mk) => {
      try {
        if (mk.map) mk.map = null;
        if (mk.setMap) mk.setMap(null);
      } catch {}
    });
    markerObjsRef.current = [];

    const hasAdvanced = !!gm.maps.marker?.AdvancedMarkerElement && !!getMapId();
    const AdvancedMarkerElement = hasAdvanced ? gm.maps.marker.AdvancedMarkerElement : null;

    markers.forEach((m) => {
      if (hasAdvanced && AdvancedMarkerElement) {
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: m.position,
          title: m.title || "",
        });
        marker.addListener("gmp-click", () => onMarkerClick?.(m));
        markerObjsRef.current.push(marker);
      } else {
        const marker = new gm.maps.Marker({
          map: mapRef.current,
          position: m.position,
          title: m.title || "",
        });
        marker.addListener("click", () => onMarkerClick?.(m));
        markerObjsRef.current.push(marker);
      }
    });
  }, [markers, onMarkerClick]);

  // ✅ Effect C: Only pan when center changed *significantly* (new search / new city)
  useEffect(() => {
    if (!mapRef.current) return;

    const current = mapRef.current.getCenter?.();
    if (!current) return;

    const currentLatLng: LatLng = { lat: current.lat(), lng: current.lng() };

    // Only re-center when it's actually a new location (prevents snap-back while dragging)
    if (isFar(currentLatLng, center, 0.01)) {
      mapRef.current.panTo(center);
    }
  }, [center]);

  // ✅ Effect D: Fit bounds when results change (optional)
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const gm = window.google;

    if (!fitToMarkers) return;

    if (markers.length > 1) {
      const bounds = new gm.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend(new gm.maps.LatLng(m.position.lat, m.position.lng)));
      mapRef.current.fitBounds(bounds, { top: 64, bottom: 64, left: 64, right: 64 });
    } else if (markers.length === 1) {
      mapRef.current.setCenter(markers[0].position);
      mapRef.current.setZoom(14);
    }
    // If 0 markers: do nothing (do NOT snap back)
  }, [markers, fitToMarkers]);

  return (import React, { useEffect, useRef, useState } from "react";

/**
 * Google Maps loader (BiteMap-compatible)
 * Stable Marker Management: Prevents "Blinking" by tracking markers by ID.
 */

type LatLng = { lat: number; lng: number };
type MarkerInput = {
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
  } catch { /* ignore */ }
  try {
    const resp = await fetch("/api/google/maps-script");
    if (resp.ok) {
      const txt = (await resp.text()).trim();
      if (txt) return txt;
    }
  } catch { /* ignore */ }
  return null;
}

function getMapId(): string | null {
  const winMapId = (typeof window !== "undefined" && window.GMAPS_MAP_ID) || null;
  const envMapId = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_MAP_ID || null;
  return (winMapId || envMapId || "").trim() || null;
}

function waitForGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (window.google?.maps) {
        clearInterval(iv);
        resolve();
      } else if (tries > 200) {
        clearInterval(iv);
        reject(new Error("Google Maps failed to load"));
      }
    }, 50);
  });
}

async function ensureGoogleMapsLoaded(): Promise<void> {
  if (window.google?.maps) return;
  const existing = document.querySelector<HTMLScriptElement>(GMAPS_SCRIPT_SELECTOR);
  if (existing) { await waitForGoogle(); return; }
  if (gmapsLoadPromise) { await gmapsLoadPromise; return; }

  gmapsLoadPromise = (async () => {
    const key = await getGmapsKey();
    if (!key) throw new Error("Google Maps key not detected");
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker,places&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    await waitForGoogle();
  })();
  await gmapsLoadPromise;
}

export default function MapView({ center, zoom = 12, markers, onMarkerClick, fitToMarkers = true, onIdle }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerObjsRef = useRef<Map<string | number, any>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Initial Map Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureGoogleMapsLoaded();
        if (cancelled) return;
        const gm = window.google;
        if (!mapRef.current && mapDivRef.current) {
          mapRef.current = new gm.maps.Map(mapDivRef.current, {
            center,
            zoom,
            mapId: getMapId() || undefined,
          });
          mapRef.current.addListener("idle", () => onIdle?.(mapRef.current));
        }
      } catch (e: any) { setError(e?.message); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync Markers - STABLE VERSION
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const gm = window.google;
    const incomingIds = new Set(markers.map(m => m.id));

    // 1. Remove markers no longer in list
    markerObjsRef.current.forEach((obj, id) => {
      if (!incomingIds.has(id)) {
        obj.setMap(null);
        markerObjsRef.current.delete(id);
      }
    });

    // 2. Add only new markers
    markers.forEach((m) => {
      if (!markerObjsRef.current.has(m.id)) {
        const marker = new gm.maps.Marker({
          map: mapRef.current,
          position: m.position,
          title: m.title,
          animation: gm.maps.Animation.DROP
        });
        marker.addListener("click", () => onMarkerClick?.(m));
        markerObjsRef.current.set(m.id, marker);
      }
    });
  }, [markers]);

  // Center Sync (Only if moved significantly)
  useEffect(() => {
    if (mapRef.current) {
      const currentCenter = mapRef.current.getCenter();
      const latDiff = Math.abs(currentCenter.lat() - center.lat);
      const lngDiff = Math.abs(currentCenter.lng() - center.lng);
      if (latDiff > 0.02 || lngDiff > 0.02) {
        mapRef.current.panTo(center);
      }
    }
  }, [center]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapDivRef} className="w-full h-full" />
      {error && <div className="absolute inset-0 bg-white/80 p-4 text-center">{error}</div>}
    </div>
  );
}
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
