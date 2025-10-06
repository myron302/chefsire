import * as React from "react";

type LatLng = { lat: number; lng: number };
type Marker = LatLng & { name?: string };

// Global flag to track if the API is loaded
let googleMapsLoaded = false;
let googleMapsLoadPromise: Promise<void> | null = null;

// Load Google Maps API script dynamically via backend proxy
function loadGoogleMapsAPI(): Promise<void> {
  if (googleMapsLoaded) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    // Fetch the API key from backend
    fetch("/api/google/maps-script")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to get Maps API key");
        return res.text();
      })
      .then((apiKey) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          googleMapsLoaded = true;
          resolve();
        };

        script.onerror = () => {
          googleMapsLoadPromise = null;
          reject(new Error("Failed to load Google Maps API"));
        };

        document.head.appendChild(script);
      })
      .catch((err) => {
        googleMapsLoadPromise = null;
        reject(err);
      });
  });

  return googleMapsLoadPromise;
}

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
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
      try {
        // Load Google Maps API
        await loadGoogleMapsAPI();

        if (!mounted || !mapRef.current) return;

        // Wait for google.maps to be available
        if (typeof google === "undefined" || !google.maps) {
          throw new Error("Google Maps API not loaded");
        }

        setIsLoading(false);

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
      } catch (err: any) {
        if (mounted) {
          console.error("Map initialization error:", err);
          setError(err.message || "Failed to load map");
          setIsLoading(false);
        }
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
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-64 rounded-lg border bg-destructive/10 flex items-center justify-center text-destructive text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden border shadow-sm relative">
      {isLoading && (
        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center z-10">
          <div className="text-sm text-muted-foreground">Loading map...</div>
        </div>
      )}
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
