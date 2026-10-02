import { Link } from "wouter";
import { ChefHat, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { matchColor, matchLabel, type RecipeMatch } from "./recipe-matches-model";

export function RecipeMatchCard({ recipe }: { recipe: RecipeMatch }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col h-full">
        {/* Recipe Image */}
        {recipe.imageUrl && (
          <div className="relative h-48 bg-gray-100">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3">
              <Badge className={`${matchColor(recipe.matchPercent)} border`}>
                {recipe.matchPercent}% Match
              </Badge>
            </div>
          </div>
        )}

        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{recipe.title}</CardTitle>
              {!recipe.imageUrl && (
                <Badge className={`${matchColor(recipe.matchPercent)} border mb-2`}>
                  {recipe.matchPercent}% Match
                </Badge>
              )}
            </div>
          </div>

          {/* Match Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">{matchLabel(recipe.matchPercent)}</span>
              <span className="text-muted-foreground">
                {recipe.matchingCount} of {recipe.totalIngredients} ingredients
              </span>
            </div>
            <Progress value={recipe.matchPercent} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="flex-1">
          <div className="space-y-4">
            {/* Meta Info */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              {recipe.cookTime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{recipe.cookTime} min</span>
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
