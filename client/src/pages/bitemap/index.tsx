import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Map as MapIcon,
  Compass,
  LocateFixed,
  Loader2,
  List,
  LayoutGrid,
  Globe2,
  Landmark,
  Star,
} from "lucide-react";

import {
  useNearbyBites,
  type BaseItem,
  type Source,
} from "@/hooks/useNearbyBites";
import { usePlaceDetails } from "@/hooks/usePlaceDetails";

import MapView from "./components/MapView";
import RestaurantCard from "./components/RestaurantCard";

/* -----------------------------
   Minimal local modal
------------------------------*/
function LocalDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close overlay"
      />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-background border shadow-xl">
        <div className="sticky top-0 z-10 p-4 border-b bg-background">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{title || "Details"}</h3>
              {subtitle && (
                <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
              )}
            </div>
            <button
              className="px-2 py-1 text-sm rounded hover:bg-muted"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
        <div className="sticky bottom-0 p-3 border-t flex justify-end bg-background">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function PriceBadge({ price, source }: { price?: number | null; source: "fsq" | "google" }) {
  if (price == null) return null;
  const count = source === "google" ? Math.max(1, price) : price;
  return <Badge variant="secondary">{"$".repeat(Math.max(1, Math.min(4, Number(count) || 1)))}</Badge>;
}

