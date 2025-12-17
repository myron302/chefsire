// client/src/pages/drinks/caffeinated/matcha/index.tsx
import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Leaf,
  Heart,
  Star,
  Search,
  Share2,
  ArrowLeft,
  Camera,
  Zap,
  X,
  Check,
  Clipboard,
  RotateCcw,
  Sparkles,
  Coffee,
  Droplets,
  Sun,
  Crown,
  Flame,
} from "lucide-react";
import { useDrinks } from "@/contexts/DrinksContext";
import UniversalSearch from "@/components/UniversalSearch";
import RecipeKit from "@/components/recipes/RecipeKit";

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };

const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));

const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: "", 1: "¼", 2: "½", 3: "¾" };
  const fracStr = fracMap[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};

const scaleAmount = (baseAmount: number | string, servings: number) => {
  const n = typeof baseAmount === "number" ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

const toMetric = (unit: string, amount: number) => {
  const mlPerCup = 240,
    mlPerOz = 30,
    mlPerTbsp = 15,
    mlPerTsp = 5;
  switch (unit) {
    case "cup":
      return { amount: Math.round(amount * mlPerCup), unit: "ml" };
    case "oz":
      return { amount: Math.round(amount * mlPerOz), unit: "ml" };
    case "tbsp":
      return { amount: Math.round(amount * mlPerTbsp), unit: "ml" };
    case "tsp":
      return { amount: Math.round(amount * mlPerTsp), unit: "ml" };
    default:
      return { amount, unit };
  }
};

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    "½": 0.5,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "¼": 0.25,
    "¾": 0.75,
    "⅛": 0.125,
  };

  const parts = ingredient.trim().replace(/\sof\s/i, " ").split(/\s+/);
  if (parts.length < 2) return { amount: "1", unit: "item", item: ingredient };

  const amountStr = parts[0];
  const amount: number | string =
    fractionMap[amountStr] ?? (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  const unit = parts[1];
  const item = parts.slice(2).join(" ");

  return { amount, unit, item };
};

// ---------- Data ----------
const matchaDrinks = [
  {
    id: "classic-matcha-latte",
    name: "Classic Matcha Latte",
    description: "Creamy matcha with steamed milk and a smooth finish",
    ingredients: ["1 tsp matcha powder", "2 tbsp hot water", "8 oz milk", "1 tsp honey (optional)"],
    benefits: ["Calm focus", "Antioxidants", "Steady energy", "Creamy"],
    nutrition: { calories: 170, caffeine: 70, carbs: 14, sugar: 12, added_sugar: 0 },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.8,
    reviews: 1624,
    drinkType: "Latte",
    energyLevel: "Medium",
    featured: true,
    trending: true,
    bestTime: "Morning",
    image: "https://images.unsplash.com/photo-1582576163090-09d3b6f8f9b3?w=900&h=600&fit=crop",
    estimatedCost: 3.75,
  },
  {
    id: "iced-matcha-latte",
    name: "Iced Matcha Latte",
    description: "Refreshing chilled matcha with milk over ice",
    ingredients: ["1 tsp matcha powder", "2 tbsp hot water", "8 oz milk", "1 cup ice"],
    benefits: ["Refreshing", "Smooth", "Steady caffeine", "Antioxidants"],
    nutrition: { calories: 160, caffeine: 70, carbs: 13, sugar: 11, added_sugar: 0 },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.7,
    reviews: 1242,
    drinkType: "Iced",
    energyLevel: "Medium",
    featured: true,
    trending: true,
    bestTime: "Afternoon",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=900&h=600&fit=crop",
    estimatedCost: 3.75,
  },
  {
    id: "ceremonial-matcha",
    name: "Ceremonial Matcha",
    description: "Traditional whisked matcha — pure and vibrant",
    ingredients: ["1 tsp ceremonial matcha", "3 oz hot water"],
    benefits: ["Clean taste", "Focus", "Antioxidants", "Low calories"],
    nutrition: { calories: 10, caffeine: 70, carbs: 2, sugar: 0, added_sugar: 0 },
    difficulty: "Medium",
    prepTime: 4,
    rating: 4.9,
    reviews: 988,
    drinkType: "Pure",
    energyLevel: "Medium",
    featured: true,
    trending: false,
    bestTime: "Morning",
    image: "https://images.unsplash.com/photo-1528826194825-47f0f9f4be11?w=900&h=600&fit=crop",
    estimatedCost: 2.25,
  },
];

