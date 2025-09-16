import { useState } from "react";
import RecipeList from "@/components/RecipeList";
import RecipeCard, { Recipe } from "@/components/RecipeCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ChefHat } from "lucide-react";

// Mock recipe data for testing
const mockRecipes: Recipe[] = [
  {
    id: "1",
    title: "Classic Spaghetti Carbonara",
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&h=400&fit=crop",
    ingredients: [
      "400g spaghetti",
      "200g pancetta or guanciale, diced",
      "4 large eggs",
      "100g Pecorino Romano cheese, grated",
      "Black pepper to taste",
      "Salt for pasta water"
    ],
    instructions: [
      "Bring a large pot of salted water to boil and cook spaghetti according to package directions.",
      "While pasta cooks, heat a large skillet over medium heat and cook pancetta until crispy.",
      "In a bowl, whisk together eggs, cheese, and black pepper.",
      "Reserve 1 cup pasta water, then drain pasta.",
      "Add hot pasta to the skillet with pancetta and toss.",
      "Remove from heat and quickly stir in egg mixture, adding pasta water as needed."
    ],
    cookTime: 20,
    servings: 4,
    difficulty: "Medium",
    calories: 520
  },
  {
    id: "2",
    title: "Avocado Toast Supreme",
    imageUrl: "https://images.unsplash.com/photo-1541519920340-29cf3c1c3c3a?w=400&h=400&fit=crop",
    ingredients: [
      "2 slices whole grain bread",
      "1 ripe avocado",
      "1 lime, juiced",
      "2 eggs",
      "Cherry tomatoes, halved",
      "Red pepper flakes",
      "Salt and pepper to taste",
      "Everything bagel seasoning"
    ],
    instructions: [
      "Toast bread slices until golden brown.",
      "Mash avocado with lime juice, salt, and pepper.",
      "Fry or poach eggs to your preference.",
      "Spread avocado mixture on toast.",
      "Top with fried egg, cherry tomatoes, and seasonings."
    ],
    cookTime: 10,
    servings: 2,
    difficulty: "Easy",
    calories: 340
  },
  {
    id: "3",
    title: "Beef Wellington",
    imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=400&fit=crop",
    ingredients: [
      "2kg beef tenderloin",
      "500g puff pastry",
      "300g mushroom duxelles",
      "200g pâté or liver mousse",
      "Prosciutto slices",
      "2 egg yolks for wash",
      "Fresh thyme",
      "Salt and black pepper"
    ],
    instructions: [
      "Season beef with salt and pepper, sear all sides until browned.",
      "Let beef cool, then brush with mustard and coat with pâté.",
      "Lay out prosciutto and spread with mushroom duxelles.",
      "Wrap beef tightly and chill for 30 minutes.",
      "Roll out pastry, wrap the beef, and seal edges.",
      "Brush with egg wash and bake at 400°F for 25-30 minutes."
    ],
    cookTime: 90,
    servings: 8,
    difficulty: "Hard",
    calories: 680
  }
];

export default function RecipesTestPage() {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showMockData, setShowMockData] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Recipe Components Test</h1>
            <p className="text-muted-foreground mb-6">
              This page demonstrates the RecipeCard and RecipeList components
            </p>
            
            <div className="flex justify-center gap-4 mb-8">
              <Button 
                onClick={() => setShowMockData(!showMockData)}
                variant={showMockData ? "default" : "outline"}
              >
                {showMockData ? "Hide" : "Show"} Mock Recipe Cards
              </Button>
            </div>
          </div>

          {/* Mock Recipe Cards Section */}
          {showMockData && (
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-6">Individual Recipe Cards</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {mockRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onClick={() => setSelectedRecipe(recipe)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* RecipeList Component Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Recipe List Component</h2>
            <p className="text-muted-foreground mb-6">
              This component fetches recipes from the API endpoint <code className="bg-muted px-2 py-1 rounded">GET /api/recipes</code>
            </p>
            
            {/* Note about database connection */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800 text-sm">
                <strong>Note:</strong> The RecipeList component will show a loading/error state because no database is connected in this environment. 
                In a real deployment with a connected database, it would fetch and display recipes from the database.
              </p>
            </div>

            <RecipeList onRecipeClick={setSelectedRecipe} />
          </div>
        </div>
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedRecipe.title}</DialogTitle>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Recipe Image */}
                {selectedRecipe.imageUrl && (
                  <div className="aspect-video overflow-hidden rounded-lg">
                    <img 
                      src={selectedRecipe.imageUrl} 
                      alt={selectedRecipe.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Recipe Meta */}
                <div className="flex items-center gap-4 text-sm">
                  {selectedRecipe.cookTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{selectedRecipe.cookTime} min</span>
                    </div>
                  )}
                  {selectedRecipe.servings && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{selectedRecipe.servings} servings</span>
                    </div>
                  )}
                  {selectedRecipe.calories && (
                    <div className="flex items-center gap-1">
                      <ChefHat className="h-4 w-4" />
                      <span>{selectedRecipe.calories} cal</span>
                    </div>
                  )}
                  {selectedRecipe.difficulty && (
                    <Badge 
                      variant={
                        selectedRecipe.difficulty === "Easy" ? "secondary" : 
                        selectedRecipe.difficulty === "Hard" ? "destructive" : "default"
                      }
                    >
                      {selectedRecipe.difficulty}
                    </Badge>
                  )}
                </div>

                {/* Ingredients */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Ingredients</h3>
                  <ul className="space-y-2">
                    {selectedRecipe.ingredients.map((ingredient, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-1">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Instructions</h3>
                  <ol className="space-y-3">
                    {selectedRecipe.instructions.map((instruction, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}