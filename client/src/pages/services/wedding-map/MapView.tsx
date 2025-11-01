import React, { useEffect, useRef, useState } from "react";

/**
 * BiteMap-compatible Google Maps loader
 * - Reuses existing window.google.maps if BiteMap already injected it
 * - Otherwise tries, in order:
 *   1) window.GMAPS_KEY (global)
 *   2) import.meta.env.VITE_GOOGLE_MAPS_API_KEY (Vite)
 *   3) GET /api/google/maps-script  (same endpoint BiteMap typically uses)
 * - Uses AdvancedMarkerElement (no legacy Marker warnings)
 * - Never references window.google until fully loaded (fixes "cannot read 'maps'")
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
};

declare global {
  interface Window {
    google?: any;
    GMAPS_KEY?: string;
  }
}

const GMAPS_SCRIPT_SELECTOR = 'script[src*="maps.googleapis.com/maps/api/js"]';

let gmapsLoadPromise: Promise<void> | null = null;

async function getGmapsKey(): Promise<string | null> {
  // 1) Global key
  if (typeof window !== "undefined") {
    const k = (window as any).GMAPS_KEY;
    if (k && String(k).trim()) return String(k).trim();
  }
  // 2) Vite env
  try {
    const viteKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY;
    if (viteKey && String(viteKey).trim()) return String(viteKey).trim();
  } catch {
    /* noop */
  }
  // 3) Server endpoint (BiteMap-style)
  try {
    const resp = await fetch("/api/google/maps-script");
    if (resp.ok) {
      const txt = (await resp.text()).trim();
      if (txt) return txt;
    }
  } catch {
    /* noop */
  }
  return null;
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

  // If a Maps <script> already exists, just wait for it.
  const existing = document.querySelector<HTMLScriptElement>(GMAPS_SCRIPT_SELECTOR);
  if (existing) {
    await waitForGoogle();
    return;
  }

  // Avoid multiple injects across re-renders
  if (gmapsLoadPromise) {
    await gmapsLoadPromise;
    return;
  }

  gmapsLoadPromise = (async () => {
    const key = await getGmapsKey();
    if (!key) throw new Error("Google Maps key not detected");

    const script = document.createElement("script");
    // Use weekly, and the modern libraries (marker for AdvancedMarkerElement, places if you need it later)
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&v=weekly&libraries=marker,places`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    await waitForGoogle();
  })();

  await gmapsLoadPromise;
}

export default function MapView({
  center,
  zoom = 12,
  markers,
  onMarkerClick,
  fitToMarkers = true,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const markerObjsRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Ensure Maps is loaded (no window.google usage before this)
        await ensureGoogleMapsLoaded();
        if (cancelled) return;

        const gm = window.google;
        if (!gm?.maps) throw new Error("Google Maps not available");

        // 2) Create map once
        if (!mapRef.current && mapDivRef.current) {
          mapRef.current = new gm.maps.Map(mapDivRef.current, {
            center,
            zoom,
            mapId: undefined, // Optionally set your Cloud Map ID for styling
          });
        }

        // 3) Clear old markers
        markerObjsRef.current.forEach((mk) => {
          // AdvancedMarkerElement is removed by setting map = null
          try {
            if (mk.map) mk.map = null;
          } catch {
            /* ignore */
          }
        });
        markerObjsRef.current = [];

        // 4) Add new markers (AdvancedMarkerElement)
        const { AdvancedMarkerElement } = gm.maps.marker;
        markers.forEach((m) => {
          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position: m.position,
            title: m.title || "",
          });
          marker.addListener("gmp-click", () => onMarkerClick?.(m));
          markerObjsRef.current.push(marker);
        });

        // 5) Fit bounds or default center/zoom
        if (fitToMarkers && markers.length > 1) {
          const bounds = new gm.maps.LatLngBounds();
          markers.forEach((m) => bounds.extend(new gm.maps.LatLng(m.position.lat, m.position.lng)));
          mapRef.current.fitBounds(bounds, { top: 64, bottom: 64, left: 64, right: 64 });
        } else if (markers.length === 1) {
          mapRef.current.setCenter(markers[0].position);
          mapRef.current.setZoom(14);
        } else {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(zoom);
        }

        setError(null);
      } catch (e: any) {
        setError(e?.message || "Map failed to load");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [center, zoom, markers, onMarkerClick, fitToMarkers]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapDivRef} className="w-full h-full" />

      {/* Friendly overlay if key missing / blocked */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="max-w-md text-center p-6 rounded-lg border bg-card shadow-sm">
            <h3 className="font-semibold mb-2">Google Maps not detected</h3>
            <p className="text-sm text-muted-foreground">
              This page loads Maps the same way as BiteMap. Make sure either{" "}
              <code>window.GMAPS_KEY</code> or <code>VITE_GOOGLE_MAPS_API_KEY</code> is set, or that{" "}
              <code>/api/google/maps-script</code> returns your key. Then refresh.
            </p>
            <p className="text-xs text-muted-foreground mt-3">Error: {error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
