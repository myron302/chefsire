import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Vendor } from "@/pages/services/lib/wedding-planning-core";

import { WeddingPlanningVendorCard } from "@/pages/services/wedding-planning/components/WeddingPlanningVendorCard";

interface WeddingPlanningVendorGridProps {
  filteredVendors: Vendor[];
  savedVendors: Set<number>;
  requestedQuotes: Set<number>;
  onToggleSave: (id: number) => void;
  onRequestQuote: (id: number) => void;
}

export function WeddingPlanningVendorGrid({
  filteredVendors,
  savedVendors,
  requestedQuotes,
  onToggleSave,
  onRequestQuote,
}: WeddingPlanningVendorGridProps) {
  if (filteredVendors.length === 0) {
    return (
      <Card className="mb-8 border-dashed">
        <CardContent className="p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">No vendors listed here yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            ChefSire's wedding vendor directory is just opening. Use the map to find vendors near you in the meantime.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/catering/wedding-map">
              <Button className="bg-gradient-to-r from-pink-600 to-purple-600">Find vendors on the map</Button>
            </Link>
            <Link href="/services/vendor-listing">
              <Button variant="outline">Are you a vendor? List your business</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
      {filteredVendors.map((vendor) => (
        <WeddingPlanningVendorCard
          key={vendor.id}
          vendor={vendor}
          isSaved={savedVendors.has(vendor.id)}
          isQuoteRequested={requestedQuotes.has(vendor.id)}
          onToggleSave={onToggleSave}
          onRequestQuote={onRequestQuote}
        />
      ))}
    </div>
  );
}
