import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Martini, Clock, Heart, Star, Target, Sparkles, Leaf, Wine, Search, Share2, ArrowLeft, Plus, Zap, Cherry, Camera, Flame, GlassWater, Award, TrendingUp, Crown, Home, Droplets, Apple, Clipboard, RotateCcw, Check, Coffee } from "lucide-react";
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
    case 'cup': return { amount: Math.round(amount * 240), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * 15), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * 5), unit: 'ml' };
    default: return { amount, unit };
  }
};

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125
  };
  
  const parts = ingredient.trim().replace(/\sof\s/i, ' ').replace(/\(|\)/g, '').split(/\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ?? 
    (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  const descriptors = new Set(['fresh', 'whole', 'large', 'sugar', 'white']);
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

const mocktails = [
  {
    id: 'mocktail-1',
    name: 'Virgin Mojito',
    description: 'Classic Cuban refreshment with mint and lime',
    drinkStyle: 'Refreshing',
    glassware: 'Highball',
    servingSize: '12 oz',
    nutrition: {
      calories: 95,
      carbs: 24,
      sugar: 22,
      sodium: 5
    },
    ingredients: [
      '10-12 Fresh Mint Leaves',
      '1 whole Lime cut in wedges',
      '2 tsp White Sugar',
      '8 oz Club Soda',
      'Crushed Ice',
      'Lime Wheel garnish'
    ],
    benefits: ['Refreshing', 'Digestive Aid', 'Cooling', 'Low Calorie'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 2345,
    trending: true,
    featured: true,
    estimatedCost: 2.50,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Mocktails',
    garnish: 'Lime wheel, mint sprig',
    method: 'Muddle',
    instructions: 'Muddle mint leaves with lime wedges and sugar in glass. Add crushed ice and top with club soda. Stir gently and garnish with lime wheel and mint sprig.'
  },
  {
    id: 'mocktail-2',
    name: 'Shirley Temple',
    description: 'Sweet and bubbly with grenadine and cherry',
    drinkStyle: 'Sweet',
    glassware: 'Collins',
    servingSize: '10 oz',
    nutrition: {
      calories: 120,
      carbs: 30,
      sugar: 28,
      sodium: 8
    },
    ingredients: [
      '8 oz Ginger Ale',
      '1 oz Grenadine',
      '0.5 oz Fresh Lime Juice',
      'Ice Cubes',
      '2 Maraschino Cherries',
      'Orange Slice garnish'
    ],
    benefits: ['Fun & Festive', 'Kid-Friendly', 'Party Classic', 'Bubbly'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1876,
    trending: false,
    featured: true,
    estimatedCost: 2.00,
    bestTime: 'Anytime',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Mocktails',
    garnish: 'Cherry, orange slice',
    method: 'Build',
    instructions: 'Fill glass with ice. Add ginger ale, grenadine, and lime juice. Stir gently. Garnish with cherries and orange slice.'
  },
  {
    id: 'mocktail-3',
    name: 'Cucumber Cooler',
    description: 'Crisp cucumber with elderflower and lime',
    drinkStyle: 'Refreshing',
    glassware: 'Coupe',
    servingSize: '8 oz',
    nutrition: {
      calories: 65,
      carbs: 16,
      sugar: 14,
      sodium: 3
    },
    ingredients: [
      '0.25 Fresh Cucumber sliced',
      '1 oz Elderflower Cordial',
      '1 oz Fresh Lime Juice',
      '4 oz Tonic Water',
      '3 Fresh Basil leaves',
      'Ice'
    ],
    benefits: ['Hydrating', 'Sophisticated', 'Low Calorie', 'Refreshing'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.7,
    reviews: 1234,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Brunch',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Mocktails',
    garnish: 'Cucumber ribbon, basil',
    method: 'Shake',
    instructions: 'Muddle cucumber and basil in shaker. Add elderflower cordial and lime juice with ice. Shake well. Strain into coupe glass. Top with tonic water. Garnish with cucumber ribbon and basil.'
  },
  {
    id: 'mocktail-4',
    name: 'Tropical Sunrise',
    description: 'Pineapple and orange with grenadine gradient',
    drinkStyle: 'Fruity',
    glassware: 'Hurricane',
    servingSize: '12 oz',
    nutrition: {
      calories: 140,
      carbs: 35,
      sugar: 32,
      vitamin_c: 80
    },
    ingredients: [
      '4 oz Pineapple Juice',
      '4 oz Orange Juice',
      '1 oz Grenadine',
      '2 chunks Fresh Pineapple',
      'Ice',
      'Cherry garnish'
    ],
    benefits: ['Vitamin C', 'Energizing', 'Tropical', 'Party Favorite'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 2156,
    trending: true,
    featured: false,
    estimatedCost: 2.75,
    bestTime: 'Brunch',
    occasion: 'Party',
    allergens: [],
    category: 'Tropical Mocktails',
    garnish: 'Pineapple wedge, cherry',
    method: 'Layer',
    instructions: 'Fill glass with ice. Add pineapple and orange juice, stir. Slowly pour grenadine down the side to create sunrise effect. Garnish with pineapple wedge and cherry.'
  },
  {
    id: 'mocktail-5',
    name: 'Lavender Lemonade Fizz',
    description: 'Floral lavender with tart lemon and bubbles',
    drinkStyle: 'Floral',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 85,
      carbs: 22,
      sugar: 20,
      sodium: 6
    },
    ingredients: [
      '1 oz Lavender Syrup',
      '1.5 oz Fresh Lemon Juice',
      '6 oz Club Soda',
      'Fresh Lavender sprig',
      'Lemon Wheel',
      'Ice'
    ],
    benefits: ['Calming', 'Aromatic', 'Elegant', 'Stress Relief'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.5,
    reviews: 987,
    trending: false,
    featured: true,
    estimatedCost: 3.25,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Floral Mocktails',
    garnish: 'Lavender sprig, lemon wheel',
    method: 'Build',
    instructions: 'Add lavender syrup and lemon juice to glass with ice. Top with club soda. Stir gently. Garnish with lavender sprig and lemon wheel.'
  },
  {
    id: 'mocktail-6',
    name: 'Watermelon Mint Smash',
    description: 'Fresh watermelon muddled with mint',
    drinkStyle: 'Refreshing',
    glassware: 'Rocks',
    servingSize: '10 oz',
    nutrition: {
      calories: 75,
      carbs: 19,
      sugar: 17,
      lycopene: 'High'
    },
    ingredients: [
      '2 cups Fresh Watermelon cubed',
      '8 Fresh Mint leaves',
      '1 oz Fresh Lime Juice',
      '0.5 oz Simple Syrup',
      '2 oz Club Soda',
      'Ice'
    ],
    benefits: ['Hydrating', 'Summer Perfect', 'Antioxidants', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 1654,
    trending: true,
    featured: false,
    estimatedCost: 2.50,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Fruity Mocktails',
    garnish: 'Watermelon triangle, mint',
    method: 'Muddle',
    instructions: 'Muddle watermelon and mint in shaker. Add lime juice and simple syrup with ice. Shake well. Strain into rocks glass over ice. Top with club soda. Garnish with watermelon triangle and mint.'
  },
  {
    id: 'mocktail-7',
    name: 'Ginger Spice Mule',
    description: 'Spicy ginger beer with lime - Moscow Mule style',
    drinkStyle: 'Spicy',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: {
      calories: 110,
      carbs: 28,
      sugar: 26,
      ginger: 'High'
    },
    ingredients: [
      '8 oz Ginger Beer',
      '1 oz Fresh Lime Juice',
      '2 slices Fresh Ginger',
      '2 Lime Wedges',
      'Mint Sprig',
      'Ice'
    ],
    benefits: ['Digestive Aid', 'Anti-inflammatory', 'Warming', 'Energizing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1432,
    trending: false,
    featured: true,
    estimatedCost: 2.25,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Spiced Mocktails',
    garnish: 'Lime wheel, mint, ginger',
    method: 'Build',
    instructions: 'Fill copper mug with ice. Add lime juice and ginger slices. Top with ginger beer. Stir gently. Garnish with lime wheel, mint sprig, and candied ginger.'
  },
  {
    id: 'mocktail-8',
    name: 'Berry Basil Smash',
    description: 'Mixed berries muddled with fresh basil',
    drinkStyle: 'Fruity',
    glassware: 'Rocks',
    servingSize: '8 oz',
    nutrition: {
      calories: 90,
      carbs: 23,
      sugar: 20,
      antioxidants: 'Very High'
    },
    ingredients: [
      '0.5 cup Mixed Berries',
      '5 Fresh Basil leaves',
      '1 oz Fresh Lemon Juice',
      '0.75 oz Simple Syrup',
      '3 oz Club Soda',
      'Ice'
    ],
    benefits: ['Antioxidants', 'Heart Health', 'Aromatic', 'Refreshing'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.8,
    reviews: 1789,
    trending: true,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Brunch',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Berry Mocktails',
    garnish: 'Berry skewer, basil leaf',
    method: 'Muddle',
    instructions: 'Muddle berries and basil in shaker. Add lemon juice and simple syrup with ice. Shake vigorously. Strain into rocks glass over ice. Top with club soda. Garnish with berry skewer and basil leaf.'
  },
  {
    id: 'mocktail-9',
    name: 'Pomegranate Sparkler',
    description: 'Tart pomegranate with sparkling wine alternative',
    drinkStyle: 'Sophisticated',
    glassware: 'Champagne Flute',
    servingSize: '8 oz',
    nutrition: {
      calories: 95,
      carbs: 24,
      sugar: 22,
      antioxidants: 'High'
    },
    ingredients: [
      '2 oz Pomegranate Juice',
      '5 oz Sparkling White Grape Juice',
      '0.5 oz Fresh Lime Juice',
      '2 tbsp Pomegranate Seeds',
      'Rosemary Sprig',
      'Ice optional'
    ],
    benefits: ['Antioxidants', 'Elegant', 'Heart Health', 'Celebration'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 1345,
    trending: false,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Celebration',
    allergens: [],
    category: 'Sparkling Mocktails',
    garnish: 'Pomegranate seeds, rosemary',
    method: 'Build',
    instructions: 'Add pomegranate juice and lime juice to champagne flute. Top with sparkling grape juice. Gently stir. Add pomegranate seeds. Garnish with rosemary sprig.'
  },
  {
    id: 'mocktail-10',
    name: 'Mango Chili Margarita',
    description: 'Sweet mango with a spicy chili rim',
    drinkStyle: 'Spicy',
    glassware: 'Margarita',
    servingSize: '10 oz',
    nutrition: {
      calories: 125,
      carbs: 31,
      sugar: 28,
      vitamin_a: 'High'
    },
    ingredients: [
      '1 cup Fresh Mango',
      '1.5 oz Fresh Lime Juice',
      '1 oz Agave Nectar',
      'Chili Powder rim',
      'Salt rim',
      '2 oz Lime Sparkling Water',
      'Ice'
    ],
    benefits: ['Vitamin A', 'Spicy Kick', 'Tropical', 'Party Favorite'],
    difficulty: 'Medium',
    prepTime: 7,
    rating: 4.9,
    reviews: 2234,
    trending: true,
    featured: true,
    estimatedCost: 3.25,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Margarita Style',
    garnish: 'Chili-salt rim, lime wheel',
    method: 'Blend',
    instructions: 'Rim glass with chili powder and salt mix. Blend mango, lime juice, agave nectar, and ice until smooth. Pour into prepared glass. Top with lime sparkling water. Garnish with lime wheel.'
  },
  {
    id: 'mocktail-11',
    name: 'Pineapple Cilantro Refresher',
    description: 'Sweet pineapple with savory cilantro twist',
    drinkStyle: 'Refreshing',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 105,
      carbs: 27,
      sugar: 24,
      vitamin_c: 'High'
    },
    ingredients: [
      '1 cup Fresh Pineapple',
      '0.25 cup Fresh Cilantro',
      '1 oz Fresh Lime Juice',
      '3 oz Coconut Water',
      '0.5 oz Agave',
      'Ice'
    ],
    benefits: ['Digestive Enzymes', 'Hydrating', 'Unique Flavor', 'Tropical'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.4,
    reviews: 876,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Tropical Mocktails',
    garnish: 'Pineapple wedge, cilantro',
    method: 'Blend',
    instructions: 'Blend pineapple, cilantro, lime juice, coconut water, and agave with ice until smooth. Pour into highball glass. Garnish with pineapple wedge and cilantro sprig.'
  },
  {
    id: 'mocktail-12',
    name: 'Espresso Martini (Mocktail)',
    description: 'Coffee-forward with vanilla and cream',
    drinkStyle: 'Rich',
    glassware: 'Martini',
    servingSize: '6 oz',
    nutrition: {
      calories: 135,
      carbs: 22,
      sugar: 18,
      caffeine: '60mg'
    },
    ingredients: [
      '2 oz Cold Brew Coffee',
      '1 oz Vanilla Syrup',
      '1 oz Heavy Cream',
      '0.5 oz Simple Syrup',
      'Ice',
      '3 Coffee Beans for garnish'
    ],
    benefits: ['Energy Boost', 'Dessert Alternative', 'Sophisticated', 'Coffee Lover'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1567,
    trending: true,
    featured: true,
    estimatedCost: 2.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: ['Dairy'],
    category: 'Coffee Mocktails',
    garnish: '3 coffee beans',
    method: 'Shake',
    instructions: 'Add cold brew coffee, vanilla syrup, heavy cream, and simple syrup to shaker with ice. Shake vigorously until frothy. Strain into chilled martini glass. Garnish with 3 coffee beans.'
  }
];

const mocktailCategories = [
  { id: 'all', name: 'All Mocktails', icon: Martini },
  { id: 'classic', name: 'Classic', icon: Star },
  { id: 'modern', name: 'Modern', icon: Sparkles },
  { id: 'tropical', name: 'Tropical', icon: Cherry },
  { id: 'berry', name: 'Berry', icon: Heart },
  { id: 'sparkling', name: 'Sparkling', icon: Wine },
  { id: 'spiced', name: 'Spiced', icon: Flame },
  { id: 'coffee', name: 'Coffee', icon: Target }
];

const occasions = [
  'All Occasions',
  'Casual',
  'Party',
  'Sophisticated',
  'Celebration',
  'Brunch'
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
  { id: 'scotch', name: 'Scotch & Irish', path: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine, description: 'UK whiskeys' },
  { id: 'martinis', name: 'Martinis', path: '/drinks/potent-potables/martinis', icon: Martini, description: 'Elegant classics' },
  { id: 'spritz', name: 'Spritz & Mimosas', path: '/drinks/potent-potables/spritz', icon: Sparkles, description: 'Bubbly refreshers' },
  { id: 'classic', name: 'Classic Cocktails', path: '/drinks/potent-potables/cocktails', icon: Wine, description: 'Timeless recipes' },
  { id: 'seasonal', name: 'Seasonal', path: '/drinks/potent-potables/seasonal', icon: Sparkles, description: 'Festive drinks' },
  { id: 'hot-drinks', name: 'Hot Drinks', path: '/drinks/potent-potables/hot-drinks', icon: Flame, description: 'Warming cocktails' }
];

// CROSS-HUB
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'protein', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'detox', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing blends' },
  { id: 'all', name: 'All Drinks', icon: Wine, route: '/drinks', description: 'Browse everything' }
];

export default function MocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOccasion, setSelectedOccasion] = useState('All Occasions');
  const [sortBy, setSortBy] = useState('trending');
  const [selectedMocktail, setSelectedMocktail] = useState<typeof mocktails[0] | null>(null);
  const [calorieRange, setCalorieRange] = useState([0, 150]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert mocktails to RecipeKit format
  const mocktailRecipesWithMeasurements = useMemo(() => {
    return mocktails.map((m) => {
      const rawList = Array.isArray(m.ingredients) ? m.ingredients : [];
      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...m,
        recipe: {
          servings: 1,
          measurements,
          directions: [m.instructions]
        }
      };
    });
  }, []);

  const handleShareMocktail = async (mocktail: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[mocktail.id] ?? 1;
    const preview = mocktail.ingredients.slice(0, 4).join(' • ');
    const text = `${mocktail.name} • ${mocktail.category} • 0% ABV\n${preview}${mocktail.ingredients.length > 4 ? ` …plus ${mocktail.ingredients.length - 4} more` : ''}`;
    const shareData = { title: mocktail.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${mocktail.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${mocktail.name}\n${text}\n${url}`);
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
        category: 'Mocktails',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(20);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredMocktails = mocktailRecipesWithMeasurements.filter(mocktail => {
    if (selectedCategory !== 'all' && !mocktail.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
      return false;
    }
    if (selectedOccasion !== 'All Occasions' && mocktail.occasion !== selectedOccasion) {
      return false;
    }
    if (mocktail.nutrition.calories < calorieRange[0] || mocktail.nutrition.calories > calorieRange[1]) {
      return false;
    }
    if (searchQuery && !mocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'calories-low') return a.nutrition.calories - b.nutrition.calories;
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    if (sortBy === 'time-quick') return a.prepTime - b.prepTime;
    return 0;
  });

  const handleMocktailClick = (mocktail: typeof mocktails[0]) => {
    setSelectedMocktail(mocktail);
    addToRecentlyViewed({
      id: mocktail.id,
      name: mocktail.name,
      category: 'Mocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeMocktail = (mocktail: typeof mocktails[0]) => {
    incrementDrinksMade();
    addPoints(20, 'Made a mocktail');
    setSelectedMocktail(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="purple"
          pointsReward={20}
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
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <Link href="/drinks/potent-potables">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Potent Potables
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Martini className="w-10 h-10" />
                Mocktails
              </h1>
              <p className="text-purple-100 text-lg">Sophisticated non-alcoholic cocktails for every occasion</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{filteredMocktails.length}</div>
              <div className="text-purple-100">Recipes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 mb-6">
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
                    <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                      <Icon className="h-4 w-4 mr-2 text-purple-500" />
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
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {sisterPotentPotablesPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Link key={page.id} href={page.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                      <Icon className="h-4 w-4 mr-2 text-purple-500" />
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
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-pink-200">
            <CardContent className="p-4 text-center">
              <Martini className="w-8 h-8 text-pink-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-pink-600">12</div>
              <div className="text-sm text-gray-600">Unique Recipes</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-purple-200">
            <CardContent className="p-4 text-center">
              <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-600">~100</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-blue-200">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">5 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-green-200">
            <CardContent className="p-4 text-center">
              <Award className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">0%</div>
              <div className="text-sm text-gray-600">Alcohol</div>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {mocktailCategories.map(category => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={selectedCategory === category.id ? "bg-purple-500 hover:bg-purple-600" : "hover:bg-purple-50"}
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
                placeholder="Search mocktails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <select
              value={selectedOccasion}
              onChange={(e) => setSelectedOccasion(e.target.value)}
              className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-auto"
            >
              {occasions.map(occasion => (
                <option key={occasion} value={occasion}>{occasion}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-auto"
            >
              <option value="trending">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="calories-low">Lowest Calories</option>
              <option value="cost-low">Most Budget-Friendly</option>
              <option value="time-quick">Quickest Prep</option>
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

        {/* Mocktails Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMocktails.map(mocktail => {
            const useMetric = !!metricFlags[mocktail.id];
            const servings = servingsById[mocktail.id] ?? (mocktail.recipe?.servings || 1);

            return (
              <Card 
                key={mocktail.id} 
                className="hover:shadow-lg transition-all cursor-pointer bg-white border-purple-100 hover:border-purple-300"
                onClick={() => handleMocktailClick(mocktail)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg">{mocktail.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToFavorites({
                          id: mocktail.id,
                          name: mocktail.name,
                          category: 'Mocktails',
                          timestamp: Date.now()
                        });
                      }}
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(mocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {mocktail.trending && (
                      <Badge className="bg-purple-500">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                    {mocktail.featured && (
                      <Badge className="bg-pink-500">
                        <GlassWater className="w-3 h-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">{mocktail.description}</p>
                  
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                    <div>
                      <div className="font-bold text-purple-600">{mocktail.nutrition.calories}</div>
                      <div className="text-gray-500">cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-pink-600">{mocktail.prepTime}min</div>
                      <div className="text-gray-500">Prep</div>
                    </div>
                    <div>
                      <div className="font-bold text-purple-600">{mocktail.method}</div>
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
                            i < Math.floor(mocktail.rating)
                              ? 'fill-purple-500 text-purple-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="font-medium ml-1">{mocktail.rating}</span>
                      <span className="text-gray-500 text-sm">({mocktail.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {mocktail.difficulty}
                    </Badge>
                  </div>

                  {/* RecipeKit Preview */}
                  {Array.isArray(mocktail.recipe?.measurements) && mocktail.recipe.measurements.length > 0 && (
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
                              setServingsById(prev => ({ ...prev, [mocktail.id]: clamp((prev[mocktail.id] ?? 1) - 1) }));
                            }}
                          >
                            −
                          </button>
                          <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [mocktail.id]: clamp((prev[mocktail.id] ?? 1) + 1) }));
                            }}
                          >
                            +
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [mocktail.id]: 1 }));
                            }}
                            title="Reset servings"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                          </Button>
                        </div>
                      </div>

                      <ul className="text-sm leading-6 text-gray-800 space-y-1">
                        {mocktail.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                          const isNum = typeof ing.amount === 'number';
                          const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                          const show = useMetric && isNum
                            ? toMetric(ing.unit, Number(ing.amount) * servings)
                            : { amount: scaledDisplay, unit: ing.unit };

                          return (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-purple-500 mt-0.5" />
                              <span>
                                <span className="text-purple-600 font-semibold">
                                  {show.amount} {show.unit}
                                </span>{" "}
                                {ing.item}
                                {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                              </span>
                            </li>
                          );
                        })}
                        {mocktail.recipe.measurements.length > 4 && (
                          <li className="text-xs text-gray-600">
                            …plus {mocktail.recipe.measurements.length - 4} more •{" "}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRecipeModal(mocktail);
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
                            const lines = mocktail.ingredients.map((ing: string) => `- ${ing}`);
                            const txt = `${mocktail.name} (serves ${servings})\n${lines.join('\n')}`;
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
                          handleShareMocktail(mocktail, servings);
                        }}>
                          <Share2 className="w-4 w-4 mr-1" /> Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMetricFlags((prev) => ({ ...prev, [mocktail.id]: !prev[mocktail.id] }));
                          }}
                        >
                          {useMetric ? 'US' : 'Metric'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {mocktail.benefits?.slice(0, 3).map((benefit: string) => (
                      <Badge key={benefit} variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                        {benefit}
                      </Badge>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                    <Button 
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRecipeModal(mocktail);
                      }}
                    >
                      <Martini className="h-4 w-4 mr-2" />
                      View Recipe
                    </Button>
                    <Button variant="outline" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      handleShareMocktail(mocktail);
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
        <Card className="mt-12 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              The Art of Mocktails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              Mocktails offer complex flavor profiles using fresh herbs, quality ingredients, and creative 
              techniques. They're designed to provide the same sophisticated experience as traditional cocktails 
              for everyone to enjoy.
            </p>
          </CardContent>
        </Card>

        {/* Your Progress Card */}
        <Card className="mt-12 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  Your Progress
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <GlassWater className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-gray-600">Level:</span>
                    <Badge className="bg-purple-600 text-white">{userProgress.level}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-pink-500" />
                    <span className="text-sm text-gray-600">XP:</span>
                    <Badge className="bg-pink-600 text-white">{userProgress.totalPoints}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Martini className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-gray-600">Drinks Made:</span>
                    <Badge className="bg-purple-100 text-purple-800">{userProgress.totalDrinksMade}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-pink-500" />
                    <span className="text-sm text-gray-600">Mocktails Found:</span>
                    <Badge className="bg-pink-100 text-pink-800">{filteredMocktails.length}</Badge>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="border-purple-300 hover:bg-purple-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2 rotate-90" />
                Back to Top
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
