import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Droplets, Clock, Heart, Target, Sparkles, Wine, 
  Search, Share2, ArrowLeft, GlassWater, Flame,
  TrendingUp, Award, Zap, Crown, Apple, Leaf,
  Clipboard, RotateCcw, Check, Home, Martini, Coffee
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
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
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

  const descriptors = new Set(['fresh', 'lime', 'lemon', 'ginger', 'tomato', 'cranberry', 'pineapple', 'coffee', 'triple']);
  if (descriptors.has(unit.toLowerCase())) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item';
  }

  if (item.includes('optional')) {
    item = item.replace('optional', '').trim();
    return m(amount, unit, item, 'optional');
  }
  
  return m(amount, unit, item);
};

const vodkaCocktails = [
  {
    id: 'vodka-1',
    name: 'Moscow Mule',
    description: 'Spicy ginger beer with vodka and lime in copper mug',
    spiritType: 'Vodka',
    origin: 'Los Angeles, USA',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: { calories: 182, carbs: 18, sugar: 16, alcohol: 11 },
    ingredients: ['2 oz Vodka', '0.5 oz Fresh Lime Juice', '6 oz Ginger Beer', 'Lime Wedge', 'Fresh Mint', 'Ice'],
    profile: ['Spicy', 'Citrus', 'Refreshing', 'Effervescent'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 4892,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    category: 'Classic Vodka',
    garnish: 'Lime wedge, mint sprig',
    method: 'Build',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill copper mug with ice. Add vodka and lime juice. Top with ginger beer. Stir gently. Garnish with lime wedge and mint sprig.'
  },
  {
    id: 'vodka-2',
    name: 'Bloody Mary',
    description: 'Savory tomato juice cocktail with spices and garnishes',
    spiritType: 'Vodka',
    origin: 'Paris, France',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: { calories: 125, carbs: 15, sugar: 11, alcohol: 14 },
    ingredients: ['2 oz Vodka', '6 oz Tomato Juice', '0.5 oz Fresh Lemon Juice', '3 dashes Worcestershire Sauce', '3 dashes Hot Sauce', '1 pinch Celery Salt', '1 pinch Black Pepper', '1 tsp Horseradish', 'Celery Stalk', 'Lemon Wedge', 'Olives', 'Ice'],
    profile: ['Savory', 'Spicy', 'Umami', 'Brunch'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 5234,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    category: 'Classic Vodka',
    garnish: 'Celery stalk, lemon wedge, olives',
    method: 'Build & Stir',
    abv: '12-16%',
    iba_official: true,
    instructions: 'Fill highball glass with ice. Add vodka, tomato juice, lemon juice, Worcestershire, hot sauce, celery salt, pepper, and horseradish. Stir well. Garnish elaborately.'
  },
  {
    id: 'vodka-3',
    name: 'Cosmopolitan',
    description: '90s icon with cranberry, lime, and triple sec',
    spiritType: 'Vodka',
    origin: 'New York City, USA',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 150, carbs: 8, sugar: 7, alcohol: 12 },
    ingredients: ['1.5 oz Vodka', '0.5 oz Triple Sec', '0.5 oz Fresh Lime Juice', '0.25 oz Cranberry Juice', 'Orange Peel', 'Ice'],
    profile: ['Fruity', 'Tart', 'Sophisticated', 'Pink'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 6234,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    category: 'Classic Vodka',
    garnish: 'Orange peel twist',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    instructions: 'Add vodka, triple sec, lime juice, and cranberry juice to shaker with ice. Shake for 10 seconds. Strain into chilled martini glass. Express orange peel over drink and garnish.'
  },
  {
    id: 'vodka-4',
    name: 'Vodka Martini',
    description: 'Clean, crisp, iconic cocktail',
    spiritType: 'Vodka',
    origin: 'United States',
    glassware: 'Martini Glass',
    servingSize: '3 oz',
    nutrition: { calories: 175, carbs: 1, sugar: 0, alcohol: 18 },
    ingredients: ['2.5 oz Vodka', '0.5 oz Dry Vermouth', 'Lemon Peel or Olives', 'Ice'],
    profile: ['Dry', 'Clean', 'Strong', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 4567,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    category: 'Classic Vodka',
    garnish: 'Lemon twist or olives',
    method: 'Stir',
    abv: '30-35%',
    iba_official: true,
    instructions: 'Add vodka and vermouth to mixing glass with ice. Stir for 30 seconds until very cold. Strain into chilled martini glass. Garnish with lemon twist or olives.'
  },
  {
    id: 'vodka-5',
    name: 'White Russian',
    description: 'Creamy coffee liqueur dessert cocktail',
    spiritType: 'Vodka',
    origin: 'Belgium',
    glassware: 'Old Fashioned Glass',
    servingSize: '6 oz',
    nutrition: { calories: 280, carbs: 18, sugar: 16, alcohol: 14 },
    ingredients: ['2 oz Vodka', '1 oz Coffee Liqueur', '1 oz Heavy Cream', 'Ice'],
    profile: ['Creamy', 'Coffee', 'Sweet', 'Dessert'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 3876,
    trending: false,
    featured: false,
    estimatedCost: 4.50,
    category: 'Creamy Vodka',
    garnish: 'None',
    method: 'Build',
    abv: '18-22%',
    iba_official: true,
    instructions: 'Fill old fashioned glass with ice. Add vodka and coffee liqueur. Stir. Float heavy cream on top. Serve unstirred for layered effect.'
  },
  {
    id: 'vodka-6',
    name: 'Espresso Martini',
    description: 'Caffeinated vodka cocktail with coffee',
    spiritType: 'Vodka',
    origin: 'London, England',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 12, sugar: 10, alcohol: 13 },
    ingredients: ['2 oz Vodka', '0.5 oz Coffee Liqueur', '1 oz Fresh Espresso', '0.25 oz Simple Syrup', '3 Coffee Beans', 'Ice'],
    profile: ['Coffee', 'Energizing', 'Smooth', 'Modern'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.8,
    reviews: 5892,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Modern Vodka',
    garnish: '3 coffee beans',
    method: 'Shake',
    abv: '20-24%',
    iba_official: true,
    instructions: 'Add vodka, coffee liqueur, fresh espresso, and simple syrup to shaker with ice. Shake vigorously for 15 seconds. Strain into chilled martini glass. Garnish with 3 coffee beans.'
  },
  {
    id: 'vodka-7',
    name: 'Vodka Tonic',
    description: 'Simple, refreshing highball',
    spiritType: 'Vodka',
    origin: 'Modern',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: { calories: 175, carbs: 15, sugar: 14, alcohol: 12 },
    ingredients: ['2 oz Vodka', '5 oz Tonic Water', 'Lime Wedge', 'Ice'],
    profile: ['Crisp', 'Bitter', 'Light', 'Refreshing'],
    difficulty: 'Very Easy',
    prepTime: 1,
    rating: 4.3,
    reviews: 2345,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    category: 'Classic Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill highball glass with ice. Add vodka. Top with tonic water. Stir gently. Garnish with lime wedge.'
  },
  {
    id: 'vodka-8',
    name: 'Lemon Drop',
    description: 'Sweet and sour citrus vodka cocktail',
    spiritType: 'Vodka',
    origin: 'San Francisco, USA',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 185, carbs: 14, sugar: 12, alcohol: 13 },
    ingredients: ['2 oz Vodka', '0.5 oz Triple Sec', '0.75 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', 'Sugar for rim', 'Lemon Wheel', 'Ice'],
    profile: ['Citrus', 'Sweet', 'Tart', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 3456,
    trending: false,
    featured: true,
    estimatedCost: 3.50,
    category: 'Classic Vodka',
    garnish: 'Sugar rim, lemon wheel',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Rim chilled martini glass with sugar. Add vodka, triple sec, lemon juice, and syrup to shaker with ice. Shake hard. Strain into prepared glass. Garnish with lemon wheel.'
  },
  {
    id: 'vodka-9',
    name: 'Sea Breeze',
    description: 'Fruity vodka with cranberry and grapefruit',
    spiritType: 'Vodka',
    origin: 'United States',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: { calories: 175, carbs: 16, sugar: 14, alcohol: 11 },
    ingredients: ['1.5 oz Vodka', '3 oz Cranberry Juice', '1.5 oz Grapefruit Juice', 'Lime Wedge', 'Ice'],
    profile: ['Fruity', 'Tart', 'Refreshing', 'Beach'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 2876,
    trending: false,
    featured: false,
    estimatedCost: 3.50,
    category: 'Fruity Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill highball glass with ice. Add vodka, cranberry juice, and grapefruit juice. Stir well. Garnish with lime wedge.'
  },
  {
    id: 'vodka-10',
    name: 'Black Russian',
    description: 'Simple vodka and coffee liqueur',
    spiritType: 'Vodka',
    origin: 'Belgium',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: { calories: 220, carbs: 15, sugar: 14, alcohol: 16 },
    ingredients: ['2 oz Vodka', '1 oz Coffee Liqueur', 'Ice'],
    profile: ['Coffee', 'Strong', 'Simple', 'Classic'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 1987,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    category: 'Classic Vodka',
    garnish: 'None',
    method: 'Build',
    abv: '25-30%',
    iba_official: true,
    instructions: 'Fill old fashioned glass with ice. Add vodka and coffee liqueur. Stir gently. Serve.'
  },
  {
    id: 'vodka-11',
    name: 'French Martini',
    description: 'Vodka with pineapple and raspberry',
    spiritType: 'Vodka',
    origin: 'New York City, USA',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 12, sugar: 10, alcohol: 13 },
    ingredients: ['2 oz Vodka', '0.5 oz Chambord', '1 oz Pineapple Juice', 'Ice'],
    profile: ['Fruity', 'Sweet', 'Sophisticated', 'Berry'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 3124,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    category: 'Modern Vodka',
    garnish: 'Raspberry',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Add vodka, Chambord, and pineapple juice to shaker with ice. Shake for 10 seconds. Strain into chilled martini glass. Garnish with raspberry.'
  },
  {
    id: 'vodka-12',
    name: 'Vodka Cranberry',
    description: 'Simple vodka and cranberry juice',
    spiritType: 'Vodka',
    origin: 'United States',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: { calories: 165, carbs: 14, sugar: 13, alcohol: 12 },
    ingredients: ['2 oz Vodka', '5 oz Cranberry Juice', 'Lime Wedge', 'Ice'],
    profile: ['Fruity', 'Tart', 'Simple', 'Easy'],
    difficulty: 'Very Easy',
    prepTime: 1,
    rating: 4.2,
    reviews: 4321,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    category: 'Fruity Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill highball glass with ice. Add vodka and cranberry juice. Stir. Garnish with lime wedge.'
  }
];

const vodkaCategories = [
  { id: 'all', name: 'All Cocktails', icon: Droplets, description: 'Every vodka cocktail' },
  { id: 'classic', name: 'Classic Vodka', icon: Crown, description: 'Traditional favorites' },
  { id: 'modern', name: 'Modern Vodka', icon: Sparkles, description: 'Contemporary creations' },
  { id: 'fruity', name: 'Fruity Vodka', icon: Apple, description: 'Refreshing & fruity' }
];

const methods = ['All Methods', 'Build', 'Shake', 'Stir'];

// SISTER PAGES
const sisterPotentPotablesPages = [
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

export default function VodkaCocktailsPage() {
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

  // Convert cocktails to RecipeKit format
  const vodkaRecipesWithMeasurements = useMemo(() => {
    return vodkaCocktails.map((c) => {
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

  const handleShareCocktail = async (cocktail: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[cocktail.id] ?? 1;
    const preview = cocktail.ingredients.slice(0, 4).join(' • ');
    const text = `${cocktail.name} • ${cocktail.category} • ${cocktail.method}\n${preview}${cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ''}`;
    const shareData = { title: cocktail.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${cocktail.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${cocktail.name}\n${text}\n${url}`);
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
        category: 'vodka-cocktails',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(35);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = vodkaRecipesWithMeasurements.filter(cocktail => {
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string> = {
        'classic': 'Classic Vodka',
        'modern': 'Modern Vodka',
        'fruity': 'Fruity Vodka',
        'creamy': 'Creamy Vodka'
      };
      if (cocktail.category !== categoryMap[selectedCategory]) return false;
    }
    if (selectedMethod !== 'All Methods' && !cocktail.method.includes(selectedMethod)) return false;
    const abvNum = parseInt(cocktail.abv);
    if (abvNum < alcoholRange[0] || abvNum > alcoholRange[1]) return false;
    if (searchQuery && !cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (onlyIBA && !cocktail.iba_official) return false;
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
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="cyan"
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
                  <Droplets className="h-6 w-6 text-cyan-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Vodka Cocktails</h1>
                  <Badge className="bg-cyan-100 text-cyan-800">Clean & Versatile</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <GlassWater className="fill-cyan-500 text-cyan-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-cyan-50 hover:border-cyan-300">
                        <Icon className="h-4 w-4 mr-2 text-cyan-500" />
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
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                        <Icon className="h-4 w-4 mr-2 text-blue-500" />
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
                <div className="text-2xl font-bold text-cyan-600">15%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">4.6★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-cyan-600">2.5 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{vodkaCocktails.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {vodkaCategories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-cyan-600 hover:bg-cyan-700" : "hover:bg-cyan-50"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search vodka cocktails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
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
            <Card className="mb-6 bg-white border-cyan-200">
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

          {/* Cocktails Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map(cocktail => {
              const useMetric = !!metricFlags[cocktail.id];
              const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-cyan-100 hover:border-cyan-300"
                  onClick={() => openRecipeModal(cocktail)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg">{cocktail.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToFavorites({
                            id: cocktail.id,
                            name: cocktail.name,
                            category: 'Vodka Cocktails',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-cyan-100 text-cyan-700">{cocktail.category}</Badge>
                      {cocktail.trending && (
                        <Badge className="bg-blue-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-cyan-500">
                          <GlassWater className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      {cocktail.iba_official && (
                        <Badge className="bg-blue-600">
                          <Award className="w-3 h-3 mr-1" />
                          IBA
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{cocktail.description}</p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-cyan-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-cyan-600">{cocktail.method.split(' ')[0]}</div>
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
                              i < Math.floor(cocktail.rating)
                                ? 'fill-cyan-500 text-cyan-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="font-medium ml-1">{cocktail.rating}</span>
                        <span className="text-gray-500 text-sm">({cocktail.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {cocktail.difficulty}
                      </Badge>
                    </div>

                    {/* RecipeKit Preview */}
                    {Array.isArray(cocktail.recipe?.measurements) && cocktail.recipe.measurements.length > 0 && (
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
                                setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? 1) - 1) }));
                              }}
                            >
                              −
                            </button>
                            <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                            <button
                              className="px-2 py-1 border rounded text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? 1) + 1) }));
                              }}
                            >
                              +
                            </button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [cocktail.id]: 1 }));
                              }}
                              title="Reset servings"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                          </div>
                        </div>

                        <ul className="text-sm leading-6 text-gray-800 space-y-1">
                          {cocktail.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                            const isNum = typeof ing.amount === 'number';
                            const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                            const show = useMetric && isNum
                              ? toMetric(ing.unit, Number(ing.amount) * servings)
                              : { amount: scaledDisplay, unit: ing.unit };

                            return (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-cyan-500 mt-0.5" />
                                <span>
                                  <span className="text-cyan-600 font-semibold">
                                    {show.amount} {show.unit}
                                  </span>{" "}
                                  {ing.item}
                                  {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                </span>
                              </li>
                            );
                          })}
                          {cocktail.recipe.measurements.length > 4 && (
                            <li className="text-xs text-gray-600">
                              …plus {cocktail.recipe.measurements.length - 4} more •{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecipeModal(cocktail);
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
                              const lines = cocktail.ingredients.map((ing: string) => `- ${ing}`);
                              const txt = `${cocktail.name} (serves ${servings})\n${lines.join('\n')}`;
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
                            handleShareCocktail(cocktail, servings);
                          }}>
                            <Share2 className="w-4 w-4 mr-1" /> Share
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetricFlags((prev) => ({ ...prev, [cocktail.id]: !prev[cocktail.id] }));
                            }}
                          >
                            {useMetric ? 'US' : 'Metric'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile?.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs bg-cyan-100 text-cyan-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                      <Button 
                        className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Droplets className="h-4 w-4 mr-2" />
                        View Recipe
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleShareCocktail(cocktail);
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
          <Card className="mt-12 bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-cyan-500" />
                The World of Vodka
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Droplets className="w-8 h-8 text-cyan-500 mb-2" />
                  <h3 className="font-semibold mb-2">Neutral Spirit</h3>
                  <p className="text-sm text-gray-700">
                    Vodka's clean, neutral character makes it the ultimate mixer. Its lack of strong flavor 
                    lets other ingredients shine.
                  </p>
                </div>
                <div>
                  <Award className="w-8 h-8 text-blue-500 mb-2" />
                  <h3 className="font-semibold mb-2">Purity Matters</h3>
                  <p className="text-sm text-gray-700">
                    Premium vodka undergoes multiple distillations and filtrations for exceptional smoothness 
                    and minimal impurities.
                  </p>
                </div>
                <div>
                  <Sparkles className="w-8 h-8 text-purple-500 mb-2" />
                  <h3 className="font-semibold mb-2">Versatility</h3>
                  <p className="text-sm text-gray-700">
                    From brunch classics to elegant martinis, vodka adapts to any occasion and mixes with 
                    virtually anything.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Progress Card */}
          <Card className="mt-12 bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-cyan-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-cyan-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-cyan-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-blue-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-cyan-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-cyan-100 text-cyan-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-blue-100 text-blue-800">{filteredCocktails.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-cyan-300 hover:bg-cyan-50"
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
