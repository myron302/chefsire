// client/src/pages/marketplace/Marketplace.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Search, Filter, ShoppingCart, Star, MapPin, Package, Plus, TrendingUp, Users, DollarSign, Eye, Globe2, Save, Share2 } from "lucide-react";
import { Button as UIButton } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";

// Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_replace_me");

// ---- CraftJS basic components (same as StoreViewer) ----
const Container = ({ children }) => <div className="p-4 border border-gray-200 rounded">{children}</div>;
const Text = ({ text }) => <p className="text-gray-800">{text}</p>;
const Banner = () => (
  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg">
    <h3>Welcome to My Culinary Store!</h3>
  </div>
);
const ProductCard = ({ product }) => (
  <UICard className="w-64">
    <div className="p-4">
      <h4 className="font-semibold">{product?.name ?? "Sample Product"}</h4>
      <p className="text-gray-600">${product?.price ?? 9.99}</p>
      <UIButton className="mt-3">Add to Cart</UIButton>
    </div>
  </UICard>
);
const resolver = { Container, Text, Banner, ProductCard };

type Store = {
  id: string;
  userId: string;
  handle: string;
  name: string;
  bio: string;
  theme: Record<string, unknown>;
  layout: unknown | null;
  published: boolean;
};

const customRenderNode = ({ render }) => (
  <div className="relative group">
    {render}
    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100">
      <UIButton size="sm" variant="outline">Edit</UIButton>
    </div>
  </div>
);

