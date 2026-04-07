import React from "react";
import { Button } from "@/components/ui/button";
import { MarketplaceProduct } from "@/lib/store/marketplaceTypes";
import { MarketplaceEmptyState } from "./MarketplaceEmptyState";
import { MarketplaceLoadingState } from "./MarketplaceLoadingState";
import { MarketplaceProductCard } from "./MarketplaceProductCard";
import { MarketplaceProductListItem } from "./MarketplaceProductListItem";

interface MarketplaceResultsSectionProps {
  loading: boolean;
  products: MarketplaceProduct[];
  viewMode: "grid" | "list";
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectProduct: (productId: number) => void;
  onFavorite: (productName: string) => void;
  onClearFilters: () => void;
}

export function MarketplaceResultsSection({
  loading,
  products,
  viewMode,
  hasMore,
  onLoadMore,
  onSelectProduct,
  onFavorite,
  onClearFilters,
}: MarketplaceResultsSectionProps) {
  if (loading && products.length === 0) {
    return <MarketplaceLoadingState viewMode={viewMode} />;
  }

  return (
    <>
      <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" : "space-y-4"}>
        {products.map((product) =>
          viewMode === "grid" ? (
            <MarketplaceProductCard
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
              onFavorite={onFavorite}
            />
          ) : (
            <MarketplaceProductListItem
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
              onFavorite={onFavorite}
            />
          )
        )}
      </div>

      {hasMore && (
        <div className="text-center mt-8">
          <Button onClick={onLoadMore} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {!loading && products.length === 0 && <MarketplaceEmptyState onClearFilters={onClearFilters} />}
    </>
  );
}
