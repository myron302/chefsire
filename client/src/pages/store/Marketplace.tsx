import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getMarketplaceProducts } from "@/lib/store/marketplaceApi";
import { MarketplaceProduct } from "@/lib/store/marketplaceTypes";
import {
  applyMarketplaceFiltersAndSorting,
  buildMarketplaceQueryParams,
  defaultMarketplaceFilters,
  MARKETPLACE_PAGE_SIZE,
  MarketplaceFilters,
} from "./lib/marketplaceFilters";
import { MarketplaceFiltersPanel } from "./components/MarketplaceFiltersPanel";
import { MarketplaceHeaderControls } from "./components/MarketplaceHeaderControls";
import { MarketplaceResultsSection } from "./components/MarketplaceResultsSection";
import { MarketplaceToolbar } from "./components/MarketplaceToolbar";

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<MarketplaceFilters>(defaultMarketplaceFilters);

  const [showFilters, setShowFilters] = useState(false);

  const fetchProducts = async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const params = buildMarketplaceQueryParams(filters, currentPage);

      const data = await getMarketplaceProducts(params);
      const fetchedProducts = data.products || [];
      const transformedProducts = applyMarketplaceFiltersAndSorting(fetchedProducts, filters);

      if (reset) {
        setProducts(transformedProducts);
        setPage(1);
      } else {
        setProducts((prev) => [...prev, ...transformedProducts]);
      }

      setTotalCount(data.total || 0);
      setHasMore(fetchedProducts.length === MARKETPLACE_PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load marketplace products. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.category, filters.location, filters.sortBy, filters.deliveryMethod]);

  useEffect(() => {
    if (page > 1) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(true);
  };

  const clearFilters = () => {
    setFilters(defaultMarketplaceFilters);
  };

  const handleFavorite = (productName: string) => {
    toast({
      title: "Added to favorites",
      description: `${productName} has been added to your favorites.`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Marketplace</h1>
          <p className="text-gray-600">Discover amazing products from local chefs and creators</p>
        </div>

        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <MarketplaceToolbar
            searchValue={filters.search}
            onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
            onSubmit={handleSearch}
            onToggleFilters={() => setShowFilters((prev) => !prev)}
          />

          {showFilters && (
            <MarketplaceFiltersPanel
              filters={filters}
              totalCount={totalCount}
              onCategoryChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
              onLocationChange={(value) => setFilters((prev) => ({ ...prev, location: value }))}
              onDeliveryMethodChange={(value) => setFilters((prev) => ({ ...prev, deliveryMethod: value }))}
              onSortChange={(value) => setFilters((prev) => ({ ...prev, sortBy: value }))}
              onClearFilters={clearFilters}
            />
          )}
        </div>

        <MarketplaceHeaderControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onStartSelling={() => setLocation("/store/create")}
        />

        <MarketplaceResultsSection
          loading={loading}
          products={products}
          viewMode={viewMode}
          hasMore={hasMore}
          onLoadMore={() => setPage((prev) => prev + 1)}
          onSelectProduct={(productId) => setLocation(`/product/${productId}`)}
          onFavorite={handleFavorite}
          onClearFilters={clearFilters}
        />
      </div>
    </div>
  );
}