// ---------------- Store Builder ----------------
function StoreBuilder({ onBack }: { onBack: () => void }) {
  const { user } = useUser();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const { actions, query } = useEditor((state) => ({ json: state }));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Load (or create) store for this user
        const res = await fetch(`/api/stores/by-user/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (!data.store) {
            // auto-create a starter store
            const create = await fetch(`/api/stores`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-user-id": user.id },
              body: JSON.stringify({
                name: user.displayName ? `${user.displayName}'s Store` : "My Store",
                bio: "",
              }),
            });
            const created = await create.json();
            if (mounted) setStore(created.store);
          } else if (mounted) {
            setStore(data.store);
          }
        }
      } catch (e) {
        console.error("load store", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user.id]);

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    try {
      // Get CraftJS serialized JSON
      const json = query.serialize();
      const res = await fetch(`/api/stores/${store.id}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ layout: json }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch (e) {
      console.error("save layout", e);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (published: boolean) => {
    if (!store) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/stores/${store.id}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ published }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch (e) {
      console.error("publish", e);
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Preparing your store…
      </div>
    );
  }

  const previewHref = `/store/${store.handle}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={onBack} className="text-gray-600 hover:text-gray-900 mb-2 flex items-center">
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Store Builder</h1>
            <p className="text-gray-600">Drag & drop your storefront. Save, publish, and share.</p>
          </div>
          <div className="flex gap-2">
            <Link href={previewHref}>
              <UIButton variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" /> Preview
              </UIButton>
            </Link>
            <UIButton onClick={handleSave} className="bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-2" disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
            </UIButton>
            <UIButton
              onClick={() => handlePublish(!store.published)}
              className="flex items-center gap-2"
              variant={store.published ? "outline" : undefined}
              disabled={publishing}
            >
              <Globe2 className="w-4 h-4" />
              {publishing ? "Updating…" : store.published ? "Unpublish" : "Publish"}
            </UIButton>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: Palette */}
          <div className="col-span-12 md:col-span-3">
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-bold mb-4">Elements</h2>
              <div className="space-y-2">
                <Element is={Container} canvas>
                  <UIButton variant="ghost" className="w-full">Container</UIButton>
                </Element>
                <Element is={Text} text="Your text" canvas>
                  <UIButton variant="ghost" className="w-full">Text</UIButton>
                </Element>
                <Element is={Banner} canvas>
                  <UIButton variant="ghost" className="w-full">Banner</UIButton>
                </Element>
                <Element is={ProductCard} product={{ name: "Sample", price: 9.99 }} canvas>
                  <UIButton variant="ghost" className="w-full">Product Card</UIButton>
                </Element>
              </div>
            </div>
          </div>

          {/* Right: Canvas */}
          <div className="col-span-12 md:col-span-9">
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-bold mb-4">Live Preview</h2>
              <Editor resolver={resolver} onRender={customRenderNode}>
                <Frame json={store.layout}>
                  <Element is={Container} canvas className="min-h-[520px] border border-dashed border-gray-300">
                    <Text text="Drop elements here to build your store" />
                  </Element>
                </Frame>
              </Editor>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Marketplace (browse/sell) ----------------
function Marketplace() {
  const { user } = useUser();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"browse" | "sell" | "builder">("browse");

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
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeCategory !== "all") params.append("category", activeCategory);
        if (searchQuery) params.append("query", searchQuery);

        const res = await fetch(`/api/marketplace/products?${params}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products ?? []);
        }
      } catch (e) {
        console.error("products", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/marketplace/categories`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories ?? {});
        }
      } catch (e) {
        console.error("categories", e);
      }
    })();
  }, []);

  if (view === "builder") {
    return <StoreBuilder onBack={() => setView("sell")} />;
  }

  if (view === "sell") {
    return (
      <SellerDashboard
        onBack={() => setView("browse")}
        onOpenBuilder={() => setView("builder")}
      />
    );
  }

  const formatPrice = (price: number | string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(price));

  const getShippingInfo = (product: any) => {
    if (product.shippingEnabled && product.localPickupEnabled) return "Shipping & Pickup Available";
    if (product.shippingEnabled) return "Shipping Available";
    if (product.localPickupEnabled) return "Local Pickup Only";
    return "Contact Seller";
    };

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
            <div className="flex gap-3">
              {/* My Store shortcut */}
              <Link href="/store/me">
                <UIButton variant="outline" className="hidden md:inline-flex">My Store</UIButton>
              </Link>
              <UIButton onClick={() => setView("sell")} className="bg-orange-500 text-white hover:bg-orange-600 flex items-center">
                <Plus className="w-4 h-4 mr-2" /> Start Selling
              </UIButton>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <Package className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {Object.values(categories).reduce((a, b) => a + (b || 0), 0)}
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for ingredients, tools, or sellers..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center">
              <Filter className="w-4 h-4 mr-2" /> Filters
            </button>
          </div>

          {/* Categories */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {[
              ...categoryList,
            ].map((category) => (
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
                  <span className="text-xs bg-black/20 rounded-full px-2 py-0.5">
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery ? `No products match "${searchQuery}"` : "No products in this category yet"}
            </p>
            <UIButton onClick={() => setView("sell")} className="bg-orange-500 text-white hover:bg-orange-600">
              Be the first to sell here
            </UIButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
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
                      <p className="text-xl font-bold text-orange-600">
                        {formatPrice(product.price)}
                      </p>
                      {product.shippingCost && (
                        <p className="text-xs text-gray-500">+{formatPrice(product.shippingCost)} shipping</p>
                      )}
                    </div>
                  </div>

                  {product.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">4.8 (12)</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full capitalize">
                      {product.category}
                    </span>
                  </div>

                  <div className="flex items-center text-xs text-gray-500 mb-4">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span>{getShippingInfo(product)}</span>
                  </div>

                  <div className="flex gap-2">
                    <UIButton className="flex-1 bg-orange-500 text-white hover:bg-orange-600">
                      <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                    </UIButton>
                    <UIButton variant="outline">
                      <Star className="w-4 h-4" />
                    </UIButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------- Seller Dashboard ---------------
function SellerDashboard({ onBack, onOpenBuilder }: { onBack: () => void; onOpenBuilder: () => void }) {
  const { user, updateUser } = useUser();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "analytics" | "store-builder" | "subscription">("products");
  const [showUpgradeModal, setShowUpgradeModal] = useState(user.subscription === "free" || (user.trialEndDate && new Date(user.trialEndDate) < new Date()));

  const handleUpgrade = async (tier: "pro" | "enterprise", isTrial = false) => {
    const stripe = await stripePromise;
    const response = await fetch("/api/stripe/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, userId: user.id, isTrial }),
    });
    if (isTrial) {
      updateUser({ ...user, subscription: tier, trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    } else {
      const { sessionId } = await response.json();
      await stripe?.redirectToCheckout({ sessionId });
    }
  };

  const canAddProduct = user.subscription !== "free" || user.productCount < 5;
  const trialDaysLeft = user.trialEndDate ? Math.ceil((new Date(user.trialEndDate).getTime() - Date.now()) / 86400000) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={onBack} className="text-gray-600 hover:text-gray-900 mb-4 flex items-center">← Back to Marketplace</button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Seller Dashboard</h1>
            <p className="text-gray-600">Manage your products and track your sales</p>
          </div>
          <UIButton className="bg-orange-500 text-white hover:bg-orange-600 flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </UIButton>
        </div>

        {/* Trial modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md">
              <h3 className="text-xl font-bold mb-4">Start Your 30-Day Trial</h3>
              <p className="mb-4">Try Pro features free for 30 days. No card required.</p>
              <div className="flex gap-4">
                <UIButton onClick={() => handleUpgrade("pro", true)} className="bg-orange-500 text-white">Start 30-Day Trial</UIButton>
                <UIButton variant="outline" onClick={() => setShowUpgradeModal(false)}>Later</UIButton>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard icon={Package} title="Active Products" value="12" delta="+2 this month" />
          <StatCard icon={DollarSign} title="Monthly Revenue" value="$1,245" delta="+18% from last month" />
          <StatCard icon={TrendingUp} title="Total Views" value="3,241" delta="+5% this week" />
          <StatCard icon={Star} title="Avg Rating" value="4.9" delta="From 23 reviews" />
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: "products", name: "My Products", count: 12 },
                { id: "orders", name: "Orders", count: 5 },
                { id: "analytics", name: "Analytics" },
                { id: "store-builder", name: "Store Builder" },
                { id: "subscription", name: "Subscription" },
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
                  {tab.count && <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">{tab.count}</span>}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "products" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Your Products</h3>
                  <UIButton className="bg-orange-500 text-white hover:bg-orange-600">Add New Product</UIButton>
                </div>
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Your products will appear here once you start selling</p>
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Orders from customers will appear here</p>
              </div>
            )}

            {activeTab === "store-builder" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Build Your Store</h3>
                <UIButton onClick={onOpenBuilder} className="bg-orange-500 text-white hover:bg-orange-600">
                  Launch Store Builder
                </UIButton>
                <Link href="/store/me">
                  <UIButton variant="outline" className="ml-2">View My Store</UIButton>
                </Link>
              </div>
            )}

            {activeTab === "subscription" && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-6">Seller Subscription</h3>
                {user.trialEndDate && <p className="mb-4 text-green-600">Trial active - Ends in {trialDaysLeft} days</p>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <PlanCard title="Free" price="$0" features={["Up to 5 products", "10% commission fee", "Basic analytics"]} button="Current Plan" />
                  <PlanCard
                    title="Professional"
                    price="$35"
                    recommended
                    features={["Unlimited products", "5% commission fee", "Advanced analytics", "Priority support"]}
                    onClick={() => handleUpgrade("pro")}
                    button="Upgrade Now"
                  />
                  <PlanCard
                    title="Enterprise"
                    price="$75"
                    features={["Everything in Pro", "3% commission fee", "Custom storefront", "Dedicated support"]}
                    onClick={() => handleUpgrade("enterprise")}
                    button="Learn More"
                    outline
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, delta }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center">
        <div className="p-3 bg-gray-100 rounded-lg mr-4">
          <Icon className="w-6 h-6 text-gray-700" />
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-600">{delta}</p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ title, price, features, recommended, onClick, button, outline }: any) {
  return (
    <div className={`${recommended ? "border-2 border-orange-500" : "border"} ${outline ? "border-gray-300" : "border-gray-200"} rounded-lg p-6 relative`}>
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-full text-xs">
          Recommended
        </div>
      )}
      <h4 className="text-lg font-semibold mb-2">{title}</h4>
      <p className="text-3xl font-bold mb-4">
        {price}
        <span className="text-sm text-gray-600">/month</span>
      </p>
      <ul className="text-sm text-gray-600 space-y-2 mb-4">
        {features.map((f: string) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
      <UIButton onClick={onClick} className={outline ? "" : "bg-orange-500 text-white hover:bg-orange-600"} variant={outline ? "outline" : undefined} >
        {button}
      </UIButton>
    </div>
  );
}

export default Marketplace;
