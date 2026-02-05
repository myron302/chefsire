import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Search,
  Navigation,
  List,
  Grid,
  Sparkles,
  Clock,
  Star,
  Shield,
  Heart,
  X,
  MapPinned,
  Phone,
  Globe,
  Camera,
  Music,
  Flower2,
  ShoppingBag,
  Shirt,
  FileDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import MapView from "./MapView";

/**
 * Wedding Vendor Map (LIVE Google Places)
 * ✅ Derived counts (accurate)
 * ✅ Load more (pagination)
 * ✅ Search this area (map pan/zoom)
 * ✅ Comparison drawer (up to 3)
 * ✅ Open Now badge (details-based)
 * ✅ Safe PDF export (print-to-PDF, no jsPDF dependency)
 */

type LatLng = { lat: number; lng: number };

type VendorCategoryKey =
  | "all"
  | "venue"
  | "photographer"
  | "dj"
  | "florist"
  | "dressShop"
  | "tuxedoShop";

type PlaceResultLite = {
  id: string; // place_id
  placeId: string;
  name: string;
  category: VendorCategoryKey;
  address?: string;
  position: LatLng;
  rating?: number;
  reviews?: number;
  priceRange?: string;
  image?: string;
  verified?: boolean;

  // details (loaded on demand)
  phone?: string;
  website?: string;
  isOpenNow?: boolean;
};

const categoryConfig: Record<VendorCategoryKey, { label: string; icon: any; query: string }> = {
  all: {
    label: "All",
    icon: Sparkles,
    query: "wedding venue OR photographer OR wedding dj OR florist OR bridal shop OR tuxedo shop",
  },
  venue: { label: "Venues", icon: MapPin, query: "wedding venue OR event venue OR banquet hall" },
  photographer: { label: "Photo", icon: Camera, query: "wedding photographer OR photographer" },
  dj: { label: "DJ & Music", icon: Music, query: "wedding dj OR dj services" },
  florist: { label: "Florist", icon: Flower2, query: "florist wedding OR florist" },
  dressShop: { label: "Dresses", icon: ShoppingBag, query: "bridal shop OR wedding dress shop" },
  tuxedoShop: { label: "Tuxedos", icon: Shirt, query: "tuxedo shop OR formal wear" },
};

// ---------- Helpers ----------
function priceLevelToRange(level?: number): string | undefined {
  if (level == null) return undefined;
  return ["$", "$", "$$", "$$$", "$$$$"][level] || undefined;
}

function pickCategoryFromTypes(selected: VendorCategoryKey, types?: string[]): VendorCategoryKey {
  if (selected !== "all") return selected;
  if (!types || !types.length) return "all";
  const t = new Set(types);

  if (t.has("photographer")) return "photographer";
  if (t.has("florist")) return "florist";
  if (t.has("clothing_store") || t.has("store")) return "dressShop";
  if (t.has("event_venue") || t.has("banquet_hall") || t.has("restaurant") || t.has("lodging")) return "venue";

  return "all";
}

function placePhoto(place: any, max = 800): string | undefined {
  try {
    const p = place.photos?.[0];
    if (!p) return undefined;
    return p.getUrl({ maxWidth: max, maxHeight: max });
  } catch {
    return undefined;
  }
}

function waitForGoogle(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    let waited = 0;
    const step = 50;
    const timer = setInterval(() => {
      waited += step;
      if (window.google?.maps && window.google.maps.places) {
        clearInterval(timer);
        resolve();
      }
      if (waited >= timeoutMs) {
        clearInterval(timer);
        reject(new Error("Google Maps not detected"));
      }
    }, step);
  });
}

async function geocodeAddress(address: string): Promise<LatLng | null> {
  await waitForGoogle().catch(() => {});
  const gm = window.google;
  if (!gm?.maps?.Geocoder) return null;

  const geocoder = new gm.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results: any, status: any) => {
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else {
        resolve(null);
      }
    });
  });
}

