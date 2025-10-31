import * as React from "react";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  MapPin, Search, Camera, Music, Flower, Heart, Users, Star, Shield,
  Phone, Globe, Navigation, List, Grid, Sparkles, X, MapPinned, Shirt, Crown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Google Maps
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Autocomplete,
  useJsApiLoader,
} from "@react-google-maps/api";

// ---------- Mock data (same vendors you had) ----------
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

const categoryConfig = {
  all: { label: "All Vendors", color: "#8b5cf6" }, // purple
  venue: { label: "Venues", color: "#3b82f6" }, // blue
  photographer: { label: "Photographers", color: "#ec4899" }, // pink
  dj: { label: "DJs & Entertainment", color: "#f59e0b" }, // amber
  florist: { label: "Florists", color: "#22c55e" }, // green
  dressShop: { label: "Dress Shops", color: "#a855f7" }, // purple
  tuxedoShop: { label: "Tuxedo Shops", color: "#6366f1" }, // indigo
} as const;

type CategoryKey = keyof typeof categoryConfig | "all";
type Vendor = {
  id: number;
  name: string;
  category: Exclude<CategoryKey, "all">;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  reviews: number;
  priceRange: string;
  image: string;
  verified?: boolean;
  capacity?: string;
  style?: string;
  specialty?: string;
  amenities?: string[];
  services?: string[];
  packages?: string[];
  brands?: string[];
};

const FLAT_VENDORS: Vendor[] = [
  ...(weddingVendors.venues as any),
  ...(weddingVendors.photographers as any),
  ...(weddingVendors.djs as any),
  ...(weddingVendors.florists as any),
  ...(weddingVendors.dressShops as any),
  ...(weddingVendors.tuxedoShops as any),
];

// Google Map container style
const mapContainerStyle = { width: "100%", height: "100%" };

// Build a colored SVG pin per category
function markerIconFor(category: Vendor["category"]): google.maps.Symbol {
  const fill = (categoryConfig as any)[category]?.color ?? "#8b5cf6";
  return {
    path: "M12 2C7.03 2 3 6.03 3 11c0 5.25 7.2 11.64 8.1 12.39a1.3 1.3 0 0 0 1.8 0C13.8 22.64 21 16.25 21 11c0-4.97-4.03-9-9-9zm0 12.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
    fillColor: fill,
    fillOpacity: 1,
    strokeWeight: 1.2,
    strokeColor: "#ffffff",
    scale: 1.2,
    anchor: new google.maps.Point(12, 24),
  };
}

