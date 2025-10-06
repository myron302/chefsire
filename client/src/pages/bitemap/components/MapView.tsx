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
  // If we don't have at least a center or markers, don't render anything.
  if (!center && markers.length === 0) return null;

  // Build the markers query string: "lat,lng|lat,lng|..."
  const markerParam = markers
    .map((m) => `${m.lat},${m.lng}`)
    .slice(0, 20) // small safety cap for URL length
    .join("|");

  // Prefer explicit center; otherwise center on the first marker
  const centerParam = center
    ? `${center.lat},${center.lng}`
    : markers.length
    ? `${markers[0].lat},${markers[0].lng}`
    : "";

  // ✅ Static Maps hard limit is 640x640; use scale=2 for retina
  const src = `/api/google/staticmap?center=${encodeURIComponent(
    centerParam
  )}&zoom=${zoom}&size=640x360&scale=2${
    markerParam ? `&markers=${encodeURIComponent(markerParam)}` : ""
  }`;

  // Hide the image if Google rejects it (404/403/etc.)
  const [hide, setHide] = React.useState(false);
  if (hide) return null;

  return (
    <div className="w-full rounded-lg overflow-hidden border">
      <img
        src={src}
        alt="Map"
        className="w-full h-64 object-cover"
        loading="lazy"
        onError={() => setHide(true)}
      />
    </div>
  );
}
