// client/src/components/SearchAutocomplete.tsx
import { useState, useEffect, useRef, FormEvent } from "react";
import { useLocation } from "wouter";
import { Search, User, ChefHat, Utensils, Star, PawPrint } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface AutocompleteResult {
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    specialty?: string;
    isChef: boolean;
    type: "user";
  }>;
  recipes: Array<{
    id: string | number;
    title: string;
    imageUrl?: string;
    cookTime?: number;
    source: string;
    type: "recipe";
  }>;
  drinks: Array<{
    id: string;
    name: string;
    imageUrl?: string;
    category?: string;
    route?: string;
    matchKind?: "recipe-exact" | "category" | "external";
    type: "drink";
  }>;
  reviews: Array<{
    id: string;
    name: string;
    route: string;
    type: "review";
  }>;
  petFoods: Array<{
    id: string;
    name: string;
    route: string;
    type: "pet-food";
  }>;
  query: string;
}

export default function SearchAutocomplete() {
  const [, setLocation] = useLocation();
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<AutocompleteResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Flatten results for keyboard navigation
  const allResults = results
    ? [
        ...results.users.map((u) => ({ ...u, category: "Users" })),
        ...results.recipes.map((r) => ({ ...r, category: "Recipes" })),
        ...results.reviews.map((rv) => ({ ...rv, category: "Reviews" })),
        ...results.drinks.map((d) => ({ ...d, category: "Drinks" })),
        ...results.petFoods.map((p) => ({ ...p, category: "Pet Food" })),
      ]
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!searchText.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(searchText.trim())}`
        );
        const data = await response.json();
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Autocomplete error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchText]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();

    toast({
      title: "Search",
      description: q ? `Searching for: ${q}` : "Searching…",
      duration: 1500,
    });

    setIsOpen(false);

    // When the user submits without selecting a dropdown item (Enter key),
    // route them to the most relevant section based on available autocomplete results.
    // This keeps the existing recipe search as a fallback.
    if (!q) {
      setLocation("/recipes");
      return;
    }

    const safeQ = encodeURIComponent(q);
    const has = results;

    // Submit priority:
    // 1) exact drink recipe hit (from generated index)
    // 2) drink category route
    // 3) reviews route
    // 4) recipes fallback
    if (has?.drinks?.length) {
      const exactDrink = has.drinks.find(
        (d) => d.matchKind === "recipe-exact" && typeof d.route === "string" && d.route
      );
      if (exactDrink?.route) {
        setLocation(exactDrink.route);
        return;
      }

      const drinkCategory = has.drinks.find(
        (d) => d.matchKind === "category" && typeof d.route === "string" && d.route
      );
      if (drinkCategory?.route) {
        setLocation(drinkCategory.route);
        return;
      }

      const fallbackDrinkRoute = has.drinks.find((d) => typeof d.route === "string" && d.route)?.route;
      if (fallbackDrinkRoute) {
        setLocation(fallbackDrinkRoute);
        return;
      }

      setLocation(`/drinks?q=${safeQ}`);
      return;
    }

    if (has?.reviews?.length) {
      const target = has.reviews.find((rv) => typeof rv.route === "string" && rv.route)?.route;
      if (target) {
        setLocation(target);
        return;
      }
      setLocation(`/reviews?q=${safeQ}`);
      return;
    }

    if (has?.petFoods?.length) {
      const target = has.petFoods.find((p) => typeof p.route === "string" && p.route)?.route;
      if (target) {
        setLocation(target);
        return;
      }
      setLocation("/pet-food");
      return;
    }

    // Default behavior: go to recipe search.
    setLocation(`/recipes?q=${safeQ}`);
  };

  const handleResultClick = (item: any) => {
    setIsOpen(false);
    setSearchText("");

    if (item.type === "user") {
      setLocation(`/profile/${item.username}`);
      return;
    }

    if (item.type === "recipe") {
      setLocation(`/recipes/${item.id}`);
      return;
    }

    if (item.type === "review") {
      setLocation(item.route || `/reviews?q=${encodeURIComponent(item.name)}`);
      return;
    }

    if (item.type === "pet-food") {
      setLocation(item.route || "/pet-food");
      return;
    }

    if (item.type === "drink") {
      // Prefer explicit route for site categories.
      if (item.route) {
        setLocation(item.route);
        return;
      }
      // Fallback: go to drinks hub with a query.
      const q = String(item.name || "").trim();
      setLocation(q ? `/drinks?q=${encodeURIComponent(q)}` : "/drinks");
      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || allResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < allResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < allResults.length) {
          handleResultClick(allResults[selectedIndex]);
        } else {
          handleSubmit(e);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const hasResults =
    !!results &&
    (results.users.length > 0 ||
      results.recipes.length > 0 ||
      results.reviews.length > 0 ||
      results.drinks.length > 0 ||
      results.petFoods.length > 0);

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search users, recipes, reviews, drinks, pet food…"
          className="w-full pl-10 bg-muted border-border rounded-full"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (hasResults) setIsOpen(true);
          }}
          aria-label="Search site"
          autoComplete="off"
        />
      </form>

      {isOpen && (searchText.trim() || isLoading) && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full bg-background border border-border rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
        >
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : hasResults ? (
            <div className="py-2">
              {/* Users Section */}
              {results!.users.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="inline h-3 w-3 mr-1" />
                    Chefs
                  </div>
                  {results!.users.map((user, index) => {
                    const globalIndex = index;
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleResultClick(user)}
                        className={cn(
                          "w-full px-3 py-2 flex items-center space-x-3 hover:bg-muted transition-colors text-left",
                          selectedIndex === globalIndex && "bg-muted"
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar} alt={user.displayName} />
                          <AvatarFallback>
                            {user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {user.displayName}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            @{user.username}
                            {user.isChef && user.specialty && ` • ${user.specialty}`}
                          </div>
                        </div>
                        {user.isChef && (
                          <ChefHat className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Recipes Section */}
              {results!.recipes.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Utensils className="inline h-3 w-3 mr-1" />
                    Recipes
                  </div>
                  {results!.recipes.map((recipe, index) => {
                    const globalIndex = results!.users.length + index;
                    return (
                      <button
                        key={String(recipe.id)}
                        onClick={() => handleResultClick(recipe)}
                        className={cn(
                          "w-full px-3 py-2 flex items-center space-x-3 hover:bg-muted transition-colors text-left",
                          selectedIndex === globalIndex && "bg-muted"
                        )}
                      >
                        {recipe.imageUrl && (
                          <img
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            className="h-10 w-10 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{recipe.title}</div>
                          {recipe.cookTime ? (
                            <div className="text-sm text-muted-foreground">
                              {recipe.cookTime} min
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Reviews Section */}
              {results!.reviews.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Star className="inline h-3 w-3 mr-1" />
                    Reviews
                  </div>
                  {results!.reviews.map((review, index) => {
                    const globalIndex =
                      results!.users.length + results!.recipes.length + index;
                    return (
                      <button
                        key={review.id}
                        onClick={() => handleResultClick(review)}
                        className={cn(
                          "w-full px-3 py-2 flex items-center space-x-3 hover:bg-muted transition-colors text-left",
                          selectedIndex === globalIndex && "bg-muted"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{review.name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            Search restaurant reviews
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Drinks Section */}
              {results!.drinks.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    🍹 Drinks
                  </div>
                  {results!.drinks.map((drink, index) => {
                    const globalIndex =
                      results!.users.length +
                      results!.recipes.length +
                      results!.reviews.length +
                      index;
                    return (
                      <button
                        key={`${drink.id}-${index}`}
                        onClick={() => handleResultClick(drink)}
                        className={cn(
                          "w-full px-3 py-2 flex items-center space-x-3 hover:bg-muted transition-colors text-left",
                          selectedIndex === globalIndex && "bg-muted"
                        )}
                      >
                        {drink.imageUrl ? (
                          <img
                            src={drink.imageUrl}
                            alt={drink.name}
                            className="h-10 w-10 rounded object-cover flex-shrink-0"
                          />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{drink.name}</div>
                          {drink.category ? (
                            <div className="text-sm text-muted-foreground capitalize">
                              {String(drink.category).replace(/-/g, " ")}
                            </div>
                          ) : drink.route ? (
                            <div className="text-sm text-muted-foreground truncate">
                              {drink.route}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pet Food Section */}
              {results!.petFoods.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <PawPrint className="inline h-3 w-3 mr-1" />
                    Pet Food
                  </div>
                  {results!.petFoods.map((pf, index) => {
                    const globalIndex =
                      results!.users.length +
                      results!.recipes.length +
                      results!.reviews.length +
                      results!.drinks.length +
                      index;
                    return (
                      <button
                        key={pf.id}
                        onClick={() => handleResultClick(pf)}
                        className={cn(
                          "w-full px-3 py-2 flex items-center space-x-3 hover:bg-muted transition-colors text-left",
                          selectedIndex === globalIndex && "bg-muted"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{pf.name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {pf.route}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No results found for "{searchText}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
