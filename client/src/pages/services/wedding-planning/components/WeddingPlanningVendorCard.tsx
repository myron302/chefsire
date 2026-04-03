import { memo } from "react";

import { AlertCircle, Bookmark, Clock, Shield, Sparkles, Star, TrendingUp } from "lucide-react";
import { Link } from "wouter";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { Vendor } from "@/pages/services/lib/wedding-planning-core";

interface WeddingPlanningVendorCardProps {
  vendor: Vendor;
  isSaved: boolean;
  isQuoteRequested: boolean;
  onToggleSave: (id: number) => void;
  onRequestQuote: (id: number) => void;
}

export const WeddingPlanningVendorCard = memo(
  ({ vendor, isSaved, isQuoteRequested, onToggleSave, onRequestQuote }: WeddingPlanningVendorCardProps) => {
    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative">
          <img
            src={vendor.image}
            alt={vendor.name}
            className="w-full h-40 md:h-48 object-cover"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            style={{ contentVisibility: "auto" }}
          />
          {(vendor as any).sponsored && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-xs">
              <TrendingUp className="w-3 h-3 mr-1 text-white" />
              <span className="hidden sm:inline">Sponsored</span>
            </Badge>
          )}
          {(vendor as any).featured && !(vendor as any).sponsored && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-pink-600 to-purple-600 text-xs">
              <Sparkles className="w-3 h-3 mr-1 text-white" />
              <span className="hidden sm:inline">Featured</span>
            </Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 rounded-full p-1.5 md:p-2"
            onClick={() => onToggleSave(vendor.id)}
          >
            <Bookmark className={`w-3 h-3 md:w-4 md:h-4 ${isSaved ? "fill-current" : ""}`} />
          </Button>

          <Badge
            className={`absolute bottom-2 left-2 text-xs ${
              (vendor as any).availability === "Available"
                ? "bg-green-500"
                : (vendor as any).availability === "Limited"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          >
            {(vendor as any).availability}
          </Badge>
        </div>

        <CardContent className="p-3 md:p-4">
          <div className="mb-2">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-1">
              {vendor.name}
              {(vendor as any).verified && <Shield className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{(vendor as any).description}</p>
          </div>

          <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-sm md:text-base">{vendor.rating}</span>
              <span className="text-xs md:text-sm text-muted-foreground">({vendor.reviews})</span>
            </div>
            <span className="text-xs md:text-sm font-medium">{vendor.priceRange}</span>
          </div>

          {(vendor as any).amenities && (
            <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
              {(vendor as any).amenities.slice(0, 3).map((amenity: string) => (
                <Badge key={amenity} variant="secondary" className="text-[10px] md:text-xs">
                  {amenity}
                </Badge>
              ))}
              {(vendor as any).amenities.length > 3 && (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  +{(vendor as any).amenities.length - 3}
                </Badge>
              )}
            </div>
          )}

          {(vendor as any).viewsToday && (
            <Alert className="mb-2 md:mb-3 p-2">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-[10px] md:text-xs">{(vendor as any).viewsToday} couples viewed today</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t">
            <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
              <Clock className="w-3 h-3 text-amber-500" />
              <span className="hidden sm:inline">Responds in {(vendor as any).responseTime}</span>
              <span className="sm:hidden">{(vendor as any).responseTime}</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {isQuoteRequested ? (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  Quote Requested
                </Badge>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => onRequestQuote(vendor.id)} className="flex-1 sm:flex-none text-xs">
                    <span className="hidden sm:inline">Get Quote</span>
                    <span className="sm:hidden">Quote</span>
                  </Button>
                  <Link href="/catering/wedding-map" className="flex-1 sm:flex-none">
                    <Button size="sm" className="bg-gradient-to-r from-pink-600 to-purple-600 w-full text-xs">
                      <span className="hidden sm:inline">View Map</span>
                      <span className="sm:hidden">Map</span>
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
  (prevProps, nextProps) =>
    prevProps.vendor.id === nextProps.vendor.id &&
    prevProps.isSaved === nextProps.isSaved &&
    prevProps.isQuoteRequested === nextProps.isQuoteRequested
);

WeddingPlanningVendorCard.displayName = "WeddingPlanningVendorCard";
