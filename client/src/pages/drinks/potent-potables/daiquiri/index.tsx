import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { GlassWater, Search, Share2, ArrowLeft, Heart, Check, RotateCcw, Crown, Sparkles, Droplets, Apple, Snowflake, Flame, Martini, Wine, Zap, Leaf, Home, Clipboard, Coffee } from "lucide-react";
import { useDrinks } from "@/contexts/DrinksContext";
import RecipeKit from "@/components/recipes/RecipeKit";

// -------- Helpers --------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const map: Record<number, string> = { 0: "", 1: "¼", 2: "½", 3: "¾" };
  const f = map[frac];
  if (!whole && f) return f;
  if (whole && f) return `${whole} ${f}`;
  return `${whole}`;
};
const scaleAmount = (base: number | string, servings: number) => {
  const n = typeof base === "number" ? base : parseFloat(String(base));
  if (Number.isNaN(n)) return base;
  return toNiceFraction(n * servings);
};
const toMetric = (unit: string, amount: number) => {
  const mlPerOz = 30;
  switch (unit) {
    case "oz": return { amount: Math.round(amount * mlPerOz), unit: "ml" };
    case "dash": return { amount: Math.round(amount * 1), unit: "dash" };
    default: return { amount, unit };
  }
};
const parseIngredient = (ingredient: string): Measured => {
  const fraction: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };
  const parts = ingredient.trim().replace(/\sof\s/i, " ").split(/\s+/);
  if (parts.length < 2) return { amount: "1", unit: "item", item: ingredient };
  let amountStr = parts[0];
  let amount: number | string = fraction[amountStr] ?? (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));
  let unit = parts[1];
  let item = parts.slice(2).join(" ");
  const descriptors = new Set(["fresh", "large", "simple", "rich", "dry"]);
  if (descriptors.has(unit.toLowerCase())) {
    item = [unit, item].filter(Boolean).join(" ").trim();
    unit = "item";
  }
  if (item.includes("(optional)")) {
    item = item.replace("(optional)", "").trim();
    return { amount, unit, item, note: "optional" };
  }
  return { amount, unit, item };
};

