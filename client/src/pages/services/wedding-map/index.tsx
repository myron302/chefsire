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

  // Geocode a text location into lat/lng
 client/src/pages/services/wedding-map/index.tsx

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
          <Button className="bg-gradient-to-r from-pink-600 to-purple-600">
            <Heart className="w-4 h-4 mr-2" />
            Start Planning
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
