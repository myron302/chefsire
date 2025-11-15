import React, { useState, useEffect } from "react";
import { Package, DollarSign, TrendingUp, ShoppingCart, Crown, Plus, Settings, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/contexts/UserContext";
import ThemeSelector from "@/components/store/ThemeSelector";

export default function SellerDashboard() {
  const { user } = useUser();
  const [stats, setStats] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [tier, setTier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState("modern");
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch store info
      const storeRes = await fetch(`/api/stores/user/${user!.id}`, {
        credentials: "include"
      });
      if (storeRes.ok) {
        const data = await storeRes.json();
        setStore(data.store);
        setSelectedTheme(data.store?.theme || "modern");
      }

      // Fetch seller analytics
      const statsRes = await fetch(`/api/marketplace/sellers/${user!.id}/analytics`, {
        credentials: "include"
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      // Fetch recent sales
      const salesRes = await fetch("/api/orders/my-sales?limit=10", {
        credentials: "include"
      });
      if (salesRes.ok) {
        const data = await salesRes.json();
        setSales(data.sales || []);
      }

      // Fetch subscription tier
      const tierRes = await fetch("/api/subscriptions/my-tier", {
        credentials: "include"
      });
      if (tierRes.ok) {
        const data = await tierRes.json();
        setTier(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (newTier: string) => {
    try {
      const response = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier: newTier })
      });

      if (response.ok) {
        alert(`Successfully upgraded to ${newTier}!`);
        fetchDashboardData(); // Refresh data
      } else {
        const error = await response.json();
        alert(`Failed to upgrade: ${error.error}`);
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("Failed to upgrade subscription");
    }
  };

  const handleThemeChange = async (themeId: string) => {
    setSelectedTheme(themeId);

    if (!store?.id) return;

    try {
      const response = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: themeId })
      });

      if (response.ok) {
        alert("Theme updated successfully!");
      } else {
        const error = await response.json();
        alert(`Failed to update theme: ${error.error}`);
      }
    } catch (error) {
      console.error("Theme update error:", error);
      alert("Failed to update theme");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const currentTier = tier?.currentTier || "free";
  const tierInfo = tier?.tierInfo;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Store Settings & Dashboard</h1>
          <p className="text-gray-600">Manage your subscription, customize your store, and track performance</p>
        </div>

        <Tabs defaultValue="subscription" className="space-y-6">
          <TabsList>
            <TabsTrigger value="subscription">
              <Crown className="h-4 w-4 mr-2" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="customization">
              <Palette className="h-4 w-4 mr-2" />
              Customization
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Subscription Tab */}
          <TabsContent value="subscription"  className="space-y-6">

        {/* Subscription Tier Card */}
        <Card className="mb-8 border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-orange-500" />
                <CardTitle>Subscription Tier: {tierInfo?.name || "Free"}</CardTitle>
              </div>
              <Badge className="bg-orange-500">{tierInfo?.commission}% Commission</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Features</h4>
                <ul className="space-y-1">
                  {tierInfo?.features.map((feature: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-green-600">✓</span> {feature}
                    </li>
                  ))}
                </ul>
              </div>
              {currentTier === "free" && (
                <div className="flex flex-col justify-center">
                  <h4 className="font-semibold mb-3">Upgrade to reduce commission</h4>
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleUpgrade("starter")}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Starter - $15/mo (8% commission)
                    </Button>
                    <Button
                      onClick={() => handleUpgrade("professional")}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Professional - $35/mo (5% commission)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Your latest orders and transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No sales yet</p>
                <p className="text-sm mt-2">Start by adding products to your store</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sales.map((sale) => (
                  <div key={sale.order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{sale.product.name}</p>
                        <p className="text-sm text-gray-600">
                          {sale.buyer.displayName || sale.buyer.username} • {sale.order.quantity}x
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(sale.order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        +${parseFloat(sale.order.sellerAmount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Fee: ${parseFloat(sale.order.platformFee).toFixed(2)}
                      </p>
                      <Badge variant={sale.order.status === "delivered" ? "default" : "secondary"}>
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

          {/* Customization Tab */}
          <TabsContent value="customization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Store Theme Customization</CardTitle>
                <CardDescription>Choose a theme that matches your brand and style</CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeSelector
                  selectedTheme={selectedTheme}
                  onSelectTheme={handleThemeChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.activeProducts || 0} active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalSales || 0}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${parseFloat(stats?.monthlyRevenue || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalViews || 0}</div>
                  <p className="text-xs text-muted-foreground">Product views</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