const drinkTypes = [
  { id: "pure", name: "Pure", icon: Leaf, description: "Traditional whisked matcha" },
  { id: "latte", name: "Latte", icon: Heart, description: "Creamy milk-based matcha" },
  { id: "specialty", name: "Specialty", icon: Sparkles, description: "Unique matcha blends" },
];

const benefitsList = [
  { id: "focus", name: "Calm Focus", description: "Smooth, steady alertness" },
  { id: "antioxidants", name: "Antioxidants", description: "Matcha is antioxidant-rich" },
  { id: "steady", name: "Steady Energy", description: "Great energy with less crash" },
];

const otherDrinkHubs = [
  { id: "espresso", name: "Espresso", icon: Coffee, route: "/drinks/caffeinated/espresso", description: "Bold shots" },
  { id: "cold-brew", name: "Cold Brew", icon: Droplets, route: "/drinks/caffeinated/cold-brew", description: "Smooth & chilled" },
  { id: "iced", name: "Iced Coffee", icon: Sun, route: "/drinks/caffeinated/iced", description: "Refreshing iced" },
  { id: "specialty", name: "Specialty", icon: Crown, route: "/drinks/caffeinated/specialty", description: "Unique caffeinated" },
  { id: "all-drinks", name: "All Drinks", icon: Flame, route: "/drinks", description: "Browse everything" },
];

