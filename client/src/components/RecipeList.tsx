import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import RecipeCard, { Recipe } from "./RecipeCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RecipeListResponse {
  recipes: Recipe[];
  total: number;
  limit: number;
  offset: number;
}

interface RecipeListProps {
  limit?: number;
  onRecipeClick?: (recipe: Recipe) => void;
}

export default function RecipeList({ limit = 50, onRecipeClick }: RecipeListProps) {
  const [offset, setOffset] = useState(0);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery<RecipeListResponse>({
    queryKey: ["/api/recipes", { limit, offset }],
    queryFn: () => apiRequest("GET", `/api/recipes?limit=${limit}&offset=${offset}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const handleRefresh = () => {
    setOffset(0);
    refetch();
  };

  const handleLoadMore = () => {
    if (data && data.recipes.length === limit) {
      setOffset(prevOffset => prevOffset + limit);
    }
  };

  // Loading state
  if (isLoading && offset === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading recipes...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : "Failed to load recipes"}
          </AlertDescription>
        </Alert>
        <div className="flex justify-center mt-4">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (data && data.recipes.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-lg text-muted-foreground">No recipes found</p>
          <p className="text-sm text-muted-foreground">
            Try fetching some recipes from external sources first
          </p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  const recipes = data?.recipes || [];
  const hasMore = recipes.length === limit;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Recipes</h1>
          <p className="text-muted-foreground">
            {data?.total ? `Showing ${recipes.length} recipes` : "Loading..."}
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onClick={() => onRecipeClick?.(recipe)}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <Button 
            onClick={handleLoadMore} 
            variant="outline"
            disabled={isFetching}
          >
            {isFetching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}

      {/* Loading overlay for pagination */}
      {isFetching && offset > 0 && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-background p-4 rounded-lg shadow-lg">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
            <p className="mt-2 text-sm">Loading more recipes...</p>
          </div>
        </div>
      )}
    </div>
  );
}