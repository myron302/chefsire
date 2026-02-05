import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Search,
  Navigation,
  List,
  Grid,
  Sparkles,
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
import MapView, { MarkerInput } from "./MapView";

/**
 * Wedding Vendor Map (API-efficient + stable UI)
 *
 * ✅ One category search at a time (low cost)
 * ✅ Cache results per category (counts stay consistent)
 * ✅ "All" = union of loaded categories (dedup by place_id)
 * ✅ Load more works per category (no blinking markers)
 * ✅ Search this area (no snap-back loop)
 * ✅ Details fetched on click only (phone/website/open-now/photo)
 * ✅ PDF export uses browser print (no jspdf dependency)
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

  phone?: string;
  website?: string;
  isOpenNow?: boolean;
};

const categoryConfig: Record<VendorCategoryKey, { label: string; icon: any; query: string }> = {
  all: {
    label: "All",
    icon: Sparkles,
    // "All" is NOT used for accurate cross-category counts.
    // It’s only used when user clicks All and nothing is loaded yet.
    query: "wedding services",
  },
  venue: {
    label: "Venues",
    icon: MapPin,
    query: "wedding venue OR event venue OR banquet hall",
  },
  photographer: {
    label: "Photo",
    icon: Camera,
    query: "wedding photographer OR photographer",
  },
  dj: {
    label: "DJ & Music",
    icon: Music,
    query: "wedding dj OR dj services OR wedding entertainment",
  },
  florist: {
    label: "Florist",
    icon: Flower2,
    query: "wedding florist OR florist",
  },
  dressShop: {
    label: "Dresses",
    icon: ShoppingBag,
    query: "bridal shop OR wedding dress OR bridal boutique",
  },
  tuxedoShop: {
    label: "Tuxedos",
    icon: Shirt,
    query: "tuxedo shop OR tuxedo rental OR formal wear",
  },
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

// Wait for Google (MapView loads script; this just waits for readiness)
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

export default function WeddingVendorMap() {
  // UI state
  const [selectedCategory, setSelectedCategory] = useState<VendorCategoryKey>("venue");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("Colchester, CT");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [savedVendors, setSavedVendors] = useState<Set<string>>(new Set());

  // Map state
  const [searchCenter, setSearchCenter] = useState<LatLng>({ lat: 41.5754, lng: -72.332 }); // Colchester-ish default
  const [mapBoundsCenter, setMapBoundsCenter] = useState<LatLng | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);

  // Data + cache per category
  const [vendorsByCategory, setVendorsByCategory] = useState<Record<VendorCategoryKey, PlaceResultLite[]>>({
    all: [],
    venue: [],
    photographer: [],
    dj: [],
    florist: [],
    dressShop: [],
    tuxedoShop: [],
  });

  const [paginationByCategory, setPaginationByCategory] = useState<
    Record<VendorCategoryKey, google.maps.places.PlaceSearchPagination | null>
  >({
    all: null,
    venue: null,
    photographer: null,
    dj: null,
    florist: null,
    dressShop: null,
    tuxedoShop: null,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Details modal
  const [selectedVendor, setSelectedVendor] = useState<PlaceResultLite | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Input refs (optional autocomplete hookup)
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  // Pagination append flag (used by the places callback triggered by nextPage())
  const appendRef = useRef(false);

  // Keep these in refs so the Places callback is always correct
  const activeCategoryRef = useRef<VendorCategoryKey>(selectedCategory);
  const activeCenterRef = useRef<LatLng>(searchCenter);

  useEffect(() => {
    activeCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  useEffect(() => {
    activeCenterRef.current = searchCenter;
  }, [searchCenter]);

  // Union view for "All" (dedup by id)
  const unionVendors = useMemo(() => {
    const map = new Map<string, PlaceResultLite>();
    const keys: VendorCategoryKey[] = ["venue", "photographer", "dj", "florist", "dressShop", "tuxedoShop"];
    for (const k of keys) {
      for (const v of vendorsByCategory[k]) {
        if (!map.has(v.id)) map.set(v.id, v);
      }
    }
    return Array.from(map.values());
  }, [vendorsByCategory]);

  // Active list
  const vendors: PlaceResultLite[] =
    selectedCategory === "all"
      ? (unionVendors.length ? unionVendors : vendorsByCategory.all)
      : vendorsByCategory[selectedCategory];

  // Accurate counts = how many you’ve loaded per category (cached)
  const categoryCounts = useMemo(() => {
    const counts: Record<VendorCategoryKey, number> = {
      all: (unionVendors.length || vendorsByCategory.all.length),
      venue: vendorsByCategory.venue.length,
      photographer: vendorsByCategory.photographer.length,
      dj: vendorsByCategory.dj.length,
      florist: vendorsByCategory.florist.length,
      dressShop: vendorsByCategory.dressShop.length,
      tuxedoShop: vendorsByCategory.tuxedoShop.length,
    };
    return counts;
  }, [vendorsByCategory, unionVendors]);

  // Markers for map
  const markers: MarkerInput[] = useMemo(
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

  // Toggle save
  const toggleSaveVendor = (vendorId: string) => {
    setSavedVendors((prev) => {
      const ns = new Set(prev);
      if (ns.has(vendorId)) ns.delete(vendorId);
      else ns.add(vendorId);
      return ns;
    });
  };

  // Geocode city -> LatLng
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

  // --- CORE SEARCH (one category at a time, cached) ---
  const runTextSearch = async (category: VendorCategoryKey, center: LatLng, isPagination: boolean) => {
    try {
      await waitForGoogle();
      const gm = window.google;
      const service = new gm.maps.places.PlacesService(document.createElement("div"));

      const baseQuery = categoryConfig[category].query;
      const finalQuery = searchQuery ? `${baseQuery} ${searchQuery}` : baseQuery;

      activeCategoryRef.current = category;
      activeCenterRef.current = center;
      appendRef.current = isPagination;

      service.textSearch(
        {
          query: finalQuery,
          location: new gm.maps.LatLng(center.lat, center.lng),
          radius: 10000,
        },
        (results: any[], status: string, nextPagination: any) => {
          if (status !== gm.maps.places.PlacesServiceStatus.OK || !results) {
            if (status !== "ZERO_RESULTS") setErrorMsg(status || "Search failed");
            setLoading(false);
            return;
          }

          const mapped = results
            .map((p) => {
              if (!p?.place_id || !p?.geometry?.location) return null;
              const loc = p.geometry.location;
              const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
              const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;

              const cat =
                category === "all" ? pickCategoryFromTypes("all", p.types) : category;

              const v: PlaceResultLite = {
                id: p.place_id,
                placeId: p.place_id,
                name: p.name || "Untitled",
                category: cat,
                address: p.formatted_address || p.vicinity,
                position: { lat, lng },
                rating: p.rating,
                reviews: p.user_ratings_total,
                priceRange: priceLevelToRange(p.price_level),
                image: p.photos && p.photos.length ? p.photos[0].getUrl({ maxWidth: 600 }) : undefined,
                verified: p.business_status === "OPERATIONAL",
                // NOTE: opening_hours.isOpen() is more reliable from getDetails;
                // but if it exists here, we can show it.
                isOpenNow: p.opening_hours?.isOpen ? p.opening_hours.isOpen() : undefined,
              };

              return v;
            })
            .filter(Boolean) as PlaceResultLite[];

          const targetCategory = activeCategoryRef.current;

          setVendorsByCategory((prev) => {
            const existing = prev[targetCategory] || [];
            const next = appendRef.current ? mergeDedupById(existing, mapped) : mapped;
            return { ...prev, [targetCategory]: next };
          });

          setPaginationByCategory((prev) => ({
            ...prev,
            [targetCategory]: nextPagination || null,
          }));

          setLoading(false);
          setErrorMsg(null);
        }
      );
    } catch (e: any) {
      setErrorMsg(e?.message || "Search failed");
      setLoading(false);
    }
  };

  function mergeDedupById(a: PlaceResultLite[], b: PlaceResultLite[]) {
    const map = new Map<string, PlaceResultLite>();
    for (const x of a) map.set(x.id, x);
    for (const x of b) map.set(x.id, x);
    return Array.from(map.values());
  }

  // Debounced search when category changes (ONLY if that category cache is empty)
  useEffect(() => {
    let t: any = null;

    t = setTimeout(async () => {
      // If we already have cached results for this category at this location, don’t re-hit API
      const hasCache =
        selectedCategory === "all"
          ? (vendorsByCategory.all.length > 0 || unionVendors.length > 0)
          : vendorsByCategory[selectedCategory].length > 0;

      if (hasCache) return;

      setLoading(true);
      setErrorMsg(null);

      // If "All" has nothing loaded yet, run the "all" query once
      const catToSearch = selectedCategory === "all" ? "all" : selectedCategory;
      await runTextSearch(catToSearch, searchCenter, false);
    }, 300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Debounced geocode when locationQuery changes, then clears caches and searches current category
  useEffect(() => {
    let t: any = null;

    t = setTimeout(async () => {
      setErrorMsg(null);

      // Geocode new location
      setLoading(true);
      const loc = (await geocodeAddress(locationQuery)) || searchCenter;

      // New location => clear caches + pagination
      setVendorsByCategory({
        all: [],
        venue: [],
        photographer: [],
        dj: [],
        florist: [],
        dressShop: [],
        tuxedoShop: [],
      });
      setPaginationByCategory({
        all: null,
        venue: null,
        photographer: null,
        dj: null,
        florist: null,
        dressShop: null,
        tuxedoShop: null,
      });

      setSearchCenter(loc);
      setShowSearchArea(false);

      // Now run search for current category
      const catToSearch = selectedCategory === "all" ? "all" : selectedCategory;
      await runTextSearch(catToSearch, loc, false);
    }, 650);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery]);

  // “Search this area” (uses current map center, doesn’t fight panning)
  const searchThisArea = async () => {
    if (!mapBoundsCenter) return;
    setShowSearchArea(false);

    // Treat this like a "new location" search (clear caches)
    setVendorsByCategory({
      all: [],
      venue: [],
      photographer: [],
      dj: [],
      florist: [],
      dressShop: [],
      tuxedoShop: [],
    });
    setPaginationByCategory({
      all: null,
      venue: null,
      photographer: null,
      dj: null,
      florist: null,
      dressShop: null,
      tuxedoShop: null,
    });

    setSearchCenter(mapBoundsCenter);

    setLoading(true);
    const catToSearch = selectedCategory === "all" ? "all" : selectedCategory;
    await runTextSearch(catToSearch, mapBoundsCenter, false);
  };

  const loadMore = () => {
    const p = paginationByCategory[selectedCategory];
    if (!p?.hasNextPage) return;
    setLoading(true);
    appendRef.current = true;
    p.nextPage(); // this triggers the original callback we stored via runTextSearch closure
  };

  // Details fetch (phone/website/openNow/photo) - on click only
  const handleViewDetails = async (vendor: PlaceResultLite) => {
    setSelectedVendor(vendor);
    setShowDetails(true);

    // If already have details, don’t spend extra
    if (vendor.phone || vendor.website || vendor.isOpenNow !== undefined) return;

    try {
      await waitForGoogle();
      const gm = window.google;
      const service = new gm.maps.places.PlacesService(document.createElement("div"));
      setDetailsLoading(true);

      service.getDetails(
        {
          placeId: vendor.placeId,
          fields: ["formatted_phone_number", "website", "opening_hours", "photos", "formatted_address", "business_status"],
        },
        (place: any, status: string) => {
          if (status === gm.maps.places.PlacesServiceStatus.OK && place) {
            const patch: Partial<PlaceResultLite> = {
              phone: place.formatted_phone_number || vendor.phone,
              website: place.website || vendor.website,
              address: place.formatted_address || vendor.address,
              image: placePhoto(place) || vendor.image,
              isOpenNow: place.opening_hours?.isOpen ? place.opening_hours.isOpen() : vendor.isOpenNow,
              verified: place.business_status ? place.business_status === "OPERATIONAL" : vendor.verified,
            };

            setSelectedVendor((prev) => (prev && prev.id === vendor.id ? { ...prev, ...patch } : prev));

            // Patch into the cache (whichever category list contains it)
            setVendorsByCategory((prev) => {
              const next = { ...prev };
              (Object.keys(next) as VendorCategoryKey[]).forEach((k) => {
                next[k] = next[k].map((v) => (v.id === vendor.id ? { ...v, ...patch } : v));
              });
              return next;
            });
          }
          setDetailsLoading(false);
        }
      );
    } catch {
      setDetailsLoading(false);
    }
  };

  const exportSavedVendorsToPDF = () => {
    const saved = Array.from(savedVendors)
      .map((id) => {
        // find in union first
        const u = unionVendors.find((v) => v.id === id);
        if (u) return u;
        // otherwise scan lists
        const keys: VendorCategoryKey[] = ["venue", "photographer", "dj", "florist", "dressShop", "tuxedoShop", "all"];
        for (const k of keys) {
          const found = vendorsByCategory[k].find((v) => v.id === id);
          if (found) return found;
        }
        return null;
      })
      .filter(Boolean) as PlaceResultLite[];

    if (!saved.length) return;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Wedding Vendor Shortlist</title>
          <style>
            body{font-family:Arial, sans-serif; padding:24px;}
            h1{margin:0 0 6px 0;}
            .meta{color:#555; font-size:12px; margin-bottom:14px;}
            table{width:100%; border-collapse:collapse; font-size:12px;}
            th,td{border:1px solid #ddd; padding:10px; vertical-align:top;}
            th{background:#db2777; color:white; text-align:left;}
            .small{color:#555; font-size:11px;}
          </style>
        </head>
        <body>
          <h1>Wedding Vendor Shortlist</h1>
          <div class="meta">Location: ${escapeHtml(locationQuery)}<br/>Generated: ${escapeHtml(new Date().toLocaleString())}</div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Rating</th>
                <th>Price</th>
                <th>Open</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Website</th>
              </tr>
            </thead>
            <tbody>
              ${saved
                .map(
                  (v) => `
                <tr>
                  <td>${escapeHtml(v.name)}</td>
                  <td>${escapeHtml(categoryConfig[v.category]?.label || v.category)}</td>
                  <td>${v.rating != null ? escapeHtml(String(v.rating)) : "—"}</td>
                  <td>${v.priceRange ? escapeHtml(v.priceRange) : "—"}</td>
                  <td>${v.isOpenNow === undefined ? "—" : v.isOpenNow ? "Open" : "Closed"}</td>
                  <td>${v.address ? escapeHtml(v.address) : "—"}</td>
                  <td>${v.phone ? escapeHtml(v.phone) : "—"}</td>
                  <td>${v.website ? escapeHtml(v.website) : "—"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const getCategoryIcon = (category: VendorCategoryKey) => {
    const config = categoryConfig[category];
    return config ? config.icon : MapPin;
  };

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
              {vendors.length} shown
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

        {errorMsg && <p className="text-sm text-red-500 mb-2">Error: {errorMsg}</p>}
      </div>

      {/* Map + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Map Section */}
        <div className="lg:col-span-2 relative">
          {showSearchArea && (
            <Button
              onClick={searchThisArea}
              className="
                absolute top-6 left-1/2 -translate-x-1/2 z-20
                shadow-2xl bg-white text-pink-600 hover:bg-pink-50
                border-2 border-pink-200 rounded-full px-6 py-5
                transition-all duration-300 ease-out
                hover:scale-105 active:scale-95
              "
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
                  center={searchCenter}
                  zoom={12}
                  markers={markers}
                  onMarkerClick={(m) => handleViewDetails(m.vendor as PlaceResultLite)}
                  fitToMarkers
                  onIdle={(map) => {
                    const c = map.getCenter?.();
                    if (!c) return;

                    setMapBoundsCenter({ lat: c.lat(), lng: c.lng() });
                    setShowSearchArea(true);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vendor List Section */}
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

              {loading && <p className="text-xs text-muted-foreground mt-1">Loading…</p>}
              {!loading && paginationByCategory[selectedCategory]?.hasNextPage && (
                <p className="text-xs text-muted-foreground mt-1">Showing {vendors.length}. More available.</p>
              )}
            </CardHeader>

            <CardContent className={`flex-1 overflow-y-auto ${viewMode === "grid" ? "" : "space-y-3"}`}>
              {vendors.length === 0 && !loading ? (
                <div className="text-center text-sm text-muted-foreground mt-6">
                  No vendors loaded for this category yet. Try another category or search.
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {vendors.map((v) => {
                    const Icon = getCategoryIcon(v.category);
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

                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Icon className="w-3 h-3" />
                            <span>{categoryConfig[v.category]?.label}</span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {v.isOpenNow !== undefined && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-4 ${
                                  v.isOpenNow ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
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

                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.address || "—"}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                vendors.map((v) => {
                  const Icon = getCategoryIcon(v.category);
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

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Icon className="w-3 h-3" />
                              <span>{categoryConfig[v.category]?.label}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              {v.isOpenNow !== undefined && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-4 ${
                                    v.isOpenNow ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
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

                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.address || "—"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Load more */}
              {paginationByCategory[selectedCategory]?.hasNextPage && (
                <div className="py-4 flex justify-center">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                    {loading ? "Loading…" : "Load More Vendors"}
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
                      className={
                        selectedVendor.isOpenNow
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }
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
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Saved Vendors Section */}
      {savedVendors.size > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Saved Vendors ({savedVendors.size})
                </CardTitle>
                <CardDescription>Vendors you've bookmarked for your wedding</CardDescription>
              </div>

              <Button variant="outline" size="sm" onClick={exportSavedVendorsToPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Save PDF
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from(savedVendors).map((vid) => {
                const v = unionVendors.find((x) => x.id === vid) || vendors.find((x) => x.id === vid);
                if (!v) return null;
                const Icon = getCategoryIcon(v.category);

                return (
                  <Card key={v.id} className="overflow-hidden">
                    <div className="relative h-32">
                      {v.image ? (
                        <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute top-2 right-2 rounded-full p-2"
                        onClick={() => toggleSaveVendor(v.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-semibold text-sm mb-1">{v.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="w-3 h-3" />
                        <span>{categoryConfig[v.category]?.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-purple-600" />
          <h3 className="text-xl font-bold mb-2">Planning Your Perfect Day?</h3>
          <p className="text-muted-foreground mb-4">
            Save time by shortlisting vendors and exporting a PDF to share with your partner.
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
