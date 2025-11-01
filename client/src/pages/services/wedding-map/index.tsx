/* client/src/pages/services/wedding-map/index.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* global google */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin, Search, Filter, ChefHat, Camera, Music,
  Flower, Heart, Users, DollarSign, Star, Shield,
  Phone, Globe, Navigation, List, Grid,
  Sparkles, Clock, X, MapPinned,
  Shirt, Crown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import {
  GoogleMap,
  Marker,
  Autocomplete,
  useJsApiLoader,
} from "@react-google-maps/api";

/** -----------------------------
 * Vendor seed data (same as yours)
 * ----------------------------- */
const weddingVendors = {
  venues: [
    {
      id: 1,
      name: "The Grand Ballroom",
      category: "venue",
      address: "123 Main St, Hartford, CT",
      lat: 41.7658,
      lng: -72.6734,
      rating: 4.8,
      reviews: 89,
      priceRange: "$$$$",
      capacity: "50-300",
      image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400",
      amenities: ["In-House Catering", "Parking", "Bridal Suite", "Dance Floor"],
      phone: "(860) 555-0123",
      website: "www.grandballroom.com",
      verified: true,
    },
    {
      id: 2,
      name: "Riverside Gardens",
      category: "venue",
      address: "456 River Rd, Hartford, CT",
      lat: 41.7733,
      lng: -72.6814,
      rating: 4.9,
      reviews: 134,
      priceRange: "$$$",
      capacity: "75-250",
      image: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400",
      amenities: ["Outdoor Ceremony", "Garden", "Waterfront", "Tents"],
      phone: "(860) 555-0456",
      website: "www.riversidegardens.com",
      verified: true,
    },
  ],
  photographers: [
    {
      id: 3,
      name: "Moments Photography",
      category: "photographer",
      address: "789 Studio Ln, Hartford, CT",
      lat: 41.7608,
      lng: -72.67,
      rating: 5.0,
      reviews: 203,
      priceRange: "$$$",
      style: "Documentary",
      image: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=400",
      packages: ["6 hours", "8 hours", "Full day"],
      phone: "(860) 555-0789",
      website: "www.momentsphotography.com",
      verified: true,
    },
    {
      id: 4,
      name: "Classic Captures",
      category: "photographer",
      address: "321 Photo Ave, West Hartford, CT",
      lat: 41.762,
      lng: -72.742,
      rating: 4.7,
      reviews: 156,
      priceRange: "$$",
      style: "Traditional",
      image: "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400",
      packages: ["4 hours", "6 hours", "Full day"],
      phone: "(860) 555-0234",
      website: "www.classiccaptures.com",
      verified: false,
    },
  ],
  djs: [
    {
      id: 5,
      name: "Elite Entertainment DJ",
      category: "dj",
      address: "567 Music St, Hartford, CT",
      lat: 41.7689,
      lng: -72.6789,
      rating: 4.7,
      reviews: 156,
      priceRange: "$$",
      specialty: "All Genres",
      image: "https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=400",
      amenities: ["MC Services", "Lighting", "Dance Floor", "Wireless Mics"],
      phone: "(860) 555-0345",
      website: "www.elitedj.com",
      verified: false,
    },
    {
      id: 6,
      name: "Sound Wave Productions",
      category: "dj",
      address: "890 Beat Blvd, Hartford, CT",
      lat: 41.771,
      lng: -72.665,
      rating: 4.9,
      reviews: 189,
      priceRange: "$$$",
      specialty: "Modern Hits",
      image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400",
      amenities: ["Full Sound System", "DJ + MC", "Custom Playlists", "Lighting Package"],
      phone: "(860) 555-0567",
      website: "www.soundwaveproductions.com",
      verified: true,
    },
  ],
  florists: [
    {
      id: 7,
      name: "Bloom & Petal",
      category: "florist",
      address: "234 Garden Way, Hartford, CT",
      lat: 41.7645,
      lng: -72.685,
      rating: 4.8,
      reviews: 92,
      priceRange: "$$$",
      specialty: "Rustic & Wildflower",
      image: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400",
      services: ["Bouquets", "Centerpieces", "Ceremony Arrangements", "Delivery"],
      phone: "(860) 555-0678",
      website: "www.bloomandpetal.com",
      verified: true,
    },
    {
      id: 8,
      name: "Elegant Blooms",
      category: "florist",
      address: "678 Flower Ln, West Hartford, CT",
      lat: 41.755,
      lng: -72.735,
      rating: 4.6,
      reviews: 78,
      priceRange: "$$",
      specialty: "Classic Roses",
      image: "https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=400",
      services: ["Bouquets", "Centerpieces", "Church Flowers"],
      phone: "(860) 555-0890",
      website: "www.elegantblooms.com",
      verified: false,
    },
  ],
  dressShops: [
    {
      id: 9,
      name: "Bridal Elegance",
      category: "dressShop",
      address: "345 Fashion Ave, Hartford, CT",
      lat: 41.767,
      lng: -72.672,
      rating: 4.9,
      reviews: 167,
      priceRange: "$$$$",
      brands: ["Vera Wang", "Monique Lhuillier", "Pronovias"],
      image: "https://images.unsplash.com/photo-1594552072238-f828d5c34c33?w=400",
      services: ["Appointments", "Alterations", "Custom Design", "Accessories"],
      phone: "(860) 555-0901",
      website: "www.bridalelegance.com",
      verified: true,
    },
    {
      id: 10,
      name: "The Bridal Boutique",
      category: "dressShop",
      address: "789 Style St, West Hartford, CT",
      lat: 41.76,
      lng: -72.745,
      rating: 4.7,
      reviews: 124,
      priceRange: "$$$",
      brands: ["Maggie Sottero", "Allure", "Essense of Australia"],
      image: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=400",
      services: ["Appointments", "Alterations", "Bridesmaid Dresses"],
      phone: "(860) 555-1012",
      website: "www.bridalboutique.com",
      verified: true,
    },
  ],
  tuxedoShops: [
    {
      id: 11,
      name: "Gentleman's Attire",
      category: "tuxedoShop",
      address: "456 Suit Ln, Hartford, CT",
      lat: 41.768,
      lng: -72.676,
      rating: 4.6,
      reviews: 98,
      priceRange: "$$",
      brands: ["Hugo Boss", "Calvin Klein", "Ralph Lauren"],
      image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400",
      services: ["Rentals", "Sales", "Fittings", "Group Discounts"],
      phone: "(860) 555-1123",
      website: "www.gentlemansattire.com",
      verified: false,
    },
    {
      id: 12,
      name: "The Tuxedo Gallery",
      category: "tuxedoShop",
      address: "123 Formal Way, West Hartford, CT",
      lat: 41.759,
      lng: -72.738,
      rating: 4.8,
      reviews: 143,
      priceRange: "$$$",
      brands: ["Armani", "Brooks Brothers", "Michael Kors"],
      image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400",
      services: ["Rentals", "Sales", "Custom Tailoring", "Same-Day Alterations"],
      phone: "(860) 555-1234",
      website: "www.tuxedogallery.com",
      verified: true,
    },
  ],
} as const;

