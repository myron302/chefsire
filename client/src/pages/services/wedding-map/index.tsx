import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin, Search, Navigation, List, Grid, Sparkles, Clock, Star, Shield,
  Heart, X, MapPinned, Phone, Globe, Camera, Users, Music, Flower2, ShoppingBag, Shirt,
  ChevronDown, FileDown, Mail
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import MapView from "./MapView";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * UPDATED Wedding Vendor Discovery
 * - Accurate Derived Counts
 * - Load More Pagination
 * - Search This Area (Spatial)
 * - Comparison Drawer & PDF Export
 * - Inquiry System
 */

type LatLng = { lat: number; lng: number };

type VendorCategoryKey = "all" | "venue" | "photographer" | "dj" | "florist" | "dressShop" | "tuxedoShop";

type PlaceResultLite = {
  id: string;
  name: string;
  category: VendorCategoryKey;
  address?: string;
  position: LatLng;
  rating?: number;
  userRatingsTotal?: number;
  priceRange?: string;
  image?: string;
  placeId: string;
  phone?: string;
  website?: string;
  isOpenNow?: boolean;
  businessStatus?: string;
};

const categoryConfig: Record<VendorCategoryKey, { label: string; icon: any; query: string }> = {
  all: { label: "All Vendors", icon: Sparkles, query: "wedding services" },
  venue: { label: "Venues", icon: MapPin, query: "wedding venue event space" },
  photographer: { label: "Photography", icon: Camera, query: "wedding photographer" },
  dj: { label: "Music & DJ", icon: Music, query: "wedding dj entertainment" },
  florist: { label: "Florists", icon: Flower2, query: "wedding florist" },
  dressShop: { label: "Bridal Shops", icon: ShoppingBag, query: "wedding dress bridal shop" },
  tuxedoShop: { label: "Tuxedo Rental", icon: Shirt, query: "tuxedo rental suit" },
};

function pickCategoryFromTypes(selected: VendorCategoryKey, types?: string[]): VendorCategoryKey {
  if (selected !== "all") return selected;
  if (!types) return "all";
  const t = new Set(types);
  if (t.has("photographer")) return "photographer";
  if (t.has("florist")) return "florist";
  if (t.has("clothing_store")) return "dressShop";
  if (t.has("event_venue") || t.has("lodging") || t.has("restaurant")) return "venue";
  return "all";
}