export default function BiteMapPage() {
  // UI state
  const [q, setQ] = React.useState("restaurant");
  const [near, setNear] = React.useState("New York, NY");
  const [ll, setLL] = React.useState<string | undefined>(undefined);
  const [tab, setTab] = React.useState<"all" | "fsq" | "google">("all");
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [mapOpen, setMapOpen] = React.useState<boolean>(false);

  // Selection for details
  const [selected, setSelected] = React.useState<BaseItem | null>(null);

  // Fetch list
  const list = useNearbyBites({
    q,
    near: ll ? undefined : near,
    ll,
    source: tab === "all" ? "both" : (tab as Source),
    limit: 60,
  });

  // Fetch details (only for Google; FSQ shows basic modal)
  const details = usePlaceDetails(
    selected?.source ?? "fsq",
    selected?.id
  );

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLL(`${pos.coords.latitude},${pos.coords.longitude}`),
      () => alert("Could not get your location.")
    );
  }

  // Prepare markers for MapView
  const markers = React.useMemo(() => {
    if (!list.data) return [];
    return list.data
      .map((it) => {
        const fsqLat = (it as any).geocodes?.main?.latitude;
        const fsqLng = (it as any).geocodes?.main?.longitude;
        const gglLoc =
          (it as any).geocodes?.location ||
          (it as any).geocodes?.geometry?.location ||
          (it as any).geometry?.location;
        const gLat = gglLoc?.lat;
        const gLng = gglLoc?.lng;
        const lat = fsqLat ?? gLat;
        const lng = fsqLng ?? gLng;
        if (typeof lat === "number" && typeof lng === "number") {
          return { lat, lng, name: it.name };
        }
        return null;
      })
      .filter(Boolean) as { lat: number; lng: number; name?: string }[];
  }, [list.data]);

  // Derive a center
  const center = React.useMemo(() => {
    if (ll) {
      const [lat, lng] = ll.split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    if (markers.length) return { lat: markers[0].lat, lng: markers[0].lng };
    return undefined;
  }, [ll, markers]);

  const isLoading = list.isLoading;
  const hasError = !!list.error;

  // Build detail fields
  const det = details.data || null;
  const detName = det?.name ?? selected?.name ?? "Details";
  const detAddress =
    det?.location?.address ||
    [det?.location?.locality, det?.location?.region].filter(Boolean).join(", ") ||
    selected?.location?.address ||
    [selected?.location?.locality, selected?.location?.region].filter(Boolean).join(", ") ||
    "";

  const detRating = typeof det?.rating === "number"
    ? det.rating
    : (typeof selected?.rating === "number" ? selected.rating : undefined);

  const detUserCount = det?.user_ratings_total;
  const detWebsite = det?.website || undefined;
  const detUrl = det?.url || undefined;

  // Coordinates
  const detLat =
    det?.location?.lat ??
    (det as any)?.geometry?.location?.lat ??
    (selected as any)?.location?.lat ??
    (selected as any)?.geocodes?.main?.latitude ??
    (selected as any)?.geometry?.location?.lat ??
    null;
  const detLng =
    det?.location?.lng ??
    (det as any)?.geometry?.location?.lng ??
    (selected as any)?.location?.lng ??
    (selected as any)?.geocodes?.main?.longitude ??
    (selected as any)?.geometry?.location?.lng ??
    null;
  const detCenter =
    typeof detLat === "number" && typeof detLng === "number"
      ? { lat: detLat, lng: detLng }
      : undefined;

  const detReviews = Array.isArray(det?.reviews) ? det.reviews : [];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <MapIcon className="w-6 h-6" />
          <h1 className="text-2xl font-semibold">BiteMap</h1>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={mapOpen ? "default" : "ghost"}
            onClick={() => setMapOpen((v) => !v)}
            title="Toggle map"
          >
            <MapIcon className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={view === "list" ? "default" : "ghost"}
            onClick={() => setView("list")}
            title="List"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={view === "grid" ? "default" : "ghost"}
            onClick={() => setView("grid")}
            title="Grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search (e.g., tacos, sushi, vegan)"
            className="w-64"
          />
          <Button onClick={() => list.refetch()}>
            <Compass className="w-4 h-4 mr-1" />
            Search
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={near}
            onChange={(e) => setNear(e.target.value)}
            placeholder="City or neighborhood"
            disabled={!!ll}
            className="w-56"
          />
          <Button
            variant={ll ? "secondary" : "outline"}
            onClick={() => (ll ? setLL(undefined) : useMyLocation())}
          >
            <LocateFixed className="w-4 h-4 mr-1" />
            {ll ? "Using GPS" : "Use my location"}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="ml-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="fsq">
              <Landmark className="w-3.5 h-3.5 mr-1" />
              Foursquare
            </TabsTrigger>
            <TabsTrigger value="google">
              <Globe2 className="w-3.5 h-3.5 mr-1" />
              Google
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Map */}
      {mapOpen && (
        <>
          <MapView center={center} markers={markers} />
          <Separator className="my-2" />
        </>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : hasError ? (
        <div className="text-red-600">
          Search failed. Check your API keys in <code>server/.env</code>.
        </div>
      ) : (
        <ResultsGrid
          items={list.data || []}
          view={view}
          onOpenDetails={(item) => setSelected(item)}
        />
      )}

      {/* Details modal */}
      <LocalDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={detName}
        subtitle={
          <div className="space-y-1">
            <div>{detAddress || "—"}</div>
            <div className="flex items-center gap-2">
              {typeof detRating === "number" && (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 stroke-yellow-400" />
                  <span>
                    {detRating.toFixed(1)}
                    {typeof detUserCount === "number" && ` (${detUserCount})`}
                  </span>
                </div>
              )}
              {selected?.source && (
                <Badge variant="outline" className="text-xs">
                  {selected.source === "fsq" ? "Foursquare" : "Google"}
                </Badge>
              )}
            </div>
          </div>
        }
      >
        {details.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading details…
          </div>
        )}

        {/* Static map */}
        {detCenter && (
          <img
            className="w-full h-56 object-cover rounded border mb-4"
            src={`/api/google/staticmap?center=${encodeURIComponent(
              `${detCenter.lat},${detCenter.lng}`
            )}&zoom=15&size=1024x400&scale=2&markers=${encodeURIComponent(`${detCenter.lat},${detCenter.lng}`)}`}
            alt="Map"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        {/* Reviews */}
        {detReviews.length > 0 && (
          <div className="space-y-2 mt-3">
            <div className="font-semibold text-sm">Recent reviews</div>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {detReviews.slice(0, 6).map((rv: any, idx: number) => (
                <div key={idx} className="text-sm border rounded p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">{rv.author || "Guest"}</div>
                    {typeof rv.rating === "number" && (
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                        <span>{rv.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {rv.text || ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          {detUrl && (
            <a href={detUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                Open listing
              </Button>
            </a>
          )}
          {detWebsite && (
            <a href={detWebsite} target="_blank" rel="noreferrer">
              <Button size="sm">Visit website</Button>
            </a>
          )}
        </div>
      </LocalDialog>
    </div>
  );
}

function ResultsGrid({
  items,
  view,
  onOpenDetails,
}: {
  items: BaseItem[];
  view: "list" | "grid";
  onOpenDetails: (item: BaseItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No results. Try a broader query, another neighborhood, or "Use my location".
      </div>
    );
  }

  const containerClass =
    view === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      : "space-y-3";

  return (
    <div className={containerClass}>
      {items.map((b) => (
        <RestaurantCard
          key={`${b.source}-${b.id}`}
          name={b.name}
          address={
            b.location?.address ||
            [b.location?.locality, b.location?.region].filter(Boolean).join(", ")
          }
          rating={typeof b.rating === "number" ? b.rating : undefined}
          price={b.price ?? undefined}
          categories={b.categories || []}
          source={b.source}
          onSelect={() => onOpenDetails(b)}
          raw={(b as any)._raw}
        />
      ))}
    </div>
  );
}
