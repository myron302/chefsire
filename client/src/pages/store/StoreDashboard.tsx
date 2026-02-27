import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Store, Package, DollarSign, TrendingUp, Eye, EyeOff, Globe,
  Settings, Edit, Plus, ShoppingCart, BarChart3, Users, AlertCircle,
  Crown, Palette, Sparkles, ArrowLeft,
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

interface DashboardStats {
  totalProducts: number;
  publishedProducts: number;
  totalViews: number;
  totalSales: number;
  revenue: number;
  monthlyRevenue: number;
}

export default function StoreDashboard() {
  const { user, updateUser } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [store, setStore] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    publishedProducts: 0,
    totalViews: 0,
    totalSales: 0,
    revenue: 0,
    monthlyRevenue: 0,
  });
  const [tier, setTier] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("modern");
  const [showPlansModal, setShowPlansModal] = useState(false);

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
          const productsRes = await fetch(`/api/marketplace/sellers/${user!.id}/products`, { credentials: "include" });
          let productStats = { totalProducts: 0, publishedProducts: 0 };
          if (productsRes.ok) {
            const pd = await productsRes.json();
            const products = pd.products || [];
            productStats = {
              totalProducts: products.length,
              publishedProducts: products.filter((p: any) => p.isActive).length,
            };
          }

          // Store stats
          const statsRes = await fetch(`/api/stores/${s.id}/stats`, { credentials: "include" });
          let storeStats = { totalViews: 0, totalSales: 0, totalRevenue: 0 };
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

  const handleSubscriptionUpgrade = async (tierName: string) => {
    try {
      const res = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier: tierName }),
      });
      if (res.ok) {
        toast({ description: `Upgraded to ${tierName}!` });
        loadDashboard();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Upgrade failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Upgrade failed", variant: "destructive" });
    }
  };

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
  const trialDaysLeft = user?.trialEndDate
    ? Math.max(0, Math.ceil((new Date(user.trialEndDate).getTime() - Date.now()) / 86400000))
    : 0;

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Products", value: stats.totalProducts, sub: `${stats.publishedProducts} published`, icon: Package, iconClass: "text-orange-500 bg-orange-100" },
            { label: "Store Views", value: stats.totalViews, sub: "+12% this week", icon: Eye, iconClass: "text-blue-500 bg-blue-100" },
            { label: "Total Sales", value: stats.totalSales, sub: "All time", icon: ShoppingCart, iconClass: "text-green-500 bg-green-100" },
            { label: "Revenue", value: `$${Number(stats.revenue).toLocaleString()}`, sub: "All time", icon: DollarSign, iconClass: "text-purple-500 bg-purple-100" },
          ].map(({ label, value, sub, icon: Icon, iconClass }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
                <div className={`p-1.5 rounded-lg ${iconClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="products">
              <Package className="w-4 h-4 mr-1.5" />Products
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="w-4 h-4 mr-1.5" />Orders
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
                {recentSales.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="font-medium">No orders yet</p>
                    <p className="text-sm mt-1">Orders will appear here when customers make purchases</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentSales.map((sale) => (
                      <div key={sale.order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{sale.product.name}</p>
                            <p className="text-xs text-gray-500">
                              {sale.buyer.displayName || sale.buyer.username} · {sale.order.quantity}x ·{" "}
                              {new Date(sale.order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600 text-sm">
                            +${parseFloat(sale.order.sellerAmount).toFixed(2)}
                          </p>
                          <Badge variant={sale.order.status === "delivered" ? "default" : "secondary"} className="text-xs mt-0.5">
                            {sale.order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Products", value: stats.totalProducts, sub: `${stats.publishedProducts} active`, icon: Package },
                { label: "Total Sales", value: stats.totalSales, sub: "All time", icon: ShoppingCart },
                { label: "Monthly Revenue", value: `$${Number(stats.monthlyRevenue).toFixed(2)}`, sub: "This month", icon: DollarSign },
                { label: "Total Views", value: stats.totalViews, sub: "Product views", icon: TrendingUp },
              ].map(({ label, value, sub, icon: Icon }) => (
                <Card key={label}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
                    <Icon className="w-4 h-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{value}</div>
                    <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="py-16 text-center text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium">Detailed analytics coming soon</p>
                <p className="text-sm mt-1">Track your store performance and customer insights over time</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            {/* Current Plan Banner */}
            <Card className="mb-6 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Crown className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle>Current Plan: {tierInfo?.name || currentTier}</CardTitle>
                      {trialDaysLeft > 0 && (
                        <p className="text-sm text-orange-600 mt-0.5">Trial active · {trialDaysLeft} days remaining</p>
                      )}
                    </div>
                  </div>
                  {tierInfo?.commission !== undefined && (
                    <Badge className="bg-orange-500">{tierInfo.commission}% commission</Badge>
                  )}
                </div>
              </CardHeader>
              {tierInfo?.features && (
                <CardContent>
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    {tierInfo.features.map((f: string, i: number) => (
                      <span key={i} className="text-sm text-gray-700 flex items-center gap-1.5">
                        <span className="text-green-500">✓</span> {f}
                      </span>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Upgrade Plans */}
            <Card>
              <CardHeader>
                <CardTitle>Available Plans</CardTitle>
                <CardDescription>Upgrade to reduce commission fees and unlock more features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: "starter", name: "Starter", price: 15, commission: "8%", features: ["Up to 100 products", "Custom branding", "Basic analytics"] },
                    { id: "professional", name: "Professional", price: 35, commission: "5%", features: ["Unlimited products", "Advanced analytics", "Priority support"], popular: true },
                    { id: "enterprise", name: "Enterprise", price: 75, commission: "2%", features: ["Everything in Pro", "White-label", "Dedicated support"] },
                  ].map((plan) => (
                    <div key={plan.id} className={`relative border-2 rounded-xl p-5 ${plan.popular ? "border-orange-500" : "border-gray-200"}`}>
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-orange-500">Recommended</Badge>
                        </div>
                      )}
                      <h4 className="font-bold mb-1">{plan.name}</h4>
                      <div className="text-2xl font-bold mb-1">
                        ${plan.price}<span className="text-sm text-gray-500 font-normal">/mo</span>
                      </div>
                      <p className="text-sm text-green-600 font-medium mb-3">{plan.commission} commission</p>
                      <ul className="space-y-1 mb-4">
                        {plan.features.map((f, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-center gap-1.5">
                            <span className="text-green-500">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={() => handleSubscriptionUpgrade(plan.id)}
                        className={`w-full ${plan.popular ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                        variant={plan.popular ? "default" : "outline"}
                        disabled={currentTier === plan.id}
                      >
                        {currentTier === plan.id ? "Current Plan" : `Upgrade to ${plan.name}`}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Action Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/store/products/new">
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="pt-5">
                <Package className="text-orange-500 mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold mb-1">Add a Product</h3>
                <p className="text-sm text-gray-500">List a new item in your store</p>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/store/${store.handle}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="pt-5">
                <Eye className="text-blue-500 mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold mb-1">View Your Store</h3>
                <p className="text-sm text-gray-500">See how customers see your storefront</p>
              </CardContent>
            </Card>
          </Link>
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => toast({ title: "Coming Soon", description: "Customer insights will be available in a future update" })}
          >
            <CardContent className="pt-5">
              <Users className="text-purple-500 mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Customer Insights</h3>
              <p className="text-sm text-gray-500">Analytics and customer behaviour — coming soon</p>
            </CardContent>
          </Card>
        </div>
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
