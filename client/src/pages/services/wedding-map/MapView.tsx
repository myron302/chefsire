import React, { useEffect, useRef, useState } from "react";

/**
 * Google Maps loader (BiteMap-compatible)
 * - Reuses existing window.google if BiteMap already injected it
 * - Otherwise tries, in order:
 *   1) window.GMAPS_KEY
 *   2) import.meta.env.VITE_GOOGLE_MAPS_API_KEY
 *   3) GET /api/google/maps-script  (same style BiteMap often uses)
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
  // 1) Global window key (BiteMap sometimes sets this)
  if (typeof window !== "undefined") {
    const k = window.GMAPS_KEY;
    if (k && String(k).trim()) return String(k).trim();
  }
  // 2) Vite env
  try {
    const viteKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY;
    if (viteKey && String(viteKey).trim()) return String(viteKey).trim();
  } catch {
    /* ignore */
  }
  // 3) Server endpoint
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
  // Prefer global or Vite env (configure this if you want Advanced Markers)
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

  // If a Maps <script> already exists (e.g., from BiteMap), just wait for it.
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

    // Use recommended async loading param + libraries
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(key)}` +
      `&v=weekly&libraries=marker,places&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    await waitForGoogle();

    // Prime importLibrary (modern pattern)
    try {
      await Promise.all([
        window.google.maps.importLibrary("maps"),
        window.google.maps.importLibrary("marker"),
      ]);
    } catch {
      // older builds still work without importLibrary
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
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerObjsRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Ensure Maps loaded (no window.google access before this)
        await ensureGoogleMapsLoaded();
        if (cancelled) return;

        const gm = window.google;
        if (!gm?.maps) throw new Error("Google Maps not available");

        // Discover Map ID (required for Advanced Markers on some projects)
        const mapId = getMapId();

        // 2) Create map once
        if (!mapRef.current && mapDivRef.current) {
          // If you have a Map ID, pass it to enable vector map + advanced markers
          const mapOptions: any = {
            center,
            zoom,
          };
          if (mapId) mapOptions.mapId = mapId;

          // Prefer the class from importLibrary when available
          let MapCtor: any = gm.maps.Map;
          try {
            const { Map } = await gm.maps.importLibrary?.("maps");
            if (Map) MapCtor = Map;
          } catch {
            /* ignore */
          }
          mapRef.current = new MapCtor(mapDivRef.current, mapOptions);
        }

        // 3) Clear old markers
        markerObjsRef.current.forEach((mk) => {
          try {
            if (mk.map) mk.map = null;
            if (mk.setMap) mk.setMap(null);
          } catch {
            /* ignore */
          }
        });
        markerObjsRef.current = [];

        // 4) Choose marker implementation
        const hasAdvanced =
          !!gm.maps.marker?.AdvancedMarkerElement && !!getMapId(); // only if Map ID too
        let AdvancedMarkerElement: any = null;
        if (hasAdvanced) {
          try {
            const libs = await gm.maps.importLibrary?.("marker");
            AdvancedMarkerElement = libs?.AdvancedMarkerElement || gm.maps.marker.AdvancedMarkerElement;
          } catch {
            AdvancedMarkerElement = gm.maps.marker?.AdvancedMarkerElement || null;
          }
        }

        // 5) Add markers
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
            // Fallback to legacy Marker (works without Map ID)
            const marker = new gm.maps.Marker({
              map: mapRef.current,
              position: m.position,
              title: m.title || "",
            });
            marker.addListener("click", () => onMarkerClick?.(m));
            markerObjsRef.current.push(marker);
          }
        });

        // 6) Fit bounds or default center/zoom
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
