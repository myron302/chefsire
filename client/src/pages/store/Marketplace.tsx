import React, { useState, useEffect } from "react";
import { Search, Filter, ShoppingCart, Star, MapPin, Package, Store, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useLocation } from "wouter";

const CATEGORIES = [
  { id: "all", name: "All Products" },
  { id: "spices", name: "Spices & Herbs" },
  { id: "ingredients", name: "Specialty Ingredients" },
  { id: "sauces", name: "Sauces & Condiments" },
  { id: "cookware", name: "Cookware & Tools" },
  { id: "cookbooks", name: "Cookbooks & Guides" },
  { id: "other", name: "Other" },
];

export default function Marketplace() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [activeCategory, searchQuery]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.append("category", activeCategory);
      if (searchQuery) params.append("query", searchQuery);
      const response = await fetch(`/api/marketplace/products?${params}`);
      if (response.ok) {
        const data = await response.json();
        const productsWithStores = await Promise.all(
          (data.products || []).map(async (product: any) => {
            try {
              const storeRes = await fetch(`/api/stores/user/${product.sellerId}`);
              if (storeRes.ok) {
                const storeData = await storeRes.json();
                return { ...product, store: storeData.store };
              }
            } catch (_) {}
            return product;
          })
        );
        setProducts(productsWithStores);
      }
    } catch (e) {
      console.error("Error fetching products:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/marketplace/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || {});
      }
    } catch (e) {
      console.error("Error fetching categories:", e);
    }
  };

  const handleStartSelling = async () => {
    if (!user) { setLocation("/login"); return; }
    try {
      const response = await fetch(`/api/stores/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setLocation(data.store ? "/store/dashboard" : "/store/create");
      } else {
        setLocation("/store/create");
      }
    } catch {
      setLocation("/store/create");
    }
  };

  const formatPrice = (price: number | string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(price));

  const getShippingLabel = (product: any) => {
    if (product.shippingEnabled && product.localPickupEnabled) return "Shipping & Pickup";
    if (product.shippingEnabled) return "Shipping Available";
    if (product.localPickupEnabled) return "Local Pickup Only";
    return "Contact Seller";
  };

  const totalProducts = Object.values(categories).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Marketplace</h1>
            <p className="text-gray-500 text-sm mt-1">
              Discover unique ingredients and cooking tools from fellow chefs
            </p>
          </div>
          <button
            onClick={handleStartSelling}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors text-sm"
          >
            <Store className="w-4 h-4" />
            Start Selling
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Package, label: "Total Products", value: totalProducts, iconClass: "text-orange-600 bg-orange-100" },
            { icon: Users, label: "Active Sellers", value: 142, iconClass: "text-green-600 bg-green-100" },
            { icon: TrendingUp, label: "New This Week", value: "+23", iconClass: "text-blue-600 bg-blue-100" },
            { icon: Star, label: "Avg Rating", value: "4.8★", iconClass: "text-purple-600 bg-purple-100" },
          ].map(({ icon: Icon, label, value, iconClass }) => (
            <div key={label} className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3">
              <div className={`p-2 rounded-lg ${iconClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-semibold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products or sellers..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white"
            />
          </div>
          <button className="sm:w-auto px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm text-gray-700 bg-white transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeCategory === cat.id
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-600 hover:bg-orange-50 border border-gray-200"
              }`}
            >
              {cat.name}
              {cat.id !== "all" && categories[cat.id] ? (
                <span className={`text-xs rounded-full px-1.5 ${activeCategory === cat.id ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
                  {categories[cat.id]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No products found</h3>
            <p className="text-gray-400 text-sm mb-5">
              {searchQuery ? `No results for "${searchQuery}"` : "Nothing in this category yet"}
            </p>
            <button
              onClick={handleStartSelling}
              className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              Be the first to sell here
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => setLocation(`/marketplace/product/${product.id}`)}
              >
                {/* Image */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {product.images?.length ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  <span className="absolute top-2 right-2 bg-white/90 text-gray-600 text-xs px-2 py-0.5 rounded-full capitalize">
                    {product.category}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1">
                      {product.name}
                    </h3>
                    <span className="text-orange-600 font-bold text-sm whitespace-nowrap">
                      {formatPrice(product.price)}
                    </span>
                  </div>

                  {product.description && (
                    <p className="text-gray-500 text-xs line-clamp-2 mb-3">{product.description}</p>
                  )}

                  {/* Seller */}
                  <div
                    className="flex items-center gap-2 mb-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (product.store) setLocation(`/store/${product.store.handle}`);
                    }}
                  >
                    <img
                      src={product.seller?.avatar || "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f?w=32&h=32&fit=crop"}
                      alt={product.seller?.displayName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="text-xs text-gray-600 font-medium hover:text-orange-600 transition-colors truncate">
                      {product.seller?.displayName}
                    </span>
                    {product.seller?.isChef && (
                      <Badge variant="secondary" className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0">
                        Chef
                      </Badge>
                    )}
                  </div>

                  {/* Shipping + Rating */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span>{getShippingLabel(product)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-gray-500">4.8</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/marketplace/product/${product.id}`);
                    }}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
