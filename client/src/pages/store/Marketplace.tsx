import React, { useEffect, useState } from "react";
import { Filter, Grid, List, Search, Store } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getMarketplaceProducts } from "@/lib/store/marketplaceApi";
import { MarketplaceProduct } from "@/lib/store/marketplaceTypes";
import { MarketplaceEmptyState } from "./components/MarketplaceEmptyState";
import { MarketplaceLoadingState } from "./components/MarketplaceLoadingState";
import { MarketplaceProductCard } from "./components/MarketplaceProductCard";
import { MarketplaceProductListItem } from "./components/MarketplaceProductListItem";
import {
  applyMarketplaceFiltersAndSorting,
  buildMarketplaceQueryParams,
  defaultMarketplaceFilters,
  MARKETPLACE_PAGE_SIZE,
  marketplaceCategories,
  marketplaceDeliveryMethods,
  MarketplaceFilters,
  marketplaceSortOptions,
} from "./lib/marketplaceFilters";

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
      const transformedProducts = applyMarketplaceFiltersAndSorting(data.products || [], filters);

      if (reset) {
        setProducts(transformedProducts);
        setPage(1);
      } else {
        setProducts((prev) => [...prev, ...transformedProducts]);
      }

      setTotalCount(data.total || 0);
      setHasMore(transformedProducts.length === MARKETPLACE_PAGE_SIZE);
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
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search products, chefs, or stores..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </form>

          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Select
                  value={filters.category}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaceCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Location..."
                  value={filters.location}
                  onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
                />

                <Select
                  value={filters.deliveryMethod}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, deliveryMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Delivery" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaceDeliveryMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, sortBy: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaceSortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <span className="text-sm text-gray-500">{totalCount} products found</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
              <Grid className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Button onClick={() => setLocation("/store/create")}>
            <Store className="w-4 h-4 mr-2" />
            Start Selling
          </Button>
        </div>

        {loading && products.length === 0 ? (
          <MarketplaceLoadingState viewMode={viewMode} />
        ) : (
          <>
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" : "space-y-4"}>
              {products.map((product) =>
                viewMode === "grid" ? (
                  <MarketplaceProductCard
                    key={product.id}
                    product={product}
                    onSelect={(productId) => setLocation(`/product/${productId}`)}
                    onFavorite={handleFavorite}
                  />
                ) : (
                  <MarketplaceProductListItem
                    key={product.id}
                    product={product}
                    onSelect={(productId) => setLocation(`/product/${productId}`)}
                  />
                )
              )}
            </div>

            {hasMore && (
              <div className="text-center mt-8">
                <Button onClick={() => setPage((prev) => prev + 1)} disabled={loading}>
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}

            {!loading && products.length === 0 && <MarketplaceEmptyState onClearFilters={clearFilters} />}
          </>
        )}
      </div>
    </div>
  );
}
