import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Lightweight, BiteMap-style Google Maps loader:
 * - If window.google.maps exists, reuse it (so BiteMap remains untouched).
 * - Else, fetch key from /api/google/maps-script and inject once.
 * - Uses AdvancedMarkerElement (no legacy Marker warnings).
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
  }
}

const GMAPS_SCRIPT_SELECTOR = 'script[src*="maps.googleapis.com/maps/api/js"]';

async function ensureGoogleMapsLoaded(): Promise<void> {
  // Already loaded
  if (window.google?.maps) return;

  // Existing script tag present? Wait for it.
  const existingScript = document.querySelector<HTMLScriptElement>(GMAPS_SCRIPT_SELECTOR);
  if (existingScript) {
    await waitForGoogle();
    return;
  }

  // Fetch key from the same server endpoint BiteMap uses
  const resp = await fetch("/api/google/maps-script");
  if (!resp.ok) throw new Error("Google Maps key not detected");
  const key = (await resp.text()).trim();
  if (!key) throw new Error("Google Maps key not detected");

  // Inject script (avoid duplicates)
  const script = document.createElement("script");
  // Using new libraries param including marker + places (no legacy Marker/Autocomplete warnings)
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    key
  )}&v=weekly&libraries=marker,places`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);

  await waitForGoogle();
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

export default function MapView({
  center,
  zoom = 12,
  markers,
  onMarkerClick,
  fitToMarkers = true
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  const markerObjsRef = useRef<any[]>([]);

  // Recompute bounds when markers change
  const bounds = useMemo(() => {
    const b = new (window.google?.maps?.LatLngBounds || (class {
      extend() {}
    }))();
    markers.forEach((m) => b.extend(new window.google.maps.LatLng(m.position.lat, m.position.lng)));
    return b;
  }, [markers]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureGoogleMapsLoaded();
        if (cancelled) return;

        // Create map once
        if (!mapRef.current && mapDivRef.current) {
          mapRef.current = new window.google.maps.Map(mapDivRef.current, {
            center,
            zoom,
            mapId: undefined // optional: set your Cloud MapID here if you have styles
          });
        }

        // Clear old markers
        markerObjsRef.current.forEach((mk) => {
          if (mk.map) mk.map = null;
        });
        markerObjsRef.current = [];

        // Add Advanced markers
        const { AdvancedMarkerElement } = window.google.maps.marker;

        markers.forEach((m) => {
          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position: m.position,
            title: m.title || "",
          });

          marker.addListener("gmp-click", () => {
            onMarkerClick?.(m);
          });

          markerObjsRef.current.push(marker);
        });

        // Fit bounds
        if (fitToMarkers && markers.length > 1) {
          const fitBounds = new window.google.maps.LatLngBounds();
          markers.forEach((m) =>
            fitBounds.extend(new window.google.maps.LatLng(m.position.lat, m.position.lng))
          );
          mapRef.current.fitBounds(fitBounds, { top: 64, bottom: 64, left: 64, right: 64 });
        } else if (markers.length === 1) {
          mapRef.current.setCenter(markers[0].position);
          mapRef.current.setZoom(14);
        } else {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(zoom);
        }
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
              This page loads Maps the same way as BiteMap (via <code>/api/google/maps-script</code>).
              Visit <strong>/bitemap</strong> once to ensure the key is working, or confirm that the server
              has <code>GOOGLE_MAPS_API_KEY</code> set. Then refresh this page.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Error: {error}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
