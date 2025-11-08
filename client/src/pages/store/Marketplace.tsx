import React, { useState, useEffect } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Search, Filter, ShoppingCart, Star, MapPin, Package, Plus, TrendingUp, Users, DollarSign, Store, Crown, AlertCircle } from "lucide-react";
import { Button as UIButton } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Custom store components for the builder
const Container = ({ children }) => <div className="p-4 border border-gray-200 rounded">{children}</div>;
const Text = ({ text }) => <p className="text-gray-800">{text}</p>;
const Banner = () => (
  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg">
    <h3>Welcome to My Culinary Store!</h3>
  </div>
);
const ProductCard = ({ product }) => (
  <UICard className="w-64">
    <div className="p-4 font-semibold">{product.name}</div>
    <div className="px-4 pb-4 text-gray-700">${product.price}</div>
    <UIButton className="m-4">Add to Cart</UIButton>
  </UICard>
);
const resolver = { Container, Text, Banner, ProductCard };

const customRenderNode = ({ render }) => (
  <div className="relative group">
    {render}
    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100">
      <UIButton size="sm" variant="outline">
        Edit
      </UIButton>
    </div>
  </div>
);

// Inner component to access Editor state
const SaveButton = ({ onSave, saving }) => {
  const { query } = useEditor();

  const handleClick = () => {
    const json = query.serialize();
    onSave(json);
  };

  return (
    <UIButton
      onClick={handleClick}
      className="bg-orange-500 text-white hover:bg-orange-600"
      disabled={saving}
    >
      {saving ? "Saving..." : "Save & Publish"}
    </UIButton>
  );
};

