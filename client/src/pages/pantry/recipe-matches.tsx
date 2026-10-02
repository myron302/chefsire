import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChefHat, Package, CheckCircle2, AlertCircle, ArrowLeft, Filter, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import { RecipeMatchCard } from "./RecipeMatchCard";
import { meetsMinimumMatch, normalizeRecipeSuggestions, type RecipeMatch } from "./recipe-matches-model";

export default function RecipeMatches() {
  const { user } = useUser();
  const [minMatchScore, setMinMatchScore] = useState("0.5");

  // Fetch recipe matches
  const { data: matchData, isLoading, error } = useQuery({
    // The minimum-match select filters the loaded suggestions locally, so it is not part of the request key.
    queryKey: ["/api/pantry/recipe-matches"],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      // Self endpoint: the server derives the account from the session, never from an id in the URL.
      const res = await fetch(`/api/pantry/users/me/pantry/recipe-suggestions?maxMissingIngredients=3&limit=20`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch recipe suggestions");
      return res.json();
    },
    enabled: !!user?.id,
  });

  // The endpoint's response is normalized once here; see recipe-matches-model.ts for the real contract.
  const matches: RecipeMatch[] = useMemo(
    () => normalizeRecipeSuggestions(matchData).filter((m) => meetsMinimumMatch(m, minMatchScore)),
    [matchData, minMatchScore],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-gray-500">Finding recipes you can cook...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <h3 className="text-lg font-semibold mb-2 text-red-900">Failed to load recipe matches</h3>
            <p className="text-red-700">Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/pantry">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pantry
          </Button>
        </Link>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <ChefHat className="w-10 h-10 text-primary" />
              What Can I Cook?
            </h1>
            <p className="text-muted-foreground mt-2">
              Recipes you can make with ingredients from your pantry
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <label className="text-sm font-medium mr-3">Minimum Match:</label>
                <Select value={minMatchScore} onValueChange={setMinMatchScore}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.9">90%+ (Excellent)</SelectItem>
                    <SelectItem value="0.7">70%+ (Good)</SelectItem>
                    <SelectItem value="0.5">50%+ (Partial)</SelectItem>
                    <SelectItem value="0.3">30%+ (Any)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="text-sm">
                {matches.length} {matches.length === 1 ? "recipe" : "recipes"} found
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {matches.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold mb-2">No recipe matches found</h3>
            <p className="text-muted-foreground mb-6">
              {parseFloat(minMatchScore) > 0.5
                ? "Try lowering the minimum match percentage to see more recipes"
                : "Add more ingredients to your pantry to see recipe suggestions"}
            </p>
            <div className="flex gap-3 justify-center">
              {parseFloat(minMatchScore) > 0.3 && (
                <Button variant="outline" onClick={() => setMinMatchScore("0.3")}>
                  <Filter className="w-4 h-4 mr-2" />
                  Lower Match Filter
                </Button>
              )}
              <Link href="/pantry">
                <Button>
                  <Package className="w-4 h-4 mr-2" />
                  Add Ingredients
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Info Card */}
          <Card className="mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">How Recipe Matching Works</p>
                  <p className="text-muted-foreground">
                    We calculate the match score based on how many ingredients you have versus what's needed.
                    Green badges show ingredients you have, orange badges show what you're missing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipe Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {matches.map((recipe) => (
              <RecipeMatchCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
