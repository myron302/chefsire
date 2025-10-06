import * as React from "react";

// Leaflet works great with Vite/React, but its CSS and marker images need a bit of setup.
// We import the CSS directly so styles are bundled.
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number };
type Marker = LatLng & { name?: string };

export default function MapView({
  center,
  markers = [],
  zoom = 13,
}: {
  center?: LatLng;
  markers?: Marker[];
  zoom?: number;
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = React.useRef<any>(null);

  // Don’t render anything if we truly have no coordinates
  if (!center && markers.length === 0) return null;

  React.useEffect(() => {
    let map: any;
    let L: any;
    let cleanup: (() => void) | undefined;

    (async () => {
      // Dynamic import so we avoid SSR issues and keep bundle lean
      const leaflet = await import("leaflet");
      L = leaflet.default || leaflet;

      // Fix default icon paths so Vite loads the marker images correctly
      // (these imports resolve to files in node_modules)
      const iconUrl = (await import("leaflet/dist/images/marker-icon.png")).default as string;
      const iconRetinaUrl = (await import("leaflet/dist/images/marker-icon-2x.png")).default as string;
      const shadowUrl = (await import("leaflet/dist/images/marker-shadow.png")).default as string;

      L.Icon.Default.mergeOptions({
        iconUrl,
        iconRetinaUrl,
        shadowUrl,
      });

      // Pick a sensible center: explicit center, else first marker
      const initialCenter: [number, number] = center
        ? [center.lat, center.lng]
        : [markers[0].lat, markers[0].lng];

      // Create the map only once
      if (!mapInstanceRef.current && mapRef.current) {
        map = L.map(mapRef.current, {
          center: initialCenter,
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        // OSM tiles (no key required)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        mapInstanceRef.current = map;
      } else {
        map = mapInstanceRef.current;
        map.setView(initialCenter, zoom);
      }

      // Add markers
      const layerGroup = L.layerGroup().addTo(map);
      markers.forEach((m) => {
        const mk = L.marker([m.lat, m.lng]);
        if (m.name) mk.bindPopup(`<b>${escapeHtml(m.name)}</b>`);
        mk.addTo(layerGroup);
      });

      // If multiple markers, fit the map bounds nicely
      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      // Cleanup markers when props change / component unmounts
      cleanup = () => {
        if (map && layerGroup) {
          map.removeLayer(layerGroup);
        }
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [center?.lat, center?.lng, zoom, JSON.stringify(markers)]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg overflow-hidden border"
      style={{ height: "256px" }} // ~h-64
      aria-label="Map"
    />
  );
}

// Tiny helper to avoid HTML injection in popups
function escapeHtml(s?: string) {
  if (!s) return "";
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
