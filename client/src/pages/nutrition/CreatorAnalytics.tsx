import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, ShoppingBag, Star, Calendar } from "lucide-react";

type AnalyticsData = {
  totals: {
    totalSales: number;
    totalRevenue: string;
  };
  daily: Array<{
    date: string;
    sales: number;
    revenue: string;
  }>;
  topPlans: Array<{
    blueprint: {
      id: string;
      title: string;
      price: string;
      salesCount: number;
    };
    totalRevenue: string;
  }>;
};

export default function CreatorAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/analytics", {
        credentials: "include",
      });

      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-center text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <TrendingUp className="w-8 h-8 text-blue-500" />
          Creator Analytics
        </h1>
        <p className="text-muted-foreground">Track your meal plan performance and revenue</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${parseFloat(data.totals.totalRevenue || "0").toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All-time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totals.totalSales}</div>
            <p className="text-xs text-muted-foreground mt-1">Plans sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
            <Star className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {data.totals.totalSales > 0
                ? (parseFloat(data.totals.totalRevenue) / data.totals.totalSales).toFixed(2)
                : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Plans */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Top Performing Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topPlans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sales data yet</p>
          ) : (
            <div className="space-y-4">
              {data.topPlans.map((plan, index) => (
                <div
                  key={plan.blueprint.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-muted-foreground w-8">
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold">{plan.blueprint.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {plan.blueprint.salesCount} sales at ${plan.blueprint.price} each
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      ${parseFloat(plan.totalRevenue).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total revenue</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.daily.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No recent sales</p>
          ) : (
            <div className="space-y-2">
              {data.daily.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {day.date ? new Date(day.date).toLocaleDateString() : "Unknown date"}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-sm text-muted-foreground">
                      {day.sales} {day.sales === 1 ? "sale" : "sales"}
                    </span>
                    <span className="font-semibold text-green-600">
                      ${parseFloat(day.revenue || "0").toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
