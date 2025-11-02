import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChefHat, Package, CheckCircle2, AlertCircle, ArrowLeft, Filter, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

type RecipeMatch = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  ingredients: string[];
  matchScore: number;
  matchingIngredients: string[];
  missingIngredients: string[];
  totalTime?: number;
  difficulty?: string;
};

export default function RecipeMatches() {
  const [minMatchScore, setMinMatchScore] = useState("0.5");

  // Fetch recipe matches
  const { data: matchData, isLoading, error } = useQuery({
    queryKey: ["/api/pantry/recipe-matches", { minScore: minMatchScore }],
  });

  const matches: RecipeMatch[] = matchData?.matches || [];

  // Get match color based on score
  const getMatchColor = (score: number) => {
    if (score >= 0.9) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 0.7) return "bg-blue-100 text-blue-800 border-blue-200";
    if (score >= 0.5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getMatchLabel = (score: number) => {
    if (score >= 0.9) return "Excellent Match";
    if (score >= 0.7) return "Good Match";
    if (score >= 0.5) return "Partial Match";
    return "Low Match";
  };

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
              <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="flex flex-col h-full">
                  {/* Recipe Image */}
                  {recipe.imageUrl && (
                    <div className="relative h-48 bg-gray-100">
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3">
                        <Badge className={`${getMatchColor(recipe.matchScore)} border`}>
                          {Math.round(recipe.matchScore * 100)}% Match
                        </Badge>
                      </div>
                    </div>
                  )}

                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{recipe.name}</CardTitle>
                        {!recipe.imageUrl && (
                          <Badge className={`${getMatchColor(recipe.matchScore)} border mb-2`}>
                            {Math.round(recipe.matchScore * 100)}% Match
                          </Badge>
                        )}
                        {recipe.description && (
                          <CardDescription className="line-clamp-2">
                            {recipe.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>

                    {/* Match Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">{getMatchLabel(recipe.matchScore)}</span>
                        <span className="text-muted-foreground">
                          {recipe.matchingIngredients.length} of {recipe.ingredients.length} ingredients
                        </span>
                      </div>
                      <Progress value={recipe.matchScore * 100} className="h-2" />
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="space-y-4">
                      {/* Meta Info */}
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {recipe.totalTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{recipe.totalTime} min</span>
                          </div>
                        )}
                        {recipe.difficulty && (
                          <div className="flex items-center gap-1">
                            <ChefHat className="w-4 h-4" />
                            <span>{recipe.difficulty}</span>
                          </div>
                        )}
                      </div>

                      {/* Matching Ingredients */}
                      {recipe.matchingIngredients.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium">You have:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {recipe.matchingIngredients.slice(0, 8).map((ing, idx) => (
                              <Badge key={idx} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {ing}
                              </Badge>
                            ))}
                            {recipe.matchingIngredients.length > 8 && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                +{recipe.matchingIngredients.length - 8} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Missing Ingredients */}
                      {recipe.missingIngredients.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium">You need:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {recipe.missingIngredients.slice(0, 6).map((ing, idx) => (
                              <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                {ing}
                              </Badge>
                            ))}
                            {recipe.missingIngredients.length > 6 && (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                +{recipe.missingIngredients.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0">
                    <Link href={`/recipe/${recipe.id}`}>
                      <Button className="w-full">
                        View Recipe
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