export default function WeddingVendorMap() {
  // If you already inject the Maps script elsewhere (e.g., BiteMap), this loader
  // will detect it. If not, set VITE_GOOGLE_MAPS_API_KEY in your env.
  const loaderOptions = useMemo(() => {
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    const opts: any = { id: "google-map-script", libraries: ["places"] };
    if (key) opts.googleMapsApiKey = key;
    return opts;
  }, []);
  const { isLoaded } = useJsApiLoader(loaderOptions);

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("Hartford, CT");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [savedVendors, setSavedVendors] = useState<Set<number>>(new Set());
  const [activeInfoId, setActiveInfoId] = useState<number | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [center, setCenter] = useState<google.maps.LatLngLiteral>({
    lat: 41.7658,
    lng: -72.6734, // Hartford default
  });
  const [zoom, setZoom] = useState(12);

  // Fit bounds to filtered vendors
  useEffect(() => {
    if (!mapRef.current) return;
    const vendors = getFilteredVendors();
    if (!vendors.length) return;
    const bounds = new google.maps.LatLngBounds();
    vendors.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
    mapRef.current.fitBounds(bounds, 50);
  }, [selectedCategory, searchQuery]);

  const handleViewDetails = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setShowDetails(true);
  };

  const toggleSaveVendor = (vendorId: number) => {
    setSavedVendors((prev) => {
      const next = new Set(prev);
      next.has(vendorId) ? next.delete(vendorId) : next.add(vendorId);
      return next;
    });
  };

  const getFilteredVendors = () => {
    const q = searchQuery.trim().toLowerCase();
    return FLAT_VENDORS.filter((v) => {
      const matchCat = selectedCategory === "all" || v.category === selectedCategory;
      const matchQ = !q || v.name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  };

  const filteredVendors = getFilteredVendors();

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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search by vendor name, specialty, or service..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  {/* Google Places Autocomplete for location */}
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={(ac) => (autocompleteRef.current = ac)}
                      onPlaceChanged={() => {
                        const place = autocompleteRef.current?.getPlace();
                        if (!place || !place.geometry) return;
                        const loc = place.geometry.location;
                        const nextCenter = { lat: loc.lat(), lng: loc.lng() };
                        setCenter(nextCenter);
                        setZoom(12);
                        setLocationQuery(place.formatted_address || "");
                        // pan + (optional) fit vendors near new center (we keep simple here)
                        mapRef.current?.panTo(nextCenter);
                      }}
                      options={{ types: ["(cities)"] }}
                    >
                      <Input
                        placeholder="Location (City, State)"
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        className="pl-10"
                      />
                    </Autocomplete>
                  ) : (
                    <Input
                      placeholder="Location (City, State)"
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      className="pl-10"
                    />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <Button
              key={key}
              variant={selectedCategory === (key as CategoryKey) ? "default" : "outline"}
              onClick={() => setSelectedCategory(key as CategoryKey)}
              className="whitespace-nowrap"
            >
              <span
                className="w-4 h-4 mr-2 inline-block rounded-full"
                style={{ backgroundColor: (cfg as any).color }}
              />
              {(cfg as any).label}
              <Badge variant="secondary" className="ml-2">
                {key === "all"
                  ? FLAT_VENDORS.length
                  : FLAT_VENDORS.filter((v) => v.category === (key as any)).length}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Map + List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Google Map */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] overflow-hidden">
            <CardContent className="p-0 h-full">
              {isLoaded ? (
                <GoogleMap
                  onLoad={(m) => (mapRef.current = m)}
                  center={center}
                  zoom={zoom}
                  mapContainerStyle={mapContainerStyle}
                  options={{
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                  }}
                >
                  {filteredVendors.map((v) => (
                    <Marker
                      key={v.id}
                      position={{ lat: v.lat, lng: v.lng }}
                      icon={markerIconFor(v.category)}
                      onClick={() => {
                        setActiveInfoId(v.id);
                      }}
                    />
                  ))}

                  {filteredVendors.map((v) =>
                    activeInfoId === v.id ? (
                      <InfoWindow
                        key={`iw-${v.id}`}
                        position={{ lat: v.lat, lng: v.lng }}
                        onCloseClick={() => setActiveInfoId(null)}
                      >
                        <div className="space-y-1 max-w-[220px]">
                          <div className="font-semibold">{v.name}</div>
                          <div className="text-xs text-muted-foreground">{v.address}</div>
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span>{v.rating}</span>
                            <span className="text-muted-foreground">({v.reviews})</span>
                          </div>
                          <Button
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => handleViewDetails(v)}
                          >
                            View Details
                          </Button>
                        </div>
                      </InfoWindow>
                    ) : null
                  )}
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                  <p className="text-gray-500">Loading Google Map…</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vendor List */}
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
                return (
                  <Card
                    key={vendor.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleViewDetails(vendor)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={vendor.image}
                            alt={vendor.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate flex items-center gap-1">
                              {vendor.name}
                              {vendor.verified && (
                                <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" />
                              )}
                            </h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSaveVendor(vendor.id);
                              }}
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  savedVendors.has(vendor.id)
                                    ? "fill-red-500 text-red-500"
                                    : ""
                                }`}
                              />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3 h-3" />
                            <span>{vendor.address}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-medium">
                                {vendor.rating}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({vendor.reviews})
                              </span>
                            </div>
                            <span className="text-xs font-medium">
                              {vendor.priceRange}
                            </span>
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
                      {selectedVendor.verified && (
                        <Shield className="w-5 h-5 text-blue-500" />
                      )}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-2">
                      <MapPin className="w-4 h-4" />
                      {selectedVendor.address}
                    </DialogDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleSaveVendor(selectedVendor.id)}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        savedVendors.has(selectedVendor.id)
                          ? "fill-red-500 text-red-500"
                          : ""
                      }`}
                    />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Image */}
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  <img
                    src={selectedVendor.image}
                    alt={selectedVendor.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Rating and Price */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">
                      {selectedVendor.rating}
                    </span>
                    <span className="text-muted-foreground">
                      ({selectedVendor.reviews} reviews)
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {selectedVendor.priceRange}
                  </Badge>
                </div>

                {/* Category-specific info */}
                {selectedVendor.capacity && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Capacity: {selectedVendor.capacity} guests
                    </span>
                  </div>
                )}
                {selectedVendor.style && (
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Style: {selectedVendor.style}</span>
                  </div>
                )}
                {selectedVendor.specialty && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Specialty: {selectedVendor.specialty}
                    </span>
                  </div>
                )}

                {/* Amenities/Services/Packages */}
                {(selectedVendor.amenities ||
                  selectedVendor.services ||
                  selectedVendor.packages ||
                  selectedVendor.brands) && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      {selectedVendor.amenities
                        ? "Amenities"
                        : selectedVendor.services
                        ? "Services"
                        : selectedVendor.packages
                        ? "Packages"
                        : "Brands"}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(
                        selectedVendor.amenities ||
                        selectedVendor.services ||
                        selectedVendor.packages ||
                        selectedVendor.brands
                      )?.map((item: string) => (
                        <Badge key={item} variant="outline">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact + Directions */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    {selectedVendor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={`tel:${selectedVendor.phone}`}
                          className="text-sm hover:underline"
                        >
                          {selectedVendor.phone}
                        </a>
                      </div>
                    )}
                    {selectedVendor.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={`https://${selectedVendor.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
                          {selectedVendor.website}
                        </a>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => {
                      const q =
                        selectedVendor.lat && selectedVendor.lng
                          ? `${selectedVendor.lat},${selectedVendor.lng}`
                          : encodeURIComponent(selectedVendor.address);
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${q}`,
                        "_blank"
                      );
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
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
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Saved Vendors ({savedVendors.size})
            </CardTitle>
            <CardDescription>Vendors you've bookmarked for your wedding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from(savedVendors).map((vendorId) => {
                const vendor = FLAT_VENDORS.find((v) => v.id === vendorId);
                if (!vendor) return null;

                return (
                  <Card key={vendor.id} className="overflow-hidden">
                    <div className="relative h-32">
                      <img
                        src={vendor.image}
                        alt={vendor.name}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute top-2 right-2 rounded-full p-2"
                        onClick={() => toggleSaveVendor(vendor.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-semibold text-sm mb-1">{vendor.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{vendor.address}</span>
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
