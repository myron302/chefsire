import { memo } from "react";

import { Bookmark, Globe, Instagram, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { Vendor, VENDOR_CATEGORIES } from "@/pages/services/lib/wedding-planning-core";
import { WeddingPlanningUnclaimedVendorActions } from "@/pages/services/wedding-planning/components/WeddingPlanningUnclaimedVendorActions";

interface WeddingPlanningVendorCardProps {
  vendor: Vendor;
  isSaved: boolean;
  isQuoteRequested: boolean;
  onToggleSave: (id: number) => void;
  onRequestQuote: (id: number) => void;
}

export const WeddingPlanningVendorCard = memo(
  ({ vendor, isSaved, isQuoteRequested, onToggleSave, onRequestQuote }: WeddingPlanningVendorCardProps) => {
    const categoryLabel = VENDOR_CATEGORIES.find((c) => c.value === vendor.type)?.label ?? "Wedding vendor";
    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1 mb-1">
                <Badge variant="secondary" className="text-[10px] md:text-xs">{categoryLabel}</Badge>
                {vendor.unclaimed && (
                  <Badge variant="outline" className="text-[10px] md:text-xs text-muted-foreground" title="This business hasn't joined ChefSire yet">
                    Not on ChefSire yet
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-base md:text-lg">{vendor.name}</h3>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full p-1.5 md:p-2 flex-shrink-0"
              onClick={() => onToggleSave(vendor.id)}
              aria-label={isSaved ? "Remove from saved vendors" : "Save vendor"}
            >
              <Bookmark className={`w-3 h-3 md:w-4 md:h-4 ${isSaved ? "fill-current" : ""}`} />
            </Button>
          </div>

          {vendor.description && (
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-3 mb-2">{vendor.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-muted-foreground mb-3">
            {vendor.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {vendor.location}</span>
            )}
            {vendor.priceRange && <span className="font-medium text-foreground">{vendor.priceRange}</span>}
            {vendor.yearsInBusiness && <span>{vendor.yearsInBusiness} yrs in business</span>}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t">
            <div className="flex items-center gap-3 text-xs md:text-sm">
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-pink-600 hover:underline">
                  <Globe className="w-3 h-3" /> Website
                </a>
              )}
              {vendor.instagramHandle && (
                <a
                  href={`https://instagram.com/${encodeURIComponent(vendor.instagramHandle)}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-pink-600 hover:underline"
                >
                  <Instagram className="w-3 h-3" /> Instagram
                </a>
              )}
            </div>
            {vendor.unclaimed ? (
              <WeddingPlanningUnclaimedVendorActions vendor={vendor} />
            ) : isQuoteRequested ? (
              <Badge variant="secondary" className="text-[10px] md:text-xs">Quote Requested</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onRequestQuote(vendor.id)} className="text-xs w-full sm:w-auto">
                Get Quote
              </Button>
            )}
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
