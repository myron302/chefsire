import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Package, ShoppingCart, Edit, Sparkles, Palette, BarChart3, Crown,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import SubscriptionPlansModal from "@/components/store/SubscriptionPlansModal";
import StoreBuilder from "@/components/store/StoreBuilder";
import { getSellerMarketplaceProducts } from "@/lib/store/marketplaceApi";
import StoreDashboardStatsGrid from "./components/StoreDashboardStatsGrid";
import StoreDashboardBuilderTab from "./components/StoreDashboardBuilderTab";
import StoreDashboardAnalyticsTab from "./components/StoreDashboardAnalyticsTab";
import StoreDashboardSubscriptionTab from "./components/StoreDashboardSubscriptionTab";
import StoreDashboardQuickActions from "./components/StoreDashboardQuickActions";
import StoreDashboardLoadingState from "./components/StoreDashboardLoadingState";
import StoreDashboardEmptyState from "./components/StoreDashboardEmptyState";
import StoreDashboardHeader from "./components/StoreDashboardHeader";
import StoreDashboardProductsTab from "./components/StoreDashboardProductsTab";
import StoreDashboardOrdersTab from "./components/StoreDashboardOrdersTab";
import StoreDashboardCustomizeTab from "./components/StoreDashboardCustomizeTab";
import StoreDashboardThemeTab from "./components/StoreDashboardThemeTab";
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
    return <StoreDashboardLoadingState />;
  }

  // No store yet
  if (!store) {
    return <StoreDashboardEmptyState onCreateStore={() => setLocation("/store/create")} />;
  }

  const currentTier = tier?.currentTier || user?.subscription || "free";
  const tierInfo = tier?.tierInfo;
  const trialDaysLeft = calculateTrialDaysLeft(user?.trialEndDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <StoreDashboardHeader
          storeName={store.name}
          storeHandle={store.handle}
          published={store.published}
          currentTier={currentTier}
          trialDaysLeft={trialDaysLeft}
          publishing={publishing}
          onTogglePublish={handleTogglePublish}
        />

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
            <StoreDashboardProductsTab sellerId={user!.id} totalProducts={stats.totalProducts} />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <StoreDashboardOrdersTab recentSales={recentSales} />
          </TabsContent>

          {/* Store Builder Tab */}
          <TabsContent value="builder">
            <StoreDashboardBuilderTab onOpenBuilder={() => setShowBuilder(true)} />
          </TabsContent>

          {/* Customize Tab */}
          <TabsContent value="customize">
            <StoreDashboardCustomizeTab store={store} onUpdate={handleCustomizationUpdate} />
          </TabsContent>

          {/* Theme Tab */}
          <TabsContent value="theme">
            <StoreDashboardThemeTab selectedTheme={selectedTheme} onSelectTheme={handleThemeChange} />
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
