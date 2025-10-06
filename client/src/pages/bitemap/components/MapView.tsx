import * as React from "react";

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
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null);
  const markersRef = React.useRef<google.maps.Marker[]>([]);

  // Don't render if no coordinates
  if (!center && markers.length === 0) {
    return (
      <div className="w-full h-64 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
        No location data available
      </div>
    );
  }

  React.useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mapRef.current) return;

      // Wait for Google Maps to load
      if (typeof google === "undefined" || !google.maps) {
        console.error("Google Maps not loaded");
        return;
      }

      if (!mounted) return;

      // Determine center
      const mapCenter = center || (markers.length > 0 ? markers[0] : { lat: 40.7128, lng: -74.006 });

      // Create map only once
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: mapCenter,
          zoom: zoom,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
      } else {
        // Update existing map
        mapInstanceRef.current.setCenter(mapCenter);
        mapInstanceRef.current.setZoom(zoom);
      }

      const map = mapInstanceRef.current;

      // Clear old markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      // Add new markers
      const bounds = new google.maps.LatLngBounds();
      let hasMultipleMarkers = false;

      markers.forEach((m) => {
        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map: map,
          title: m.name,
        });

        if (m.name) {
          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 4px 8px; font-weight: 600;">${escapeHtml(m.name)}</div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        }

        markersRef.current.push(marker);
        bounds.extend({ lat: m.lat, lng: m.lng });
        hasMultipleMarkers = true;
      });

      // Fit bounds if multiple markers
      if (markers.length > 1 && hasMultipleMarkers) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    };

    initMap();

    return () => {
      mounted = false;
    };
  }, [center?.lat, center?.lng, zoom, JSON.stringify(markers)]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      // Don't destroy the map instance here, let React handle it
    };
  }, []);

  return (
    <div className="w-full rounded-lg overflow-hidden border shadow-sm">
      <div
        ref={mapRef}
        className="w-full"
        style={{ height: "400px" }}
        aria-label="Google Map"
      />
    </div>
  );
}

function escapeHtml(s?: string) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
