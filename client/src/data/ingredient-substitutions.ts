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
import {
  type IngredientSubstitution,
  ingredientSubstitutions,
  searchIngredientSubstitutions,
} from "../../data/ingredient-substitutions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export default function SubstitutionsPage() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IngredientSubstitution[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientSubstitution | null>(null);
  const [favorites, setFavorites] = useState<IngredientSubstitution[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  
  // Debounce the search query to avoid searching on every keystroke
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem("ingredientFavorites");
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error("Failed to parse favorites from localStorage", error);
        setFavorites([]);
      }
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("ingredientFavorites", JSON.stringify(favorites));
  }, [favorites]);

  // This effect will run when the debounced search query changes
  useEffect(() => {
    // When a new search is performed, we should clear the selected ingredient
    if (debouncedSearchQuery.trim()) {
      setSelectedIngredient(null);
      const filtered = searchIngredientSubstitutions(debouncedSearchQuery);
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery]);
  
  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // When the user starts typing, clear favorites view and selected ingredient
    setShowFavorites(false);
    setSelectedIngredient(null);
  };

  // Handle search submission (e.g., pressing Enter)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The debounced effect already handles the search
  };

  // Handle ingredient selection
  const handleSelectIngredient = (ingredient: IngredientSubstitution) => {
    setSelectedIngredient(ingredient);
  };

  // Handle returning to search results from detail view
  const handleBackToSearch = () => {
    setSelectedIngredient(null);
  };

  // Toggle favorite status
  const toggleFavorite = (ingredient: IngredientSubstitution) => {
    setFavorites(prev => {
      const isFavorite = prev.some(fav => fav.ingredient === ingredient.ingredient);
      if (isFavorite) {
        return prev.filter(fav => fav.ingredient !== ingredient.ingredient);
      } else {
        return [...prev, ingredient];
      }
    });
  };

  // Check if ingredient is favorited
  const isFavorited = (ingredientName: string) => {
    return favorites.some(fav => fav.ingredient === ingredientName);
  };
  
  const popularIngredients = ingredientSubstitutions.filter(sub => 
    ["Butter", "Eggs", "Milk", "Flour", "Sugar"].includes(sub.ingredient)
  );
  
  const isSearching = !!debouncedSearchQuery.trim();

  // Determine what content to render
  const renderContent = () => {
    if (showFavorites) {
      return (
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
                <Card key={ingredient.ingredient} className="border-2 border-amber-200 hover:border-amber-400 transition-all hover:shadow-lg rounded-xl">
                  <CardHeader className="bg-amber-50 rounded-t-xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-amber-800">{ingredient.ingredient}</CardTitle>
                        <CardDescription className="text-amber-600">{ingredient.amount}</CardDescription>
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
      );
    }
    
    if (selectedIngredient) {
      return (
        // Detail View
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-amber-800">Substitution Details</h2>
            <Button 
              onClick={handleBackToSearch}
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
                  <CardTitle className="text-2xl text-amber-800">{selectedIngredient.ingredient}</CardTitle>
                  <CardDescription className="text-amber-600">{selectedIngredient.amount}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleFavorite(selectedIngredient)}
                  className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full"
                >
                  <Heart className={`h-6 w-6 ${isFavorited(selectedIngredient.ingredient) ? 'fill-amber-500' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-amber-700 mb-4">Available Substitutes:</h3>
              <div className="space-y-4">
                {selectedIngredient.substitutes.map((sub, index) => (
                  <Card key={index} className="border border-amber-100 hover:border-amber-300 transition-colors rounded-lg">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-amber-800 text-lg">{sub.substitute}</h4>
                        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                          Amount: {sub.amount}
                        </span>
                      </div>
                      {sub.note && <p className="text-sm text-amber-600 mt-2">Note: {sub.note}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <div className="text-center">
            <Button 
              onClick={handleBackToSearch}
              className="bg-amber-600 hover:bg-amber-700 px-6 py-2 rounded-lg"
            >
              Back to Search Results
            </Button>
          </div>
        </section>
      );
    }

    if (isSearching) {
      if (searchResults.length > 0) {
        return (
          // Search Results View
          <section>
            <h2 className="text-2xl font-semibold text-amber-800 mb-4">
              Search Results for "{debouncedSearchQuery}"
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(ingredient => (
                <Card key={ingredient.ingredient} className="border-2 border-amber-200 hover:border-amber-400 transition-all hover:shadow-lg rounded-xl">
                  <CardHeader className="bg-amber-50 rounded-t-xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-amber-800">{ingredient.ingredient}</CardTitle>
                        <CardDescription className="text-amber-600">{ingredient.amount}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFavorite(ingredient)}
                        className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full"
                      >
                        <Heart className={`h-5 w-5 ${isFavorited(ingredient.ingredient) ? 'fill-amber-500' : ''}`} />
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
        );
      } else {
        return (
          // No Results View
          <section className="text-center py-12">
            <Card className="max-w-md mx-auto border-2 border-amber-200 rounded-xl">
              <CardContent className="py-8">
                <p className="text-amber-600 mb-4">No ingredients found for "{debouncedSearchQuery}"</p>
                <Button 
                  onClick={() => setSearchQuery("")}
                  className="bg-amber-600 hover:bg-amber-700 rounded-lg"
                >
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          </section>
        );
      }
    }

    // Default View
    return (
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
              {popularIngredients.map(ingredient => (
                <Button
                  key={ingredient.ingredient}
                  variant="outline"
                  onClick={() => handleSelectIngredient(ingredient)}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full"
                >
                  {ingredient.ingredient}
                </Button>
              ))}
            </div>
            <p className="text-sm text-amber-500">
              Try searching for: butter, eggs, milk, flour, sugar...
            </p>
          </CardContent>
        </Card>
      </section>
    );
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
          </form>

          {/* Favorites Toggle */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setShowFavorites(!showFavorites);
                setSelectedIngredient(null);
                setSearchQuery("");
              }}
              className={`border-2 ${showFavorites ? 'border-amber-500 bg-amber-100' : 'border-amber-300'} px-4 py-2 rounded-lg`}
            >
              <Heart className={`mr-2 h-4 w-4 ${showFavorites ? 'fill-amber-500 text-amber-500' : 'text-amber-500'}`} />
              {showFavorites ? 'Showing Favorites' : 'Show Favorites'}
            </Button>
          </div>
        </section>

        {/* Main Content */}
        <main>
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-amber-600 text-sm">
          <p>© {new Date().getFullYear()} Ingredient Substitution Guide. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
