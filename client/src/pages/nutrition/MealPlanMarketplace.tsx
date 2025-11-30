import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Search, Filter, DollarSign, Calendar, Star, TrendingUp, ChefHat, Users } from "lucide-react";

type MealPlanListing = {
  blueprint: {
    id: string;
    title: string;
    description: string | null;
    price: string;
    duration: number;
    difficulty: string | null;
    dietType: string | null;
    coverImage: string | null;
    salesCount: number;
    createdAt: string;
  };
  creator: {
    id: string;
    username: string;
    displayName: string;
  };
  avgRating: number;
  reviewCount: number;
};

export default function MealPlanMarketplace() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [plans, setPlans] = useState<MealPlanListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  useEffect(() => {
    fetchPlans();
  }, [search, difficulty, sortBy, minPrice, maxPrice]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (difficulty && difficulty !== "all") params.set("difficulty", difficulty);
      if (sortBy) params.set("sort", sortBy);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);

      const response = await fetch(`/api/meal-plans?${params.toString()}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId: string, price: string) => {
    try {
      const response = await fetch(`/api/meal-plans/${planId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentMethod: "stripe" }),
      });

      if (response.ok) {
        toast({
          title: "Purchase successful!",
          description: "Your meal plan is now available in your library",
        });
        setLocation("/nutrition/my-purchases");
      } else {
        const data = await response.json();
        toast({
          title: "Purchase failed",
          description: data.message || "Failed to purchase meal plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process purchase",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <ShoppingCart className="w-8 h-8 text-green-500" />
          Meal Plan Marketplace
        </h1>
        <p className="text-muted-foreground">Browse and purchase curated meal plans from top creators</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search meal plans..."
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="all">All Difficulties</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min $"
                className="w-20"
              />
              <Input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max $"
                className="w-20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading meal plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ChefHat className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No meal plans found</h3>
            <p className="text-muted-foreground">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.blueprint.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                {/* Cover Image */}
                {plan.blueprint.coverImage ? (
                  <img
                    src={plan.blueprint.coverImage}
                    alt={plan.blueprint.title}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg mb-4 flex items-center justify-center">
                    <ChefHat className="w-16 h-16 text-green-600 opacity-50" />
                  </div>
                )}

                {/* Title & Creator */}
                <h3 className="text-lg font-semibold mb-1">{plan.blueprint.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  by {plan.creator.displayName || plan.creator.username}
                </p>

                {/* Description */}
                {plan.blueprint.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {plan.blueprint.description}
                  </p>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {plan.blueprint.duration} days
                  </Badge>
                  {plan.blueprint.difficulty && (
                    <Badge variant="secondary" className="capitalize">
                      {plan.blueprint.difficulty}
                    </Badge>
                  )}
                  {plan.blueprint.dietType && (
                    <Badge variant="outline">{plan.blueprint.dietType}</Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between mb-4 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      {plan.avgRating ? Number(plan.avgRating).toFixed(1) : "New"}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {plan.blueprint.salesCount}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    ${plan.blueprint.price}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => setLocation(`/nutrition/meal-plans/${plan.blueprint.id}`)}
                    variant="outline"
                  >
                    View Details
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handlePurchase(plan.blueprint.id, plan.blueprint.price)}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Buy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
