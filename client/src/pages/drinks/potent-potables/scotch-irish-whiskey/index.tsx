import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Castle, Clock, Heart, Star, Target, Sparkles, Mountain, Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater, TrendingUp, Award, Crown, Zap, Droplets, BookOpen, Home, Apple, Leaf, Wine, Martini, Clipboard, RotateCcw, Check, Coffee } from "lucide-react";
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
    case 'barspoon': return { amount: Math.round(amount * 5), unit: 'ml' };
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

  const descriptors = new Set(['blended', 'highland', 'islay', 'irish', 'fresh', 'sweet', 'honey']);
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

const scotchIrishCocktails = [
  {
    id: 'scotch-1',
    name: 'Penicillin',
    description: 'Modern classic with honey, ginger, and smoky scotch',
    spiritType: 'Blended Scotch',
    origin: 'New York City, USA',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 12,
      sugar: 10,
      alcohol: 16
    },
    ingredients: [
      '2 oz Blended Scotch',
      '0.75 oz Fresh Lemon Juice',
      '0.75 oz Honey-Ginger Syrup',
      '0.25 oz Islay Scotch (float)',
      'Candied Ginger',
      'Ice'
    ],
    profile: ['Smoky', 'Spicy', 'Balanced', 'Modern'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 2891,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Scotch',
    garnish: 'Candied ginger',
    method: 'Shake',
    abv: '26-30%',
    iba_official: false,
    instructions: 'Shake blended scotch, lemon juice, and honey-ginger syrup with ice. Strain over fresh ice in rocks glass. Float Islay scotch on top. Garnish with candied ginger.'
  },
  {
    id: 'scotch-2',
    name: 'Rob Roy',
    description: 'Scotch Manhattan with sweet vermouth',
    spiritType: 'Blended Scotch',
    origin: 'New York City, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 6,
      sugar: 4,
      alcohol: 18
    },
    ingredients: [
      '2 oz Scotch Whisky',
      '1 oz Sweet Vermouth',
      '2 dashes Angostura Bitters',
      'Lemon Peel',
      'Ice'
    ],
    profile: ['Rich', 'Herbal', 'Classic', 'Smooth'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 2345,
    trending: false,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Scotch',
    garnish: 'Lemon peel or cherry',
    method: 'Stir',
    abv: '30-34%',
    iba_official: true,
    instructions: 'Stir scotch, sweet vermouth, and bitters with ice until well chilled. Strain into chilled coupe glass. Garnish with lemon peel or cherry.'
  },
  {
    id: 'scotch-3',
    name: 'Blood and Sand',
    description: 'Equal parts scotch, cherry, orange, and vermouth',
    spiritType: 'Blended Scotch',
    origin: 'London, England',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 210,
      carbs: 15,
      sugar: 12,
      alcohol: 15
    },
    ingredients: [
      '0.75 oz Scotch Whisky',
      '0.75 oz Cherry Heering',
      '0.75 oz Sweet Vermouth',
      '0.75 oz Fresh Orange Juice',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Fruity', 'Complex', 'Balanced', 'Unique'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 1876,
    trending: false,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Adventurous',
    allergens: [],
    category: 'Classic Scotch',
    garnish: 'Orange peel',
    method: 'Shake',
    abv: '22-26%',
    iba_official: true,
    instructions: 'Shake all equal parts with ice vigorously. Double strain into chilled coupe glass. Express orange peel over drink and garnish.'
  },
  {
    id: 'scotch-4',
    name: 'Rusty Nail',
    description: 'Simple scotch and Drambuie combination',
    spiritType: 'Blended Scotch',
    origin: 'Scotland',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 205,
      carbs: 10,
      sugar: 9,
      alcohol: 18
    },
    ingredients: [
      '1.5 oz Scotch Whisky',
      '0.75 oz Drambuie',
      'Lemon Peel',
      'Ice'
    ],
    profile: ['Honey', 'Herbal', 'Smooth', 'Classic'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 1654,
    trending: false,
    featured: false,
    estimatedCost: 5.50,
    bestTime: 'After Dinner',
    occasion: 'Relaxed',
    allergens: [],
    category: 'Classic Scotch',
    garnish: 'Lemon peel',
    method: 'Build',
    abv: '32-36%',
    iba_official: true,
    instructions: 'Add scotch and Drambuie to rocks glass with ice. Stir gently. Express lemon peel over drink and drop in.'
  },
  {
    id: 'scotch-5',
    name: 'Godfather',
    description: 'Scotch and amaretto over ice',
    spiritType: 'Blended Scotch',
    origin: 'United States',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 195,
      carbs: 9,
      sugar: 8,
      alcohol: 18
    },
    ingredients: [
      '1.5 oz Scotch Whisky',
      '0.75 oz Amaretto',
      'Ice'
    ],
    profile: ['Nutty', 'Sweet', 'Smooth', 'Simple'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 1432,
    trending: false,
    featured: false,
    estimatedCost: 4.50,
    bestTime: 'After Dinner',
    occasion: 'Casual',
    allergens: ['Almonds'],
    category: 'Classic Scotch',
    garnish: 'None',
    method: 'Build',
    abv: '34-38%',
    iba_official: true,
    instructions: 'Pour scotch and amaretto over ice in rocks glass. Stir briefly and serve.'
  },
  {
    id: 'irish-1',
    name: 'Irish Coffee',
    description: 'Hot coffee with Irish whiskey and cream',
    spiritType: 'Irish Whiskey',
    origin: 'County Limerick, Ireland',
    glassware: 'Irish Coffee Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 210,
      carbs: 10,
      sugar: 8,
      alcohol: 12
    },
    ingredients: [
      '1.5 oz Irish Whiskey',
      '4 oz Hot Coffee',
      '1 tsp Brown Sugar',
      'Heavy Cream (lightly whipped)'
    ],
    profile: ['Warm', 'Coffee', 'Creamy', 'Classic'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 4521,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'After Dinner',
    occasion: 'Cozy',
    allergens: ['Dairy'],
    category: 'Irish Classics',
    garnish: 'Whipped cream float',
    method: 'Build',
    abv: '10-14%',
    iba_official: true,
    instructions: 'Preheat glass with hot water. Add brown sugar and hot coffee, stir to dissolve. Add Irish whiskey. Float lightly whipped cream on top by pouring over the back of a spoon.'
  },
  {
    id: 'irish-2',
    name: 'Irish Mule',
    description: 'Irish whiskey twist on the Moscow Mule',
    spiritType: 'Irish Whiskey',
    origin: 'Modern',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: {
      calories: 185,
      carbs: 16,
      sugar: 14,
      alcohol: 12
    },
    ingredients: [
      '2 oz Irish Whiskey',
      '4 oz Ginger Beer',
      '0.5 oz Fresh Lime Juice',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Spicy', 'Refreshing', 'Gingery', 'Easy'],
    difficulty: 'Very Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 2134,
    trending: true,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Irish Modern',
    garnish: 'Lime wedge, mint',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill copper mug with ice. Add Irish whiskey and lime juice. Top with ginger beer. Stir gently. Garnish with lime wedge and mint sprig.'
  },
  {
    id: 'irish-3',
    name: 'Irish Old Fashioned',
    description: 'Classic old fashioned with Irish whiskey',
    spiritType: 'Irish Whiskey',
    origin: 'Modern',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 170,
      carbs: 5,
      sugar: 4,
      alcohol: 17
    },
    ingredients: [
      '2 oz Irish Whiskey',
      '0.25 oz Simple Syrup',
      '2 dashes Angostura Bitters',
      '1 dash Orange Bitters',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Smooth', 'Balanced', 'Classic', 'Refined'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 1876,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Irish Modern',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false,
    instructions: 'Add simple syrup and bitters to rocks glass. Add large ice cube and Irish whiskey. Stir until well chilled. Express orange peel over drink and garnish.'
  },
  {
    id: 'irish-4',
    name: 'Tipperary',
    description: 'Irish whiskey with sweet vermouth and Chartreuse',
    spiritType: 'Irish Whiskey',
    origin: 'Ireland',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 8,
      sugar: 6,
      alcohol: 17
    },
    ingredients: [
      '2 oz Irish Whiskey',
      '1 oz Sweet Vermouth',
      '0.5 oz Green Chartreuse',
      '2 dashes Angostura Bitters',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Herbal', 'Complex', 'Sophisticated', 'Classic'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.5,
    reviews: 987,
    trending: false,
    featured: false,
    estimatedCost: 7.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Irish Classics',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '28-32%',
    iba_official: false,
    instructions: 'Stir all ingredients with ice until well chilled. Strain into chilled coupe glass. Express orange peel over drink and garnish.'
  },
  {
    id: 'scotch-6',
    name: 'Smoky Martini',
    description: 'Gin martini with Islay scotch rinse',
    spiritType: 'Islay Scotch',
    origin: 'Modern',
    glassware: 'Coupe Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 165,
      carbs: 2,
      sugar: 1,
      alcohol: 19
    },
    ingredients: [
      '2 oz Gin',
      '0.5 oz Dry Vermouth',
      'Islay Scotch (rinse)',
      'Lemon Peel',
      'Ice'
    ],
    profile: ['Smoky', 'Dry', 'Elegant', 'Bold'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 1543,
    trending: true,
    featured: true,
    estimatedCost: 7.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Scotch',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '36-40%',
    iba_official: false,
    instructions: 'Rinse chilled coupe glass with Islay scotch and discard excess. Stir gin and vermouth with ice until very cold. Strain into rinsed glass. Express lemon peel and garnish.'
  },
  {
    id: 'scotch-7',
    name: 'Highland Sour',
    description: 'Scotch sour with honey and lemon',
    spiritType: 'Highland Scotch',
    origin: 'Modern',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 11,
      sugar: 9,
      alcohol: 15
    },
    ingredients: [
      '2 oz Highland Scotch',
      '0.75 oz Fresh Lemon Juice',
      '0.5 oz Honey Syrup',
      'Egg White (optional)',
      '2 dashes Angostura Bitters',
      'Lemon Wheel',
      'Ice'
    ],
    profile: ['Bright', 'Honey', 'Smooth', 'Refreshing'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.6,
    reviews: 1234,
    trending: true,
    featured: false,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Cocktail Party',
    allergens: ['Eggs'],
    category: 'Modern Scotch',
    garnish: 'Lemon wheel, bitters',
    method: 'Shake',
    abv: '24-28%',
    iba_official: false,
    instructions: 'Dry shake egg white if using. Add scotch, lemon juice, honey syrup and ice. Shake vigorously. Double strain into coupe. Garnish with lemon wheel and drops of bitters.'
  },
  {
    id: 'irish-5',
    name: 'Emerald Isle',
    description: 'Irish whiskey with mint and cream',
    spiritType: 'Irish Whiskey',
    origin: 'Modern',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 220,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      '2 oz Irish Whiskey',
      '0.5 oz Green Crème de Menthe',
      '0.5 oz Heavy Cream',
      '0.25 oz Simple Syrup',
      'Mint Leaves',
      'Ice'
    ],
    profile: ['Minty', 'Creamy', 'Sweet', 'Festive'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 876,
    trending: false,
    featured: false,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'St. Patrick\'s Day',
    allergens: ['Dairy'],
    category: 'Irish Modern',
    garnish: 'Mint sprig',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Shake all ingredients with ice until well chilled and frothy. Strain into coupe glass. Garnish with fresh mint sprig.'
  },
  {
    id: 'scotch-8',
    name: 'Cameron\'s Kick',
    description: 'Scotch and Irish whiskey with orgeat',
    spiritType: 'Blended Scotch',
    origin: 'London, England',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 200,
      carbs: 13,
      sugar: 11,
      alcohol: 16
    },
    ingredients: [
      '1 oz Blended Scotch',
      '1 oz Irish Whiskey',
      '0.75 oz Fresh Lemon Juice',
      '0.75 oz Orgeat Syrup',
      '2 dashes Angostura Bitters',
      'Ice'
    ],
    profile: ['Nutty', 'Citrus', 'Complex', 'Balanced'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.5,
    reviews: 765,
    trending: false,
    featured: false,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: ['Almonds'],
    category: 'Modern Scotch',
    garnish: 'Lemon peel',
    method: 'Shake',
    abv: '26-30%',
    iba_official: true,
    instructions: 'Shake both whiskies, lemon juice, orgeat, and bitters with ice vigorously. Double strain into chilled coupe. Express lemon peel and garnish.'
  }
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
  { id: 'daiquiri', name: 'Daiquiri', path: '/drinks/potent-potables/daiquiri', icon: Droplets, description: 'Rum classics' },
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

export default function ScotchIrishWhiskeyPage() {
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
  const [selectedCocktail, setSelectedCocktail] = useState<typeof scotchIrishCocktails[0] | null>(null);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['Classic Scotch', 'Irish Classics', 'Modern Scotch', 'Irish Modern'];
  const difficulties = ['Very Easy', 'Easy', 'Medium'];

  // Convert cocktails to RecipeKit format
  const cocktailRecipesWithMeasurements = useMemo(() => {
    return scotchIrishCocktails.map((c) => {
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
    const text = `${cocktail.name} • ${cocktail.category}\n${preview}${cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ''}`;
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
        category: 'scotch-irish-whiskey',
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

  const handleCocktailClick = (cocktail: typeof scotchIrishCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'scotch-irish-whiskey',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof scotchIrishCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a Scotch/Irish cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-green-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="amber"
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
        <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-green-700 text-white py-16 px-4">
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
              <Castle className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Scotch & Irish Whiskey</h1>
                <p className="text-xl text-white/90">Celtic spirits and timeless traditions</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search Scotch & Irish cocktails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-6 text-lg bg-white/95 border-0"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{scotchIrishCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{scotchIrishCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{scotchIrishCocktails.filter(c => c.iba_official).length}</div>
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
          <Card className="bg-gradient-to-r from-orange-50 to-green-50 border-green-300 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                        <Icon className="h-4 w-4 mr-2 text-green-500" />
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

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-3xl md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search Scotch & Irish cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <select
                value={selectedCategory || 'all'}
                onChange={(e) => setSelectedCategory(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                value={selectedDifficulty || 'all'}
                onChange={(e) => setSelectedDifficulty(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
              >
                <option value="all">All Levels</option>
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>{diff}</option>
                ))}
              </select>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Target className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          {/* Cocktails Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => {
              const useMetric = !!metricFlags[cocktail.id];
              const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

              return (
                <Card
                  key={cocktail.id}
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-amber-100 hover:border-amber-300"
                  onClick={() => handleCocktailClick(cocktail)}
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
                            category: 'Scotch & Irish Whiskey',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-amber-100 text-amber-700">{cocktail.category}</Badge>
                      {cocktail.trending && (
                        <Badge className="bg-red-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-amber-500">
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

                    {/* Key Info */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-amber-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-orange-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-amber-600">{cocktail.method}</div>
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
                                ? 'fill-amber-500 text-amber-500'
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
                                <Check className="h-4 w-4 text-amber-500 mt-0.5" />
                                <span>
                                  <span className="text-amber-600 font-semibold">
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
                        <Badge key={tag} variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-3">
                      <Button 
                        className="flex-1 bg-orange-700 hover:bg-orange-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Castle className="h-4 w-4 mr-2" />
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
                <Castle className="w-7 h-7 text-orange-700" />
                About Scotch & Irish Whiskey
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-amber-700">Scotch Whisky</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Scotch whisky must be distilled and aged in Scotland for at least three years in oak casks. 
                    Known for its diverse regional characteristics, from the peaty, smoky flavors of Islay to 
                    the lighter, more delicate Highland styles. Scotch is typically spelled without an "e" and 
                    can be either single malt (from one distillery using malted barley) or blended (combining 
                    malt and grain whiskies).
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-green-700">Irish Whiskey</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Irish whiskey is known for its smooth, approachable character and is typically triple-distilled, 
                    making it lighter and smoother than most Scotch. It must be aged in Ireland for at least three 
                    years. Irish whiskey includes single pot still (using both malted and unmalted barley), single 
                    malt, grain, and blended varieties. The extra "e" in whiskey is the Irish (and American) spelling.
                  </p>
                </div>
              </div>

              {/* Scotch Regions */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-amber-700">Scotch Whisky Regions</h3>
                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-slate-100 rounded-lg border border-gray-200">
                    <div className="font-semibold text-gray-700 mb-2">Islay</div>
                    <div className="text-sm text-gray-600">Peaty, smoky, maritime character. Bold and intense.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-100 rounded-lg border border-amber-200">
                    <div className="font-semibold text-amber-700 mb-2">Highland</div>
                    <div className="text-sm text-gray-600">Diverse styles. Often rich, full-bodied, and complex.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-100 rounded-lg border border-blue-200">
                    <div className="font-semibold text-blue-700 mb-2">Speyside</div>
                    <div className="text-sm text-gray-600">Elegant, sweet, fruity. Often sherried notes.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Lowland</div>
                    <div className="text-sm text-gray-600">Light, delicate, floral. Triple-distilled tradition.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-100 rounded-lg border border-orange-200">
                    <div className="font-semibold text-orange-700 mb-2">Campbeltown</div>
                    <div className="text-sm text-gray-600">Briny, slightly smoky. Maritime influence.</div>
                  </div>
                </div>
              </div>

              {/* Irish Whiskey Styles */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-green-700">Irish Whiskey Styles</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Single Pot Still</div>
                    <div className="text-sm text-gray-600">Malted and unmalted barley. Spicy, full-bodied character.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Single Malt</div>
                    <div className="text-sm text-gray-600">100% malted barley from one distillery. Complex flavors.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Grain Whiskey</div>
                    <div className="text-sm text-gray-600">Made from grains other than malted barley. Lighter style.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Blended</div>
                    <div className="text-sm text-gray-600">Mix of pot still, malt, and grain. Smooth, balanced.</div>
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
                      <GlassWater className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-amber-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-orange-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Castle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-amber-100 text-amber-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-orange-100 text-orange-800">{filteredCocktails.length}</Badge>
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
