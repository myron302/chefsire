import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * Wedding Vendor Map
 * - Stable map (no snapping / blinking)
 * - Category-specific search (1 query per click, cheap)
 * - Per-category caching (counts stay meaningful as you browse)
 * - Pagination per category ("Load More" appends without wiping)
 * - "Search this area" (no auto-search on pan)
 * - Safe PDF export (browser print / save as PDF)
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

const CATEGORY_ORDER: VendorCategoryKey[] = [
  "all",
  "venue",
  "photographer",
  "dj",
  "florist",
  "dressShop",
  "tuxedoShop",
];

const categoryConfig: Record<VendorCategoryKey, { label: string; icon: any; query: string }> = {
  all: {
    label: "All",
    icon: Sparkles,
    query: "wedding venue OR photographer OR wedding dj OR florist OR bridal shop OR tuxedo shop",
  },
  venue: {
    label: "Venues",
    icon: MapPin,
    query: "wedding venue OR event venue OR banquet hall OR wedding hall",
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
    query: "bridal shop OR wedding dress shop OR bridal boutique",
  },
  tuxedoShop: {
    label: "Tuxedos",
    icon: Shirt,
    query: "tuxedo shop OR tuxedo rental OR formal wear OR suit rental",
  },
};

// ---------- Helpers ----------
function priceLevelToRange(level?: number): string | undefined {
  if (level == null) return undefined;
  return ["$", "$", "$$", "$$$", "$$$$"][level] || undefined;
}

