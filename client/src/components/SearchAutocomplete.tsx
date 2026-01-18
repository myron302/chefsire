import { useState, useEffect, useRef, FormEvent } from "react";
import { useLocation } from "wouter";
import { Search, User, ChefHat, Utensils } from "lucide-react";
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
    type: "drink";
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

  // Debug: Log component mount
  useEffect(() => {
    console.log("[SearchAutocomplete] Component mounted");
    toast({
      title: "Search Ready",
      description: "SearchAutocomplete component loaded successfully",
      duration: 2000,
    });
  }, []);

  // Flatten results for keyboard navigation
  const allResults = results
    ? [
        ...results.users.map((u) => ({ ...u, category: "Users" })),
        ...results.recipes.map((r) => ({ ...r, category: "Recipes" })),
        ...results.drinks.map((d) => ({ ...d, category: "Drinks" })),
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
    console.log("[SearchAutocomplete] Form submitted with query:", searchText);
    toast({
      title: "Search Submitted",
      description: `Searching for: ${searchText || "(empty)"}`,
      duration: 2000,
    });
    const q = searchText.trim();
    setIsOpen(false);
    if (q) {
      setLocation(`/recipes?q=${encodeURIComponent(q)}`);
    } else {
      setLocation("/recipes");
    }
  };

  const handleResultClick = (item: any) => {
    console.log("[SearchAutocomplete] Result clicked:", item);
    setIsOpen(false);
    setSearchText("");

    if (item.type === "user") {
      setLocation(`/profile/${item.username}`);
    } else if (item.type === "recipe") {
      setLocation(`/recipes/${item.id}`);
    } else if (item.type === "drink") {
      setLocation(`/drinks/${item.id}`);
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

  const hasResults = results && (results.users.length > 0 || results.recipes.length > 0 || results.drinks.length > 0);

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search recipes, chefs, or ingredients..."
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
              {results.users.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="inline h-3 w-3 mr-1" />
                    Chefs
                  </div>
                  {results.users.map((user, index) => {
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
                          <div className="font-medium truncate">{user.displayName}</div>
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
              {results.recipes.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Utensils className="inline h-3 w-3 mr-1" />
                    Recipes
                  </div>
                  {results.recipes.map((recipe, index) => {
                    const globalIndex = results.users.length + index;
                    return (
                      <button
                        key={recipe.id}
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
                          {recipe.cookTime && (
                            <div className="text-sm text-muted-foreground">
                              {recipe.cookTime} min
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Drinks Section */}
              {results.drinks.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    🍹 Drinks
                  </div>
                  {results.drinks.map((drink, index) => {
                    const globalIndex =
                      results.users.length + results.recipes.length + index;
                    return (
                      <button
                        key={drink.id}
                        onClick={() => handleResultClick(drink)}
                        className={cn(
                          "w-full px-3 py-2 flex items-center space-x-3 hover:bg-muted transition-colors text-left",
                          selectedIndex === globalIndex && "bg-muted"
                        )}
                      >
                        {drink.imageUrl && (
                          <img
                            src={drink.imageUrl}
                            alt={drink.name}
                            className="h-10 w-10 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{drink.name}</div>
                          {drink.category && (
                            <div className="text-sm text-muted-foreground capitalize">
                              {drink.category.replace(/-/g, " ")}
                            </div>
                          )}
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
