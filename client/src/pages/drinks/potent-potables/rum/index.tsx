import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Palmtree, Clock, Heart, Star, Target, Sparkles, Sun, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Crown, Coffee, Leaf, Zap, Cherry, Waves,
  Droplets, BookOpen, Home, Apple, Wine, Martini,
  Clipboard, RotateCcw, Check
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
    default: return { amount, unit };
  }
};

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125
  };
  
  const parts = ingredient.trim().replace(/\sof\s/i, ' ').split(/\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ?? 
    (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  const descriptors = new Set(['fresh', 'white', 'dark', 'gold', 'aged', 'light']);
  if (descriptors.has(unit.toLowerCase())) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item';
  }

  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }
  
  return m(amount, unit, item);
};

const rumCocktails = [
  {
    id: 'rum-1',
    name: 'Mojito',
    description: 'Refreshing Cuban classic with mint and lime',
    spiritType: 'White Rum',
    origin: 'Havana, Cuba',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 217,
      carbs: 24,
      sugar: 20,
      alcohol: 13
    },
    ingredients: [
      '2 oz White Rum',
      '1 oz Fresh Lime Juice',
      '0.75 oz Simple Syrup',
      '8-10 Fresh Mint Leaves',
      'Soda Water (top)',
      'Ice'
    ],
    profile: ['Refreshing', 'Minty', 'Citrus', 'Tropical'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 5642,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Afternoon',
    occasion: 'Beach',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Mint sprig, lime wheel',
    method: 'Muddle & Build',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Muddle mint leaves with lime juice and simple syrup in glass. Add rum and ice. Top with soda water. Stir gently and garnish with mint sprig and lime wheel.'
  },
  {
    id: 'rum-2',
    name: 'Daiquiri',
    description: 'Perfect balance of rum, lime, and sugar',
    spiritType: 'White Rum',
    origin: 'Santiago de Cuba',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 186,
      carbs: 9,
      sugar: 7,
      alcohol: 15
    },
    ingredients: [
      '2 oz White Rum',
      '1 oz Fresh Lime Juice',
      '0.75 oz Simple Syrup',
      'Ice'
    ],
    profile: ['Clean', 'Citrus', 'Balanced', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 4328,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Lime wheel',
    method: 'Shake',
    abv: '20-24%',
    iba_official: true,
    instructions: 'Shake all ingredients vigorously with ice. Double strain into chilled coupe glass. Garnish with lime wheel.'
  },
  {
    id: 'rum-3',
    name: 'Piña Colada',
    description: 'Creamy tropical paradise in a glass',
    spiritType: 'White Rum',
    origin: 'San Juan, Puerto Rico',
    glassware: 'Hurricane Glass',
    servingSize: '12 oz',
    nutrition: {
      calories: 490,
      carbs: 58,
      sugar: 52,
      alcohol: 16
    },
    ingredients: [
      '2 oz White Rum',
      '3 oz Coconut Cream',
      '3 oz Pineapple Juice',
      'Pineapple Chunks (optional)',
      'Crushed Ice'
    ],
    profile: ['Creamy', 'Tropical', 'Sweet', 'Indulgent'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 6234,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Beach',
    occasion: 'Vacation',
    allergens: ['Coconut'],
    category: 'Tropical Rum',
    garnish: 'Pineapple wedge, cherry',
    method: 'Blend',
    abv: '12-15%',
    iba_official: true,
    instructions: 'Blend all ingredients with crushed ice until smooth. Pour into hurricane glass. Garnish with pineapple wedge and cherry.'
  },
  {
    id: 'rum-4',
    name: 'Mai Tai',
    description: 'Complex tiki classic with almond and citrus notes',
    spiritType: 'Dark Rum',
    origin: 'Oakland, California',
    glassware: 'Old Fashioned Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 254,
      carbs: 18,
      sugar: 15,
      alcohol: 17
    },
    ingredients: [
      '2 oz Dark Rum',
      '0.5 oz Orange Curaçao',
      '0.5 oz Orgeat Syrup',
      '1 oz Fresh Lime Juice',
      '0.25 oz Simple Syrup',
      'Crushed Ice'
    ],
    profile: ['Complex', 'Nutty', 'Citrus', 'Tropical'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 3987,
    trending: true,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Tiki Bar',
    allergens: ['Almonds'],
    category: 'Tiki Rum',
    garnish: 'Mint sprig, lime shell, pineapple',
    method: 'Shake',
    abv: '20-24%',
    iba_official: true,
    instructions: 'Shake all ingredients with ice. Strain over crushed ice in rocks glass. Garnish elaborately with mint sprig, spent lime shell, and pineapple.'
  },
  {
    id: 'rum-5',
    name: 'Dark and Stormy',
    description: 'Bold ginger beer and dark rum combination',
    spiritType: 'Dark Rum',
    origin: 'Bermuda',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 235,
      carbs: 26,
      sugar: 23,
      alcohol: 13
    },
    ingredients: [
      '2 oz Dark Rum',
      '4 oz Ginger Beer',
      '0.5 oz Fresh Lime Juice',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Spicy', 'Bold', 'Refreshing', 'Gingery'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 3456,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill highball glass with ice. Add rum and lime juice. Top with ginger beer. Stir gently and garnish with lime wedge.'
  },
  {
    id: 'rum-6',
    name: 'Zombie',
    description: 'Powerful tiki drink with multiple rums',
    spiritType: 'Mixed Rum',
    origin: 'Hollywood, California',
    glassware: 'Tiki Mug',
    servingSize: '8 oz',
    nutrition: {
      calories: 315,
      carbs: 24,
      sugar: 20,
      alcohol: 22
    },
    ingredients: [
      '1.5 oz White Rum',
      '1.5 oz Gold Rum',
      '1 oz Overproof Rum',
      '0.75 oz Lime Juice',
      '1 oz Pineapple Juice',
      '0.5 oz Passion Fruit Syrup',
      '0.5 oz Grenadine',
      '1 dash Angostura Bitters',
      'Ice'
    ],
    profile: ['Strong', 'Complex', 'Fruity', 'Intense'],
    difficulty: 'Hard',
    prepTime: 7,
    rating: 4.7,
    reviews: 2145,
    trending: true,
    featured: true,
    estimatedCost: 8.00,
    bestTime: 'Night',
    occasion: 'Party',
    allergens: [],
    category: 'Tiki Rum',
    garnish: 'Mint sprig, cherry, pineapple',
    method: 'Shake',
    abv: '28-32%',
    iba_official: true,
    instructions: 'Shake all three rums, juices, syrups, and bitters with ice. Strain over crushed ice in tiki mug. Garnish elaborately with mint, cherry, and pineapple.'
  },
  {
    id: 'rum-7',
    name: 'Cuba Libre',
    description: 'Rum and coke elevated with fresh lime',
    spiritType: 'White Rum',
    origin: 'Havana, Cuba',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 185,
      carbs: 18,
      sugar: 17,
      alcohol: 12
    },
    ingredients: [
      '2 oz White Rum',
      '4 oz Coca-Cola',
      '0.5 oz Fresh Lime Juice',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Sweet', 'Refreshing', 'Easy', 'Classic'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 4567,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    bestTime: 'Anytime',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '9-11%',
    iba_official: true,
    instructions: 'Fill highball glass with ice. Squeeze lime wedge and drop in. Add rum and top with Coca-Cola. Stir gently.'
  },
  {
    id: 'rum-8',
    name: 'Hurricane',
    description: 'New Orleans party drink with passion fruit',
    spiritType: 'Dark Rum',
    origin: 'New Orleans, Louisiana',
    glassware: 'Hurricane Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 325,
      carbs: 38,
      sugar: 34,
      alcohol: 16
    },
    ingredients: [
      '2 oz White Rum',
      '2 oz Dark Rum',
      '1 oz Passion Fruit Syrup',
      '2 oz Orange Juice',
      '1 oz Lime Juice',
      '0.5 oz Simple Syrup',
      'Grenadine (splash)',
      'Ice'
    ],
    profile: ['Fruity', 'Strong', 'Party', 'Tropical'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.6,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Night',
    occasion: 'Party',
    allergens: [],
    category: 'Tropical Rum',
    garnish: 'Orange slice, cherry',
    method: 'Shake',
    abv: '14-18%',
    iba_official: false,
    instructions: 'Shake both rums, passion fruit syrup, juices, and simple syrup with ice. Strain into hurricane glass over ice. Float grenadine. Garnish with orange slice and cherry.'
  },
  {
    id: 'rum-9',
    name: 'Ti\' Punch',
    description: 'Simple Martinique rum cocktail',
    spiritType: 'Rhum Agricole',
    origin: 'Martinique',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 165,
      carbs: 8,
      sugar: 7,
      alcohol: 16
    },
    ingredients: [
      '2 oz Rhum Agricole',
      '1 disc Lime',
      '1 barspoon Cane Syrup',
      'Ice (optional)'
    ],
    profile: ['Grassy', 'Bright', 'Simple', 'Authentic'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 987,
    trending: true,
    featured: false,
    estimatedCost: 5.00,
    bestTime: 'Afternoon',
    occasion: 'Authentic',
    allergens: [],
    category: 'Contemporary Rum',
    garnish: 'Lime disc',
    method: 'Build',
    abv: '30-35%',
    iba_official: false,
    instructions: 'Add lime disc and cane syrup to glass. Muddle gently. Add rhum agricole. Stir. Add ice if desired.'
  },
  {
    id: 'rum-10',
    name: 'Painkiller',
    description: 'Pusser\'s rum tropical blend from BVI',
    spiritType: 'Dark Rum',
    origin: 'British Virgin Islands',
    glassware: 'Hurricane Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 425,
      carbs: 48,
      sugar: 42,
      alcohol: 15
    },
    ingredients: [
      '2 oz Pusser\'s Rum',
      '4 oz Pineapple Juice',
      '1 oz Orange Juice',
      '1 oz Cream of Coconut',
      'Crushed Ice'
    ],
    profile: ['Creamy', 'Tropical', 'Sweet', 'Beach'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 2134,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Beach',
    occasion: 'Vacation',
    allergens: ['Coconut'],
    category: 'Tropical Rum',
    garnish: 'Nutmeg, orange slice, cherry',
    method: 'Shake',
    abv: '12-15%',
    iba_official: false,
    instructions: 'Shake all ingredients with ice. Strain into hurricane glass over crushed ice. Top with freshly grated nutmeg. Garnish with orange slice and cherry.'
  },
  {
    id: 'rum-11',
    name: 'Jungle Bird',
    description: 'Bitter-sweet tiki drink with Campari',
    spiritType: 'Dark Rum',
    origin: 'Kuala Lumpur, Malaysia',
    glassware: 'Old Fashioned Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 235,
      carbs: 22,
      sugar: 18,
      alcohol: 15
    },
    ingredients: [
      '1.5 oz Dark Rum',
      '0.75 oz Campari',
      '1.5 oz Pineapple Juice',
      '0.5 oz Lime Juice',
      '0.5 oz Simple Syrup',
      'Ice'
    ],
    profile: ['Bitter', 'Sweet', 'Tropical', 'Complex'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.6,
    reviews: 1654,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Adventurous',
    allergens: [],
    category: 'Contemporary Rum',
    garnish: 'Pineapple wedge',
    method: 'Shake',
    abv: '18-22%',
    iba_official: false,
    instructions: 'Shake all ingredients with ice. Strain over fresh ice in rocks glass. Garnish with pineapple wedge.'
  },
  {
    id: 'rum-12',
    name: 'Rum Old Fashioned',
    description: 'Classic old fashioned with aged rum',
    spiritType: 'Aged Rum',
    origin: 'Modern',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 175,
      carbs: 5,
      sugar: 4,
      alcohol: 18
    },
    ingredients: [
      '2 oz Aged Rum',
      '0.25 oz Demerara Syrup',
      '2 dashes Angostura Bitters',
      '1 dash Orange Bitters',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Rich', 'Complex', 'Smooth', 'Sophisticated'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1876,
    trending: true,
    featured: false,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Contemporary Rum',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false,
    instructions: 'Add demerara syrup and bitters to rocks glass. Add large ice cube and rum. Stir until well chilled. Express orange peel over drink and garnish.'
  }
];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
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

export default function RumCocktailsPage() {
  const { 
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof rumCocktails[0] | null>(null);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['Classic Rum', 'Tropical Rum', 'Tiki Rum', 'Contemporary Rum'];
  const difficulties = ['Very Easy', 'Easy', 'Medium', 'Hard'];

  // Convert cocktails to RecipeKit format
  const cocktailRecipesWithMeasurements = useMemo(() => {
    return rumCocktails.map((c) => {
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
        category: 'rum-cocktails',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(40);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = cocktailRecipesWithMeasurements.filter(cocktail => {
    const matchesSearch = cocktail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cocktail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const handleCocktailClick = (cocktail: typeof rumCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'rum-cocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof rumCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a rum cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="orange"
            pointsReward={40}
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

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/drinks/potent-potables">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Potent Potables
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <Palmtree className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Rum Cocktails</h1>
                <p className="text-xl text-white/90">From Caribbean classics to tiki treasures</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search rum cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{rumCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{rumCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{rumCocktails.filter(c => c.iba_official).length}</div>
                <div className="text-white/80 text-sm">IBA Official</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-orange-300 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                        <Icon className="h-4 w-4 mr-2 text-orange-500" />
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
          <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-red-300 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                        <Icon className="h-4 w-4 mr-2 text-red-500" />
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

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-gray-700">Categories</h3>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className={selectedCategory === null ? "bg-orange-600" : ""}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-orange-600" : ""}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-gray-700">Difficulty</h3>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                  <Button
                    variant={selectedDifficulty === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDifficulty(null)}
                    className={selectedDifficulty === null ? "bg-orange-600" : ""}
                  >
                    All Levels
                  </Button>
                  {difficulties.map(diff => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={selectedDifficulty === diff ? "bg-orange-600" : ""}
                    >
                      {diff}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-4 text-gray-600">
            Showing {filteredCocktails.length} of {rumCocktails.length} cocktails
          </div>

          {/* Cocktails Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => {
              const useMetric = !!metricFlags[cocktail.id];
              const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                  onClick={() => handleCocktailClick(cocktail)}
                >
                  <div className="relative bg-gradient-to-br from-amber-100 to-orange-100 p-6 h-48 flex items-center justify-center">
                    <Palmtree className="w-20 h-20 text-orange-600 group-hover:scale-110 transition-transform" />
                    {cocktail.trending && (
                      <Badge className="absolute top-3 left-3 bg-red-500">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                    {cocktail.iba_official && (
                      <Badge className="absolute top-3 right-3 bg-blue-600">
                        <Award className="w-3 h-3 mr-1" />
                        IBA
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute bottom-3 right-3 bg-white/80 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToFavorites({
                          id: cocktail.id,
                          name: cocktail.name,
                          category: 'rum-cocktails',
                          timestamp: Date.now()
                        });
                      }}
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          isFavorite(cocktail.id)
                            ? 'fill-red-500 text-red-500'
                            : 'text-gray-600'
                        }`}
                      />
                    </Button>
                  </div>

                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-xl">{cocktail.name}</CardTitle>
                      <Badge variant="outline" className="ml-2">
                        {cocktail.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{cocktail.description}</p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Key Info */}
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <div className="font-bold text-orange-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-red-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-orange-600">{cocktail.method}</div>
                        <div className="text-gray-500">Method</div>
                      </div>
                    </div>

                    {/* GLASS RATING */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(cocktail.rating)
                                ? 'fill-orange-500 text-orange-500'
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
                                <Check className="h-4 w-4 text-orange-500 mt-0.5" />
                                <span>
                                  <span className="text-orange-600 font-semibold">
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
                        <Badge key={tag} variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-3">
                      <Button 
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Palmtree className="h-4 w-4 mr-2" />
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

          {/* Educational Section */}
          <Card className="mt-12 bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Palmtree className="w-7 h-7 text-orange-600" />
                About Rum
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-700 leading-relaxed">
                Rum is a spirit distilled from sugarcane byproducts such as molasses or directly from sugarcane juice. 
                Originating in the Caribbean, rum has become one of the world's most versatile spirits, ranging from light 
                and crisp to dark and full-bodied. The diversity of rum makes it perfect for everything from refreshing 
                tropical drinks to complex aged sipping spirits.
              </p>

              {/* Rum Types */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-orange-700">Types of Rum</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-amber-600 mb-2">White/Light Rum</div>
                    <div className="text-sm text-gray-700">Clear, mild flavor. Perfect for mojitos and daiquiris.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-yellow-700 mb-2">Gold/Amber Rum</div>
                    <div className="text-sm text-gray-700">Aged briefly, medium-bodied. Great for mixing.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-amber-800 mb-2">Dark Rum</div>
                    <div className="text-sm text-gray-700">Rich, full-bodied. Ideal for tropical drinks and sipping.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-green-700 mb-2">Rhum Agricole</div>
                    <div className="text-sm text-gray-700">Made from fresh cane juice. Grassy, complex flavor.</div>
                  </div>
                </div>
              </div>

              {/* Regions */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-orange-700">Rum Regions</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="font-semibold text-blue-700 mb-2">Caribbean</div>
                    <div className="text-sm text-gray-700">Jamaica, Barbados, Trinidad. Rich, funky, traditional styles.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                    <div className="font-semibold text-orange-700 mb-2">Latin America</div>
                    <div className="text-sm text-gray-700">Cuba, Dominican Republic, Puerto Rico. Light, smooth rums.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <div className="font-semibold text-green-700 mb-2">French Islands</div>
                    <div className="text-sm text-gray-700">Martinique, Guadeloupe. Agricole-style, grassy notes.</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Progress Card */}
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-orange-300 mt-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-orange-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-orange-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-red-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Palmtree className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-orange-100 text-orange-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-red-100 text-red-800">{filteredCocktails.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-orange-300 hover:bg-orange-50"
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
