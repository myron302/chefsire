import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Heart, Search, Filter, TrendingUp, Clock, User, Sparkles,
  ChefHat, Apple, Utensils, Star
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { formatDistanceToNow } from "date-fns";

type Remix = {
  id: string;
  userId: string;
  parentRecipeId: string;
  parentRecipeName: string;
  name: string;
  description: string;
  remixType: "variation" | "dietary_conversion" | "portion_adjustment" | "ingredient_swap";
  modifications: any;
  likesCount: number;
  savesCount: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
};

export default function RemixesPage() {
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/remixes", filter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filter !== "all") params.append("type", filter);

      const response = await fetch(`/api/remixes?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to fetch remixes");
      return response.json() as Promise<Remix[]>;
    },
  });

  const remixes = data || [];

  const getRemixTypeIcon = (type: string) => {
    switch (type) {
      case "variation":
        return Sparkles;
      case "dietary_conversion":
        return Apple;
      case "portion_adjustment":
        return Utensils;
      case "ingredient_swap":
        return ChefHat;
      default:
        return Star;
    }
  };

  const getRemixTypeLabel = (type: string) => {
    switch (type) {
      case "variation":
        return "Creative Variation";
      case "dietary_conversion":
        return "Dietary Conversion";
      case "portion_adjustment":
        return "Portion Adjusted";
      case "ingredient_swap":
        return "Ingredient Swap";
      default:
        return "Remix";
    }
  };

  const getRemixTypeColor = (type: string) => {
    switch (type) {
      case "variation":
        return "bg-purple-500";
      case "dietary_conversion":
        return "bg-green-500";
      case "portion_adjustment":
        return "bg-blue-500";
      case "ingredient_swap":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleLikeRemix = async (remixId: string) => {
    if (!user) return;

    try {
      await fetch(`/api/remixes/${remixId}/like`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Failed to like remix:", error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <ChefHat className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Please Log In</h2>
            <p className="text-muted-foreground mb-4">
              Log in to explore creative recipe remixes from the community!
            </p>
            <Button asChild>
              <a href="/auth">Log In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white rounded-xl p-8 mb-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Sparkles className="h-10 w-10" />
                Recipe Remixes
              </h1>
              <p className="text-white/90 text-lg">
                Discover creative twists on your favorite recipes!
              </p>
            </div>
            <div className="text-center bg-white/20 backdrop-blur rounded-lg p-4">
              <ChefHat className="h-8 w-8 mx-auto mb-1" />
              <div className="text-3xl font-bold">{remixes.length}</div>
              <div className="text-sm text-white/80">Total Remixes</div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search remixes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  variant={filter === "variation" ? "default" : "outline"}
                  onClick={() => setFilter("variation")}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Variations
                </Button>
                <Button
                  variant={filter === "dietary_conversion" ? "default" : "outline"}
                  onClick={() => setFilter("dietary_conversion")}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <Apple className="h-4 w-4 mr-1" />
                  Dietary
                </Button>
                <Button
                  variant={filter === "portion_adjustment" ? "default" : "outline"}
                  onClick={() => setFilter("portion_adjustment")}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <Utensils className="h-4 w-4 mr-1" />
                  Portions
                </Button>
                <Button
                  variant={filter === "ingredient_swap" ? "default" : "outline"}
                  onClick={() => setFilter("ingredient_swap")}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <ChefHat className="h-4 w-4 mr-1" />
                  Swaps
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Loading remixes...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && remixes.length === 0 && (
          <Card className="p-12 text-center">
            <Sparkles className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-2xl font-bold mb-2">No Remixes Found</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to create a remix! Go to any recipe and click the "Remix" button.
            </p>
            <Button asChild>
              <a href="/recipes">Browse Recipes</a>
            </Button>
          </Card>
        )}

        {/* Remixes Grid */}
        {!isLoading && remixes.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {remixes.map((remix) => {
              const Icon = getRemixTypeIcon(remix.remixType);
              return (
                <Card key={remix.id} className="hover:shadow-xl transition-shadow overflow-hidden">
                  <div className={`h-2 ${getRemixTypeColor(remix.remixType)}`} />

                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={getRemixTypeColor(remix.remixType)}>
                        <Icon className="h-3 w-3 mr-1" />
                        {getRemixTypeLabel(remix.remixType)}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(remix.createdAt), { addSuffix: true })}
                      </div>
                    </div>

                    <CardTitle className="text-xl">{remix.name}</CardTitle>

                    <div className="text-sm text-muted-foreground mt-1">
                      Remix of: <span className="font-medium">{remix.parentRecipeName}</span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <p className="text-muted-foreground mb-4 line-clamp-3">
                      {remix.description}
                    </p>

                    {/* Creator Info */}
                    <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold">
                        {remix.user.displayName?.[0] || "U"}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{remix.user.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{remix.user.username}</div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLikeRemix(remix.id)}
                        className="flex-1"
                      >
                        <Heart className="h-4 w-4 mr-1" />
                        {remix.likesCount} Likes
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1">
                        <Star className="h-4 w-4 mr-1" />
                        {remix.savesCount} Saves
                      </Button>
                    </div>

                    <Button className="w-full mt-4" asChild>
                      <a href={`/recipes/${remix.parentRecipeId}`}>
                        View Recipe
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