// -------- Data --------
const daiquiris = [
  {
    id: "daiquiri-1",
    name: "Classic Daiquiri",
    description: "Rum, lime, and sugar—perfectly balanced.",
    category: "classic",
    era: "1900s",
    method: "Shake",
    spiritType: "Rum",
    abv: "22%",
    prepTime: 3,
    difficulty: "Easy",
    rating: 4.8,
    reviews: 5213,
    featured: true,
    trending: true,
    ingredients: ["2 oz White Rum", "1 oz Fresh Lime Juice", "0.75 oz Simple Syrup", "Ice", "Lime Wheel"],
    instructions: "Shake rum, lime, and syrup with ice. Fine strain into a chilled coupe. Garnish with lime wheel."
  },
  {
    id: "daiquiri-2",
    name: "Hemingway Daiquiri",
    description: "Dry, citrusy riff with grapefruit and maraschino.",
    category: "classic",
    era: "1930s",
    method: "Shake",
    spiritType: "Rum",
    abv: "20%",
    prepTime: 4,
    difficulty: "Medium",
    rating: 4.7,
    reviews: 3120,
    featured: true,
    ingredients: [
      "2 oz White Rum",
      "0.5 oz Fresh Lime Juice",
      "0.5 oz Fresh Grapefruit Juice",
      "0.25 oz Maraschino Liqueur",
      "0.25 oz Simple Syrup",
      "Ice",
      "Grapefruit Peel"
    ],
    instructions: "Shake all with ice. Fine strain into coupe. Express grapefruit peel."
  },
  {
    id: "daiquiri-3",
    name: "Strawberry Daiquiri (Shaken)",
    description: "Bright berry notes; not frozen.",
    category: "fruit",
    era: "1970s",
    method: "Shake",
    spiritType: "Rum",
    abv: "19%",
    prepTime: 4,
    difficulty: "Easy",
    rating: 4.6,
    reviews: 2688,
    trending: true,
    ingredients: [
      "2 oz White Rum",
      "0.75 oz Fresh Lime Juice",
      "0.5 oz Simple Syrup",
      "3 Fresh Strawberries",
      "Ice"
    ],
    instructions: "Muddle strawberries with syrup. Add rum, lime, ice. Shake hard. Fine strain into coupe."
  },
  {
    id: "daiquiri-4",
    name: "Frozen Strawberry Daiquiri",
    description: "The frosty crowd-pleaser.",
    category: "frozen",
    era: "1980s",
    method: "Blend",
    spiritType: "Rum",
    abv: "14%",
    prepTime: 3,
    difficulty: "Easy",
    rating: 4.5,
    reviews: 4512,
    ingredients: [
      "1.5 oz White Rum",
      "1 oz Fresh Lime Juice",
      "0.75 oz Simple Syrup",
      "1 cup Frozen Strawberries",
      "1 cup Crushed Ice"
    ],
    instructions: "Blend all until smooth. Pour into chilled hurricane or coupe. Garnish with strawberry."
  },
  {
    id: "daiquiri-5",
    name: "Banana Daiquiri",
    description: "Tropical, creamy texture from fresh banana.",
    category: "frozen",
    era: "1970s",
    method: "Blend",
    spiritType: "Rum",
    abv: "13%",
    prepTime: 3,
    difficulty: "Easy",
    rating: 4.5,
    reviews: 1985,
    ingredients: [
      "1.5 oz Gold Rum",
      "0.75 oz Fresh Lime Juice",
      "0.5 oz Simple Syrup",
      "0.5 small Ripe Banana",
      "1 cup Crushed Ice"
    ],
    instructions: "Blend until smooth. Pour into glass. Optional nutmeg dust."
  },
  {
    id: "daiquiri-6",
    name: "Pineapple Daiquiri",
    description: "Juicy tropical twist.",
    category: "fruit",
    era: "1970s",
    method: "Shake",
    spiritType: "Rum",
    abv: "18%",
    prepTime: 3,
    difficulty: "Easy",
    rating: 4.4,
    reviews: 1522,
    ingredients: [
      "2 oz White Rum",
      "0.75 oz Fresh Lime Juice",
      "0.5 oz Simple Syrup",
      "1 oz Fresh Pineapple Juice",
      "Ice"
    ],
    instructions: "Shake all with ice. Fine strain into coupe. Garnish with pineapple leaf."
  },
  {
    id: "daiquiri-7",
    name: "Coconut Daiquiri",
    description: "Silky coconut with bright lime.",
    category: "tropical",
    era: "modern",
    method: "Shake",
    spiritType: "Rum",
    abv: "17%",
    prepTime: 4,
    difficulty: "Medium",
    rating: 4.6,
    reviews: 1105,
    ingredients: [
      "1.5 oz White Rum",
      "0.5 oz Coconut Cream",
      "0.75 oz Fresh Lime Juice",
      "0.5 oz Simple Syrup",
      "Ice"
    ],
    instructions: "Shake hard with plenty of ice. Fine strain into coupe. Lime wheel garnish."
  },
  {
    id: "daiquiri-8",
    name: "Mulata Daiquiri",
    description: "Rum, cacao, and lime—Cuban classic riff.",
    category: "cuban",
    era: "1940s",
    method: "Shake",
    spiritType: "Rum",
    abv: "20%",
    prepTime: 4,
    difficulty: "Medium",
    rating: 4.5,
    reviews: 862,
    featured: true,
    ingredients: [
      "2 oz Aged Rum",
      "0.5 oz Crème de Cacao",
      "0.75 oz Fresh Lime Juice",
      "0.25 oz Simple Syrup",
      "1 dash Angostura Bitters",
      "Ice"
    ],
    instructions: "Shake all with ice. Fine strain into coupe. Optional cocoa dust."
  },
  {
    id: "daiquiri-9",
    name: "Frozen Mango Daiquiri",
    description: "Sunny, smooth, and slushy.",
    category: "frozen",
    era: "modern",
    method: "Blend",
    spiritType: "Rum",
    abv: "14%",
    prepTime: 3,
    difficulty: "Easy",
    rating: 4.5,
    reviews: 1210,
    ingredients: [
      "1.5 oz White Rum",
      "1 oz Fresh Lime Juice",
      "0.5 oz Simple Syrup",
      "1 cup Frozen Mango",
      "1 cup Crushed Ice"
    ],
    instructions: "Blend until smooth. Pour into chilled glass. Mango slice garnish."
  },
  {
    id: "daiquiri-10",
    name: "Chartreuse Daiquiri",
    description: "Herbal kick with green chartreuse.",
    category: "modern",
    era: "modern",
    method: "Shake",
    spiritType: "Rum",
    abv: "22%",
    prepTime: 3,
    difficulty: "Medium",
    rating: 4.6,
    reviews: 744,
    ingredients: [
      "1.5 oz White Rum",
      "0.5 oz Green Chartreuse",
      "0.75 oz Fresh Lime Juice",
      "0.5 oz Simple Syrup",
      "Ice"
    ],
    instructions: "Shake hard with ice. Fine strain into coupe. Express lime."
  }
];