const StoreBuilder = ({ onBack, storeId }) => {
  const [initialLayout, setInitialLayout] = useState(null);
  const [saving, setSaving] = useState(false);
  const { user } = useUser();

  // Load existing layout when component mounts
  useEffect(() => {
    const loadLayout = async () => {
      if (!storeId) return;
      try {
        const response = await fetch(`/api/stores-crud/${storeId}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.store?.layout) {
            setInitialLayout(data.store.layout);
          }
        }
      } catch (error) {
        console.error("Error loading layout:", error);
      }
    };
    loadLayout();
  }, [storeId]);

  const handleSave = async (editorState) => {
    if (!storeId || !user) {
      alert("Please create a store first");
      return;
    }

    setSaving(true);
    try {
      // Save to API
      const response = await fetch(`/api/stores-crud/${storeId}/layout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ layout: editorState })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Store layout saved successfully", data);
        alert("Store layout saved!");
      } else {
        const error = await response.json();
        console.error("Failed to save:", error);
        alert("Failed to save store layout");
      }
    } catch (error) {
      console.error("Error saving layout:", error);
      alert("Error saving store layout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Editor resolver={resolver} onRender={customRenderNode}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <button onClick={onBack} className="text-gray-600 hover:text-gray-900 mb-4 flex items-center">
                ← Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Store Builder</h1>
              <p className="text-gray-600">Customize your storefront with drag-and-drop</p>
            </div>
            <SaveButton onSave={handleSave} saving={saving} />
          </div>

          <div className="flex gap-4">
            <div className="w-64 bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-bold mb-4">Add Elements</h2>
              <div className="space-y-2">
                <Element is={Container} canvas>
                  <UIButton variant="ghost">Drag Container</UIButton>
                </Element>
                <Element is={Text} text="Drag Text" canvas>
                  <UIButton variant="ghost">Drag Text</UIButton>
                </Element>
                <Element is={Banner} canvas>
                  <UIButton variant="ghost">Drag Banner</UIButton>
                </Element>
                <Element is={ProductCard} product={{ name: "Sample Product", price: 9.99 }} canvas>
                  <UIButton variant="ghost">Drag Product Card</UIButton>
                </Element>
              </div>
            </div>

            <div className="flex-1 bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-bold mb-4">Your Store Preview</h2>
              <Frame json={initialLayout}>
                <Element is={Container} canvas className="min-h-[500px] border border-dashed border-gray-300">
                  <Text text="Drop elements here to build your store" />
                </Element>
              </Frame>
            </div>
          </div>
        </Editor>
      </div>
    </div>
  );
};

const Marketplace = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"browse" | "sell">("browse");
  const { user } = useUser();

  const categoryList = [
    { id: "all", name: "All Products", icon: Package },
    { id: "spices", name: "Spices & Herbs", icon: Package },
    { id: "ingredients", name: "Specialty Ingredients", icon: Package },
    { id: "sauces", name: "Sauces & Condiments", icon: Package },
    { id: "cookware", name: "Cookware & Tools", icon: Package },
    { id: "cookbooks", name: "Cookbooks & Guides", icon: Package },
    { id: "other", name: "Other", icon: Package },
  ];

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
        // Enhance products with store information
        const productsWithStores = await Promise.all(
          (data.products || []).map(async (product: any) => {
            try {
              const storeResponse = await fetch(`/api/stores/user/${product.sellerId}`);
              if (storeResponse.ok) {
                const storeData = await storeResponse.json();
                return { ...product, store: storeData.store };
              }
            } catch (e) {
              console.error('Error fetching store:', e);
            }
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

  const formatPrice = (price: number | string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(price));

  const getShippingInfo = (product: any) => {
    if (product.shippingEnabled && product.localPickupEnabled) return "Shipping & Pickup Available";
    if (product.shippingEnabled) return "Shipping Available";
    if (product.localPickupEnabled) return "Local Pickup Only";
    return "Contact Seller";
  };

  // Check if user can sell (has subscription or active trial)
  const canSell = user?.subscription !== "free" || 
    (user?.trialEndDate && new Date(user.trialEndDate) > new Date());

  const handleStartSelling = async () => {
    if (!user) {
      // Redirect to login
      window.location.href = "/login";
      return;
    }

    if (!canSell) {
      // Show upgrade modal or redirect to subscription
      setView("sell");
      return;
    }
    
    // Check if user already has a store
    try {
      const response = await fetch(`/api/stores/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.store) {
          // User has a store, go to seller dashboard
          setView("sell");
        } else {
          // User needs to create a store first
          window.location.href = "/store/create";
        }
      }
    } catch (error) {
      console.error('Error checking store:', error);
      // If API fails, redirect to store creation
      window.location.href = "/store/create";
    }
  };

  // Handle seller click - navigate to their store
  const handleSellerClick = (product: any) => {
    if (product.store) {
      window.location.href = `/store/${product.store.handle}`;
    } else {
      // Fallback to user profile
      window.location.href = `/profile/${product.sellerId}`;
    }
  };

  // Handle product click - navigate to product page in store
  const handleProductClick = (product: any) => {
    if (product.store) {
      window.location.href = `/store/${product.store.handle}/product/${product.id}`;
    } else {
      // Fallback to product details page
      window.location.href = `/product/${product.id}`;
    }
  };

  if (view === "sell") return <SellerDashboard onBack={() => setView("browse")} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketplace</h1>
              <p className="text-gray-600">Discover unique ingredients and cooking tools from fellow chefs</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleStartSelling}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center"
              >
                <Store className="w-4 h-4 mr-2" />
                Start Selling
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <Package className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {Object.values(categories).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Sellers</p>
                  <p className="text-lg font-semibold text-gray-900">142</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">This Week</p>
                  <p className="text-lg font-semibold text-gray-900">+23 new</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Star className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Rating</p>
                  <p className="text-lg font-semibold text-gray-900">4.8★</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for ingredients, tools, or sellers..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Categories */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {categoryList.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  activeCategory === category.id ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-orange-50"
                }`}
              >
                <category.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{category.name}</span>
                {category.id !== "all" && categories[category.id] && (
                  <span className="text-xs bg-black bg-opacity-20 rounded-full px-2 py-0.5">
                    {categories[category.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-4">{searchQuery ? `No products match "${searchQuery}"` : "No products in this category yet"}</p>
            <button
              onClick={handleStartSelling}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Be the first to sell here
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleProductClick(product)}
              >
                {product.images?.length ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-400" />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
                    <div className="text-right">
                      <p className="text-xl font-bold text-orange-600">{formatPrice(product.price)}</p>
                      {product.shippingCost && <p className="text-xs text-gray-500">+{formatPrice(product.shippingCost)} shipping</p>}
                    </div>
                  </div>

                  {product.description && <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">4.8 (12)</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full capitalize">
                      {product.category}
                    </span>
                  </div>

                  {/* Enhanced Seller Info with Store Badge */}
                  <div className="flex items-center mb-4">
                    <div 
                      className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer hover:text-orange-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSellerClick(product);
                      }}
                    >
                      <img
                        src={product.seller?.avatar || "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f"}
                        alt={product.seller?.displayName}
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="font-medium">{product.seller?.displayName}</span>
                      {product.seller?.isChef && (
                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                          Chef
                        </Badge>
                      )}
                      {product.store && (
                        <Badge variant="outline" className="text-xs">
                          <Store className="w-3 h-3 mr-1" />
                          Store
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center text-xs text-gray-500 mb-4">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span>{getShippingInfo(product)}</span>
                  </div>

                  <div className="flex space-x-2">
                    <button 
                      className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add to cart logic
                      }}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to Cart
                    </button>
                    <button 
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Favorite logic
                      }}
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const SellerDashboard = ({ onBack }: { onBack: () => void }) => {
  const { user, updateUser } = useUser(); // { subscription, productCount, trialEndDate }
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "analytics" | "store-builder" | "subscription" | "store">(
    "products"
  );
  const [showBuilder, setShowBuilder] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(
    user.subscription === "free" || (user.trialEndDate && new Date(user.trialEndDate) < new Date())
  );
  const [userStore, setUserStore] = useState<any>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  // Load user's store
  useEffect(() => {
    loadUserStore();
  }, [user.id]);

  const loadUserStore = async () => {
    try {
      const response = await fetch(`/api/stores/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserStore(data.store);
      }
    } catch (error) {
      console.error('Failed to load store:', error);
    } finally {
      setStoreLoading(false);
    }
  };

  // Simple trial activation without payment
  const handleStartTrial = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        description: "Please log in to start your trial",
      });
      return;
    }

    try {
      // For now, just update the local user context
      // In production, you'd call a backend endpoint to record the trial
      const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      updateUser({ subscription: "pro", trialEndDate: trialEnds.toISOString() });

      setShowUpgradeModal(false);

      toast({
        description: "🎉 30-day store trial activated! Create your store to start selling.",
      });

      // Redirect to store creation if they don't have a store
      setTimeout(() => {
        if (!userStore) {
          window.location.href = "/store/create";
        }
      }, 1500);
    } catch (error) {
      console.error('Error starting trial:', error);
      toast({
        variant: "destructive",
        description: "Failed to start trial. Please try again.",
      });
    }
  };

  // 🔁 Square upgrade flow — creates a hosted checkout link and navigates there
  const handleUpgrade = async (tier: "pro" | "enterprise", isTrial = false) => {
    if (!user) {
      alert("Please log in to start your trial or upgrade.");
      return;
    }

    try {
      const resp = await fetch("/api/square/subscription-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          trial: isTrial,
          userId: user.id,
          email: user.email,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.url) {
        // More specific error message
        const errorMsg = data?.error || "Could not start checkout";
        if (errorMsg.includes("Missing plan variation")) {
          alert("Subscription service is currently being configured. Please check back later or contact support.");
        } else {
          alert(`Error: ${errorMsg}`);
        }
        return;
      }
      // If you want to record local UI state immediately for trial:
      if (isTrial) {
        const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        updateUser({ ...user, subscription: tier, trialEndDate: trialEnds });
      }
      window.location.href = data.url; // go to Square-hosted page
    } catch (e) {
      console.error("Square upgrade error", e);
      alert("There was a problem starting checkout. Please try again.");
    }
  };

  const canAddProduct = user.subscription !== "free" || user.productCount < 5;
  const trialDaysLeft = user.trialEndDate ? Math.ceil((new Date(user.trialEndDate).getTime() - Date.now()) / 86400000) : 0;

  if (showBuilder) return <StoreBuilder onBack={() => setShowBuilder(false)} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={onBack} className="text-gray-600 hover:text-gray-900 mb-4 flex items-center">
              ← Back to Marketplace
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Seller Dashboard</h1>
            <p className="text-gray-600">Manage your products and track your sales</p>
          </div>
          
          {/* Store creation button if no store exists */}
          {!userStore && !storeLoading && (
            <button 
              onClick={() => window.location.href = '/store/create'}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center"
            >
              <Store className="w-4 h-4 mr-2" />
              Create Store
            </button>
          )}
          {userStore && (
            <button 
              onClick={() => window.location.href = `/store/${userStore.handle}`}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center"
            >
              <Store className="w-4 h-4 mr-2" />
              View My Store
            </button>
          )}
        </div>

        {/* Tier Selection Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Crown className="w-8 h-8 text-orange-500 mr-3" />
                    <div>
                      <h3 className="text-2xl font-bold">Choose Your Store Plan</h3>
                      <p className="text-gray-600">Start with a 30-day free trial, cancel anytime</p>
                    </div>
                  </div>
                  <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Starter Tier */}
                <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <h4 className="text-lg font-bold mb-2">Starter</h4>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">$19</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Up to 50 products</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Custom store URL</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Basic analytics</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Email support</span>
                    </li>
                  </ul>
                  <UIButton onClick={() => {
                    updateUser({ subscription: "starter", trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
                    setShowUpgradeModal(false);
                    toast({ description: "🎉 30-day Starter trial activated!" });
                    setTimeout(() => window.location.href = "/store/create", 1500);
                  }} className="w-full">
                    Start Free Trial
                  </UIButton>
                </div>

                {/* Pro Tier */}
                <div className="border-2 border-orange-500 rounded-lg p-6 hover:shadow-lg transition-shadow relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-orange-500 text-white">Most Popular</Badge>
                  </div>
                  <h4 className="text-lg font-bold mb-2">Professional</h4>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">$49</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Unlimited products</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Custom domain</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Advanced analytics</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Priority support</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Marketing tools</span>
                    </li>
                  </ul>
                  <UIButton onClick={() => {
                    updateUser({ subscription: "pro", trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
                    setShowUpgradeModal(false);
                    toast({ description: "🎉 30-day Pro trial activated!" });
                    setTimeout(() => window.location.href = "/store/create", 1500);
                  }} className="w-full bg-orange-500 hover:bg-orange-600">
                    Start Free Trial
                  </UIButton>
                </div>

                {/* Enterprise Tier */}
                <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <h4 className="text-lg font-bold mb-2">Enterprise</h4>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">$99</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Everything in Pro</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>White-label branding</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>API access</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Dedicated account manager</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Custom integrations</span>
                    </li>
                  </ul>
                  <UIButton onClick={() => {
                    updateUser({ subscription: "enterprise", trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
                    setShowUpgradeModal(false);
                    toast({ description: "🎉 30-day Enterprise trial activated!" });
                    setTimeout(() => window.location.href = "/store/create", 1500);
                  }} className="w-full">
                    Start Free Trial
                  </UIButton>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t text-center text-sm text-gray-600">
                All plans include a 30-day free trial • No credit card required • Cancel anytime
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg mr-4">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Products</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
                <p className="text-xs text-green-600">+2 this month</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">$1,245</p>
                <p className="text-xs text-green-600">+18% from last month</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg mr-4">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900">3,241</p>
                <p className="text-xs text-blue-600">+5% this week</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg mr-4">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Rating</p>
                <p className="text-2xl font-bold text-gray-900">4.9</p>
                <p className="text-xs text-gray-600">From 23 reviews</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Added Store Tab */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: "products", name: "My Products", count: 12 },
                { id: "orders", name: "Orders", count: 5 },
                { id: "analytics", name: "Analytics", count: null },
                { id: "store-builder", name: "Store Builder", count: null },
                { id: "store", name: "My Store", count: null },
                { id: "subscription", name: "Subscription", count: null },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === (tab.id as any)
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.name}
                  {tab.count && (
                    <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">{tab.count}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "products" && (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Your products will appear here once you start selling</p>
                {!userStore && (
                  <button 
                    onClick={() => window.location.href = '/store/create'}
                    className="mt-4 bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    Create Store to Start Selling
                  </button>
                )}
              </div>
            )}

            {activeTab === "orders" && (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Orders from customers will appear here</p>
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="text-center py-12 text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Sales analytics and performance metrics will appear here</p>
              </div>
            )}

            {activeTab === "store-builder" && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-6">Build Your Store</h3>
                {userStore ? (
                  <div className="text-center">
                    <button
                      onClick={() => setShowBuilder(true)}
                      className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                    >
                      Launch Store Builder
                    </button>
                    <p className="text-gray-600 mt-4">Customize your storefront layout and design</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Store className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 mb-4">Create a store first to use the store builder</p>
                    <button 
                      onClick={() => window.location.href = '/store/create'}
                      className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                    >
                      Create Store
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* NEW STORE TAB CONTENT */}
            {activeTab === "store" && (
              <div>
                {storeLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
                    <p className="text-gray-600">Loading store...</p>
                  </div>
                ) : userStore ? (
                  <div className="space-y-6">
                    {/* Store Overview Card */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">{userStore.name}</h3>
                          <p className="text-gray-600">artisana.app/store/{userStore.handle}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              userStore.is_published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                            }`}>
                              {userStore.is_published ? "Published" : "Draft"}
                            </span>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {userStore.subscription_tier} Tier
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => window.location.href = `/store/${userStore.handle}`}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            View Store
                          </button>
                          <button 
                            onClick={() => setShowBuilder(true)}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                          >
                            Customize Store
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button 
                        onClick={() => setActiveTab("products")}
                        className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-orange-300 transition-colors"
                      >
                        <Package className="w-8 h-8 text-orange-500 mb-2" />
                        <h4 className="font-semibold">Manage Products</h4>
                        <p className="text-sm text-gray-600 mt-1">Add, edit, or remove products</p>
                      </button>
                      
                      <button 
                        onClick={() => setShowBuilder(true)}
                        className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-orange-300 transition-colors"
                      >
                        <Store className="w-8 h-8 text-orange-500 mb-2" />
                        <h4 className="font-semibold">Customize Design</h4>
                        <p className="text-sm text-gray-600 mt-1">Change your store's appearance</p>
                      </button>
                      
                      <button 
                        onClick={() => setActiveTab("analytics")}
                        className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-orange-300 transition-colors"
                      >
                        <TrendingUp className="w-8 h-8 text-orange-500 mb-2" />
                        <h4 className="font-semibold">View Analytics</h4>
                        <p className="text-sm text-gray-600 mt-1">Track your store performance</p>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Store className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold mb-2">No store yet</h3>
                    <p className="text-gray-600 mb-4">Create your storefront to start selling products</p>
                    <button 
                      onClick={() => window.location.href = '/store/create'}
                      className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                    >
                      Create Your Store
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "subscription" && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-6">Seller Subscription</h3>
                {user.trialEndDate && <p className="mb-4 text-green-600">Trial active - Ends in {trialDaysLeft} days</p>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-2">Free</h4>
                    <p className="text-3xl font-bold mb-4">
                      $0<span className="text-sm text-gray-600">/month</span>
                    </p>
                    <ul className="text-sm text-gray-600 space-y-2 mb-4">
                      <li>• Up to 5 products</li>
                      <li>• 10% commission fee</li>
                      <li>• Basic analytics</li>
                    </ul>
                    <button className="w-full bg-gray-500 text-white py-2 rounded-lg">Current Plan</button>
                  </div>

                  <div className="border-2 border-orange-500 rounded-lg p-6 relative">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-full text-xs">
                      Recommended
                    </div>
                    <h4 className="text-lg font-semibold mb-2">Professional</h4>
                    <p className="text-3xl font-bold mb-4">
                      $35<span className="text-sm text-gray-600">/month</span>
                    </p>
                    <ul className="text-sm text-gray-600 space-y-2 mb-4">
                      <li>• Unlimited products</li>
                      <li>• Lower fees</li>
                      <li>• Advanced analytics</li>
                      <li>• Priority support</li>
                    </ul>
                    <button
                      onClick={() => handleUpgrade("pro", false)}
                      className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600"
                    >
                      Upgrade with Square
                    </button>
                    <button
                      onClick={() => handleUpgrade("pro", true)}
                      className="w-full mt-2 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
                    >
                      Start 30-Day Trial
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-2">Enterprise</h4>
                    <p className="text-3xl font-bold mb-4">
                      $75<span className="text-sm text-gray-600">/month</span>
                    </p>
                    <ul className="text-sm text-gray-600 space-y-2 mb-4">
                      <li>• Everything in Pro</li>
                      <li>• Lowest fees</li>
                      <li>• Custom storefront</li>
                      <li>• Dedicated support</li>
                    </ul>
                    <button
                      onClick={() => handleUpgrade("enterprise", false)}
                      className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
                    >
                      Contact Sales / Upgrade
                    </button>
                    <button
                      onClick={() => handleUpgrade("enterprise", true)}
                      className="w-full mt-2 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
                    >
                      Start Enterprise Trial
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