export default function WeddingVendorMap() {
  // --- Search & Data State ---
  const [locationQuery, setLocationQuery] = useState("New York, NY");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<VendorCategoryKey>("all");
  const [vendors, setVendors] = useState<PlaceResultLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<google.maps.places.PlaceSearchPagination | null>(null);
  
  // --- Map State ---
  const [center, setCenter] = useState<LatLng>({ lat: 40.7128, lng: -74.006 });
  const [mapBoundsCenter, setMapBoundsCenter] = useState<LatLng | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  
  // --- Interaction State ---
  const [selectedVendor, setSelectedVendor] = useState<PlaceResultLite | null>(null);
  const [savedVendors, setSavedVendors] = useState<Set<string>>(new Set());
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  // --- 1. THE VENDOR COUNT FIX: Derived state via useMemo ---
  const categoryCounts = useMemo(() => {
    const counts: Record<VendorCategoryKey, number> = {
      all: vendors.length, venue: 0, photographer: 0, dj: 0, florist: 0, dressShop: 0, tuxedoShop: 0
    };
    vendors.forEach(v => {
      if (v.category !== "all" && counts[v.category] !== undefined) counts[v.category]++;
    });
    return counts;
  }, [vendors]);

  const searchRef = useRef<number | null>(null);

  // Main Search Logic
  const performSearch = async (loc?: LatLng) => {
    setLoading(true);
    const gm = window.google;
    const targetLoc = loc || center;

    const service = new gm.maps.places.PlacesService(document.createElement("div"));
    const q = [categoryConfig[selectedCategory].query, searchQuery].filter(Boolean).join(" ");

    const request = {
      query: q,
      location: new gm.maps.LatLng(targetLoc.lat, targetLoc.lng),
      radius: 25000,
    };

    service.textSearch(request, (results, status, nextPagination) => {
      if (status === gm.maps.places.PlacesServiceStatus.OK && results) {
        const mapped = results.map(p => ({
          id: p.place_id!,
          placeId: p.place_id!,
          name: p.name!,
          category: pickCategoryFromTypes(selectedCategory, p.types),
          address: p.formatted_address,
          position: { lat: p.geometry!.location!.lat(), lng: p.geometry!.location!.lng() },
          rating: p.rating,
          userRatingsTotal: p.user_ratings_total,
          priceRange: "$".repeat(p.price_level || 0) || "N/A",
          image: p.photos?.[0]?.getUrl(),
          isOpenNow: p.opening_hours?.isOpen?.(),
        }));
        
        // If it's a pagination call, append; otherwise replace
        setVendors(prev => (nextPagination && !results.length) ? prev : mapped);
        setPagination(nextPagination || null);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (searchRef.current) window.clearTimeout(searchRef.current);
    searchRef.current = window.setTimeout(() => performSearch(), 500);
  }, [selectedCategory, searchQuery, locationQuery]);

  const handleLoadMore = () => {
    if (pagination?.hasNextPage) {
      setLoading(true);
      pagination.nextPage();
    }
  };

  const toggleSave = (id: string) => {
    const next = new Set(savedVendors);
    next.has(id) ? next.delete(id) : next.add(id);
    setSavedVendors(next);
  };

  const toggleComparison = (id: string) => {
    setComparisonIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Wedding Vendor Shortlist", 14, 22);
    const data = vendors.filter(v => comparisonIds.includes(v.id)).map(v => [v.name, v.category, v.rating || "N/A", v.address]);
    (doc as any).autoTable({ startY: 30, head: [['Name', 'Category', 'Rating', 'Address']], body: data });
    doc.save("wedding-vendors.pdf");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Badge variant="outline" className="text-pink-600 border-pink-200 bg-pink-50">
            Professional Vendor Discovery
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight">Find Your Wedding Team</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              value={locationQuery} 
              onChange={(e) => setLocationQuery(e.target.value)}
              className="pl-10" 
              placeholder="City or Zip..." 
            />
          </div>
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10" 
              placeholder="Specific name or style..." 
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto no-scrollbar">
        {(Object.entries(categoryConfig) as [VendorCategoryKey, any][]).map(([key, cfg]) => (
          <Button
            key={key}
            variant={selectedCategory === key ? "default" : "outline"}
            className={`rounded-full gap-2 transition-all ${selectedCategory === key ? "bg-pink-600 hover:bg-pink-700 shadow-md scale-105" : ""}`}
            onClick={() => setSelectedCategory(key)}
          >
            <cfg.icon className="w-4 h-4" />
            {cfg.label}
            <Badge variant="secondary" className="ml-1 bg-white/20 text-xs px-1.5 py-0">
              {categoryCounts[key]}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vendor List */}
        <div className="lg:col-span-1 space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
          {loading && vendors.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground animate-pulse">Searching for vendors...</div>
          ) : vendors.map(v => (
            <Card key={v.id} className="group hover:border-pink-300 transition-all cursor-pointer">
              <CardContent className="p-4 flex gap-4">
                <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden relative">
                  {v.image ? <img src={v.image} className="object-cover w-full h-full" /> : <cfg.icon className="w-8 h-8 m-auto text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold truncate text-sm">{v.name}</h3>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSave(v.id)}>
                      <Heart className={`w-4 h-4 ${savedVendors.has(v.id) ? "fill-pink-500 text-pink-500" : ""}`} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={`text-[10px] h-4 ${v.isOpenNow ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}`}>
                      {v.isOpenNow ? "Open Now" : "Closed"}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {v.rating}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => toggleComparison(v.id)}>
                      {comparisonIds.includes(v.id) ? "Added" : "Compare"}
                    </Button>
                    <Button size="sm" className="h-7 text-xs flex-1 bg-pink-50 text-pink-600 hover:bg-pink-100 border-none">Details</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {pagination?.hasNextPage && (
            <Button variant="ghost" className="w-full text-pink-600 font-semibold" onClick={handleLoadMore} disabled={loading}>
              {loading ? "Loading..." : "Load More Vendors"}
            </Button>
          )}
        </div>

        {/* Map Column */}
        <div className="lg:col-span-2 relative">
          {showSearchArea && (
            <Button 
              onClick={() => { performSearch(mapBoundsCenter!); setShowSearchArea(false); }}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-20 shadow-2xl bg-white text-pink-600 hover:bg-pink-50 border-2 border-pink-200 rounded-full px-6 py-5 transition-all animate-in fade-in zoom-in"
            >
              <div className="absolute inset-0 rounded-full bg-pink-400/20 animate-ping -z-10" />
              <Search className="w-4 h-4 mr-2" /> Search this area
            </Button>
          )}
          <Card className="h-[600px] overflow-hidden border-2">
            <MapView 
              center={center} 
              markers={vendors} 
              onIdle={(map: any) => {
                const c = map.getCenter();
                setMapBoundsCenter({ lat: c.lat(), lng: c.lng() });
                setShowSearchArea(true);
              }}
            />
          </Card>
        </div>
      </div>

      {/* Action Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-pink-600 text-white">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Compare & Save</h3>
              <p className="opacity-90">Compare up to 3 vendors side-by-side.</p>
            </div>
            <Button variant="secondary" onClick={() => setIsComparisonOpen(true)} disabled={comparisonIds.length === 0}>
              Compare ({comparisonIds.length})
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-purple-600 text-white">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Bulk Inquiries</h3>
              <p className="opacity-90">Contact all saved vendors at once.</p>
            </div>
            <Button variant="secondary" onClick={() => setIsQuoteModalOpen(true)} disabled={savedVendors.size === 0}>
              Request Quotes ({savedVendors.size})
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Drawer */}
      <Dialog open={isComparisonOpen} onOpenChange={setIsComparisonOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Vendor Comparison</DialogTitle>
            <Button variant="outline" size="sm" onClick={exportToPDF} className="mr-8">
              <FileDown className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4 text-center">
            <div className="text-left font-bold space-y-10 pt-16 text-muted-foreground">
              <div>Category</div>
              <div>Rating</div>
              <div>Price</div>
              <div>Status</div>
            </div>
            {comparisonIds.map(id => {
              const v = vendors.find(vend => vend.id === id);
              if (!v) return null;
              return (
                <div key={v.id} className="space-y-10">
                  <div className="font-bold h-12 flex items-center justify-center">{v.name}</div>
                  <div>{v.category}</div>
                  <div className="flex justify-center items-center gap-1"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> {v.rating}</div>
                  <div>{v.priceRange}</div>
                  <div>{v.isOpenNow ? "Open" : "Closed"}</div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