export default function MatchaDrinksPage() {
  const { addToFavorites, isFavorite, addToRecentlyViewed, userProgress, incrementDrinksMade, addPoints } = useDrinks();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDrinkType, setSelectedDrinkType] = useState("");
  const [selectedBenefit, setSelectedBenefit] = useState("");
  const [maxCalories, setMaxCalories] = useState<number | "all">("all");
  const [onlyZeroSugar, setOnlyZeroSugar] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "caffeine" | "cost" | "calories">("rating");
  const [activeTab, setActiveTab] = useState<"browse" | "drink-types" | "benefits" | "featured" | "trending">("browse");
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const drinkRecipesWithMeasurements = useMemo(() => {
    return matchaDrinks.map((d) => {
      const rawList = Array.isArray(d.ingredients) ? d.ingredients : [];
      const measurements = rawList.map((ing: any) => (typeof ing === "string" ? parseIngredient(ing) : ing));
      return {
        ...d,
        recipe: {
          servings: 1,
          measurements,
          directions: [
            "Whisk matcha with hot water until frothy",
            "Add milk/base (hot or iced)",
            "Sweeten if desired",
            "Serve and enjoy",
          ],
        },
      };
    });
  }, []);

  const featuredDrinks = drinkRecipesWithMeasurements.filter((d) => d.featured);
  const trendingDrinks = drinkRecipesWithMeasurements.filter((d) => d.trending);

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      addToRecentlyViewed({
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: "caffeinated" as const,
        description: `${selectedRecipe.drinkType || ""} • ${selectedRecipe.bestTime || ""}`,
        ingredients: selectedRecipe.ingredients,
        nutrition: selectedRecipe.nutrition,
        difficulty: selectedRecipe.difficulty,
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        bestTime: selectedRecipe.bestTime,
        tags: selectedRecipe.benefits,
      });
      incrementDrinksMade();
      addPoints(25);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const handleShareDrink = async (drink: any, servingsOverride?: number) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const servings = servingsOverride ?? servingsById[drink.id] ?? drink.recipe?.servings ?? 1;
    const preview = drink.ingredients.slice(0, 2).join(" • ");
    const text = `${drink.name} • ${drink.drinkType} • ${drink.bestTime}\n${preview}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: drink.name, text, url });
      } else {
        await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`);
        alert("Recipe copied to clipboard!");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`);
        alert("Recipe copied to clipboard!");
      } catch {
        alert("Unable to share on this device.");
      }
    }
  };

  const handleSharePage = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Browse ${matchaDrinks.length} matcha drinks for calm focus and steady energy.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Matcha Drinks", text, url });
      } else {
        await navigator.clipboard.writeText(`Matcha Drinks\n${text}\n${url}`);
        alert("Link copied to clipboard!");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`Matcha Drinks\n${text}\n${url}`);
        alert("Link copied to clipboard!");
      } catch {
        alert("Unable to share on this device.");
      }
    }
  };

  const filteredDrinks = useMemo(() => {
    let filtered = drinkRecipesWithMeasurements.filter((drink) => {
      const matchesSearch =
        drink.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drink.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDrinkType || drink.drinkType === selectedDrinkType;
      const matchesBenefit =
        !selectedBenefit ||
        drink.benefits.some((b: string) => b.toLowerCase().includes(selectedBenefit.toLowerCase()));
      const matchesCalories = maxCalories === "all" || drink.nutrition.calories <= maxCalories;
      const matchesSugar = !onlyZeroSugar || drink.nutrition.added_sugar === 0;

      return matchesSearch && matchesType && matchesBenefit && matchesCalories && matchesSugar;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "caffeine":
          return (b.nutrition.caffeine || 0) - (a.nutrition.caffeine || 0);
        case "cost":
          return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case "calories":
          return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [drinkRecipesWithMeasurements, searchQuery, selectedDrinkType, selectedBenefit, maxCalories, onlyZeroSugar, sortBy]);

  // ✅ IMPORTANT: Reset is a simple function (no nested braces in JSX)
  const resetServings = (drinkId: string, defaultServings: number) => {
    setServingsById((prev) => ({ ...prev, [drinkId]: defaultServings }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowUniversalSearch(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
            </div>
          </div>
        </div>
      )}

      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => {
            setShowKit(false);
            setSelectedRecipe(null);
          }}
          accent="rose"
          pointsReward={25}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: selectedRecipe.nutrition || {},
            defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1,
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/caffeinated">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Caffeinated
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Leaf className="h-6 w-6 text-emerald-600" />
                <h1 className="text-2xl font-bold text-gray-900">Matcha Drinks</h1>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Calm & Focused</Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}>
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Cross hub nav */}
        <Card className="bg-gradient-to-r from-emerald-50 to-lime-50 border-emerald-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon as any;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-emerald-50 hover:border-emerald-300">
                      <Icon className="h-4 w-4 mr-2 text-emerald-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{hub.name}</div>
                        <div className="text-xs text-gray-500">{hub.description}</div>
                      </div>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: "browse", label: "Browse All", icon: Search },
            { id: "drink-types", label: "Drink Types", icon: Leaf },
            { id: "benefits", label: "Benefits", icon: Heart },
            { id: "featured", label: "Featured", icon: Star },
            { id: "trending", label: "Trending", icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 ${activeTab === tab.id ? "bg-emerald-600 shadow-sm !text-white hover:!text-white hover:bg-emerald-700" : ""}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Browse */}
        {activeTab === "browse" && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      placeholder="Search matcha drinks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedDrinkType}
                      onChange={(e) => setSelectedDrinkType(e.target.value)}
                    >
                      <option value="">All Types</option>
                      {drinkTypes.map((type) => (
                        <option key={type.id} value={type.name}>
                          {type.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {benefitsList.map((benefit) => (
                        <option key={benefit.id} value={benefit.name}>
                          {benefit.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={maxCalories}
                      onChange={(e) => setMaxCalories(e.target.value === "all" ? "all" : Number(e.target.value))}
                    >
                      <option value="all">All Calories</option>
                      <option value={100}>Under 100 cal</option>
                      <option value={150}>Under 150 cal</option>
                      <option value={200}>Under 200 cal</option>
                      <option value={300}>Under 300 cal</option>
                    </select>

                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                      <input type="checkbox" checked={onlyZeroSugar} onChange={(e) => setOnlyZeroSugar(e.target.checked)} />
                      Zero Added Sugar
                    </label>

                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="caffeine">Sort by Caffeine</option>
                      <option value="cost">Sort by Cost</option>
                      <option value="calories">Sort by Calories</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDrinks.map((drink) => {
                const useMetric = !!metricFlags[drink.id];
                const servings = servingsById[drink.id] ?? (drink.recipe?.servings || 1);

                return (
                  <Card
                    key={drink.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRecipeModal(drink);
                    }}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{drink.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{drink.description}</p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToFavorites({
                              id: drink.id,
                              name: drink.name,
                              category: "caffeinated",
                              description: drink.description,
                              ingredients: drink.ingredients,
                              nutrition: drink.nutrition,
                              difficulty: drink.difficulty,
                              prepTime: drink.prepTime,
                              rating: drink.rating,
                              drinkType: drink.drinkType,
                              bestTime: drink.bestTime,
                            });
                          }}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(drink.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{drink.drinkType}</Badge>
                        <Badge variant="outline">{drink.energyLevel}</Badge>
                        {drink.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-emerald-700">{drink.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-emerald-700">{drink.nutrition.caffeine}mg</div>
                          <div className="text-gray-500">Caffeine</div>
                        </div>
                        <div>
                          <div className="font-bold text-emerald-700">{drink.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{drink.rating}</span>
                          <span className="text-gray-500 text-sm">({drink.reviews})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {drink.difficulty}
                        </Badge>
                      </div>

                      {Array.isArray(drink.recipe?.measurements) && drink.recipe.measurements.length > 0 && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">Recipe (serves {servings})</div>

                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setServingsById((prev) => ({
                                    ...prev,
                                    [drink.id]: clamp((prev[drink.id] ?? (drink.recipe?.servings || 1)) - 1),
                                  }));
                                }}
                              >
                                -
                              </button>

                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>

                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setServingsById((prev) => ({
                                    ...prev,
                                    [drink.id]: clamp((prev[drink.id] ?? (drink.recipe?.servings || 1)) + 1),
                                  }));
                                }}
                              >
                                +
                              </button>

                              {/* ✅ Reset button is SIMPLE now */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resetServings(drink.id, drink.recipe?.servings || 1);
                                }}
                                title="Reset servings"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                              </Button>
                            </div>
                          </div>

                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {drink.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === "number";
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show =
                                useMetric && isNum
                                  ? toMetric(ing.unit, Number((ing.amount as number) * servings))
                                  : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                                  <span>
                                    <span className="text-amber-500 font-semibold">
                                      {show.amount} {show.unit}
                                    </span>{" "}
                                    {ing.item}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>

                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const lines = drink.ingredients.map((ing: string) => `- ${ing}`);
                                const txt = `${drink.name} (serves ${servings})\n${lines.join("\n")}`;
                                try {
                                  await navigator.clipboard.writeText(txt);
                                  alert("Recipe copied!");
                                } catch {
                                  alert("Unable to copy on this device.");
                                }
                              }}
                            >
                              <Clipboard className="w-4 h-4 mr-1" /> Copy
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareDrink(drink, servings);
                              }}
                            >
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMetricFlags((prev) => ({ ...prev, [drink.id]: !prev[drink.id] }));
                              }}
                            >
                              {useMetric ? "US" : "Metric"}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3">
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRecipeModal(drink);
                          }}
                        >
                          <Leaf className="h-4 w-4 mr-2" />
                          Make Drink (+25 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Featured */}
        {activeTab === "featured" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredDrinks.map((drink) => (
              <Card key={drink.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48">
                  {drink.image && <img src={drink.image} alt={drink.name} className="w-full h-full object-cover" />}
                  <Badge className="absolute top-4 left-4 bg-emerald-600 text-white">Featured</Badge>
                </div>
                <CardHeader>
                  <CardTitle>{drink.name}</CardTitle>
                  <p className="text-gray-600">{drink.description}</p>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRecipeModal(drink);
                    }}
                  >
                    <Leaf className="h-4 w-4 mr-2" />
                    Make This Drink
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Trending */}
        {activeTab === "trending" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingDrinks.map((drink) => (
              <Card key={drink.id} className="hover:shadow-lg transition-shadow border-2 border-emerald-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="md:max-w-3xl md:flex-1">
                      <CardTitle className="text-lg mb-1">{drink.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{drink.description}</p>
                    </div>
                    <Badge className="bg-red-400 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRecipeModal(drink);
                    }}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Progress */}
        <Card className="bg-gradient-to-r from-emerald-50 to-lime-50 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-emerald-700">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-emerald-700">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-emerald-700">
                    {userProgress.totalDrinksMade} Drinks Made
                  </Badge>
                </div>
              </div>
              <div className="text-center">
                <Progress value={userProgress.dailyGoalProgress} className="w-32 mb-2" />
                <div className="text-xs text-gray-500">Daily Goal Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
