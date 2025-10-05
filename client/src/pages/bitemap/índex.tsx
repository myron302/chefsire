// client/src/pages/bitemap.tsx
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Star, Compass, LocateFixed, ExternalLink,
  Loader2, List, LayoutGrid, Globe2, Landmark, Map
} from "lucide-react";

type FSQItem = {
  id: string;
  name: string;
  categories: string[];
  location?: { address?: string; locality?: string; region?: string };
  rating?: number | null;
  price?: number | null;
  distance?: number | null;
  geocodes?: any;
  source?: "fsq";
};

type GoogleItem = {
  id: string;
  name: string;
  categories: string[];
  location?: { address?: string };
  rating?: number | null;
  price?: number | null; // price_level 0-4
  user_ratings_total?: number | null;
  geocodes?: any;
  source?: "google";
};

type FSQDetails = {
  id: string;
  name: string;
  website?: string | null;
  location?: { address?: string; locality?: string; region?: string };
  rating?: number | null;
  price?: number | null;
  categories: string[];
  tips: { id: string; text: string; author: string; created_at?: string; agree_count: number }[];
};

type GoogleDetails = {
  id: string;
  name: string;
  website?: string | null;
  url?: string | null;
  tel?: string | null;
  location?: { address?: string };
  rating?: number | null;
  user_ratings_total?: number | null;
  price?: number | null; // price_level
  categories: string[];
  hours?: any;
  reviews: { id: string; author: string; text: string; rating?: number; created_at?: string }[];
};

function useFsq(params: { q: string; near?: string; ll?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  return useQuery({
    queryKey: ["fsq", qs],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/search?${qs}`);
      if (!res.ok) throw new Error("FSQ search failed");
      const j = await res.json();
      const items: FSQItem[] = (j.items || []).map((it: FSQItem) => ({ ...it, source: "fsq" }));
      return { items };
    },
  });
}

function useFsqDetails(id?: string) {
  return useQuery({
    queryKey: ["fsqDetails", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${id}/details?tipsLimit=8`);
      if (!res.ok) throw new Error("FSQ details failed");
      return (await res.json()) as FSQDetails;
    },
  });
}

