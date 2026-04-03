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
