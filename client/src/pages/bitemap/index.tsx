// client/src/pages/bitemap/index.tsx
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
} from "lucide-react";

// Global hooks (shared folder)
import {
  useNearbyBites,
  type BaseItem,
  type Source,
} from "@/hooks/useNearbyBites";
import {
  usePlaceDetails,
  type PlaceSource,
} from "@/hooks/usePlaceDetails";

// BiteMap local components
import MapView from "./components/MapView";
import RestaurantCard from "./components/RestaurantCard";
import DetailsSheet from "./components/DetailsSheet";

function PriceBadge({ price, source }: { price?: number | null; source: "fsq" | "google" }) {
  if (price == null) return null;
  const count = source === "google" ? Math.max(1, price) : price;
  return <Badge variant="secondary">{"$".repeat(Math.max(1, Math.min(4, count || 1)))}</Badge>;
}

export default function BiteMapPage() {
  // UI state
  const [q, setQ] = React.useState("restaurant");
  const [near, setNear] = React.useState("New York, NY");
  const [ll, setLL] = React.useState<string | undefined>(undefined); // "lat,lng"
  const [tab, setTab] = React.useState<"all" | "fsq" | "google">("all");
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [mapOpen, setMapOpen] = React.useState<boolean>(false);
  const [dedupe, setDedupe] = React.useState<boolean>(true); // ✅ NEW

  // Selection for details
  const [selected, setSelected] = React.useState<{ id: string; source: PlaceSource } | null>(null);

  // Fetch list with global hook (now passes dedupe)
  const list = useNearbyBites({
    q,
    near: ll ? undefined : near,
    ll,
    source: tab === "all" ? "both" : (tab as Source),
    limit: 60,
    dedupe: tab === "all" ? dedupe : false,
  });

  // Fetch details (unified) when selected
  const details = usePlaceDetails(selected?.source || "fsq", selected?.id);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLL(`${pos.coords.latitude},${pos.coords.longitude}`),
      () => alert("Could not get your location.")
    );
  }

  // Prepare markers for MapView
  const center = React.useMemo(() => {
    if (ll) {
      const [lat, lng] = ll.split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return undefined;
  }, [ll]);

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
        const lat = fsqLat ?? gLat ?? it.location?.lat ?? null;
        const lng = fsqLng ?? gLng ?? it.location?.lng ?? null;

        if (typeof lat === "number" && typeof lng === "number") {
          return { lat, lng, name: it.name };
        }
        return null;
      })
      .filter(Boolean) as { lat: number; lng: number; name?: string }[];
  }, [list.data]);

  const isLoading = list.isLoading;
  const hasError = !!list.error;

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

        <div className="flex items-center gap-2 ml-auto">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} >
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

          {/* ✅ De-dupe toggle (only relevant in 'All' tab) */}
          <Button
            variant={tab === "all" && dedupe ? "default" : "outline"}
            onClick={() => setDedupe((v) => !v)}
            disabled={tab !== "all"}
            title="Merge duplicates across sources"
          >
            {tab === "all" ? (dedupe ? "De-dupe: On" : "De-dupe: Off") : "De-dupe (All only)"}
          </Button>
        </div>
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
          onOpenDetails={(id, source) => setSelected({ id, source })}
        />
      )}

      {/* Details drawer */}
      <DetailsSheet
        source={(selected?.source as any) || "fsq"}
        name={details.data?.name}
        website={details.data?.website || undefined}
        url={details.data?.url || undefined}
        address={
          details.data?.location?.address ||
          [
            details.data?.location?.locality,
            details.data?.location?.region,
          ]
            .filter(Boolean)
            .join(", ") ||
          undefined
        }
        rating={details.data?.rating ?? undefined}
        userCount={details.data?.user_ratings_total ?? undefined}
        reviews={details.data?.reviews as any}
        loading={details.isLoading}
        onOpen={() => {}}
      />
    </div>
  );
}

/** ------------------------------
 * Results grid/list
 * ------------------------------ */
function ResultsGrid({
  items,
  view,
  onOpenDetails,
}: {
  items: BaseItem[];
  view: "list" | "grid";
  onOpenDetails: (id: string, source: PlaceSource) => void;
}) {
  if (!items.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No results. Try a broader query, another neighborhood, or “Use my location”.
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
          onSelect={() => onOpenDetails(b.id, b.source)}
        />
      ))}
    </div>
  );
}