function useGoogle(params: { q: string; near?: string; ll?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  return useQuery({
    queryKey: ["google", qs],
    queryFn: async () => {
      const res = await fetch(`/api/google/search?${qs}`);
      if (!res.ok) throw new Error("Google search failed");
      const j = await res.json();
      const items: GoogleItem[] = (j.items || []).map((it: GoogleItem) => ({ ...it, source: "google" }));
      return { items };
    },
  });
}

function useGoogleDetails(id?: string) {
  return useQuery({
    queryKey: ["googleDetails", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/google/${id}/details?reviewsLimit=5`);
      if (!res.ok) throw new Error("Google details failed");
      return (await res.json()) as GoogleDetails;
    },
  });
}

function PriceBadge({ price, source }: { price?: number | null; source: "fsq" | "google" }) {
  if (price == null) return null;
  // FSQ price uses 1-4; Google price_level uses 0-4 (0 means free)
  const count = source === "google" ? Math.max(1, price) : price;
  return <Badge variant="secondary">{"$".repeat(Math.max(1, Math.min(4, count || 1)))}</Badge>;
}

export default function BiteMapPage() {
  const [q, setQ] = React.useState("restaurant");
  const [near, setNear] = React.useState("New York, NY");
  const [ll, setLL] = React.useState<string | undefined>(undefined);
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [tab, setTab] = React.useState<"all" | "fsq" | "google">("all");
  const [selected, setSelected] = React.useState<{ id: string; source: "fsq" | "google" } | null>(null);

  const fsq = useFsq({ q, near: ll ? undefined : near, ll });
  const ggl = useGoogle({ q, near: ll ? undefined : near, ll });

  const fsqDetails = useFsqDetails(selected?.source === "fsq" ? selected.id : undefined);
  const gglDetails = useGoogleDetails(selected?.source === "google" ? selected.id : undefined);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLL(`${pos.coords.latitude},${pos.coords.longitude}`),
      () => alert("Could not get your location.")
    );
  }

  const combined = React.useMemo(() => {
    const a = (fsq.data?.items || []) as (FSQItem | GoogleItem)[];
    const b = (ggl.data?.items || []) as (FSQItem | GoogleItem)[];
    if (tab === "fsq") return a;
    if (tab === "google") return b;
    // Simple merge (no dedupe so you can see both sources distinctly)
    return [...a, ...b];
  }, [fsq.data, ggl.data, tab]);

  const loading = fsq.isLoading || ggl.isLoading;
  const error = fsq.isError && ggl.isError;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Map className="w-6 h-6" />
        <h1 className="text-2xl font-semibold">BiteMap</h1>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (e.g., tacos, sushi, vegan)" />
          <Button onClick={() => { fsq.refetch(); ggl.refetch(); }}>
            <Compass className="w-4 h-4 mr-1" />Search
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
          <Button variant={ll ? "secondary" : "outline"} onClick={() => (ll ? setLL(undefined) : useMyLocation())}>
            <LocateFixed className="w-4 h-4 mr-1" />
            {ll ? "Using GPS" : "Use my location"}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="ml-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="fsq"><Landmark className="w-3.5 h-3.5 mr-1" />Foursquare</TabsTrigger>
            <TabsTrigger value="google"><Globe2 className="w-3.5 h-3.5 mr-1" />Google</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-1">
          <Button size="icon" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} title="List">
            <List className="w-4 h-4" />
          </Button>
          <Button size="icon" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")} title="Grid">
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      ) : error ? (
        <div className="text-red-600">Search failed. Check API keys in <code>server/.env</code>.</div>
      ) : (
        <div className={view === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {combined.map((b: any) => (
            <Card key={`${b.source}-${b.id}`} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{b.name}</span>
                  <div className="flex items-center gap-2">
                    {typeof b.rating === "number" && (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Star className="w-4 h-4" /> {b.rating.toFixed(1)}
                      </span>
                    )}
                    <PriceBadge price={b.price} source={b.source || "fsq"} />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{(b.source || "fsq").toUpperCase()}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {b.location?.address ||
                      [b.location?.locality, b.location?.region].filter(Boolean).join(", ")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(b.categories || []).slice(0, 3).map((c: string) => <Badge key={c}>{c}</Badge>)}
                </div>

                <DetailsSheet
                  source={(b.source || "fsq") as "fsq" | "google"}
                  id={b.id}
                  setSelected={setSelected}
                  fsqDetails={fsqDetails}
                  gglDetails={gglDetails}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailsSheet(props: {
  source: "fsq" | "google";
  id: string;
  setSelected: React.Dispatch<React.SetStateAction<{ id: string; source: "fsq" | "google" } | null>>;
  fsqDetails: ReturnType<typeof useFsqDetails>;
  gglDetails: ReturnType<typeof useGoogleDetails>;
}) {
  const { source, id, setSelected, fsqDetails, gglDetails } = props;

  const isFSQ = source === "fsq";
  const loading = isFSQ ? fsqDetails.isLoading : gglDetails.isLoading;
  const data = isFSQ ? fsqDetails.data : gglDetails.data;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" onClick={() => setSelected({ id, source })}>
          View details & reviews
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{(data as any)?.name || "Details"}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="p-4 text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : data ? (
          <div className="p-4 space-y-3">
            {"website" in data && data.website && (
              <a href={data.website as string} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1">
                Website <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {"url" in data && (data as any).url && (
              <a href={(data as any).url as string} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1">
                Google Listing <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <div className="text-sm text-muted-foreground">
              {"location" in data
                ? ((data as any).location?.address ||
                    [ (data as any).location?.locality, (data as any).location?.region ]
                      .filter(Boolean).join(", "))
                : ""}
            </div>
            {"rating" in data && typeof (data as any).rating === "number" && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  <strong>{(data as any).rating.toFixed(1)}</strong>
                </span>
                {"user_ratings_total" in data && typeof (data as any).user_ratings_total === "number" && (
                  <span className="text-sm text-muted-foreground">
                    ({(data as any).user_ratings_total} reviews)
                  </span>
                )}
              </div>
            )}

            {/* Reviews / Tips */}
            {isFSQ ? (
              <div className="space-y-2">
                <h3 className="font-medium">Tips (Foursquare users)</h3>
                {(data as FSQDetails).tips.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No tips yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {(data as FSQDetails).tips.map((t) => (
                      <li key={t.id} className="border rounded p-2">
                        <p className="text-sm">{t.text}</p>
                        <div className="text-xs text-muted-foreground mt-1">— {t.author}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-medium">Recent Google reviews</h3>
                {(data as GoogleDetails).reviews.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No reviews available.</div>
                ) : (
                  <ul className="space-y-2">
                    {(data as GoogleDetails).reviews.map((r) => (
                      <li key={r.id} className="border rounded p-2">
                        <div className="flex items-center gap-2 text-sm">
                          <strong>{r.author}</strong>
                          {typeof r.rating === "number" && (
                            <span className="inline-flex items-center gap-1">
                              <Star className="w-3 h-3" /> {r.rating.toFixed(1)}
                            </span>
                          )}
                          {r.created_at && <span className="text-muted-foreground">• {r.created_at}</span>}
                        </div>
                        <p className="text-sm mt-1">{r.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No details.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
