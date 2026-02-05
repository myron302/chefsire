import React, { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const gm = window.google;
    const incomingIds = new Set(markers.map(m => m.id));

    markerObjsRef.current.forEach((obj, id) => {
      if (!incomingIds.has(id)) {
        obj.setMap(null);
        markerObjsRef.current.delete(id);
      }
    });

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