function pickCategoryFromTypes(selected: VendorCategoryKey, types?: string[]): VendorCategoryKey {
  // If user selected a specific category, we keep it deterministic
  if (selected !== "all") return selected;
  if (!types || !types.length) return "all";

  const t = new Set(types);

  // High-confidence
  if (t.has("photographer")) return "photographer";
  if (t.has("florist")) return "florist";

  // Clothing logic
  if (t.has("clothing_store") || t.has("store")) return "dressShop";

  // Venue-ish logic
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

function placeToVendorLite(place: any, selectedCategory: VendorCategoryKey): PlaceResultLite | null {
  if (!place?.place_id || !place?.geometry?.location) return null;
  const pos = place.geometry.location;
  const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
  const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;

  const forcedCategory =
    selectedCategory === "all" ? pickCategoryFromTypes("all", place.types) : selectedCategory;

  return {
    id: place.place_id,
    placeId: place.place_id,
    name: place.name || "Untitled",
    category: forcedCategory,
    address: place.formatted_address || place.vicinity,
    position: { lat, lng },
    rating: place.rating,
    reviews: place.user_ratings_total,
    priceRange: priceLevelToRange(place.price_level),
    image: placePhoto(place),
    verified: place.business_status === "OPERATIONAL",
    // NOTE: opening_hours.isOpen() is not reliable off of TextSearch results; we fill this on details fetch
  };
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

function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function safeText(s: string) {
  return (s || "").replace(/[<>&"]/g, (ch) => {
    switch (ch) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return ch;
    }
  });
}

export default function WeddingVendorMap() {
  // UI state
  const [selectedCategory, setSelectedCategory] = useState<VendorCategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("Colchester, CT");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // map state
  const [center, setCenter] = useState<LatLng>({ lat: 41.5752, lng: -72.332 }); // Colchester-ish default
  const [mapBoundsCenter, setMapBoundsCenter] = useState<LatLng | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);

  // data state (cached by category)
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
    Partial<Record<VendorCategoryKey, google.maps.places.PlaceSearchPagination | null>>
  >({});

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Saved + modal
  const [savedVendors, setSavedVendors] = useState<Set<string>>(new Set());
  const [selectedVendor, setSelectedVendor] = useState<PlaceResultLite | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const isPaginatingRef = useRef(false);
  const paginateCategoryRef = useRef<VendorCategoryKey>("all");

  // Active vendor list:
  // - If user is viewing "all": show union of all category caches (excluding "all") if present,
  //   otherwise show vendorsByCategory.all (from broad search).
  // - Else: show the chosen category list.
  const vendors = useMemo(() => {
    if (selectedCategory !== "all") return vendorsByCategory[selectedCategory] || [];

    const buckets = ["venue", "photographer", "dj", "florist", "dressShop", "tuxedoShop"] as VendorCategoryKey[];
    const hasAnyBucket = buckets.some((k) => (vendorsByCategory[k] || []).length > 0);

    if (!hasAnyBucket) return vendorsByCategory.all || [];

    const merged: PlaceResultLite[] = [];
    for (const k of buckets) merged.push(...(vendorsByCategory[k] || []));
    return dedupeById(merged);
  }, [vendorsByCategory, selectedCategory]);

  // Counts:
  // - Per category: show count if that category has been fetched at least once, else null -> UI shows "—"
  // - All: union count if we have any bucket; else count for the "all" list.
  const categoryCounts = useMemo(() => {
    const counts: Record<VendorCategoryKey, number | null> = {
      all: null,
      venue: null,
      photographer: null,
      dj: null,
      florist: null,
      dressShop: null,
      tuxedoShop: null,
    };

    // categories except "all" are "known" only if fetched (list has length OR paginationByCategory has key set)
    (["venue", "photographer", "dj", "florist", "dressShop", "tuxedoShop"] as VendorCategoryKey[]).forEach((k) => {
      const fetched = Object.prototype.hasOwnProperty.call(paginationByCategory, k) || (vendorsByCategory[k]?.length ?? 0) > 0;
      counts[k] = fetched ? (vendorsByCategory[k]?.length ?? 0) : null;
    });

    const buckets = ["venue", "photographer", "dj", "florist", "dressShop", "tuxedoShop"] as VendorCategoryKey[];
    const hasAnyBucket = buckets.some((k) => (vendorsByCategory[k] || []).length > 0);

    if (hasAnyBucket) {
      counts.all = vendors.length;
    } else {
      const fetchedAll = Object.prototype.hasOwnProperty.call(paginationByCategory, "all") || (vendorsByCategory.all?.length ?? 0) > 0;
      counts.all = fetchedAll ? (vendorsByCategory.all?.length ?? 0) : null;
    }

    return counts;
  }, [vendorsByCategory, paginationByCategory, vendors]);

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

  const toggleSaveVendor = useCallback((vendorId: string) => {
    setSavedVendors((prev) => {
      const ns = new Set(prev);
      if (ns.has(vendorId)) ns.delete(vendorId);
      else ns.add(vendorId);
      return ns;
    });
  }, []);

  // Geocode a text location into lat/lng
  const geocodeAddress = useCallback(async (address: string): Promise<LatLng | null> => {
    try {
      await waitForGoogle();
      const gm = window.google;
      if (!gm?.maps?.Geocoder) return null;
      const geocoder = new gm.maps.Geocoder();
      return await new Promise((resolve) => {
        geocoder.geocode({ address }, (results: any, status: any) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
          } else {
            resolve(null);
          }
        });
      });
    } catch {
      return null;
    }
  }, []);

  // Autocomplete (optional)
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
              setCenter({
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              });
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

  // --- SEARCH (category-specific, cached) ---
  const performSearch = useCallback(
    async (loc?: LatLng) => {
      if (loading) return;

      setLoading(true);
      setErrorMsg(null);

      try {
        await waitForGoogle();
        const gm = window.google;

        const targetLoc = loc || center;

        // If locationQuery changed, center should follow (but this does NOT happen on pan)
        // We only set center when user typed a new city OR clicked "search this area"
        // (we call setCenter in those flows)
        const service = new gm.maps.places.PlacesService(document.createElement("div"));
        const baseQuery = categoryConfig[selectedCategory].query;
        const finalQuery = [baseQuery, searchQuery].filter(Boolean).join(" ");

        const activeCategory = selectedCategory;
        paginateCategoryRef.current = activeCategory;

        service.textSearch(
          {
            query: finalQuery,
            location: new gm.maps.LatLng(targetLoc.lat, targetLoc.lng),
            radius: 10000,
          },
          (results: any[], status: string, nextPagination: any) => {
            const isPaginating = isPaginatingRef.current;
            isPaginatingRef.current = false;

            if (status !== gm.maps.places.PlacesServiceStatus.OK || !results) {
              setPaginationByCategory((prev) => ({ ...prev, [activeCategory]: null }));
              if (!isPaginating) {
                setVendorsByCategory((prev) => ({ ...prev, [activeCategory]: [] }));
              }
              if (status !== "ZERO_RESULTS") setErrorMsg(status || "Search failed");
              setLoading(false);
              return;
            }

            const mapped = results
              .map((p) => placeToVendorLite(p, activeCategory))
              .filter(Boolean) as PlaceResultLite[];

            setVendorsByCategory((prev) => {
              const prevList = prev[activeCategory] || [];
              const combined = isPaginating ? [...prevList, ...mapped] : mapped;
              return { ...prev, [activeCategory]: dedupeById(combined) };
            });

            setPaginationByCategory((prev) => ({ ...prev, [activeCategory]: nextPagination || null }));
            setLoading(false);
          }
        );
      } catch (e: any) {
        setErrorMsg(e?.message || "Search failed");
        setLoading(false);
      }
    },
    [center, loading, searchQuery, selectedCategory]
  );

  // Debounced search when category/searchQuery/locationQuery changes (typed city triggers geocode)
  const searchTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);

    searchTimerRef.current = window.setTimeout(async () => {
      // If user typed a new city, geocode it and search there
      const geo = await geocodeAddress(locationQuery);
      const loc = geo || center;

      // Only set center from city input (not from pan)
      setCenter(loc);

      // If user selects "all" and we already have other buckets, don’t auto-wipe them.
      // But still run an "all" search if nothing is cached yet (so user sees something).
      const buckets = ["venue", "photographer", "dj", "florist", "dressShop", "tuxedoShop"] as VendorCategoryKey[];
      const hasAnyBucket = buckets.some((k) => (vendorsByCategory[k] || []).length > 0);

      if (selectedCategory === "all" && hasAnyBucket) {
        // do nothing: show union
        return;
      }

      // Clear pagination flag
      isPaginatingRef.current = false;
      await performSearch(loc);
    }, 500);

    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery, locationQuery]);

  const loadMore = useCallback(() => {
    const pag = paginationByCategory[selectedCategory];
    if (!pag?.hasNextPage) return;

    isPaginatingRef.current = true;
    paginateCategoryRef.current = selectedCategory;

    // Google requires waiting internally; nextPage triggers callback again.
    pag.nextPage();
  }, [paginationByCategory, selectedCategory]);

  const searchThisArea = useCallback(async () => {
    if (!mapBoundsCenter) return;
    setCenter(mapBoundsCenter);
    setShowSearchArea(false);
    isPaginatingRef.current = false;
    await performSearch(mapBoundsCenter);
  }, [mapBoundsCenter, performSearch]);

  // Details fetch (don’t touch vendor lists except updating the clicked vendor)
  const handleViewDetails = useCallback(async (vendor: PlaceResultLite) => {
    setSelectedVendor(vendor);
    setShowDetails(true);

    // If already loaded, don’t re-fetch
    if (vendor.phone || vendor.website || vendor.isOpenNow !== undefined) return;

    try {
      await waitForGoogle();
      const gm = window.google;
      const service = new gm.maps.places.PlacesService(document.createElement("div"));
      setDetailsLoading(true);

      service.getDetails(
        {
          placeId: vendor.placeId,
          fields: ["formatted_phone_number", "website", "opening_hours", "business_status", "formatted_address", "photos"],
        },
        (place: any, status: string) => {
          if (status === gm.maps.places.PlacesServiceStatus.OK && place) {
            const patch: Partial<PlaceResultLite> = {
              phone: place.formatted_phone_number || undefined,
              website: place.website || undefined,
              isOpenNow: place.opening_hours?.isOpen?.(),
              verified: place.business_status === "OPERATIONAL",
              address: place.formatted_address || vendor.address,
              image: placePhoto(place) || vendor.image,
            };

            // Update selectedVendor (modal)
            setSelectedVendor((prev) => (prev?.id === vendor.id ? { ...prev, ...patch } : prev));

            // Update whichever category bucket contains this vendor
            setVendorsByCategory((prev) => {
              const next = { ...prev };
              (Object.keys(next) as VendorCategoryKey[]).forEach((k) => {
                const list = next[k] || [];
                const idx = list.findIndex((v) => v.id === vendor.id);
                if (idx >= 0) {
                  const updated = [...list];
                  updated[idx] = { ...updated[idx], ...patch };
                  next[k] = updated;
                }
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
  }, []);

  // PDF export (safe): print window
  const exportSavedVendorsToPDF = useCallback(() => {
    const saved = Array.from(savedVendors)
      .map((id) => vendors.find((v) => v.id === id))
      .filter(Boolean) as PlaceResultLite[];

    if (!saved.length) return;

    const rows = saved
      .map((v) => {
        return `
          <tr>
            <td>${safeText(v.name)}</td>
            <td>${safeText(categoryConfig[v.category]?.label || v.category)}</td>
            <td>${v.rating != null ? safeText(String(v.rating)) : "—"}</td>
            <td>${safeText(v.priceRange || "—")}</td>
            <td>${safeText(v.address || "—")}</td>
            <td>${safeText(v.phone || "—")}</td>
            <td>${v.website ? `<a href="${safeText(v.website)}" target="_blank" rel="noreferrer">${safeText(v.website)}</a>` : "—"}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Wedding Vendor Shortlist</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin: 0 0 8px 0; }
            .meta { color: #666; font-size: 12px; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
            th { background: #db2777; color: white; text-align: left; }
            a { color: #0b57d0; word-break: break-word; }
          </style>
        </head>
        <body>
          <h1>Wedding Vendor Shortlist</h1>
          <div class="meta">
            Location: ${safeText(locationQuery)}<br/>
            Generated: ${safeText(new Date().toLocaleString())}
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Rating</th>
                <th>Price</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Website</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "noopener,noreferrer,width=1000,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }, [savedVendors, vendors, locationQuery]);

  // Show "Search this area" when user stops moving the map (but do NOT re-search automatically)
  const handleMapIdle = useCallback((map: any) => {
    try {
      const c = map.getCenter?.();
      if (!c) return;
      const next = { lat: c.lat(), lng: c.lng() };
      setMapBoundsCenter(next);
      setShowSearchArea(true);
    } catch {
      // ignore
    }
  }, []);

  const getCategoryIcon = (category: VendorCategoryKey) => {
    const cfg = categoryConfig[category];
    return cfg ? cfg.icon : MapPin;
  };

  const hasMore = !!paginationByCategory[selectedCategory]?.hasNextPage;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Wedding Vendor Map
            </h1>
            <p className="text-muted-foreground">
              Live results pulled from Google Places near your chosen location.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              <MapPinned className="w-4 h-4 mr-1" />
              {vendors.length} showing
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
          {CATEGORY_ORDER.map((key) => {
            const cfg = categoryConfig[key];
            const Icon = cfg.icon;
            const isSelected = selectedCategory === key;
            const count = categoryCounts[key]; // number | null
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
                  {count == null ? "—" : count}
                </Badge>
              </Button>
            );
          })}
        </div>

        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {errorMsg && <p className="text-xs text-red-500">Error: {errorMsg}</p>}
      </div>

      {/* Map + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Map Section */}
        <div className="lg:col-span-2 relative">
          {showSearchArea && (
            <Button
              onClick={searchThisArea}
              className={`
                absolute top-6 left-1/2 -translate-x-1/2 z-20 
                shadow-2xl bg-white text-pink-600 hover:bg-pink-50 
                border-2 border-pink-200 rounded-full px-6 py-5
                transition-all duration-300 ease-out
                hover:scale-105 active:scale-95
              `}
              size="sm"
            >
              <div className="absolute inset-0 rounded-full bg-pink-400/20 animate-ping -z-10" />
              <Search className="w-4 h-4 mr-2" />
              <span className="font-bold tracking-tight">Search this area</span>
            </Button>
          )}

          <Card className="h-[600px] overflow-hidden border-2 transition-colors duration-500">
            <CardContent className="p-0 h-full">
              <div className="relative w-full h-full rounded-lg overflow-hidden">
                <MapView
                  center={center}
                  zoom={12}
                  markers={markers}
                  onMarkerClick={(m) => handleViewDetails(m.vendor as PlaceResultLite)}
                  fitToMarkers
                  onIdle={handleMapIdle}
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
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tip: counts show what you’ve loaded per category (— means not fetched yet).
              </p>
            </CardHeader>

            <CardContent className={`flex-1 overflow-y-auto ${viewMode === "grid" ? "" : "space-y-3"}`}>
              {vendors.length === 0 && !loading ? (
                <div className="text-center text-sm text-muted-foreground mt-6">
                  No vendors loaded yet. Try selecting a category or clicking “Search this area”.
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {vendors.map((v) => {
                    const Icon = getCategoryIcon(v.category);
                    return (
                      <Card
                        key={v.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleViewDetails(v)}
                      >
                        <div className="w-full h-28 overflow-hidden">
                          {v.image ? (
                            <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              No image
                            </div>
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
                    <Card
                      key={v.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleViewDetails(v)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            {v.image ? (
                              <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                No image
                              </div>
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

              {/* Load More */}
              {hasMore && (
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
                    <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">{selectedVendor.rating ?? "—"}</span>
                    {selectedVendor.reviews != null && (
                      <span className="text-muted-foreground">({selectedVendor.reviews} reviews)</span>
                    )}
                  </div>

                  {selectedVendor.priceRange && (
                    <Badge variant="secondary" className="text-sm">
                      {selectedVendor.priceRange}
                    </Badge>
                  )}

                  {selectedVendor.isOpenNow !== undefined && (
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${
                        selectedVendor.isOpenNow
                          ? "text-green-600 border-green-200 bg-green-50"
                          : "text-red-600 border-red-200 bg-red-50"
                      }`}
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
                    onClick={() =>
                      window.open(`https://www.google.com/maps/place/?q=place_id:${selectedVendor.placeId}`, "_blank")
                    }
                  >
                    View on Google Maps
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleViewDetails(selectedVendor)}
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

      {/* Saved Vendors */}
      {savedVendors.size > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Saved Vendors ({savedVendors.size})
                </CardTitle>
                <CardDescription>Vendors you’ve bookmarked for your wedding.</CardDescription>
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
                const v = vendors.find((x) => x.id === vid) || null;
                if (!v) return null;
                const Icon = getCategoryIcon(v.category);
                return (
                  <Card key={v.id} className="overflow-hidden">
                    <div className="relative h-32">
                      {v.image ? (
                        <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
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
            Save vendors as you browse and export your shortlist for your partner or planner.
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