type AnyVendor = (typeof weddingVendors)["venues"][number] |
  (typeof weddingVendors)["photographers"][number] |
  (typeof weddingVendors)["djs"][number] |
  (typeof weddingVendors)["florists"][number] |
  (typeof weddingVendors)["dressShops"][number] |
  (typeof weddingVendors)["tuxedoShops"][number];

const categoryConfig: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  all: { label: "All Vendors", icon: Sparkles, color: "purple" },
  venue: { label: "Venues", icon: MapPin, color: "blue" },
  photographer: { label: "Photographers", icon: Camera, color: "pink" },
  dj: { label: "DJs & Entertainment", icon: Music, color: "orange" },
  florist: { label: "Florists", icon: Flower, color: "green" },
  dressShop: { label: "Dress Shops", icon: Crown, color: "purple" },
  tuxedoShop: { label: "Tuxedo Shops", icon: Shirt, color: "indigo" },
};

/** -------------------------------------
 * Key resolution: Vite env → window fallback
 * ------------------------------------- */
function getBrowserMapsKey(): string | undefined {
  const fromVite = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const fromWindow = (globalThis as any)?.GMAPS_KEY as string | undefined;
  return fromVite || fromWindow;
}

/** -------------------------------------
 * Map shell – only mounts loader when key exists
 * ------------------------------------- */
function WeddingMapCanvas({
  vendors,
  center,
  onMarkerClick,
  onReady,
}: {
  vendors: AnyVendor[];
  center: google.maps.LatLngLiteral;
  onMarkerClick: (v: AnyVendor) => void;
  onReady?: (map: google.maps.Map) => void;
}) {
  const apiKey = getBrowserMapsKey();

  if (!apiKey) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-muted/30 rounded-lg text-center p-6">
        <div>
          <p className="font-semibold mb-1">Google Maps key not detected</p>
          <p className="text-sm text-muted-foreground">
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your environment (Plesk) or define{" "}
            <code>window.GMAPS_KEY</code> before this page loads.
          </p>
        </div>
      </div>
    );
  }

  return <WeddingMapInner apiKey={apiKey} vendors={vendors} center={center} onMarkerClick={onMarkerClick} onReady={onReady} />;
}

