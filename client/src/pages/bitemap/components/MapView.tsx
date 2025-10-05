// client/src/pages/bitemap/components/MapView.tsx
import React from "react";
import { MapPin } from "lucide-react";

interface MapViewProps {
  center?: { lat: number; lng: number };
  markers?: { lat: number; lng: number; name?: string }[];
}

export default function MapView({ center, markers }: MapViewProps) {
  return (
    <div className="relative w-full h-96 bg-muted flex items-center justify-center rounded-md border border-border">
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        <MapPin className="w-6 h-6 mr-2" />
        <span>Map view coming soon</span>
      </div>

      {/* Later: replace with real Google Maps or Leaflet render */}
      {center && (
        <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
          Center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </div>
      )}
    </div>
  );
}