const styleCategories = [
  { id: "all", name: "All Styles", color: "bg-teal-500", icon: GlassWater, description: "Every daiquiri" },
  { id: "classic", name: "Classics", color: "bg-emerald-600", icon: Martini, description: "Original formulas" },
  { id: "fruit", name: "Fruit", color: "bg-teal-600", icon: Apple, description: "Berry & tropical twists" },
  { id: "frozen", name: "Frozen", color: "bg-cyan-600", icon: Snowflake, description: "Blended favorites" },
  { id: "cuban", name: "Cuban Heritage", color: "bg-amber-600", icon: Flame, description: "Historic riffs" },
];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
  { id: 'gin', name: 'Gin', path: '/drinks/potent-potables/gin', icon: Droplets, description: 'Botanical spirits' },
  { id: 'cognac', name: 'Cognac & Brandy', path: '/drinks/potent-potables/cognac-brandy', icon: Wine, description: 'French elegance' },
  { id: 'liqueurs', name: 'Liqueurs', path: '/drinks/potent-potables/liqueurs', icon: Sparkles, description: 'Sweet & strong' },
  { id: 'scotch', name: 'Scotch & Irish', path: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine, description: 'UK whiskeys' },
  { id: 'martinis', name: 'Martinis', path: '/drinks/potent-potables/martinis', icon: Martini, description: 'Elegant classics' },
  { id: 'spritz', name: 'Spritz & Mimosas', path: '/drinks/potent-potables/spritz', icon: Sparkles, description: 'Bubbly refreshers' },
  { id: 'classic', name: 'Classic Cocktails', path: '/drinks/potent-potables/cocktails', icon: Wine, description: 'Timeless recipes' },
  { id: 'seasonal', name: 'Seasonal', path: '/drinks/potent-potables/seasonal', icon: Sparkles, description: 'Festive drinks' },
  { id: 'hot-drinks', name: 'Hot Drinks', path: '/drinks/potent-potables/hot-drinks', icon: Flame, description: 'Warming cocktails' },
  { id: 'mocktails', name: 'Mocktails', path: '/drinks/potent-potables/mocktails', icon: Sparkles, description: 'Zero-proof' }
];

// CROSS-HUB
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'protein', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'detox', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing blends' },
  { id: 'all', name: 'All Drinks', icon: Wine, route: '/drinks', description: 'Browse everything' }
];