function WeddingMapInner({
  apiKey,
  vendors,
  center,
  onMarkerClick,
  onReady,
}: {
  apiKey: string;
  vendors: AnyVendor[];
  center: google.maps.LatLngLiteral;
  onMarkerClick: (v: AnyVendor) => void;
  onReady?: (map: google.maps.Map) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader(
    useMemo(
      () => ({
        id: "wedding-map-script",
        googleMapsApiKey: apiKey,
        libraries: ["places", "marker"],
      }),
      [apiKey]
    )
  );

  const mapRef = useRef<google.maps.Map | null>(null);

  if (loadError) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="text-center px-6">
          <p className="font-semibold mb-1">Maps failed to load</p>
          <p className="text-sm text-muted-foreground">
            Check that your key allows this referrer and that <code>Maps JavaScript API</code> and{" "}
            <code>Places API</code> are enabled.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-muted/30 rounded-lg">
        Loading Google Map…
      </div>
    );
  }

  return (
    <GoogleMap
      onLoad={(m) => {
        mapRef.current = m;
        onReady?.(m);
      }}
      center={center}
      zoom={12}
      mapContainerStyle={{ width: "100%", height: "600px", borderRadius: "0.5rem" }}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      {vendors.map((v) => (
        <Marker
          key={v.id}
          position={{ lat: v.lat, lng: v.lng }}
          onClick={() => onMarkerClick(v)}
          title={v.name}
        />
      ))}
    </GoogleMap>
  );
}

/** -------------------------------------
 * Main page
 * ------------------------------------- */
