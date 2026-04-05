import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketplaceEmptyStateProps {
  onClearFilters: () => void;
}

export function MarketplaceEmptyState({ onClearFilters }: MarketplaceEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">No products found</h3>
      <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
      <Button onClick={onClearFilters}>Clear Filters</Button>
    </div>
  );
}
