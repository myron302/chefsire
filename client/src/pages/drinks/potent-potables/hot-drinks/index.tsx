import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Coffee, Clock, Heart, Target, Sparkles, Wine, 
  Search, Share2, ArrowLeft, GlassWater, Flame,
  TrendingUp, Award, Zap, Crown, Apple, Leaf,
  Clipboard, RotateCcw, Check, Home, Martini, Droplets
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '¼', 2: '½', 3: '¾' };
  const fracStr = fracMap[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};
const scaleAmount = (baseAmount: number | string, servings: number) => {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

const toMetric = (unit: string, amount: number) => {
  const mlPerOz = 30;
  const mlPerCup = 240;
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'dash': return { amount: Math.round(amount * 1), unit: 'dash' };
    case 'tbsp': return { amount: Math.round(amount * 15), unit: 'ml' };
    default: return { amount, unit };
  }
};

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125
  };
  
  const parts = ingredient.trim().replace(/\sof\s/i, ' ').replace(/[()]/g, '').split(/\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ?? 
    (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  return m(amount, unit, item);
};

const hotDrinks = [
  {
    id: 'hot-1',
    name: 'Irish Coffee',
    description: 'Classic hot coffee with Irish whiskey and cream',
    spiritType: 'Irish Whiskey',
    origin: 'Ireland',
    glassware: 'Irish Coffee Glass',
    servingSize: '8 oz',
    nutrition: { calories: 195, carbs: 10, sugar: 8, alcohol: 14 },
    ingredients: ['1.5 oz Irish Whiskey', '6 oz Hot Coffee', '2 tsp Brown Sugar', '1 oz Heavy Cream lightly whipped', 'Coffee beans'],
    profile: ['Warm', 'Coffee', 'Creamy', 'Comforting'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 5234,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    category: 'Coffee Cocktails',
    garnish: 'Whipped cream, coffee beans',
    method: 'Build',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Warm Irish coffee glass with hot water, discard. Add brown sugar and hot coffee, stir to dissolve. Add Irish whiskey, stir. Float whipped cream on top by pouring over back of spoon. Garnish with coffee beans.'
  },
  {
    id: 'hot-2',
    name: 'Hot Toddy',
    description: 'Warm whiskey with honey, lemon, and spices',
    spiritType: 'Bourbon',
    origin: 'Scotland',
    glassware: 'Irish Coffee Glass',
    servingSize: '8 oz',
    nutrition: { calories: 175, carbs: 12, sugar: 10, alcohol: 12 },
    ingredients: ['2 oz Bourbon or Whiskey', '1 tbsp Honey', '0.5 oz Fresh Lemon Juice', '6 oz Hot Water', '1 Cinnamon Stick', '3 Cloves', 'Lemon Wheel', 'Star Anise'],
    profile: ['Warm', 'Soothing', 'Spicy', 'Medicinal'],
    difficulty: 'Very Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 4892,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    category: 'Whiskey Hot Drinks',
    garnish: 'Cinnamon stick, lemon wheel, star anise',
    method: 'Build',
    abv: '12-15%',
    iba_official: false,
    instructions: 'Add honey and lemon juice to glass. Add hot water and stir until honey dissolves. Add bourbon, cinnamon stick, and cloves. Stir gently. Garnish with lemon wheel and star anise.'
  },
  {
    id: 'hot-3',
    name: 'Mulled Wine',
    description: 'Spiced red wine heated with citrus and aromatics',
    spiritType: 'Red Wine',
    origin: 'Europe',
    glassware: 'Mug',
    servingSize: '8 oz',
    nutrition: { calories: 220, carbs: 18, sugar: 14, alcohol: 10 },
    ingredients: ['1 bottle Red Wine', '0.25 cup Brandy', '0.25 cup Honey', '2 Cinnamon Sticks', '6 Cloves', '3 Star Anise', '1 Orange sliced', '1 Lemon sliced', 'Fresh Nutmeg'],
    profile: ['Warm', 'Spiced', 'Festive', 'Aromatic'],
    difficulty: 'Easy',
    prepTime: 20,
    rating: 4.8,
    reviews: 6234,
    trending: false,
    featured: true,
    estimatedCost: 3.00,
    category: 'Wine Hot Drinks',
    garnish: 'Orange slice, cinnamon stick',
    method: 'Simmer',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Combine all ingredients in pot. Heat gently (do not boil) for 15-20 minutes. Strain and serve warm in mugs. Garnish each serving with orange slice and cinnamon stick.'
  },
  {
    id: 'hot-4',
    name: 'Hot Buttered Rum',
    description: 'Rich rum drink with butter and warm spices',
    spiritType: 'Dark Rum',
    origin: 'Colonial America',
    glassware: 'Mug',
    servingSize: '8 oz',
    nutrition: { calories: 295, carbs: 20, sugar: 16, alcohol: 12 },
    ingredients: ['2 oz Dark Rum', '1 tbsp Butter', '1 tbsp Brown Sugar', '6 oz Hot Water', '1 Cinnamon Stick', 'Fresh Nutmeg', 'Cloves pinch', 'Vanilla Extract dash'],
    profile: ['Rich', 'Buttery', 'Spiced', 'Decadent'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.6,
    reviews: 3456,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    category: 'Rum Hot Drinks',
    garnish: 'Cinnamon stick, nutmeg',
    method: 'Build',
    abv: '12-15%',
    iba_official: false,
    instructions: 'Add butter, brown sugar, and spices to mug. Add hot water and stir until butter and sugar dissolve. Add rum and stir. Grate fresh nutmeg on top. Garnish with cinnamon stick.'
  },
  {
    id: 'hot-5',
    name: 'Tom and Jerry',
    description: 'Festive eggnog-style hot cocktail',
    spiritType: 'Brandy & Rum',
    origin: 'United States',
    glassware: 'Mug',
    servingSize: '8 oz',
    nutrition: { calories: 265, carbs: 22, sugar: 18, alcohol: 13 },
    ingredients: ['1 oz Brandy', '1 oz Dark Rum', '1 Egg separated', '1 tbsp Sugar', '6 oz Hot Milk', 'Vanilla Extract dash', 'Fresh Nutmeg', 'Allspice pinch'],
    profile: ['Creamy', 'Rich', 'Holiday', 'Warming'],
    difficulty: 'Hard',
    prepTime: 10,
    rating: 4.7,
    reviews: 2345,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    category: 'Holiday Drinks',
    garnish: 'Nutmeg, cinnamon',
    method: 'Build & Whip',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Beat egg yolk with sugar until thick. Beat egg white until stiff peaks form. Fold together with vanilla. Add 2 tbsp batter to mug. Add brandy and rum. Fill with hot milk. Stir well. Grate nutmeg on top.'
  },
  {
    id: 'hot-6',
    name: 'Café Brulot',
    description: 'Flaming New Orleans coffee with brandy and spices',
    spiritType: 'Brandy',
    origin: 'New Orleans, USA',
    glassware: 'Demitasse Cup',
    servingSize: '4 oz',
    nutrition: { calories: 145, carbs: 8, sugar: 6, alcohol: 12 },
    ingredients: ['2 oz Brandy', '4 oz Strong Hot Coffee', '2 Sugar Cubes', '4 Cloves', '1 Cinnamon Stick', 'Orange Peel strip', 'Lemon Peel strip'],
    profile: ['Dramatic', 'Spiced', 'Strong', 'Theatrical'],
    difficulty: 'Hard',
    prepTime: 8,
    rating: 4.8,
    reviews: 1876,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    category: 'Coffee Cocktails',
    garnish: 'Orange peel, cinnamon stick',
    method: 'Flame',
    abv: '18-22%',
    iba_official: false,
    instructions: 'In chafing dish, muddle sugar, cloves, cinnamon, and citrus peels. Add brandy and carefully ignite. Ladle flaming mixture while slowly adding hot coffee to extinguish flames. Serve in demitasse cups.'
  },
  {
    id: 'hot-7',
    name: 'Hot Apple Cider',
    description: 'Spiced apple cider with rum or bourbon',
    spiritType: 'Rum or Bourbon',
    origin: 'United States',
    glassware: 'Mug',
    servingSize: '10 oz',
    nutrition: { calories: 210, carbs: 28, sugar: 24, alcohol: 10 },
    ingredients: ['2 oz Dark Rum or Bourbon', '8 oz Hot Apple Cider', '1 Cinnamon Stick', '3 Cloves', '1 Star Anise', 'Orange Slice', 'Apple Slice', 'Caramel drizzle'],
    profile: ['Sweet', 'Spiced', 'Festive', 'Autumn'],
    difficulty: 'Very Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 4123,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    category: 'Seasonal Hot Drinks',
    garnish: 'Apple slice, cinnamon stick, star anise',
    method: 'Build',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Heat apple cider with cinnamon, cloves, and star anise for 5 minutes. Pour into mug, add rum or bourbon. Stir. Garnish with apple slice and cinnamon stick. Optional caramel drizzle on top.'
  },
  {
    id: 'hot-8',
    name: 'Hot Chocolate with Rum',
    description: 'Rich hot chocolate spiked with dark rum',
    spiritType: 'Dark Rum',
    origin: 'Caribbean',
    glassware: 'Mug',
    servingSize: '10 oz',
    nutrition: { calories: 285, carbs: 32, sugar: 26, alcohol: 10 },
    ingredients: ['2 oz Dark Rum', '8 oz Hot Chocolate', '1 oz Heavy Cream', 'Whipped Cream', 'Chocolate Shavings', 'Cinnamon dash', 'Sea Salt pinch'],
    profile: ['Rich', 'Chocolate', 'Creamy', 'Indulgent'],
    difficulty: 'Very Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 3876,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    category: 'Chocolate Drinks',
    garnish: 'Whipped cream, chocolate shavings',
    method: 'Build',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Make hot chocolate. Add dark rum and heavy cream. Stir well. Top with whipped cream. Garnish with chocolate shavings and pinch of cinnamon and sea salt.'
  }
];

const hotDrinkCategories = [
  { id: 'all', name: 'All Hot Drinks', icon: Coffee, description: 'Every warm cocktail' },
  { id: 'coffee', name: 'Coffee Cocktails', icon: Coffee, description: 'Hot coffee drinks' },
  { id: 'whiskey', name: 'Whiskey Hot Drinks', icon: Wine, description: 'Warm whiskey cocktails' },
  { id: 'seasonal', name: 'Seasonal', icon: Sparkles, description: 'Holiday favorites' }
];

const methods = ['All Methods', 'Build', 'Simmer', 'Flame'];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
  { id: 'gin', name: 'Gin', path: '/drinks/potent-potables/gin', icon: Droplets, description: 'Botanical spirits' },
  { id: 'cognac', name: 'Cognac & Brandy', path: '/drinks/potent-potables/cognac-brandy', icon: Wine, description: 'French elegance' },
  { id: 'liqueurs', name: 'Liqueurs', path: '/drinks/potent-potables/liqueurs', icon: Sparkles, description: 'Sweet & strong' },
  { id: 'daiquiri', name: 'Daiquiri', path: '/drinks/potent-potables/daiquiri', icon: Droplets, description: 'Rum classics' },
  { id: 'scotch', name: 'Scotch & Irish', path: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine, description: 'UK whiskeys' },
  { id: 'martinis', name: 'Martinis', path: '/drinks/potent-potables/martinis', icon: Martini, description: 'Elegant classics' },
  { id: 'spritz', name: 'Spritz & Mimosas', path: '/drinks/potent-potables/spritz', icon: Sparkles, description: 'Bubbly refreshers' },
  { id: 'classic', name: 'Classic Cocktails', path: '/drinks/potent-potables/cocktails', icon: Wine, description: 'Timeless recipes' },
  { id: 'seasonal', name: 'Seasonal', path: '/drinks/potent-potables/seasonal', icon: Sparkles, description: 'Festive drinks' },
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

export default function HotDrinksPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('All Methods');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [alcoholRange, setAlcoholRange] = useState([0, 45]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert drinks to RecipeKit format
  const hotDrinkRecipesWithMeasurements = useMemo(() => {
    return hotDrinks.map((c) => {
      const rawList = Array.isArray(c.ingredients) ? c.ingredients : [];
      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...c,
        recipe: {
          servings: 1,
          measurements,
          directions: [c.instructions]
        }
      };
    });
  }, []);

  const handleShareDrink = async (drink: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[drink.id] ?? 1;
    const preview = drink.ingredients.slice(0, 4).join(' • ');
    const text = `${drink.name} • ${drink.category} • ${drink.method}\n${preview}${drink.ingredients.length > 4 ? ` …plus ${drink.ingredients.length - 4} more` : ''}`;
    const shareData = { title: drink.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      addToRecentlyViewed({
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'hot-drinks',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(35);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredDrinks = hotDrinkRecipesWithMeasurements.filter(drink => {
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string> = {
        'coffee': 'Coffee Cocktails',
        'whiskey': 'Whiskey Hot Drinks',
        'seasonal': 'Seasonal Hot Drinks'
      };
      if (drink.category !== categoryMap[selectedCategory]) return false;
    }
    if (selectedMethod !== 'All Methods' && !drink.method.includes(selectedMethod)) return false;
    const abvNum = parseInt(drink.abv);
    if (abvNum < alcoholRange[0] || abvNum > alcoholRange[1]) return false;
    if (searchQuery && !drink.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (onlyIBA && !drink.iba_official) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'alcohol-low') return parseInt(a.abv) - parseInt(b.abv);
    if (sortBy === 'alcohol-high') return parseInt(b.abv) - parseInt(a.abv);
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    return 0;
  });

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="red"
            pointsReward={35}
            onComplete={handleCompleteRecipe}
            item={{
              id: selectedRecipe.id,
              name: selectedRecipe.name,
              prepTime: selectedRecipe.prepTime,
              directions: selectedRecipe.recipe?.directions || [],
              measurements: selectedRecipe.recipe?.measurements || [],
              baseNutrition: {},
              defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
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
                  <Coffee className="h-6 w-6 text-red-700" />
                  <h1 className="text-2xl font-bold text-gray-900">Hot Drinks</h1>
                  <Badge className="bg-red-100 text-red-800">Warm Cocktails</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <GlassWater className="fill-red-500 text-red-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                        <Icon className="h-4 w-4 mr-2 text-red-500" />
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
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                        <Icon className="h-4 w-4 mr-2 text-orange-500" />
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
                <div className="text-2xl font-bold text-red-700">11%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">4.7★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-700">6 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{hotDrinks.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {hotDrinkCategories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-red-700 hover:bg-red-800" : "hover:bg-red-50"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-md md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search hot drinks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 md:min-w-fit">
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-auto"
              >
                {methods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-auto"
              >
                <option value="trending">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="alcohol-low">Lowest ABV</option>
                <option value="alcohol-high">Highest ABV</option>
                <option value="cost-low">Most Budget-Friendly</option>
              </select>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full sm:w-auto"
              >
                <Target className="w-4 h-4 mr-2" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card className="mb-6 bg-white border-red-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Alcohol Content: {alcoholRange[0]}-{alcoholRange[1]}% ABV
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      value={alcoholRange[1]}
                      onChange={(e) => setAlcoholRange([alcoholRange[0], parseInt(e.target.value)])}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="iba-only"
                      checked={onlyIBA}
                      onChange={(e) => setOnlyIBA(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="iba-only" className="text-sm font-medium">
                      IBA Official Cocktails Only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drinks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrinks.map(drink => {
              const useMetric = !!metricFlags[drink.id];
              const servings = servingsById[drink.id] ?? (drink.recipe?.servings || 1);

              return (
                <Card 
                  key={drink.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-red-100 hover:border-red-300"
                  onClick={() => openRecipeModal(drink)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg">{drink.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToFavorites({
                            id: drink.id,
                            name: drink.name,
                            category: 'Hot Drinks',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-red-100 text-red-700">{drink.category}</Badge>
                      {drink.trending && (
                        <Badge className="bg-orange-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {drink.featured && (
                        <Badge className="bg-red-700">
                          <Coffee className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      {drink.iba_official && (
                        <Badge className="bg-blue-600">
                          <Award className="w-3 h-3 mr-1" />
                          IBA
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{drink.description}</p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-red-700">{drink.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-orange-600">{drink.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-red-700">{drink.method.split(' ')[0]}</div>
                        <div className="text-gray-500">Method</div>
                      </div>
                    </div>

                    {/* GLASS RATING */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(drink.rating)
                                ? 'fill-red-700 text-red-700'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="font-medium ml-1">{drink.rating}</span>
                        <span className="text-gray-500 text-sm">({drink.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {drink.difficulty}
                      </Badge>
                    </div>

                    {/* RecipeKit Preview */}
                    {Array.isArray(drink.recipe?.measurements) && drink.recipe.measurements.length > 0 && (
                      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-900">
                            Recipe (serves {servings})
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 border rounded text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? 1) - 1) }));
                              }}
                            >
                              −
                            </button>
                            <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                            <button
                              className="px-2 py-1 border rounded text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? 1) + 1) }));
                              }}
                            >
                              +
                            </button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [drink.id]: 1 }));
                              }}
                              title="Reset servings"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                          </div>
                        </div>

                        <ul className="text-sm leading-6 text-gray-800 space-y-1">
                          {drink.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                            const isNum = typeof ing.amount === 'number';
                            const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                            const show = useMetric && isNum
                              ? toMetric(ing.unit, Number(ing.amount) * servings)
                              : { amount: scaledDisplay, unit: ing.unit };

                            return (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-red-700 mt-0.5" />
                                <span>
                                  <span className="text-red-700 font-semibold">
                                    {show.amount} {show.unit}
                                  </span>{" "}
                                  {ing.item}
                                  {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                </span>
                              </li>
                            );
                          })}
                          {drink.recipe.measurements.length > 4 && (
                            <li className="text-xs text-gray-600">
                              …plus {drink.recipe.measurements.length - 4} more •{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecipeModal(drink);
                                }}
                                className="underline"
                              >
                                Show more
                              </button>
                            </li>
                          )}
                        </ul>

                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const lines = drink.ingredients.map((ing: string) => `- ${ing}`);
                              const txt = `${drink.name} (serves ${servings})\n${lines.join('\n')}`;
                              try {
                                await navigator.clipboard.writeText(txt);
                                alert('Recipe copied!');
                              } catch {
                                alert('Unable to copy.');
                              }
                            }}
                          >
                            <Clipboard className="w-4 h-4 mr-1" /> Copy
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            handleShareDrink(drink, servings);
                          }}>
                            <Share2 className="w-4 w-4 mr-1" /> Share
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetricFlags((prev) => ({ ...prev, [drink.id]: !prev[drink.id] }));
                            }}
                          >
                            {useMetric ? 'US' : 'Metric'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {drink.profile?.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs bg-red-100 text-red-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 md:min-w-fit">
                      <Button 
                        className="flex-1 bg-red-700 hover:bg-red-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(drink);
                        }}
                      >
                        <Coffee className="h-4 w-4 mr-2" />
                        View Recipe
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleShareDrink(drink);
                      }}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-red-700" />
                The Art of Hot Cocktails
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Coffee className="w-8 h-8 text-red-700 mb-2" />
                  <h3 className="font-semibold mb-2">Perfect Temperature</h3>
                  <p className="text-sm text-gray-700">
                    Hot cocktails should be served between 140-160°F. Too hot masks flavors, too cool loses the 
                    warming effect. Use a thermometer for precision.
                  </p>
                </div>
                <div>
                  <Award className="w-8 h-8 text-orange-600 mb-2" />
                  <h3 className="font-semibold mb-2">Spice Timing</h3>
                  <p className="text-sm text-gray-700">
                    Add spices like cinnamon, cloves, and star anise early to infuse flavors. Citrus peels go in 
                    last to preserve their bright, aromatic oils.
                  </p>
                </div>
                <div>
                  <Sparkles className="w-8 h-8 text-amber-600 mb-2" />
                  <h3 className="font-semibold mb-2">Winter Comfort</h3>
                  <p className="text-sm text-gray-700">
                    Hot cocktails are perfect for cold weather, holiday gatherings, and après-ski. They're also 
                    traditional remedies for colds (though not a cure!).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Progress Card */}
          <Card className="mt-12 bg-gradient-to-r from-red-50 to-orange-50 border-red-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-red-700" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-red-700" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-red-700 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-orange-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-red-700" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-red-100 text-red-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-gray-600">Hot Drinks Found:</span>
                      <Badge className="bg-orange-100 text-orange-800">{filteredDrinks.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-red-300 hover:bg-red-50"
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