export default function WeddingVendorMap() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("Hartford, CT");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedVendor, setSelectedVendor] = useState<AnyVendor | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [savedVendors, setSavedVendors] = useState<Set<number>>(new Set());
  const [center, setCenter] = useState<google.maps.LatLngLiteral>({ lat: 41.7658, lng: -72.6734 });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // flatten vendors
  const allVendors: AnyVendor[] = useMemo(
    () => [
      ...weddingVendors.venues,
      ...weddingVendors.photographers,
      ...weddingVendors.djs,
      ...weddingVendors.florists,
      ...weddingVendors.dressShops,
      ...weddingVendors.tuxedoShops,
    ],
    []
  );

  const filteredVendors = useMemo(() => {
    return allVendors.filter((vendor) => {
      const matchesCategory = selectedCategory === "all" || vendor.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        vendor.name.toLowerCase().includes(q) ||
        vendor.address.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allVendors, selectedCategory, searchQuery]);

  const handleViewDetails = (vendor: AnyVendor) => {
    setSelectedVendor(vendor);
    setShowDetails(true);
  };

  const toggleSaveVendor = (vendorId: number) => {
    setSavedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  const getCategoryIcon = (category: string) => {
    const config = categoryConfig[category];
    return config ? config.icon : MapPin;
  };

  // Safe Autocomplete handler with geocode fallback
  const onPlaceChanged = async () => {
    try {
      const place = autocompleteRef.current?.getPlace();
      const loc = place?.geometry?.location ?? null;
      if (loc) {
        const next = { lat: loc.lat(), lng: loc.lng() };
        setCenter(next);
        setLocationQuery(place?.formatted_address || place?.name || locationQuery);
        return;
      }
      // fallback via Geocoder
      const text = locationQuery;
      if (!text) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: text }, (results, status) => {
        const r = results?.[0];
        if (status === "OK" && r?.geometry?.location) {
          const loc2 = r.geometry.location;
          setCenter({ lat: loc2.lat(), lng: loc2.lng() });
        }
      });
    } catch (e) {
      // swallow – keep UI alive
      console.error("Autocomplete error:", e);
    }
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
            <p className="text-muted-foreground">Find and explore wedding vendors near you on the map</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              <MapPinned className="w-4 h-4 mr-1" />
              {filteredVendors.length} vendors found
            </Badge>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search by vendor name, specialty, or service..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                {/* Autocomplete wraps the input for location */}
                <Autocomplete
                  onLoad={(ac) => (autocompleteRef.current = ac)}
                  onPlaceChanged={onPlaceChanged}
                  options={{}}
                >
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      placeholder="Location (City, State)"
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onPlaceChanged();
                        }
                      }}
                      className="pl-10"
                    />
                  </div>
                </Autocomplete>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {Object.entries(categoryConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={key}
                variant={selectedCategory === key ? "default" : "outline"}
                onClick={() => setSelectedCategory(key)}
                className="whitespace-nowrap"
              >
                <Icon className="w-4 h-4 mr-2" />
                {config.label}
                <Badge variant="secondary" className="ml-2">
                  {key === "all" ? allVendors.length : allVendors.filter((v) => v.category === key).length}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Map + Vendor List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Map Section */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] overflow-hidden">
            <CardContent className="p-0 h-full">
              <WeddingMapCanvas
                vendors={filteredVendors}
                center={center}
                onMarkerClick={handleViewDetails}
                onReady={() => {}}
              />
            </CardContent>
          </Card>
        </div>

        {/* Vendor List Section */}
        <div className="lg:col-span-1">
          <Card className="h-[600px] overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Vendors List</CardTitle>
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
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              {filteredVendors.map((vendor) => {
                const Icon = getCategoryIcon(vendor.category);
                return (
                  <Card
                    key={vendor.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleViewDetails(vendor)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate flex items-center gap-1">
                              {vendor.name}
                              {("verified" in vendor && (vendor as any).verified) && (
                                <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" />
                              )}
                            </h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSaveVendor(vendor.id as number);
                              }}
                            >
                              <Heart
                                className={`w-4 h-4 ${savedVendors.has(vendor.id as number) ? "fill-red-500 text-red-500" : ""}`}
                              />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Icon className="w-3 h-3" />
                            <span>{categoryConfig[(vendor as any).category]?.label}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-medium">{(vendor as any).rating}</span>
                              <span className="text-xs text-muted-foreground">({(vendor as any).reviews})</span>
                            </div>
                            <span className="text-xs font-medium">{(vendor as any).priceRange}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                      {("verified" in selectedVendor && (selectedVendor as any).verified) && (
                        <Shield className="w-5 h-5 text-blue-500" />
                      )}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-2">
                      <MapPin className="w-4 h-4" />
                      {selectedVendor.address}
                    </DialogDescription>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => toggleSaveVendor(selectedVendor.id as number)}>
                    <Heart
                      className={`w-5 h-5 ${savedVendors.has(selectedVendor.id as number) ? "fill-red-500 text-red-500" : ""}`}
                    />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Image */}
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  <img src={selectedVendor.image} alt={selectedVendor.name} className="w-full h-full object-cover" />
                </div>

                {/* Rating and Price */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">{(selectedVendor as any).rating}</span>
                    <span className="text-muted-foreground">({(selectedVendor as any).reviews} reviews)</span>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {(selectedVendor as any).priceRange}
                  </Badge>
                </div>

                {/* Category-specific info */}
                {("capacity" in selectedVendor) && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Capacity: {(selectedVendor as any).capacity} guests</span>
                  </div>
                )}
                {("style" in selectedVendor) && (
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Style: {(selectedVendor as any).style}</span>
                  </div>
                )}
                {("specialty" in selectedVendor) && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Specialty: {(selectedVendor as any).specialty}</span>
                  </div>
                )}

                {/* Amenities/Services/Packages/Brands */}
                {((selectedVendor as any).amenities ||
                  (selectedVendor as any).services ||
                  (selectedVendor as any).packages ||
                  (selectedVendor as any).brands) && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      {(selectedVendor as any).amenities
                        ? "Amenities"
                        : (selectedVendor as any).services
                        ? "Services"
                        : (selectedVendor as any).packages
                        ? "Packages"
                        : "Brands"}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(
                        (selectedVendor as any).amenities ||
                        (selectedVendor as any).services ||
                        (selectedVendor as any).packages ||
                        (selectedVendor as any).brands
                      )?.map((item: string) => (
                        <Badge key={item} variant="outline">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact Info */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    {("phone" in selectedVendor) && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${(selectedVendor as any).phone}`} className="text-sm hover:underline">
                          {(selectedVendor as any).phone}
                        </a>
                      </div>
                    )}
                    {("website" in selectedVendor) && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={`https://${(selectedVendor as any).website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
                          {(selectedVendor as any).website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600">Request Quote</Button>
                  <Button variant="outline" className="flex-1">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Now
                  </Button>
                </div>

                {/* Address Box */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Location</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{selectedVendor.address}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
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
            <CardDescription>Vendors you've bookmarked for your wedding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from(savedVendors).map((vendorId) => {
                const vendor = allVendors.find((v) => v.id === vendorId);
                if (!vendor) return null;
                const Icon = getCategoryIcon((vendor as any).category);
                return (
                  <Card key={vendor.id} className="overflow-hidden">
                    <div className="relative h-32">
                      <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover" />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute top-2 right-2 rounded-full p-2"
                        onClick={() => toggleSaveVendor(vendor.id as number)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-semibold text-sm mb-1">{vendor.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="w-3 h-3" />
                        <span>{categoryConfig[(vendor as any).category]?.label}</span>
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
