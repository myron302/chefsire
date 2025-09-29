"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Heart, Search } from "lucide-react";

// Types
interface Substitute {
  id: string;
  name: string;
  ratio: string;
  notes: string;
}

interface Ingredient {
  id: string;
  name: string;
  category: string;
  substitutes: Substitute[];
}

// Mock data
const mockIngredients: Ingredient[] = [
  {
    id: "1",
    name: "Butter",
    category: "Dairy",
    substitutes: [
      {
        id: "1-1",
        name: "Margarine",
        ratio: "1:1",
        notes: "Best for baking, may alter flavor slightly"
      },
      {
        id: "1-2",
        name: "Coconut Oil",
        ratio: "1:1",
        notes: "Solid at room temp, good for vegan options"
      },
      {
        id: "1-3",
        name: "Applesauce",
        ratio: "1:1",
        notes: "Reduces calories, works well in cakes and muffins"
      }
    ]
  },
  {
    id: "2",
    name: "Eggs",
    category: "Protein",
    substitutes: [
      {
        id: "2-1",
        name: "Flaxseed Meal",
        ratio: "1 tbsp + 3 tbsp water = 1 egg",
        notes: "Best for binding in baked goods"
      },
      {
        id: "2-2",
        name: "Applesauce",
        ratio: "1/4 cup = 1 egg",
        notes: "Adds moisture, works well in cakes"
      },
      {
        id: "2-3",
        name: "Commercial Egg Replacer",
        ratio: "Follow package instructions",
        notes: "Designed specifically for egg replacement"
      }
    ]
  },
  {
    id: "3",
    name: "Milk",
    category: "Dairy",
    substitutes: [
      {
        id: "3-1",
        name: "Almond Milk",
        ratio: "1:1",
        notes: "Unsweetened works best for savory dishes"
      },
      {
        id: "3-2",
        name: "Oat Milk",
        ratio: "1:1",
        notes: "Creamy texture, good for coffee and baking"
      },
      {
        id: "3-3",
        name: "Soy Milk",
        ratio: "1:1",
        notes: "High protein content, closest to dairy milk"
      }
    ]
  },
  {
    id: "4",
    name: "Flour",
    category: "Grains",
    substitutes: [
      {
        id: "4-1",
        name: "Almond Flour",
        ratio: "1:1 (may need more eggs)",
        notes: "Gluten-free, adds nutty flavor"
      },
      {
        id: "4-2",
        name: "Coconut Flour",
        ratio: "1:4 (use much less)",
        notes: "Highly absorbent, needs more liquid"
      },
      {
        id: "4-3",
        name: "Oat Flour",
        ratio: "1:1",
        notes: "Gluten-free when certified, adds fiber"
      }
    ]
  },
  {
    id: "5",
    name: "Sugar",
    category: "Sweeteners",
    substitutes: [
      {
        id: "5-1",
        name: "Honey",
        ratio: "3/4 cup = 1 cup sugar",
        notes: "Reduce liquid in recipe by 1/4 cup"
      },
      {
        id: "5-2",
        name: "Maple Syrup",
        ratio: "3/4 cup = 1 cup sugar",
        notes: "Reduce liquid by 3 tbsp per cup"
      },
      {
        id: "5-3",
        name: "Stevia",
        ratio: "1 tsp = 1 cup sugar",
        notes: "Highly concentrated, adjust to taste"
      }
    ]
  }
];

