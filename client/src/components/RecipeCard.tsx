import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ChefHat } from "lucide-react";

export interface Recipe {
  id: string;
  title: string;
  imageUrl?: string;
  ingredients: string[];
  instructions: string[];
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  calories?: number;
}

interface RecipeCardProps {
  recipe: Recipe;
  onClick?: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const {
    title,
    imageUrl,
    ingredients,
    instructions,
    cookTime,
    servings,
    difficulty,
    calories
  } = recipe;

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {/* Recipe Image */}
      <div className="aspect-square overflow-hidden">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className="h-full w-full object-cover" 
            loading="lazy" 
          />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <ChefHat className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>

      <CardContent className="p-4">
        {/* Recipe Title */}
        <h3 className="font-semibold text-lg line-clamp-2 mb-2">{title}</h3>

        {/* Recipe Meta Information */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          {cookTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{cookTime} min</span>
            </div>
          )}
          {servings && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{servings} servings</span>
            </div>
          )}
          {calories && (
            <div className="text-xs">
              <span>{calories} cal</span>
            </div>
          )}
        </div>

        {/* Difficulty Badge */}
        {difficulty && (
          <div className="flex items-center gap-2 mb-3">
            <Badge 
              variant={
                difficulty === "Easy" ? "secondary" : 
                difficulty === "Hard" ? "destructive" : "default"
              }
              className="text-xs"
            >
              {difficulty}
            </Badge>
          </div>
        )}

        {/* Ingredients Preview */}
        <div className="mb-3">
          <p className="text-sm font-medium mb-1">Ingredients ({ingredients.length})</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {ingredients.slice(0, 3).join(", ")}
            {ingredients.length > 3 && "..."}
          </p>
        </div>

        {/* Instructions Preview */}
        <div>
          <p className="text-sm font-medium mb-1">Instructions ({instructions.length} steps)</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {instructions[0]}
            {instructions.length > 1 && "..."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}