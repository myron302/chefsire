// client/src/components/AnalyticsDashboard.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Flame,
  Apple,
  Award,
  Download,
  Calendar,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";

type DashboardData = {
  today: any;
  week: any;
  month: any;
  allTime: any;
  tasteProfile: any;
  recentActivity: any[];
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function AnalyticsDashboard() {
  const { user } = useUser();
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/analytics/dashboard"],
    queryFn: () => fetchJSON<DashboardData>("/api/analytics/dashboard"),
    enabled: !!user,
  });

  const { data: nutritionTrends } = useQuery({
    queryKey: ["/api/analytics/nutrition-trends", timeRange],
    queryFn: () => fetchJSON(`/api/analytics/nutrition-trends?days=${timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365}`),
    enabled: !!user,
  });

  const { data: categoryData } = useQuery({
    queryKey: ["/api/analytics/category-breakdown", timeRange],
    queryFn: () => fetchJSON(`/api/analytics/category-breakdown?days=${timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365}`),
    enabled: !!user,
  });

  const { data: ingredientData } = useQuery({
    queryKey: ["/api/analytics/ingredient-usage"],
    queryFn: () => fetchJSON("/api/analytics/ingredient-usage?limit=10"),
    enabled: !!user,
  });

  const { data: costData } = useQuery({
    queryKey: ["/api/analytics/cost-analysis", timeRange],
    queryFn: () => fetchJSON(`/api/analytics/cost-analysis?days=${timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365}`),
    enabled: !!user,
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p>Please log in to view your analytics</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-48 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const week = dashboardData?.week || {};
  const month = dashboardData?.month || {};
  const allTime = dashboardData?.allTime || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track your culinary journey</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        <Button
          variant={timeRange === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeRange("week")}
        >
          7 Days
        </Button>
        <Button
          variant={timeRange === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeRange("month")}
        >
          30 Days
        </Button>
        <Button
          variant={timeRange === "year" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeRange("year")}
        >
          1 Year
        </Button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Recipes This Week"
          value={week.recipes_this_week || 0}
          icon={<Apple className="h-5 w-5" />}
          change="+12%"
          positive
        />
        <StatCard
          title="Total Calories"
          value={`${(week.calories_this_week || 0).toLocaleString()}`}
          icon={<Flame className="h-5 w-5" />}
          subtitle="this week"
        />
        <StatCard
          title="Avg Cost/Recipe"
          value={`$${(costData?.avgCostPerRecipe || 0).toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5" />}
          change="-5%"
          positive
        />
        <StatCard
          title="Current Streak"
          value={`${allTime.longest_streak || 0} days`}
          icon={<Award className="h-5 w-5" />}
          subtitle="longest streak"
        />
      </div>

      {/* Nutrition Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Nutrition Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nutritionTrends?.trends && nutritionTrends.trends.length > 0 ? (
            <NutritionChart data={nutritionTrends.trends} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No nutrition data available yet. Start tracking your recipes!
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Recipe Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData?.categories && Object.keys(categoryData.categories).length > 0 ? (
              <CategoryBreakdown categories={categoryData.categories} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No category data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Most Used Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            {ingredientData?.topIngredients && ingredientData.topIngredients.length > 0 ? (
              <div className="space-y-3">
                {ingredientData.topIngredients.map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="text-sm font-medium w-8 text-center">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.count} times
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${(item.count / ingredientData.topIngredients[0].count) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No ingredient data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
                <p className="text-2xl font-bold">
                  ${costData.totalSpent?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Avg Per Recipe</p>
                <p className="text-2xl font-bold">
                  ${costData.avgCostPerRecipe?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Recipes</p>
                <p className="text-2xl font-bold">{costData.totalRecipes || 0}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No cost data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Taste Profile */}
      {dashboardData?.tasteProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Your Taste Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <TasteProfileRadar profile={dashboardData.tasteProfile} />
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.recentActivity.slice(0, 10).map((activity: any) => (
                <div
                  key={activity.date}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.total_recipes_made} recipes made
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {activity.total_calories} cal
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.total_protein}g protein
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  change,
  positive,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  positive?: boolean;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
        </div>
        <p className="text-2xl font-bold mb-1">{value}</p>
        {change && (
          <div className="flex items-center gap-1 text-sm">
            {positive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={positive ? "text-green-500" : "text-red-500"}>
              {change}
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function NutritionChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const maxCalories = Math.max(...data.map((d) => d.total_calories || 0));

  return (
    <div className="space-y-4">
      {/* Simple bar chart */}
      <div className="flex items-end gap-2 h-48">
        {data.slice(-14).map((day, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full bg-muted rounded-t overflow-hidden flex-1">
              <div
                className="absolute bottom-0 w-full bg-primary transition-all"
                style={{
                  height: `${((day.total_calories || 0) / maxCalories) * 100}%`,
                }}
                title={`${day.total_calories} calories`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {new Date(day.date).toLocaleDateString('en', { month: 'numeric', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded-full" />
          <span>Calories</span>
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({ categories }: { categories: Record<string, number> }) {
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
  ];

  return (
    <div className="space-y-3">
      {entries.slice(0, 6).map(([category, count], index) => {
        const percentage = (count / total) * 100;
        return (
          <div key={category}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium capitalize">{category}</span>
              <span className="text-sm text-muted-foreground">
                {count} ({percentage.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[index % colors.length]} transition-all`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TasteProfileRadar({ profile }: { profile: any }) {
  const tastes = [
    { name: "Sweet", score: profile.sweet_score || 50 },
    { name: "Salty", score: profile.salty_score || 50 },
    { name: "Sour", score: profile.sour_score || 50 },
    { name: "Bitter", score: profile.bitter_score || 50 },
    { name: "Umami", score: profile.umami_score || 50 },
    { name: "Spicy", score: profile.spicy_score || 50 },
  ];

  return (
    <div className="space-y-4">
      {tastes.map((taste) => (
        <div key={taste.name}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{taste.name}</span>
            <span className="text-sm text-muted-foreground">{taste.score}/100</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all"
              style={{ width: `${taste.score}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-4">
        Profile confidence: {(parseFloat(profile.profile_confidence || 0) * 100).toFixed(0)}%
      </p>
    </div>
  );
}

export default AnalyticsDashboard;
