import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Store, Package, DollarSign, TrendingUp, Eye, EyeOff, Globe,
  Edit, Plus, ShoppingCart, BarChart3,
  Crown, Palette, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { ProductManager } from "@/components/store/ProductManager";
import ThemeSelector from "@/components/store/ThemeSelector";
import StoreCustomization from "@/components/store/StoreCustomization";
import SubscriptionPlansModal from "@/components/store/SubscriptionPlansModal";
import StoreBuilder from "@/components/store/StoreBuilder";
import { getSellerMarketplaceProducts } from "@/lib/store/marketplaceApi";
import StoreRecentSalesList from "./components/StoreRecentSalesList";
import StoreDashboardStatsGrid from "./components/StoreDashboardStatsGrid";
import StoreDashboardBuilderTab from "./components/StoreDashboardBuilderTab";
import StoreDashboardAnalyticsTab from "./components/StoreDashboardAnalyticsTab";
import StoreDashboardSubscriptionTab from "./components/StoreDashboardSubscriptionTab";
import StoreDashboardQuickActions from "./components/StoreDashboardQuickActions";
import {
  buildSubscriptionCheckoutPayload,
  calculateTrialDaysLeft,
  DEFAULT_DASHBOARD_STATS,
  getInitialProductStats,
  getInitialStoreStats,
  isMissingPlanVariationError,
  type DashboardStats,
} from "./lib/storeDashboard";