function placeToVendorLite(place: any, selectedCategory: VendorCategoryKey): PlaceResultLite | null {
  if (!place?.place_id || !place?.geometry?.location) return null;

  const pos = place.geometry.location;
  const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
  const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;

  return {
    id: place.place_id,
    placeId: place.place_id,
    name: place.name || "Untitled",
    category: pickCategoryFromTypes(selectedCategory, place.types),
    address: place.formatted_address || place.vicinity,
    position: { lat, lng },
    rating: place.rating,
    reviews: place.user_ratings_total,
    priceRange: priceLevelToRange(place.price_level),
    image: placePhoto(place),
    verified: place.business_status === "OPERATIONAL",
    // isOpenNow is best from details; textSearch is inconsistent
  };
}

export default function WeddingVendorMap() {
  // UI state
  const [selectedCategory, setSelectedCategory] = useState<VendorCategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("Hartford, CT");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [savedVendors, setSavedVendors] = useState<Set<string>>(new Set());

  // Comparison (up to 3)
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Map + data state
  const [center, setCenter] = useState<LatLng>({ lat: 41.7658, lng: -72.6734 });
  const [vendors, setVendors] = useState<PlaceResultLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination
  const [pagination, setPagination] = useState<google.maps.places.PlaceSearchPagination | null>(null);
  const isPaginatingRef = useRef(false);

  // Search-this-area
  const [mapBoundsCenter, setMapBoundsCenter] = useState<LatLng | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);

  // Modal
  const [selectedVendor, setSelectedVendor] = useState<PlaceResultLite | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Autocomplete refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Accurate category counts derived from the actual vendors list
  const categoryCounts = useMemo(() => {
    const counts: Record<VendorCategoryKey, number> = {
      all: vendors.length,
      venue: 0,
      photographer: 0,
      dj: 0,
      florist: 0,
      dressShop: 0,
      tuxedoShop: 0,
    };
    for (const v of vendors) {
      if (v.category !== "all" && counts[v.category] !== undefined) counts[v.category] += 1;
    }
    return counts;
  }, [vendors]);

  // Markers for MapView
  const markers = useMemo(
    () =>
      vendors.map((v) => ({
        id: v.id,
        position: v.position,
        title: v.name,
        category: v.category,
        vendor: v,
      })),
    [vendors]
  );

  const toggleSaveVendor = (vendorId: string) => {
    setSavedVendors((prev) => {
      const ns = new Set(prev);
      if (ns.has(vendorId)) ns.delete(vendorId);
      else ns.add(vendorId);
      return ns;
    });
  };

  const toggleComparison = (vendorId: string) => {
    setComparisonIds((prev) => {
      if (prev.includes(vendorId)) return prev.filter((x) => x !== vendorId);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, vendorId];
    });
  };

  // Autocomplete setup (optional)
  useEffect(() => {
    let cancelled = false;
    let searchAutocomplete: google.maps.places.Autocomplete | null = null;
    let locationAutocomplete: google.maps.places.Autocomplete | null = null;
    let searchListener: google.maps.MapsEventListener | null = null;
    let locationListener: google.maps.MapsEventListener | null = null;

    const initAutocomplete = async () => {
      try {
        await waitForGoogle();
        if (cancelled) return;

        const gm = window.google;
        if (!gm?.maps?.places) return;

        if (searchInputRef.current && !searchAutocomplete) {
          searchAutocomplete = new gm.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["name", "formatted_address", "place_id"],
          });
          searchListener = searchAutocomplete.addListener("place_changed", () => {
            const place = searchAutocomplete?.getPlace();
            if (place?.name) setSearchQuery(place.name);
            else if (place?.formatted_address) setSearchQuery(place.formatted_address);
          });
        }

        if (locationInputRef.current && !locationAutocomplete) {
          locationAutocomplete = new gm.maps.places.Autocomplete(locationInputRef.current, {
            fields: ["formatted_address", "geometry", "place_id"],
            types: ["(cities)"],
          });
          locationListener = locationAutocomplete.addListener("place_changed", () => {
            const place = locationAutocomplete?.getPlace();
            if (place?.formatted_address) setLocationQuery(place.formatted_address);
            if (place?.geometry?.location) {
              setCenter({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
            }
          });
        }
      } catch {
        // optional
      }
    };

    initAutocomplete();

    return () => {
      cancelled = true;
      searchListener?.remove();
      locationListener?.remove();
    };
  }, []);

  // MAIN SEARCH (supports pagination append)
  const runSearch = async (locOverride?: LatLng) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      await waitForGoogle();
      const gm = window.google;

      // For a fresh search we geocode; for "search this area" we can skip geocode and use locOverride
      const loc =
        locOverride ||
        (await geocodeAddress(locationQuery)) ||
        center;

      if (!locOverride) setCenter(loc); // only reset center when the user typed a location

      const service = new gm.maps.places.PlacesService(document.createElement("div"));
      const qBase = categoryConfig[selectedCategory].query;
      const q = [qBase, searchQuery].filter(Boolean).join(" ");

      const request: any = {
        query: q,
        location: new gm.maps.LatLng(loc.lat, loc.lng),
        radius: 25000,
      };

      await new Promise<void>((resolve) => {
        service.textSearch(request, (results: any[], status: string, nextPagination: any) => {
          if (status !== gm.maps.places.PlacesServiceStatus.OK || !results) {
            if (!isPaginatingRef.current) setVendors([]);
            setPagination(null);
            if (status !== "ZERO_RESULTS") setErrorMsg(status || "Search failed");
            isPaginatingRef.current = false;
            setLoading(false);
            return resolve();
          }

          const mapped = results
            .map((p) => placeToVendorLite(p, selectedCategory))
            .filter(Boolean) as PlaceResultLite[];

          setVendors((prev) => (isPaginatingRef.current ? [...prev, ...mapped] : mapped));
          setPagination(nextPagination || null);

          isPaginatingRef.current = false;
          setLoading(false);
          resolve();
        });
      });
    } catch (e: any) {
      isPaginatingRef.current = false;
      setLoading(false);
      setErrorMsg(e?.message || "Search failed");
      setVendors([]);
      setPagination(null);
    }
  };

  // Debounced search on inputs
  const searchRef = useRef<number | null>(null);
  useEffect(() => {
    if (searchRef.current) window.clearTimeout(searchRef.current);

    searchRef.current = window.setTimeout(() => {
      isPaginatingRef.current = false;
      runSearch();
    }, 450);

    return () => {
      if (searchRef.current) window.clearTimeout(searchRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery, locationQuery]);

  // Load more (pagination)
  const loadMore = () => {
    if (!pagination?.hasNextPage) return;
    isPaginatingRef.current = true;
    setLoading(true);
    // Google internally calls the original callback again
    pagination.nextPage();
  };

  // Details (phone/website/openNow) on demand
  const handleViewDetails = async (vendor: PlaceResultLite) => {
    setSelectedVendor(vendor);
    setShowDetails(true);

    // If already enriched, no need
    if (vendor.phone || vendor.website || vendor.isOpenNow !== undefined) return;

    try {
      await waitForGoogle();
      const gm = window.google;
      const service = new gm.maps.places.PlacesService(document.createElement("div"));
      setDetailsLoading(true);

      await new Promise<void>((resolve) => {
        service.getDetails(
          {
            placeId: vendor.placeId,
            fields: ["formatted_phone_number", "website", "opening_hours", "business_status", "formatted_address", "photos"],
          },
          (place: any, status: string) => {
            if (status === gm.maps.places.PlacesServiceStatus.OK && place) {
              const patch = {
                phone: place.formatted_phone_number || undefined,
                website: place.website || undefined,
                address: place.formatted_address || vendor.address,
                image: placePhoto(place) || vendor.image,
                verified: place.business_status === "OPERATIONAL",
                isOpenNow: place.opening_hours?.isOpen?.(),
              };

              // update modal
              setSelectedVendor((prev) => (prev && prev.id === vendor.id ? { ...prev, ...patch } : prev));

              // update list too (so cards show Open/Closed after first click)
              setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, ...patch } : v)));
            }
            resolve();
          }
        );
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const getCategoryIcon = (category: VendorCategoryKey) => {
    const cfg = categoryConfig[category];
    return cfg ? cfg.icon : MapPin;
  };

  // ✅ Safe PDF export (Print dialog -> Save as PDF)
  const exportComparisonToPDF = () => {
    const selected = vendors.filter((v) => comparisonIds.includes(v.id));
    if (!selected.length) return;

    const escape = (s?: string) =>
      String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const rows = selected
      .map(
        (v) => `
        <tr>
          <td>${escape(v.name)}</td>
          <td>${escape(categoryConfig[v.category]?.label || v.category)}</td>
          <td>${escape(v.rating ?? "—")}</td>
          <td>${escape(v.priceRange ?? "—")}</td>
          <td>${escape(v.isOpenNow === undefined ? "—" : v.isOpenNow ? "Open" : "Closed")}</td>
          <td>${escape(v.address ?? "—")}</td>
          <td>${escape(v.phone ?? "—")}</td>
          <td>${escape(v.website ?? "—")}</td>
        </tr>`
      )
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Wedding Vendor Shortlist</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
    h1{margin:0 0 6px 0}
    .meta{color:#555;font-size:12px;margin:0 0 16px 0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    th{background:#db2777;color:#fff;text-align:left}
    .tag{display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid #ddd;font-size:11px}
  </style>
</head>
<body>
  <h1>Wedding Vendor Shortlist</h1>
  <p class="meta">
    Location: ${escape(locationQuery)}<br/>
    Generated: ${escape(new Date().toLocaleString())}
  </p>

  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Category</th>
        <th>Rating</th>
        <th>Price</th>
        <th>Status</th>
        <th>Address</th>
        <th>Phone</th>
        <th>Website</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>`;

    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=650");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const comparisonVendors = useMemo(
    () => comparisonIds.map((id) => vendors.find((v) => v.id === id)).filter(Boolean) as PlaceResultLite[],
    [comparisonIds, vendors]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Wedding Vendor Map
            </h1>
            <p className="text-muted-foreground">Live results pulled from Google Places near your chosen location</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              <MapPinned className="w-4 h-4 mr-1" />
              {vendors.length} vendors found
            </Badge>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Filter by name, keyword… (optional)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    ref={searchInputRef}
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Location (City, State)"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    className="pl-10"
                    ref={locationInputRef}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Filters */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
          {(Object.keys(categoryConfig) as VendorCategoryKey[]).map((key) => {
            const cfg = categoryConfig[key];
            const Icon = cfg.icon;
            const isSelected = selectedCategory === key;
            const count = categoryCounts[key] ?? 0;

            return (
              <Button
                key={key}
                variant={isSelected ? "default" : "outline"}
                onClick={() => setSelectedCategory(key)}
                className="w-full flex items-center justify-center sm:justify-between px-2"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm hidden sm:inline truncate">{cfg.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs hidden sm:flex flex-shrink-0">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Comparison bar */}
        {comparisonIds.length > 0 && (
          <Card className="mb-6 border-pink-200">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold">{comparisonIds.length}</span> selected for comparison (max 3)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsComparisonOpen(true)}>
                  Compare
                </Button>
                <Button variant="outline" size="sm" onClick={exportComparisonToPDF}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Save PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComparisonIds([])}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Map + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Map Section */}
        <div className="lg:col-span-2 relative">
          {showSearchArea && mapBoundsCenter && (
            <Button
              onClick={() => {
                isPaginatingRef.current = false;
                runSearch(mapBoundsCenter);
                setShowSearchArea(false);
              }}
              className={`
                absolute top-6 left-1/2 -translate-x-1/2 z-20
                shadow-2xl bg-white text-pink-600 hover:bg-pink-50
                border-2 border-pink-200 rounded-full px-6 py-5
                transition-all duration-300 ease-out
                animate-in fade-in zoom-in slide-in-from-top-4
                hover:scale-105 active:scale-95
              `}
              size="sm"
            >
              <div className="absolute inset-0 rounded-full bg-pink-400/20 animate-ping -z-10" />
              <Search className="w-4 h-4 mr-2" />
              <span className="font-bold tracking-tight">Search this area</span>
            </Button>
          )}

          <Card className="h-[600px] overflow-hidden">
            <CardContent className="p-0 h-full">
              <div className="relative w-full h-full rounded-lg overflow-hidden">
                <MapView
                  center={center}
                  zoom={12}
                  markers={markers}
                  onMarkerClick={(m) => handleViewDetails(m.vendor as PlaceResultLite)}
                  fitToMarkers
                  onIdle={(map) => {
                    try {
                      const c = map.getCenter();
                      if (!c) return;
                      setMapBoundsCenter({ lat: c.lat(), lng: c.lng() });
                      setShowSearchArea(true);
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vendor List */}
        <div className="lg:col-span-1">
          <Card className="h-[600px] overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Vendors</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")}>
                    <List className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant={viewMode === "grid" ? "default" : "ghost"} onClick={() => setViewMode("grid")}>
                    <Grid className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {loading && <p className="text-xs text-muted-foreground mt-1">Loading live results…</p>}
              {errorMsg && <p className="text-xs text-red-500 mt-1">Error: {errorMsg}</p>}
            </CardHeader>

            <CardContent className={`flex-1 overflow-y-auto ${viewMode === "grid" ? "" : "space-y-3"}`}>
              {vendors.length === 0 && !loading ? (
                <div className="text-center text-sm text-muted-foreground mt-6">
                  No vendors found. Try a broader keyword or a nearby city.
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {vendors.map((v) => {
                    const Icon = getCategoryIcon(v.category);
                    const isCompared = comparisonIds.includes(v.id);

                    return (
                      <Card key={v.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDetails(v)}>
                        <div className="w-full h-28 overflow-hidden">
                          {v.image ? (
                            <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate flex items-center gap-1">
                              {v.name}
                              {v.verified && <Shield className="w-3 h-3 text-blue-500" />}
                            </h4>

                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSaveVendor(v.id);
                                }}
                              >
                                <Heart className={`w-4 h-4 ${savedVendors.has(v.id) ? "fill-red-500 text-red-500" : ""}`} />
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Icon className="w-3 h-3" />
                            <span>{categoryConfig[v.category]?.label}</span>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            {v.isOpenNow !== undefined && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-4 ${
                                  v.isOpenNow ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"
                                }`}
                              >
                                {v.isOpenNow ? "Open Now" : "Closed"}
                              </Badge>
                            )}

                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-medium">{v.rating ?? "—"}</span>
                              {v.reviews != null && <span className="text-xs text-muted-foreground">({v.reviews})</span>}
                            </div>
                            {v.priceRange && <span className="text-xs font-medium">{v.priceRange}</span>}
                          </div>

                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant={isCompared ? "default" : "outline"}
                              className="h-8 text-xs w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleComparison(v.id);
                              }}
                            >
                              {isCompared ? "Compared" : "+ Compare"}
                            </Button>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{v.address || "—"}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                vendors.map((v) => {
                  const Icon = getCategoryIcon(v.category);
                  const isCompared = comparisonIds.includes(v.id);

                  return (
                    <Card key={v.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDetails(v)}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            {v.image ? (
                              <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-sm truncate flex items-center gap-1">
                                {v.name}
                                {v.verified && <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                              </h4>

                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSaveVendor(v.id);
                                  }}
                                >
                                  <Heart className={`w-4 h-4 ${savedVendors.has(v.id) ? "fill-red-500 text-red-500" : ""}`} />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Icon className="w-3 h-3" />
                              <span>{categoryConfig[v.category]?.label}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                              {v.isOpenNow !== undefined && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-4 ${
                                    v.isOpenNow ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"
                                  }`}
                                >
                                  {v.isOpenNow ? "Open Now" : "Closed"}
                                </Badge>
                              )}

                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-medium">{v.rating ?? "—"}</span>
                                {v.reviews != null && <span className="text-xs text-muted-foreground">({v.reviews})</span>}
                              </div>
                              {v.priceRange && <span className="text-xs font-medium">{v.priceRange}</span>}
                            </div>

                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant={isCompared ? "default" : "outline"}
                                className="h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComparison(v.id);
                                }}
                              >
                                {isCompared ? "Compared" : "+ Compare"}
                              </Button>
                            </div>

                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{v.address || "—"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Load more */}
              {pagination?.hasNextPage && (
                <div className="py-4 flex justify-center">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                    {loading ? "Loading..." : "Load More Vendors"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vendor Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedVendor && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                      {selectedVendor.name}
                      {selectedVendor.verified && <Shield className="w-5 h-5 text-blue-500" />}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-2">
                      <MapPin className="w-4 h-4" />
                      {selectedVendor.address || "—"}
                    </DialogDescription>
                  </div>

                  <Button size="sm" variant="ghost" onClick={() => toggleSaveVendor(selectedVendor.id)}>
                    <Heart className={`w-5 h-5 ${savedVendors.has(selectedVendor.id) ? "fill-red-500 text-red-500" : ""}`} />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  {selectedVendor.image ? (
                    <img src={selectedVendor.image} alt={selectedVendor.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">No image</div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">{selectedVendor.rating ?? "—"}</span>
                    {selectedVendor.reviews != null && <span className="text-muted-foreground">({selectedVendor.reviews} reviews)</span>}
                  </div>

                  {selectedVendor.priceRange && (
                    <Badge variant="secondary" className="text-sm">
                      {selectedVendor.priceRange}
                    </Badge>
                  )}

                  {selectedVendor.isOpenNow !== undefined && (
                    <Badge
                      variant="outline"
                      className={`${selectedVendor.isOpenNow ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}`}
                    >
                      {selectedVendor.isOpenNow ? "Open Now" : "Closed"}
                    </Badge>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    {selectedVendor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${selectedVendor.phone}`} className="text-sm hover:underline">
                          {selectedVendor.phone}
                        </a>
                      </div>
                    )}

                    {selectedVendor.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <a href={selectedVendor.website} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                          {selectedVendor.website}
                        </a>
                      </div>
                    )}

                    {!selectedVendor.phone && !selectedVendor.website && (
                      <p className="text-sm text-muted-foreground">
                        {detailsLoading ? "Loading contact info…" : "Contact details not available."}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600"
                    onClick={() => window.open(`https://www.google.com/maps/place/?q=place_id:${selectedVendor.placeId}`, "_blank")}
                  >
                    View on Google Maps
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      handleViewDetails(selectedVendor);
                    }}
                    disabled={detailsLoading}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {detailsLoading ? "Fetching…" : "Refresh Details"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={isComparisonOpen} onOpenChange={setIsComparisonOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>Vendor Comparison</DialogTitle>
                <DialogDescription>Compare up to 3 vendors side-by-side</DialogDescription>
              </div>

              <Button variant="outline" size="sm" onClick={exportComparisonToPDF} disabled={comparisonIds.length === 0}>
                <FileDown className="w-4 h-4 mr-2" />
                Save PDF
              </Button>
            </div>
          </DialogHeader>

          {comparisonVendors.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6">No vendors selected.</div>
          ) : (
            <div className="grid grid-cols-4 gap-4 py-4">
              <div className="font-semibold space-y-8 pt-20 text-muted-foreground">
                <div>Category</div>
                <div>Rating</div>
                <div>Price</div>
                <div>Status</div>
                <div>Address</div>
              </div>

              {comparisonVendors.map((v) => (
                <div key={v.id} className="text-center space-y-6">
                  <div className="h-20 w-full rounded-md overflow-hidden mb-2 bg-muted">
                    {v.image ? <img src={v.image} alt={v.name} className="object-cover h-full w-full" /> : null}
                  </div>

                  <div className="font-bold text-sm h-10 flex items-center justify-center">{v.name}</div>

                  <div className="text-sm">{categoryConfig[v.category]?.label}</div>

                  <div className="flex justify-center items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {v.rating ?? "—"}
                  </div>

                  <div className="text-sm font-medium">{v.priceRange || "—"}</div>

                  <div className="flex justify-center">
                    {v.isOpenNow === undefined ? (
                      "—"
                    ) : (
                      <Badge variant="outline" className={v.isOpenNow ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                        {v.isOpenNow ? "Open" : "Closed"}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground line-clamp-3">{v.address || "—"}</div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => toggleComparison(v.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-purple-600" />
          <h3 className="text-xl font-bold mb-2">Planning Your Perfect Day?</h3>
          <p className="text-muted-foreground mb-4">
            Save vendors, compare your top picks, and export a shortlist PDF for your partner or planner.
          </p>
          <Button asChild className="bg-gradient-to-r from-pink-600 to-purple-600">
            <Link href="/catering/wedding-planning">
              <Heart className="w-4 h-4 mr-2" />
              Start Planning
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