export default function DaiquiriPage() {
  const { addToFavorites, isFavorite, addToRecentlyViewed, userProgress, incrementDrinksMade, addPoints } = useDrinks();

  const [activeTab, setActiveTab] = useState<"browse" | "style" | "featured">("browse");
  const [selectedStyle, setSelectedStyle] = useState("all");
  const [sortBy, setSortBy] = useState("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const withMeasurements = useMemo(() => {
    return daiquiris.map((d) => {
      const measurements = d.ingredients.map(parseIngredient);
      return { ...d, recipe: { servings: 1, measurements, directions: [d.instructions] } };
    });
  }, []);

  const filtered = withMeasurements
    .filter((c) => {
      if (selectedStyle !== "all") {
        const style = c.category?.toLowerCase() ?? "";
        if (!style.includes(selectedStyle)) return false;
      }
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "trending") return (b.reviews ?? 0) - (a.reviews ?? 0);
      if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "abv") return parseInt(b.abv) - parseInt(a.abv);
      return 0;
    });

  const featured = withMeasurements.filter((c) => c.featured);

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleComplete = () => {
    if (selectedRecipe) {
      addToRecentlyViewed({ id: selectedRecipe.id, name: selectedRecipe.name, category: "daiquiri", timestamp: Date.now() });
      incrementDrinksMade();
      addPoints(45);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const handleShare = async (cocktail: any, servingsOverride?: number) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const servings = servingsOverride ?? servingsById[cocktail.id] ?? 1;
    const preview = cocktail.ingredients.slice(0, 4).join(" • ");
    const text = `${cocktail.name} • ${cocktail.category} • ${cocktail.era}\n${preview}${
      cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ""
    }`;
    const shareData = { title: cocktail.name, text, url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(`${cocktail.name}\n${text}\n${url}`);
        alert("Recipe copied to clipboard!");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${cocktail.name}\n${text}\n${url}`);
        alert("Recipe copied to clipboard!");
      } catch {
        alert("Unable to share on this device.");
      }
    }
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="teal"
            pointsReward={45}
            onComplete={handleComplete}
            item={{
              id: selectedRecipe.id,
              name: selectedRecipe.name,
              prepTime: selectedRecipe.prepTime,
              directions: selectedRecipe.recipe?.directions || [],
              measurements: selectedRecipe.recipe?.measurements || [],
              baseNutrition: {},
              defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1,
            }}
          />
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link href="/drinks/potent-potables">
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Potent Potables
                  </Button>
                </Link>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-2">
                  <GlassWater className="h-6 w-6 text-teal-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Daiquiri</h1>
                  <Badge className="bg-teal-100 text-teal-800">Rum Classics</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <Droplets className="fill-teal-500 text-teal-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Home className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">Explore Other Drink Categories</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {otherDrinkHubs.map((hub) => {
                  const Icon = hub.icon;
                  return (
                    <Link key={hub.id} href={hub.route}>
                      <Button variant="outline" className="w-full justify-start hover:bg-teal-50 hover:border-teal-300">
                        <Icon className="h-4 w-4 mr-2 text-teal-500" />
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

          {/* SISTER PAGES NAVIGATION */}
          <Card className="bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-emerald-50 hover:border-emerald-300">
                        <Icon className="h-4 w-4 mr-2 text-emerald-500" />
                        <div className="text-left flex-1">
                          <div className="font-medium text-sm">{page.name}</div>
                          <div className="text-xs text-gray-500">{page.description}</div>
                        </div>
                        <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-teal-600">18%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">4.6★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-cyan-600">3.3 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-teal-600">{daiquiris.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
            {[
              { id: "browse", label: "Browse", icon: Search },
              { id: "style", label: "By Style", icon: Martini },
              { id: "featured", label: "Featured", icon: Crown },
            ].map((t) => {
              const Icon = t.icon as any;
              return (
                <Button
                  key={t.id}
                  variant={activeTab === (t.id as any) ? "default" : "ghost"}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex-1 ${activeTab === (t.id as any) ? "bg-white shadow-sm" : ""}`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {t.label}
                </Button>
              );
            })}
          </div>

          {/* Browse */}
          {activeTab === "browse" && (
            <div>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search daiquiris…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="trending">Most Popular</option>
                    <option value="rating">Highest Rated</option>
                    <option value="abv">Highest ABV</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((c) => {
                  const useMetric = !!metricFlags[c.id];
                  const servings = servingsById[c.id] ?? (c.recipe?.servings || 1);

                  return (
                    <Card key={c.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-1">{c.name}</CardTitle>
                            <p className="text-sm text-gray-600 mb-2">{c.description}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              addToFavorites({ id: c.id, name: c.name, category: "daiquiri", timestamp: Date.now() })
                            }
                            className="text-gray-400 hover:text-teal-500"
                          >
                            <Heart className={`h-4 w-4 ${isFavorite(c.id) ? "fill-teal-500 text-teal-500" : ""}`} />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-teal-100 text-teal-800">{c.spiritType}</Badge>
                          <Badge variant="outline">{c.era}</Badge>
                          {c.trending && <Badge className="bg-emerald-100 text-emerald-800">Trending</Badge>}
                        </div>
                      </CardHeader>

                      <CardContent>
                        {/* Quick stats */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                          <div>
                            <div className="font-bold text-teal-600">{c.abv}</div>
                            <div className="text-gray-500">ABV</div>
                          </div>
                          <div>
                            <div className="font-bold text-emerald-600">{c.prepTime}min</div>
                            <div className="text-gray-500">Prep</div>
                          </div>
                          <div>
                            <div className="font-bold text-teal-600">{c.method}</div>
                            <div className="text-gray-500">Method</div>
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <GlassWater
                                key={i}
                                className={`w-4 h-4 ${i < Math.floor(c.rating) ? "fill-teal-500 text-teal-500" : "text-gray-300"}`}
                              />
                            ))}
                            <span className="font-medium ml-1">{c.rating}</span>
                            <span className="text-gray-500 text-sm">({c.reviews})</span>
                          </div>
                          <Badge variant="outline" className="text-xs">{c.difficulty}</Badge>
                        </div>

                        {/* RecipeKit preview */}
                        {Array.isArray(c.recipe?.measurements) && c.recipe.measurements.length > 0 && (
                          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold text-gray-900">
                                Recipe (serves {servings})
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  className="px-2 py-1 border rounded text-sm"
                                  onClick={() => setServingsById((p) => ({ ...p, [c.id]: clamp((p[c.id] ?? 1) - 1) }))}
                                >
                                  −
                                </button>
                                <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                                <button
                                  className="px-2 py-1 border rounded text-sm"
                                  onClick={() => setServingsById((p) => ({ ...p, [c.id]: clamp((p[c.id] ?? 1) + 1) }))}
                                >
                                  +
                                </button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setServingsById((p) => ({ ...p, [c.id]: 1 }))}
                                  title="Reset servings"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                                </Button>
                              </div>
                            </div>

                            <ul className="text-sm leading-6 text-gray-800 space-y-1">
                              {c.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                                const isNum = typeof ing.amount === "number";
                                const scaled = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                                const show = useMetric && isNum
                                  ? toMetric(ing.unit, Number(ing.amount) * servings)
                                  : { amount: scaled, unit: ing.unit };
                                return (
                                  <li key={i} className="flex items-start gap-2">
                                    <Check className="h-4 w-4 text-teal-500 mt-0.5" />
                                    <span>
                                      <span className="text-teal-600 font-semibold">
                                        {show.amount} {show.unit}
                                      </span>{" "}
                                      {ing.item}
                                      {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                    </span>
                                  </li>
                                );
                              })}
                              {c.recipe.measurements.length > 4 && (
                                <li className="text-xs text-gray-600">
                                  …plus {c.recipe.measurements.length - 4} more •{" "}
                                  <button type="button" onClick={() => openRecipeModal(c)} className="underline">
                                    Show more
                                  </button>
                                </li>
                              )}
                            </ul>

                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const lines = c.ingredients.map((ing: string) => `- ${ing}`);
                                  const txt = `${c.name} (serves ${servings})\n${lines.join("\n")}`;
                                  try {
                                    await navigator.clipboard.writeText(txt);
                                    alert("Recipe copied!");
                                  } catch {
                                    alert("Unable to copy.");
                                  }
                                }}
                              >
                                <Clipboard className="w-4 h-4 mr-1" /> Copy
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleShare(c, servings)}>
                                <Share2 className="w-4 h-4 mr-1" /> Share
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMetricFlags((p) => ({ ...p, [c.id]: !p[c.id] }))}
                              >
                                {metricFlags[c.id] ? "US" : "Metric"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => openRecipeModal(c)}>
                            <GlassWater className="h-4 w-4 mr-2" />
                            Make Daiquiri
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleShare(c)}>
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Zero-proof nudge */}
              <Card className="mt-8 bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-600" />
                    Prefer zero-proof?
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-sm text-gray-700">
                    Check out <span className="font-semibold">Virgin Cocktails</span> for a <span className="italic">Virgin Daiquiri</span> and more non-alcoholic options.
                  </p>
                  <Link href="/drinks/potent-potables/virgin-cocktails">
                    <Button variant="outline" className="border-teal-300 hover:bg-teal-50">
                      Browse Virgin Cocktails
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* By Style */}
          {activeTab === "style" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {styleCategories.map((cat) => {
                const Icon = cat.icon as any;
                const list = daiquiris.filter((d) =>
                  cat.id === "all" ? true : (d.category || "").toLowerCase().includes(cat.id)
                );
                return (
                  <Card
                    key={cat.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedStyle(cat.id);
                      setActiveTab("browse");
                    }}
                  >
                    <CardHeader>
                      <div className="text-center">
                        <div className={`inline-flex p-3 ${cat.color.replace("bg-", "bg-").replace("-600", "-100")} rounded-full mb-3`}>
                          <Icon className={`w-8 h-8 ${cat.color.replace("bg-", "text-")}`} />
                        </div>
                        <CardTitle className="text-lg">{cat.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{cat.description}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className={`text-3xl font-bold ${cat.color.replace("bg-", "text-")} mb-1`}>{list.length}</div>
                      <div className="text-sm text-gray-600 mb-4">Daiquiris</div>
                      <Button className="w-full bg-teal-600 hover:bg-teal-700">Explore {cat.name}</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Featured */}
          {activeTab === "featured" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {featured.map((c) => (
                <Card key={c.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <Badge className="bg-teal-600 text-white mb-2">Featured</Badge>
                    <CardTitle className="text-xl">{c.name}</CardTitle>
                    <p className="text-gray-600 mt-1">{c.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-teal-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-xl font-bold text-teal-600">{c.abv}</div>
                        <div className="text-xs text-gray-600">ABV</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-emerald-600">{c.prepTime}min</div>
                        <div className="text-xs text-gray-600">Prep</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-teal-600">{c.method}</div>
                        <div className="text-xs text-gray-600">Method</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-emerald-600">{c.difficulty}</div>
                        <div className="text-xs text-gray-600">Level</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                      <ul className="space-y-1">
                        {c.ingredients.map((ing: string, i: number) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <Droplets className="h-3 w-3 text-teal-500" />
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 mb-2">Instructions:</h4>
                      <p className="text-sm text-gray-700">{c.instructions}</p>
                    </div>

                    <div className="flex gap-3">
                      <Button className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => openRecipeModal(c)}>
                        <GlassWater className="h-4 w-4 mr-2" />
                        Make Daiquiri
                      </Button>
                      <Button variant="outline" onClick={() => handleShare(c)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Your Progress Card */}
          <Card className="mt-12 bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-teal-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-teal-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-teal-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-emerald-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-cyan-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-cyan-100 text-cyan-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-teal-500" />
                      <span className="text-sm text-gray-600">Daiquiris Found:</span>
                      <Badge className="bg-teal-100 text-teal-800">{filtered.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-teal-300 hover:bg-teal-50"
                >
                  <ArrowLeft className="h-4 w-4 mr-2 rotate-90" />
                  Back to Top
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