export default function StoreDashboard() {
  const { user, updateUser } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [store, setStore] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_DASHBOARD_STATS);
  const [tier, setTier] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("modern");
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    if (user?.id) loadDashboard();
  }, [user?.id]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Load store
      const storeRes = await fetch(`/api/stores/user/${user!.id}`, { credentials: "include" });
      if (storeRes.ok) {
        const storeData = await storeRes.json();
        const s = storeData.store;
        setStore(s);
        if (s) setSelectedTheme(s.theme || "modern");

        if (s) {
          // Products
          let productStats = getInitialProductStats();
          try {
            const products = await getSellerMarketplaceProducts(user!.id, { credentials: "include" });
            productStats = {
              totalProducts: products.length,
              publishedProducts: products.filter((p: any) => p.isActive).length,
            };
          } catch {
            productStats = getInitialProductStats();
          }

          // Store stats
          const statsRes = await fetch(`/api/stores/${s.id}/stats`, { credentials: "include" });
          let storeStats = getInitialStoreStats();
          if (statsRes.ok) {
            const sd = await statsRes.json();
            storeStats = sd.stats || storeStats;
          }

          setStats({ ...productStats, totalViews: storeStats.totalViews, totalSales: storeStats.totalSales, revenue: storeStats.totalRevenue, monthlyRevenue: 0 });
        }
      }

      // Subscription tier
      const tierRes = await fetch("/api/subscriptions/my-tier", { credentials: "include" });
      if (tierRes.ok) {
        const td = await tierRes.json();
        setTier(td);
      }

      // Recent sales
      const salesRes = await fetch("/api/orders/my-sales?limit=10", { credentials: "include" });
      if (salesRes.ok) {
        const sd = await salesRes.json();
        setRecentSales(sd.sales || []);
      }
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!store) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/stores/${store.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ published: !store.published }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
        toast({
          title: data.store.published ? "Store Published" : "Store Unpublished",
          description: data.store.published
            ? "Your store is now visible to everyone!"
            : "Your store is now hidden from the public",
        });
      } else {
        toast({ title: "Error", description: "Failed to update store status", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleThemeChange = async (themeId: string) => {
    setSelectedTheme(themeId);
    if (!store?.id) return;
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: themeId }),
      });
      if (res.ok) {
        toast({ description: "Theme updated!" });
      } else {
        toast({ title: "Error", description: "Failed to update theme", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update theme", variant: "destructive" });
    }
  };

  const handleCustomizationUpdate = async (updates: any) => {
    if (!store?.id) return;
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
        toast({ description: "Store customization saved!" });
      } else {
        toast({ title: "Error", description: "Failed to save customization", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save customization", variant: "destructive" });
    }
  };

  const handleSubscriptionUpgrade = async (tierName: string, isTrial = false) => {
    if (!user) {
      toast({ title: "Not logged in", description: "Please log in to upgrade.", variant: "destructive" });
      return;
    }
    try {
      const resp = await fetch("/api/square/subscription-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildSubscriptionCheckoutPayload(tierName, isTrial, user),
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data?.url) {
        const errorMsg = data?.error || "Could not start checkout";
        if (isMissingPlanVariationError(errorMsg)) {
          toast({ title: "Coming soon", description: "Subscription service is being configured. Please check back later.", variant: "destructive" });
        } else {
          toast({ title: "Checkout error", description: errorMsg, variant: "destructive" });
        }
        return;
      }
      // Optimistically update local trial state before redirect
      if (isTrial) {
        const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        updateUser({ subscription: tierName as any, trialEndDate: trialEnds });
      }
      window.location.href = data.url; // Redirect to Square-hosted checkout
    } catch (e) {
      console.error("Square upgrade error:", e);
      toast({ title: "Checkout error", description: "There was a problem starting checkout. Please try again.", variant: "destructive" });
    }
  };

  if (showBuilder && store) {
    return <StoreBuilder storeId={store.id} onBack={() => setShowBuilder(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Store className="mx-auto w-12 h-12 text-orange-400 animate-pulse mb-3" />
          <p className="text-gray-500">Loading your store...</p>
        </div>
      </div>
    );
  }

  // No store yet
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">No Store Yet</h1>
          <p className="text-gray-500 mb-6">
            Create your storefront to start selling your products to the ChefSire community.
          </p>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setLocation("/store/create")}
          >
            <Plus className="mr-2 w-4 h-4" />
            Create Your Store
          </Button>
        </div>
      </div>
    );
  }

  const currentTier = tier?.currentTier || user?.subscription || "free";
  const tierInfo = tier?.tierInfo;
  const trialDaysLeft = calculateTrialDaysLeft(user?.trialEndDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Store Dashboard</h1>
              <p className="text-gray-500 mt-1">{store.name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/store/${store.handle}`}>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-1.5" />
                  View Store
                </Button>
              </Link>
              <Button
                onClick={handleTogglePublish}
                disabled={publishing}
                size="sm"
                variant={store.published ? "outline" : "default"}
                className={!store.published ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {store.published ? (
                  <><EyeOff className="w-4 h-4 mr-1.5" />Unpublish</>
                ) : (
                  <><Globe className="w-4 h-4 mr-1.5" />Publish Store</>
                )}
              </Button>
            </div>
          </div>

          {/* Status Row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant={store.published ? "default" : "secondary"} className={store.published ? "bg-green-600" : ""}>
              {store.published ? "Published" : "Draft"}
            </Badge>
            <Badge variant="outline" className="capitalize">
              <Crown className="w-3 h-3 mr-1" />
              {currentTier} plan
            </Badge>
            {trialDaysLeft > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Trial: {trialDaysLeft} days left
              </Badge>
            )}
            <span className="text-sm text-gray-400">
              chefsire.com/store/{store.handle}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <StoreDashboardStatsGrid stats={stats} />

        {/* Main Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="products">
              <Package className="w-4 h-4 mr-1.5" />Products
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="w-4 h-4 mr-1.5" />Orders
            </TabsTrigger>
            <TabsTrigger value="builder">
              <Edit className="w-4 h-4 mr-1.5" />Store Builder
            </TabsTrigger>
            <TabsTrigger value="customize">
              <Sparkles className="w-4 h-4 mr-1.5" />Customize
            </TabsTrigger>
            <TabsTrigger value="theme">
              <Palette className="w-4 h-4 mr-1.5" />Theme
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-1.5" />Analytics
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <Crown className="w-4 h-4 mr-1.5" />Subscription
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Product Management</CardTitle>
                    <CardDescription>Manage your store's product listings</CardDescription>
                  </div>
                  <Link href="/store/products/new">
                    <Button className="bg-orange-500 hover:bg-orange-600">
                      <Plus className="w-4 h-4 mr-1.5" />
                      {stats.totalProducts === 0 ? "Add First Product" : "Add Product"}
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <ProductManager sellerId={user!.id} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Orders placed by your customers</CardDescription>
              </CardHeader>
              <CardContent>
                <StoreRecentSalesList recentSales={recentSales} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Store Builder Tab */}
          <TabsContent value="builder">
            <StoreDashboardBuilderTab onOpenBuilder={() => setShowBuilder(true)} />
          </TabsContent>

          {/* Customize Tab */}
          <TabsContent value="customize">
            <Card>
              <CardHeader>
                <CardTitle>Store Customization</CardTitle>
                <CardDescription>Branding, banner, about section, social links, and layout</CardDescription>
              </CardHeader>
              <CardContent>
                <StoreCustomization store={store} onUpdate={handleCustomizationUpdate} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme Tab */}
          <TabsContent value="theme">
            <Card>
              <CardHeader>
                <CardTitle>Store Theme</CardTitle>
                <CardDescription>Choose a pre-designed colour theme for your storefront</CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeSelector selectedTheme={selectedTheme} onSelectTheme={handleThemeChange} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <StoreDashboardAnalyticsTab stats={stats} />
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <StoreDashboardSubscriptionTab
              currentTier={currentTier}
              tierInfo={tierInfo}
              trialDaysLeft={trialDaysLeft}
              onUpgrade={handleSubscriptionUpgrade}
            />
          </TabsContent>
        </Tabs>

        {/* Quick Action Cards */}
        <StoreDashboardQuickActions
          storeHandle={store.handle}
          onCustomerInsightsClick={() =>
            toast({ title: "Coming Soon", description: "Customer insights will be available in a future update" })
          }
        />
      </div>

      {/* Subscription Plans Modal */}
      {showPlansModal && (
        <SubscriptionPlansModal
          onClose={() => setShowPlansModal(false)}
          redirectAfter="/store/dashboard"
        />
      )}
    </div>
  );
}
