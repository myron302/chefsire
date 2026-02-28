import React, { useState, useEffect } from "react";
import { Search, Filter, ShoppingCart, Star, MapPin, Package, Store, Heart, Eye, Grid, List } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface MarketplaceProduct {
  id: number;
  name: string;
  description: string;
  price: string;
  images: string[];
  sellerName: string;
  sellerId: number;
  storeName?: string;
  storeHandle?: string;
  rating?: number;
  reviewCount?: number;
  location?: string;
  deliveryMethods: string[];
  category: string;
  isFeatured?: boolean;
  isNew?: boolean;
  viewCount?: number;
  favoriteCount?: number;
}

interface MarketplaceFilters {
  search: string;
  category: string;
  location: string;
  sortBy: string;
  deliveryMethod: string;
  priceRange: string;
}

const categories = [
  { value: "all", label: "All Categories" },
  { value: "digital", label: "Digital Products" },
  { value: "physical", label: "Physical Items" },
  { value: "recipe", label: "Recipes & Meal Plans" },
  { value: "course", label: "Cooking Courses" },
  { value: "equipment", label: "Kitchen Equipment" },
  { value: "ingredient", label: "Ingredients" },
  { value: "service", label: "Services" }
];

const sortOptions = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Newest First" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "popular", label: "Most Popular" }
];

const deliveryMethods = [
  { value: "all", label: "All Delivery" },
  { value: "shipping", label: "Shipping" },
  { value: "pickup", label: "Local Pickup" },
  { value: "digital", label: "Digital Download" },
  { value: "in_store", label: "In-Store Only" }
];

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<MarketplaceFilters>({
    search: "",
    category: "all",
    location: "",
    sortBy: "relevance",
    deliveryMethod: "all",
    priceRange: "all"
  });

  const [showFilters, setShowFilters] = useState(false);

  const fetchProducts = async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams();

      if (filters.search) params.append("query", filters.search);
      if (filters.category !== "all") params.append("category", filters.category);
      if (filters.location) params.append("location", filters.location);

      params.append("limit", "12");
      params.append("offset", ((currentPage - 1) * 12).toString());

      const response = await fetch(`/api/marketplace/products?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch products");

      const data = await response.json();

      let filteredProducts = data.products || [];

      // Apply client-side filters
      if (filters.deliveryMethod !== "all") {
        filteredProducts = filteredProducts.filter((product: MarketplaceProduct) =>
          product.deliveryMethods?.includes(filters.deliveryMethod)
        );
      }

      // Apply sorting
      switch (filters.sortBy) {
        case "newest":
          filteredProducts.sort((a: MarketplaceProduct, b: MarketplaceProduct) => b.id - a.id);
          break;
        case "price_low":
          filteredProducts.sort(
            (a: MarketplaceProduct, b: MarketplaceProduct) =>
              parseFloat(a.price) - parseFloat(b.price)
          );
          break;
        case "price_high":
          filteredProducts.sort(
            (a: MarketplaceProduct, b: MarketplaceProduct) =>
              parseFloat(b.price) - parseFloat(a.price)
          );
          break;
        case "rating":
          filteredProducts.sort(
            (a: MarketplaceProduct, b: MarketplaceProduct) =>
              (b.rating || 0) - (a.rating || 0)
          );
          break;
        case "popular":
          filteredProducts.sort(
            (a: MarketplaceProduct, b: MarketplaceProduct) =>
              (b.viewCount || 0) - (a.viewCount || 0)
          );
          break;
        default:
          break;
      }

      if (reset) {
        setProducts(filteredProducts);
        setPage(1);
      } else {
        setProducts(prev => [...prev, ...filteredProducts]);
      }

      setTotalCount(data.total || 0);
      setHasMore(filteredProducts.length === 12);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load marketplace products. Please try again.",
        variant: "destructive"
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
    setFilters({
      search: "",
      category: "all",
      location: "",
      sortBy: "relevance",
      deliveryMethod: "all",
      priceRange: "all"
    });
  };

  const ProductCard = ({ product }: { product: MarketplaceProduct }) => (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => setLocation(`/product/${product.id}`)}
    >
      <div className="relative">
        <img
          src={product.images?.[0] || "/placeholder-product.jpg"}
          alt={product.name}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="absolute top-2 left-2 flex gap-2">
          {product.isFeatured && <Badge className="bg-yellow-500">Featured</Badge>}
          {product.isNew && <Badge className="bg-green-500">New</Badge>}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-2 right-2"
          onClick={(e) => {
            e.stopPropagation();
            toast({
              title: "Added to favorites",
              description: `${product.name} has been added to your favorites.`
            });
          }}
        >
          <Heart className="w-4 h-4" />
        </Button>
      </div>

      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
          <span className="font-bold text-lg text-green-600">${product.price}</span>
        </div>

        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{product.description}</p>

        <div className="flex items-center gap-2 mb-2">
          <Store className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">{product.sellerName}</span>
        </div>

        {product.location && (
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{product.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-sm font-medium">{product.rating || 0}</span>
            <span className="text-sm text-gray-500">({product.reviewCount || 0})</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{product.viewCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span>{product.favoriteCount || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {product.deliveryMethods?.slice(0, 2).map((method, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {method.replace("_", " ")}
            </Badge>
          ))}
          {product.deliveryMethods?.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{product.deliveryMethods.length - 2}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ProductListItem = ({ product }: { product: MarketplaceProduct }) => (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => setLocation(`/product/${product.id}`)}
    >
      <CardContent className="p-4 flex gap-4">
        <img
          src={product.images?.[0] || "/placeholder-product.jpg"}
          alt={product.name}
          className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
        />

        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-lg">{product.name}</h3>
            <span className="font-bold text-lg text-green-600">${product.price}</span>
          </div>

          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{product.description}</p>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Store className="w-4 h-4" />
              <span>{product.sellerName}</span>
            </div>

            {product.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{product.location}</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span>{product.rating || 0}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-wrap gap-1">
              {product.deliveryMethods?.slice(0, 3).map((method, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {method.replace("_", " ")}
                </Badge>
              ))}
            </div>

            <Button size="sm" variant="outline">
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Marketplace</h1>
          <p className="text-gray-600">Discover amazing products from local chefs and creators</p>
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search products, chefs, or stores..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            <Button type="submit">
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </form>

          {/* Filter Panel */}
          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Select
                  value={filters.category}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Location..."
                  value={filters.location}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                />

                <Select
                  value={filters.deliveryMethod}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, deliveryMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Delivery" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
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
                <span className="text-sm text-gray-500">
                  {totalCount} products found
                </span>
              </div>
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Button onClick={() => setLocation("/store/create")}>
            <Store className="w-4 h-4 mr-2" />
            Start Selling
          </Button>
        </div>

        {/* Products Grid/List */}
        {loading && products.length === 0 ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" : "space-y-4"}>
            {Array.from({ length: 12 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <Skeleton className="h-48 w-full mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" : "space-y-4"}>
              {products.map((product) =>
                viewMode === "grid" ? (
                  <ProductCard key={product.id} product={product} />
                ) : (
                  <ProductListItem key={product.id} product={product} />
                )
              )}
            </div>

            {hasMore && (
              <div className="text-center mt-8">
                <Button
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}

            {!loading && products.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
                <Button onClick={clearFilters}>Clear Filters</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
