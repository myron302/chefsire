import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin, Search, Navigation, List, Grid, Sparkles, Clock, Star, Shield,
  Heart, X, MapPinned, Phone, Globe, Camera, Users, Music, Flower2, ShoppingBag, Shirt
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import MapView from "./MapView";

/**
 * LIVE Google Places integration
 * - No mock data
 * - Category-aware Text Search near a geocoded location
 * - Details (phone/website) fetched on demand when opening a vendor
 *
 * This file assumes Google Maps JS is injected either by BiteMap or our MapView.
 * We never touch BiteMap’s files/config.
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
  id: string;                  // place_id
  name: string;
  category: VendorCategoryKey; // best-guess based on selection / types
  address?: string;
  position: LatLng;
  rating?: number;
  reviews?: number;
  priceRange?: string;         // converted from price_level
  image?: string;
  verified?: boolean;
  // details (loaded on demand)
  phone?: string;
  website?: string;
  placeId: string;
};

const categoryConfig: Record<VendorCategoryKey, { label: string; icon: any; query: string }> = {
  all:          { label: "All",           icon: Sparkles,     query: "wedding venue OR photographer OR wedding dj OR florist OR bridal shop OR tuxedo shop" },
  venue:        { label: "Venues",        icon: MapPin,       query: "wedding venue OR event venue OR banquet hall" },
  photographer: { label: "Photo",         icon: Camera,       query: "wedding photographer OR photographer" },
  dj:           { label: "DJ & Music",    icon: Music,        query: "wedding dj OR dj services" },
  florist:      { label: "Florist",       icon: Flower2,      query: "florist wedding OR florist" },
  dressShop:    { label: "Dresses",       icon: ShoppingBag,  query: "bridal shop OR wedding dress shop" },
  tuxedoShop:   { label: "Tuxedos",       icon: Shirt,        query: "tuxedo shop OR formal wear" },
};

// ---------- Helpers ----------
function priceLevelToRange(level?: number): string | undefined {
  if (level == null) return undefined;
  return ["$", "$", "$$", "$$$", "$$$$"][level] || undefined;
}

function pickCategoryFromTypes(
  selected: VendorCategoryKey,
  types?: string[]
): VendorCategoryKey {
  if (selected !== "all") return selected;
  if (!types || !types.length) return "all";
  const t = new Set(types);
  if (t.has("photographer")) return "photographer";
  if (t.has("florist")) return "florist";
  // Clothing stores → bridal/tux guesses
  if (t.has("clothing_store")) return "dressShop";
  if (t.has("restaurant") || t.has("lodging") || t.has("point_of_interest")) return "venue";
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
  };
}

// Wait for Google to be ready (do NOT inject here; MapView already handles it)
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
  const [selectedCategory, setSelectedCategory] = useState<VendorCategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("Hartford, CT");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [savedVendors, setSavedVendors] = useState<Set<string>>(new Set());

  // Map + data state
  const [center, setCenter] = useState<LatLng>({ lat: 41.7658, lng: -72.6734 }); // Hartford default
  const [vendors, setVendors] = useState<PlaceResultLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal
  const [selectedVendor, setSelectedVendor] = useState<PlaceResultLite | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

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

  // Toggle save
  const toggleSaveVendor = (vendorId: string) => {
    setSavedVendors((prev) => {
      const ns = new Set(prev);
      if (ns.has(vendorId)) ns.delete(vendorId);
      else ns.add(vendorId);
      return ns;
    });
  };

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
            if (place?.name) {
              setSearchQuery(place.name);
            } else if (place?.formatted_address) {
              setSearchQuery(place.formatted_address);
            }
          });
        }

        if (locationInputRef.current && !locationAutocomplete) {
          locationAutocomplete = new gm.maps.places.Autocomplete(locationInputRef.current, {
            fields: ["formatted_address", "geometry", "place_id"],
            types: ["(cities)"],
          });
          locationListener = locationAutocomplete.addListener("place_changed", () => {
            const place = locationAutocomplete?.getPlace();
            if (place?.formatted_address) {
              setLocationQuery(place.formatted_address);
            }
            if (place?.geometry?.location) {
              setCenter({
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              });
            }
          });
        }
      } catch {
        // Autocomplete is optional; map can still function without it.
      }
    };

    initAutocomplete();

    return () => {
      cancelled = true;
      searchListener?.remove();
      locationListener?.remove();
    };
  }, []);

  // Geocode a text location into lat/lng
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

  // MAIN SEARCH (Places Text Search)
  const searchRef = useRef<number | null>(null);
  useEffect(() => {
    // Debounce
    if (searchRef.current) window.clearTimeout(searchRef.current);
    searchRef.current = window.setTimeout(async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        await waitForGoogle(); // ensure places lib exists
        const gm = window.google;
        const loc = (await geocodeAddress(locationQuery)) || center;
        setCenter(loc);

        const service = new gm.maps.places.PlacesService(document.createElement("div"));

        const qBase = categoryConfig[selectedCategory].query;
        const q = [qBase, searchQuery].filter(Boolean).join(" ");

        const request: any = {
          query: q,
          location: new gm.maps.LatLng(loc.lat, loc.lng),
          radius: 25000, // ~25km around the location
        };

        await new Promise<void>((resolve, reject) => {
          service.textSearch(request, (results: any[], status: string, pagination: any) => {
            if (status !== gm.maps.places.PlacesServiceStatus.OK || !results) {
              setVendors([]);
              if (status !== "ZERO_RESULTS") setErrorMsg(status || "Search failed");
              return resolve();
            }
            const mapped = results
              .map((p) => placeToVendorLite(p, selectedCategory))
              .filter(Boolean) as PlaceResultLite[];
            setVendors(mapped);
            resolve();
          });
        });
      } catch (e: any) {
        setErrorMsg(e?.message || "Search failed");
        setVendors([]);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      if (searchRef.current) window.clearTimeout(searchRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery, locationQuery]);

  // Open details & fetch phone/website on demand
  const handleViewDetails = async (vendor: PlaceResultLite) => {
    setSelectedVendor(vendor);
    setShowDetails(true);

    if (vendor.phone || vendor.website) return; // already enriched

    try {
      await waitForGoogle();
      const gm = window.google;
      const service = new gm.maps.places.PlacesService(document.createElement("div"));
      setDetailsLoading(true);

      await new Promise<void>((resolve) => {
        service.getDetails(
          {
            placeId: vendor.placeId,
            fields: [
              "formatted_phone_number",
              "website",
              "opening_hours",
              "url",
              "formatted_address",
              "photo",
            ],
          },
          (place: any, status: string) => {
            if (status === gm.maps.places.PlacesServiceStatus.OK && place) {
              setSelectedVendor((prev) =>
                prev && prev.id === vendor.id
                  ? {
                      ...prev,
                      phone: place.formatted_phone_number || prev.phone,
                      website: place.website || prev.website,
                      address: place.formatted_address || prev.address,
                      image: placePhoto(place) || prev.image,
                    }
                  : prev
              );
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
            <p className="text-muted-foreground">
              Live results pulled from Google Places near your chosen location
            </p>
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
          {(
            Object.keys(categoryConfig) as VendorCategoryKey[]
          ).map((key) => {
            const cfg = categoryConfig[key];
            const Icon = cfg.icon;
            const isSelected = selectedCategory === key;
            const count = key === "all" ? vendors.length : vendors.filter((v) => v.category === key).length;
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
      </div>

      {/* Map + Results (grid/list toggle on the right, like BiteMap) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Map Section */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              <div className="relative w-full h-full rounded-lg overflow-hidden">
                <MapView
                  center={center}
                  zoom={12}
                  markers={markers}
                  onMarkerClick={(m) => handleViewDetails(m.vendor as PlaceResultLite)}
                  fitToMarkers
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
              {loading && (
                <p className="text-xs text-muted-foreground mt-1">Loading live results…</p>
              )}
              {errorMsg && (
                <p className="text-xs text-red-500 mt-1">Error: {errorMsg}</p>
              )}
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
                              onClick={(e) => { e.stopPropagation(); toggleSaveVendor(v.id); }}
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
                              {v.reviews != null && (
                                <span className="text-xs text-muted-foreground">({v.reviews})</span>
                              )}
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
                // list mode
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
                                onClick={(e) => { e.stopPropagation(); toggleSaveVendor(v.id); }}
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
                                {v.reviews != null && (
                                  <span className="text-xs text-muted-foreground">({v.reviews})</span>
                                )}
                              </div>
                              {v.priceRange && <span className="text-xs font-medium">{v.priceRange}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {v.address || "—"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
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
                      {selectedVendor.verified && (
                        <Shield className="w-5 h-5 text-blue-500" />
                      )}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-2">
                      <MapPin className="w-4 h-4" />
                      {selectedVendor.address || "—"}
                    </DialogDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleSaveVendor(selectedVendor.id)}
                  >
                    <Heart
                      className={`w-5 h-5 ${savedVendors.has(selectedVendor.id) ? "fill-red-500 text-red-500" : ""}`}
                    />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  {selectedVendor.image ? (
                    <img
                      src={selectedVendor.image}
                      alt={selectedVendor.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>

                {/* Rating and Price */}
                <div className="flex items-center gap-4">
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
                </div>

                {/* Contact Info */}
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
                        <a
                          href={selectedVendor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
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

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600"
                    onClick={() => window.open(`https://www.google.com/maps/place/?q=place_id:${selectedVendor.placeId}`, "_blank")}
                  >
                    View on Google Maps
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => {
                    // On-demand details fetch if missing
                    if (!selectedVendor.phone || !selectedVendor.website) {
                      handleViewDetails(selectedVendor);
                    }
                  }}>
                    <Clock className="w-4 h-4 mr-2" />
                    {detailsLoading ? "Fetching…" : "Refresh Details"}
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
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Saved Vendors ({savedVendors.size})
            </CardTitle>
            <CardDescription>
              Vendors you've bookmarked for your wedding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from(savedVendors).map((vid) => {
                const v = vendors.find((x) => x.id === vid);
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
            Save time by requesting quotes from multiple vendors at once. Compare pricing and availability in one place.
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
