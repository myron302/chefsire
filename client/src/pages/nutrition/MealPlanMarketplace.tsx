import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreatorFollowButton, MealPlannerSocialActions } from "@/components/nutrition/social/MealPlannerSocial";
import { ConversionBadges } from "@/components/nutrition/social/conversionUtils";
import { ShoppingCart, Search, Calendar, Star, ChefHat, Store, SlidersHorizontal } from "lucide-react";

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
  social?: {
    likeCount: number;
    saveCount: number;
    commentCount: number;
    viewerHasLiked: boolean;
    viewerHasSaved: boolean;
  };
  viewerIsFollowingCreator?: boolean;
  creatorStats?: {
    publishedPlans: number;
    avgRating: number;
    totalSaves: number;
    totalFollowers: number;
  };
  ranking?: { trendingScore: number; recentnessBoost: number };
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
  const [duration, setDuration] = useState("all");
  const [dietaryStyle, setDietaryStyle] = useState("all");
  const [creator, setCreator] = useState("");
  const [sections, setSections] = useState<Array<{ key: string; title: string; plans: MealPlanListing[] }>>([]);

  useEffect(() => {
    fetchPlans();
  }, [search, difficulty, sortBy, minPrice, maxPrice, duration, dietaryStyle, creator]);

  useEffect(() => {
    fetch("/api/meal-plans/discovery/sections", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSections(data?.sections || []))
      .catch(() => setSections([]));
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (difficulty && difficulty !== "all") params.set("difficulty", difficulty);
      if (sortBy) params.set("sort", sortBy);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (duration !== "all") params.set("duration", duration);
      if (dietaryStyle !== "all") params.set("dietaryStyle", dietaryStyle);
      if (creator.trim()) params.set("creator", creator.trim());

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

  const clearFilters = () => { setSearch(""); setDifficulty("all"); setSortBy("newest"); setMinPrice(""); setMaxPrice(""); setDuration("all"); setDietaryStyle("all"); setCreator(""); };
  const planCard = (plan: MealPlanListing, compact = false) => (
    <Card key={`${plan.blueprint.id}-${compact ? "compact" : "full"}`} className="hover:shadow-lg transition-shadow min-w-0">
      <CardContent className={compact ? "p-4 space-y-3" : "p-6"}>
        <div className={`${compact ? "h-28" : "h-48"} w-full bg-gradient-to-br from-green-100 to-blue-100 rounded-lg mb-4 flex items-center justify-center`}><ChefHat className="w-12 h-12 text-green-600 opacity-50" /></div>
        <h3 className="text-lg font-semibold mb-1 line-clamp-2">{plan.blueprint.title}</h3>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <Link href={`/nutrition/creators/${plan.creator.id}`} className="underline-offset-4 hover:underline">by {plan.creator.displayName || plan.creator.username}</Link>
          <CreatorFollowButton creatorId={plan.creator.id} compact />
        </div>
        {plan.blueprint.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{plan.blueprint.description}</p>}
        {plan.creatorStats ? (
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-2 text-xs mb-3">
            <span>{Number(plan.creatorStats.publishedPlans).toLocaleString()} plans</span><span>{Number(plan.creatorStats.totalFollowers).toLocaleString()} followers</span>
            <span>{Number(plan.creatorStats.avgRating).toFixed(1)} avg ★</span><span>{Number(plan.creatorStats.totalSaves).toLocaleString()} saves</span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 mb-4"><ConversionBadges input={{ priceInCents: (plan.blueprint as any).priceInCents, avgRating: plan.avgRating, reviewCount: plan.reviewCount, salesCount: plan.blueprint.salesCount, createdAt: plan.blueprint.createdAt, social: plan.social, ranking: plan.ranking }} /><Badge variant="outline"><Calendar className="w-3 h-3 mr-1" />{plan.blueprint.duration} days</Badge>{plan.blueprint.difficulty && <Badge variant="secondary" className="capitalize">{plan.blueprint.difficulty}</Badge>}</div>
        <div className="flex items-center justify-between mb-4 text-sm"><span className="flex items-center gap-1"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />{plan.avgRating ? Number(plan.avgRating).toFixed(1) : "New"}</span><span className="text-lg font-bold text-green-600">${(((plan.blueprint as any).priceInCents || 0) / 100).toFixed(2)}</span></div>
        <MealPlannerSocialActions target="meal-plan" id={plan.blueprint.id} initialStats={plan.social} compact saveActionLinks={{ creatorHref: `/nutrition/creators/${plan.creator.id}` }} />
        <div className="mt-4 flex flex-wrap gap-2"><Button className="flex-1" onClick={() => setLocation(`/nutrition/meal-plans/${plan.blueprint.id}`)} variant="outline">View Details</Button><Button className="flex-1" onClick={() => handlePurchase(plan.blueprint.id, (plan.blueprint as any).price)}><ShoppingCart className="w-4 h-4 mr-2" />Buy</Button><Button className="w-full" variant="ghost" onClick={() => setLocation(`/nutrition/creators/${plan.creator.id}`)}><Store className="w-4 h-4 mr-2" />Quick View Storefront</Button></div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
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
                <option value="trending">Trending</option>
                <option value="most-liked">Most Liked</option>
                <option value="most-saved">Most Saved</option>
                <option value="most-reviewed">Most Reviewed</option>
                <option value="top-rated">Top Rated</option>
                <option value="newest">Newest</option>
                <option value="followed-creators">Followed Creators</option>
                <option value="most-purchased">Most Purchased</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
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
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full p-2 border rounded"><option value="all">Any Duration</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select>
            <Input value={dietaryStyle} onChange={(e) => setDietaryStyle(e.target.value)} placeholder="Dietary style" />
            <Input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Creator username or ID" />
            <Button type="button" variant="outline" onClick={clearFilters}><SlidersHorizontal className="h-4 w-4 mr-2" />Clear</Button>
          </div>
        </CardContent>
      </Card>

      {sections.length > 0 ? <div className="mb-8 space-y-6">{sections.map((section) => <section key={section.key}><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{section.title}</h2><Button variant="ghost" size="sm" onClick={() => { setSortBy(section.key === "highest-rated" ? "top-rated" : section.key === "most-saved" ? "most-saved" : "newest"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>View all</Button></div><div className="flex gap-4 overflow-x-auto pb-3 snap-x scroll-smooth">{section.plans.map((plan) => <div key={plan.blueprint.id} className="w-72 flex-none snap-start">{planCard(plan, true)}</div>)}</div></section>)}</div> : null}

      {/* Plans Grid */}
      {loading ? (
        <div className="text-center py-12"><p className="text-muted-foreground">Loading meal plans...</p></div>
      ) : plans.length === 0 ? (
        <Card><CardContent className="p-8 sm:p-12 text-center"><ChefHat className="w-16 h-16 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2">No matching meal plans yet</h3><p className="text-muted-foreground mb-5">Try clearing filters, browsing creators, or switching to newest and highest-rated plans.</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={clearFilters}>Clear filters</Button><Button variant="outline" onClick={() => setLocation("/nutrition/creators")}>Browse creators</Button><Button variant="outline" onClick={() => setSortBy("newest")}>View newest plans</Button><Button variant="outline" onClick={() => setSortBy("top-rated")}>View highest-rated plans</Button></div></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{plans.map((plan) => planCard(plan))}</div>
      )}    </div>
  );
}