export default function SubstitutionsPage() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Ingredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [favorites, setFavorites] = useState<Ingredient[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem("ingredientFavorites");
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("ingredientFavorites", JSON.stringify(favorites));
  }, [favorites]);

  // Filter ingredients based on search query
  const filterIngredients = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSuggestions([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = mockIngredients.filter(ingredient => 
      ingredient.name.toLowerCase().includes(query) || 
      ingredient.category.toLowerCase().includes(query)
    );

    setSearchResults(filtered);
    setSuggestions(filtered.slice(0, 5)); // Show top 5 suggestions
  }, [searchQuery]);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    filterIngredients();
    setShowFavorites(false);
  };

  // Handle ingredient selection
  const handleSelectIngredient = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setSearchQuery(ingredient.name);
    setSearchResults([]);
    setSuggestions([]);
  };

  // Toggle favorite status
  const toggleFavorite = (ingredient: Ingredient) => {
    setFavorites(prev => {
      const isFavorite = prev.some(fav => fav.id === ingredient.id);
      if (isFavorite) {
        return prev.filter(fav => fav.id !== ingredient.id);
      } else {
        return [...prev, ingredient];
      }
    });
  };

  // Check if ingredient is favorited
  const isFavorited = (ingredientId: string) => {
    return favorites.some(fav => fav.id === ingredientId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-amber-800 mb-2">
            Ingredient Substitution Guide
          </h1>
          <p className="text-amber-600 max-w-2xl mx-auto">
            Find perfect substitutes for your ingredients with our comprehensive guide
          </p>
        </header>

        {/* Search Section */}
        <section className="mb-10">
          <form onSubmit={handleSearchSubmit} className="relative mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
                <Input
                  type="text"
                  placeholder="Search for ingredients (e.g. butter, eggs, milk)..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10 py-6 text-lg border-2 border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-300 rounded-lg"
                />
              </div>
              <Button 
                type="submit" 
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-6 text-lg rounded-lg"
              >
                Search
              </Button>
            </div>
            
            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && searchQuery && (
              <Card className="absolute z-10 w-full mt-1 shadow-lg border-2 border-amber-200 rounded-lg">
                <CardContent className="p-2">
                  {suggestions.map(ingredient => (
                    <div
                      key={ingredient.id}
                      onClick={() => handleSelectIngredient(ingredient)}
                      className="cursor-pointer rounded p-3 hover:bg-amber-50 flex items-center justify-between transition-colors"
                    >
                      <span className="font-medium text-amber-800">{ingredient.name}</span>
                      <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                        {ingredient.category}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </form>

          {/* Favorites Toggle */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowFavorites(!showFavorites)}
              className={`border-2 ${showFavorites ? 'border-amber-500 bg-amber-100' : 'border-amber-300'} px-4 py-2 rounded-lg`}
            >
              <Heart className={`mr-2 h-4 w-4 ${showFavorites ? 'fill-amber-500 text-amber-500' : 'text-amber-500'}`} />
              {showFavorites ? 'Showing Favorites' : 'Show Favorites'}
            </Button>
          </div>
        </section>

        {/* Main Content */}
        <main>
          {showFavorites ? (
            // Favorites View
            <section>
              <h2 className="text-2xl font-semibold text-amber-800 mb-4">Your Favorite Substitutions</h2>
              {favorites.length === 0 ? (
                <Card className="text-center py-12 border-2 border-amber-200 rounded-xl">
                  <CardContent>
                    <p className="text-amber-600 mb-4">You haven't saved any favorites yet</p>
                    <Button 
                      onClick={() => setShowFavorites(false)}
                      className="bg-amber-600 hover:bg-amber-700 rounded-lg"
                    >
                      Browse Ingredients
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favorites.map(ingredient => (
                    <Card key={ingredient.id} className="border-2 border-amber-200 hover:border-amber-400 transition-all hover:shadow-lg rounded-xl">
                      <CardHeader className="bg-amber-50 rounded-t-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-amber-800">{ingredient.name}</CardTitle>
                            <CardDescription className="text-amber-600">{ingredient.category}</CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleFavorite(ingredient)}
                            className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full"
                          >
                            <Heart className="h-5 w-5 fill-amber-500" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <p className="text-sm text-amber-700 mb-3">
                          {ingredient.substitutes.length} substitution{ingredient.substitutes.length !== 1 ? 's' : ''} available
                        </p>
                        <Button 
                          onClick={() => handleSelectIngredient(ingredient)}
                          className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg"
                        >
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ) : selectedIngredient ? (
            // Detail View
            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-amber-800">Substitution Details</h2>
                <Button 
                  onClick={() => setSelectedIngredient(null)}
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg"
                >
                  Back to Search
                </Button>
              </div>
              
              <Card className="border-2 border-amber-200 mb-8 shadow-lg rounded-xl">
                <CardHeader className="bg-gradient-to-r from-amber-100 to-orange-50 rounded-t-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl text-amber-800">{selectedIngredient.name}</CardTitle>
                      <CardDescription className="text-amber-600">{selectedIngredient.category}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavorite(selectedIngredient)}
                      className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full"
                    >
                      <Heart className={`h-6 w-6 ${isFavorited(selectedIngredient.id) ? 'fill-amber-500' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-amber-700 mb-4">Available Substitutes:</h3>
                  <div className="space-y-4">
                    {selectedIngredient.substitutes.map(sub => (
                      <Card key={sub.id} className="border border-amber-100 hover:border-amber-300 transition-colors rounded-lg">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-amber-800 text-lg">{sub.name}</h4>
                            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                              Ratio: {sub.ratio}
                            </span>
                          </div>
                          <p className="text-sm text-amber-600 mt-2">{sub.notes}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <div className="text-center">
                <Button 
                  onClick={() => setSelectedIngredient(null)}
                  className="bg-amber-600 hover:bg-amber-700 px-6 py-2 rounded-lg"
                >
                  Back to Search Results
                </Button>
              </div>
            </section>
          ) : searchResults.length > 0 ? (
            // Search Results View
            <section>
              <h2 className="text-2xl font-semibold text-amber-800 mb-4">
                Search Results for "{searchQuery}"
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map(ingredient => (
                  <Card key={ingredient.id} className="border-2 border-amber-200 hover:border-amber-400 transition-all hover:shadow-lg rounded-xl">
                    <CardHeader className="bg-amber-50 rounded-t-xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-amber-800">{ingredient.name}</CardTitle>
                          <CardDescription className="text-amber-600">{ingredient.category}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFavorite(ingredient)}
                          className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full"
                        >
                          <Heart className={`h-5 w-5 ${isFavorited(ingredient.id) ? 'fill-amber-500' : ''}`} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-sm text-amber-700 mb-3">
                        {ingredient.substitutes.length} substitution{ingredient.substitutes.length !== 1 ? 's' : ''} available
                      </p>
                      <Button 
                        onClick={() => handleSelectIngredient(ingredient)}
                        className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg"
                      >
                        View Substitutes
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : searchQuery ? (
            // No Results View
            <section className="text-center py-12">
              <Card className="max-w-md mx-auto border-2 border-amber-200 rounded-xl">
                <CardContent className="py-8">
                  <p className="text-amber-600 mb-4">No ingredients found for "{searchQuery}"</p>
                  <Button 
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 rounded-lg"
                  >
                    Clear Search
                  </Button>
                </CardContent>
              </Card>
            </section>
          ) : (
            // Default View
            <section className="text-center py-12">
              <Card className="max-w-2xl mx-auto border-2 border-amber-200 shadow-lg rounded-xl">
                <CardContent className="py-8">
                  <div className="flex justify-center mb-4">
                    <div className="bg-amber-100 p-4 rounded-full">
                      <Search className="h-12 w-12 text-amber-600" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-semibold text-amber-800 mb-2">Find Ingredient Substitutes</h2>
                  <p className="text-amber-600 mb-6">
                    Search for any ingredient to find perfect substitutes. Save your favorites for quick access.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {mockIngredients.slice(0, 5).map(ingredient => (
                      <Button
                        key={ingredient.id}
                        variant="outline"
                        onClick={() => handleSelectIngredient(ingredient)}
                        className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full"
                      >
                        {ingredient.name}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-amber-500">
                    Try searching for: butter, eggs, milk, flour, sugar...
                  </p>
                </CardContent>
              </Card>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-amber-600 text-sm">
          <p>© {new Date().getFullYear()} Ingredient Substitution Guide. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
