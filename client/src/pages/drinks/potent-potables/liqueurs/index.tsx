import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Wine, Clock, Heart, Target, Sparkles, Droplets, Search, Share2, ArrowLeft, GlassWater, Flame, TrendingUp, Award, Zap, Crown, Apple, Leaf, Clipboard, RotateCcw, Check, Home, Martini, Cherry, Coffee } from "lucide-react";
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

  return m(amount, unit, item);
};

const liqueurCocktails = [
  {
    id: 'liqueur-1',
    name: 'Amaretto Sour',
    description: 'Sweet almond liqueur with citrus and egg white',
    liqueurType: 'Amaretto',
    origin: 'United States',
    glassware: 'Old Fashioned Glass',
    servingSize: '5 oz',
    nutrition: { calories: 215, carbs: 18, sugar: 16, alcohol: 14 },
    ingredients: ['2 oz Amaretto', '1 oz Fresh Lemon Juice', '0.5 oz Bourbon', '1 Egg White', 'Lemon Wheel', 'Maraschino Cherry', 'Ice'],
    profile: ['Sweet', 'Almond', 'Frothy', 'Dessert'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 4234,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Nut Liqueurs',
    garnish: 'Lemon wheel, cherry',
    method: 'Shake',
    abv: '18-22%',
    iba_official: false,
    instructions: 'Dry shake amaretto, bourbon, lemon juice, and egg white (no ice). Add ice and shake hard for 15 seconds. Strain into glass with ice. Garnish with lemon wheel and cherry.'
  },
  {
    id: 'liqueur-2',
    name: 'Grasshopper',
    description: 'Creamy mint chocolate dessert cocktail',
    liqueurType: 'Crème de Menthe',
    origin: 'New Orleans, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 265, carbs: 22, sugar: 20, alcohol: 12 },
    ingredients: ['1 oz Green Crème de Menthe', '1 oz White Crème de Cacao', '1 oz Heavy Cream', 'Mint Leaf', 'Ice'],
    profile: ['Minty', 'Chocolate', 'Creamy', 'Sweet'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 4.50,
    category: 'Cream Liqueurs',
    garnish: 'Mint leaf',
    method: 'Shake',
    abv: '15-18%',
    iba_official: true,
    instructions: 'Add crème de menthe, crème de cacao, and cream to shaker with ice. Shake for 15 seconds. Strain into chilled coupe glass. Garnish with mint leaf.'
  },
  {
    id: 'liqueur-3',
    name: 'B-52',
    description: 'Layered shot with Kahlúa, Baileys, and Grand Marnier',
    liqueurType: 'Multiple',
    origin: 'Canada',
    glassware: 'Shot Glass',
    servingSize: '2 oz',
    nutrition: { calories: 185, carbs: 14, sugar: 13, alcohol: 10 },
    ingredients: ['0.66 oz Kahlúa', '0.66 oz Baileys Irish Cream', '0.66 oz Grand Marnier'],
    profile: ['Layered', 'Coffee', 'Creamy', 'Orange'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.6,
    reviews: 3456,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    category: 'Layered Shots',
    garnish: 'None',
    method: 'Layer',
    abv: '25-30%',
    iba_official: true,
    instructions: 'Layer ingredients carefully in order: First Kahlúa, then Baileys (pour over back of spoon), then Grand Marnier on top. Do not mix.'
  },
  {
    id: 'liqueur-4',
    name: 'Midori Sour',
    description: 'Bright green melon liqueur sour',
    liqueurType: 'Midori',
    origin: 'Japan',
    glassware: 'Highball Glass',
    servingSize: '6 oz',
    nutrition: { calories: 195, carbs: 20, sugar: 18, alcohol: 11 },
    ingredients: ['2 oz Midori Melon Liqueur', '1 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', 'Soda Water', 'Lemon Wheel', 'Maraschino Cherry', 'Ice'],
    profile: ['Melon', 'Sweet', 'Refreshing', 'Bright'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 2345,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    category: 'Fruit Liqueurs',
    garnish: 'Lemon wheel, cherry',
    method: 'Shake & Top',
    abv: '12-15%',
    iba_official: false,
    instructions: 'Shake Midori, lemon juice, and simple syrup with ice. Strain into highball glass with ice. Top with soda water. Garnish with lemon wheel and cherry.'
  },
  {
    id: 'liqueur-5',
    name: 'Chambord Royale',
    description: 'Raspberry liqueur with champagne',
    liqueurType: 'Chambord',
    origin: 'France',
    glassware: 'Champagne Flute',
    servingSize: '5 oz',
    nutrition: { calories: 145, carbs: 10, sugar: 9, alcohol: 12 },
    ingredients: ['0.5 oz Chambord', '4.5 oz Champagne', 'Fresh Raspberry'],
    profile: ['Raspberry', 'Bubbly', 'Elegant', 'Sweet'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 3124,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    category: 'Fruit Liqueurs',
    garnish: 'Fresh raspberry',
    method: 'Build',
    abv: '14-16%',
    iba_official: false,
    instructions: 'Pour Chambord into champagne flute. Top with champagne. Drop fresh raspberry into glass.'
  },
  {
    id: 'liqueur-6',
    name: 'Baileys Mudslide',
    description: 'Creamy coffee dessert cocktail',
    liqueurType: 'Baileys',
    origin: 'United States',
    glassware: 'Old Fashioned Glass',
    servingSize: '6 oz',
    nutrition: { calories: 325, carbs: 26, sugar: 24, alcohol: 14 },
    ingredients: ['1.5 oz Baileys Irish Cream', '1.5 oz Vodka', '1.5 oz Kahlúa', '1 oz Heavy Cream', 'Chocolate Shavings', 'Ice'],
    profile: ['Creamy', 'Coffee', 'Chocolate', 'Dessert'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 4567,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    category: 'Cream Liqueurs',
    garnish: 'Chocolate shavings',
    method: 'Shake',
    abv: '18-22%',
    iba_official: false,
    instructions: 'Add Baileys, vodka, Kahlúa, and cream to shaker with ice. Shake for 15 seconds. Strain into glass with ice. Top with chocolate shavings.'
  },
  {
    id: 'liqueur-7',
    name: 'Limoncello Spritz',
    description: 'Italian lemon liqueur with prosecco',
    liqueurType: 'Limoncello',
    origin: 'Italy',
    glassware: 'Wine Glass',
    servingSize: '8 oz',
    nutrition: { calories: 175, carbs: 16, sugar: 14, alcohol: 11 },
    ingredients: ['2 oz Limoncello', '3 oz Prosecco', '2 oz Soda Water', 'Lemon Slice', 'Fresh Mint', 'Ice'],
    profile: ['Lemon', 'Bubbly', 'Refreshing', 'Italian'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 5234,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Fruit Liqueurs',
    garnish: 'Lemon slice, mint',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill wine glass with ice. Add limoncello, prosecco, and soda water. Stir gently. Garnish with lemon slice and mint.'
  },
  {
    id: 'liqueur-8',
    name: 'Frangelico Fizz',
    description: 'Hazelnut liqueur with lemon and soda',
    liqueurType: 'Frangelico',
    origin: 'Italy',
    glassware: 'Highball Glass',
    servingSize: '7 oz',
    nutrition: { calories: 185, carbs: 16, sugar: 14, alcohol: 12 },
    ingredients: ['2 oz Frangelico', '1 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', 'Soda Water', 'Lemon Twist', 'Ice'],
    profile: ['Hazelnut', 'Nutty', 'Refreshing', 'Bubbly'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1876,
    trending: false,
    featured: false,
    estimatedCost: 4.50,
    category: 'Nut Liqueurs',
    garnish: 'Lemon twist',
    method: 'Shake & Top',
    abv: '12-15%',
    iba_official: false,
    instructions: 'Shake Frangelico, lemon juice, and simple syrup with ice. Strain into highball glass with ice. Top with soda water. Garnish with lemon twist.'
  },
  {
    id: 'liqueur-9',
    name: 'Godfather',
    description: 'Simple scotch and amaretto',
    liqueurType: 'Amaretto',
    origin: 'United States',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: { calories: 195, carbs: 10, sugar: 9, alcohol: 17 },
    ingredients: ['1.5 oz Scotch Whisky', '1.5 oz Amaretto', 'Ice'],
    profile: ['Almond', 'Smoky', 'Strong', 'Simple'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 2345,
    trending: false,
    featured: false,
    estimatedCost: 5.00,
    category: 'Nut Liqueurs',
    garnish: 'None',
    method: 'Build',
    abv: '28-32%',
    iba_official: false,
    instructions: 'Fill old fashioned glass with ice. Add scotch and amaretto. Stir gently.'
  },
  {
    id: 'liqueur-10',
    name: 'Cointreau Margarita',
    description: 'Premium margarita with orange liqueur',
    liqueurType: 'Cointreau',
    origin: 'Mexico/France',
    glassware: 'Margarita Glass',
    servingSize: '5 oz',
    nutrition: { calories: 195, carbs: 14, sugar: 12, alcohol: 14 },
    ingredients: ['2 oz Tequila', '1 oz Cointreau', '1 oz Fresh Lime Juice', 'Salt for rim', 'Lime Wheel', 'Ice'],
    profile: ['Citrus', 'Orange', 'Tart', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 6234,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    category: 'Fruit Liqueurs',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Rim glass with salt. Shake tequila, Cointreau, and lime juice with ice for 10 seconds. Strain into prepared glass with fresh ice. Garnish with lime wheel.'
  },
  {
    id: 'liqueur-11',
    name: 'St. Germain Cocktail',
    description: 'Elderflower liqueur with champagne',
    liqueurType: 'St-Germain',
    origin: 'France',
    glassware: 'Champagne Flute',
    servingSize: '5 oz',
    nutrition: { calories: 155, carbs: 10, sugar: 9, alcohol: 12 },
    ingredients: ['1.5 oz St-Germain', '0.5 oz Fresh Lemon Juice', '3 oz Champagne', 'Lemon Twist'],
    profile: ['Floral', 'Elderflower', 'Bubbly', 'Elegant'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 3876,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    category: 'Floral Liqueurs',
    garnish: 'Lemon twist',
    method: 'Build',
    abv: '14-16%',
    iba_official: false,
    instructions: 'Add St-Germain and lemon juice to champagne flute. Top with champagne. Stir gently. Garnish with lemon twist.'
  },
  {
    id: 'liqueur-12',
    name: 'Aperol Spritz',
    description: 'Bittersweet Italian aperitif with prosecco',
    liqueurType: 'Aperol',
    origin: 'Venice, Italy',
    glassware: 'Wine Glass',
    servingSize: '8 oz',
    nutrition: { calories: 165, carbs: 14, sugar: 12, alcohol: 11 },
    ingredients: ['3 oz Prosecco', '2 oz Aperol', '1 oz Soda Water', 'Orange Slice', 'Ice'],
    profile: ['Bitter-Sweet', 'Orange', 'Bubbly', 'Refreshing'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 7892,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Aperitif Liqueurs',
    garnish: 'Orange slice',
    method: 'Build',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill wine glass with ice. Add prosecco, Aperol, and soda water in order. Stir gently. Garnish with orange slice.'
  },
  {
    id: 'liqueur-13',
    name: 'Drambuie Rusty Nail',
    description: 'Scotch and honey liqueur classic',
    liqueurType: 'Drambuie',
    origin: 'Scotland',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: { calories: 185, carbs: 8, sugar: 7, alcohol: 17 },
    ingredients: ['1.5 oz Scotch Whisky', '1.5 oz Drambuie', 'Lemon Twist', 'Ice'],
    profile: ['Honey', 'Herbal', 'Smoky', 'Complex'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 1987,
    trending: false,
    featured: false,
    estimatedCost: 6.00,
    category: 'Herbal Liqueurs',
    garnish: 'Lemon twist',
    method: 'Build',
    abv: '28-32%',
    iba_official: true,
    instructions: 'Fill old fashioned glass with ice. Add scotch and Drambuie. Stir gently. Garnish with lemon twist.'
  },
  {
    id: 'liqueur-14',
    name: 'Grand Marnier Sidecar',
    description: 'Cognac and orange liqueur classic',
    liqueurType: 'Grand Marnier',
    origin: 'Paris, France',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 12, sugar: 10, alcohol: 16 },
    ingredients: ['1.5 oz Cognac', '1 oz Grand Marnier', '0.75 oz Fresh Lemon Juice', 'Sugar for rim', 'Orange Twist', 'Ice'],
    profile: ['Orange', 'Citrus', 'Sophisticated', 'Classic'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 7.00,
    category: 'Fruit Liqueurs',
    garnish: 'Sugar rim, orange twist',
    method: 'Shake',
    abv: '24-28%',
    iba_official: true,
    instructions: 'Rim coupe glass with sugar. Shake cognac, Grand Marnier, and lemon juice with ice. Strain into prepared glass. Garnish with orange twist.'
  },
  {
    id: 'liqueur-15',
    name: 'Jägermeister Bomb',
    description: 'Herbal liqueur shot with energy drink',
    liqueurType: 'Jägermeister',
    origin: 'Germany',
    glassware: 'Pint Glass',
    servingSize: '10 oz',
    nutrition: { calories: 245, carbs: 32, sugar: 30, alcohol: 11 },
    ingredients: ['1.5 oz Jägermeister', '8 oz Energy Drink'],
    profile: ['Herbal', 'Energizing', 'Sweet', 'Party'],
    difficulty: 'Very Easy',
    prepTime: 1,
    rating: 4.3,
    reviews: 5432,
    trending: true,
    featured: false,
    estimatedCost: 4.00,
    category: 'Herbal Liqueurs',
    garnish: 'None',
    method: 'Drop',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Fill pint glass halfway with energy drink. Pour Jägermeister into shot glass. Drop shot glass into pint glass and drink immediately.'
  }
];

const liqueurCategories = [
  { id: 'all', name: 'All Liqueurs', icon: Wine, description: 'Every liqueur cocktail' },
  { id: 'fruit', name: 'Fruit Liqueurs', icon: Cherry, description: 'Berry & citrus flavors' },
  { id: 'cream', name: 'Cream Liqueurs', icon: GlassWater, description: 'Creamy & smooth' },
  { id: 'nut', name: 'Nut Liqueurs', icon: Crown, description: 'Almond & hazelnut' },
  { id: 'herbal', name: 'Herbal Liqueurs', icon: Leaf, description: 'Botanical & complex' }
];

const methods = ['All Methods', 'Build', 'Shake', 'Layer', 'Drop'];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
  { id: 'gin', name: 'Gin', path: '/drinks/potent-potables/gin', icon: Droplets, description: 'Botanical spirits' },
  { id: 'cognac', name: 'Cognac & Brandy', path: '/drinks/potent-potables/cognac-brandy', icon: Wine, description: 'French elegance' },
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

export default function LiqueursPage() {
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
  const liqueurRecipesWithMeasurements = useMemo(() => {
    return liqueurCocktails.map((c) => {
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
        category: 'liqueurs',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(35);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = liqueurRecipesWithMeasurements.filter(cocktail => {
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string> = {
        'fruit': 'Fruit Liqueurs',
        'cream': 'Cream Liqueurs',
        'nut': 'Nut Liqueurs',
        'herbal': 'Herbal Liqueurs',
        'aperitif': 'Aperitif Liqueurs',
        'floral': 'Floral Liqueurs',
        'layered': 'Layered Shots'
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="purple"
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
                  <Wine className="h-6 w-6 text-purple-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Liqueurs</h1>
                  <Badge className="bg-purple-100 text-purple-800">Sweet Spirits</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <GlassWater className="fill-purple-500 text-purple-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
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
          <Card className="bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                        <Icon className="h-4 w-4 mr-2 text-pink-500" />
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
                <div className="text-2xl font-bold text-purple-600">16%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-pink-600">4.6★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">3 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-pink-600">{liqueurCocktails.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {liqueurCategories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-50"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-3xl md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search liqueur cocktails..."
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
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
              >
                {methods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
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
            <Card className="mb-6 bg-white border-purple-200">
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

          {/* Cocktails Grid - Truncated for length, same pattern as gin page */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map(cocktail => {
              const useMetric = !!metricFlags[cocktail.id];
              const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-purple-100 hover:border-purple-300"
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
                            category: 'Liqueurs',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-purple-100 text-purple-700">{cocktail.category}</Badge>
                      {cocktail.trending && (
                        <Badge className="bg-pink-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-purple-500">
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
                        <div className="font-bold text-purple-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-pink-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-purple-600">{cocktail.method.split(' ')[0]}</div>
                        <div className="text-gray-500">Method</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(cocktail.rating)
                                ? 'fill-purple-500 text-purple-500'
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

                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile?.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                      <Button 
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Wine className="h-4 w-4 mr-2" />
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
          <Card className="mt-12 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-purple-500" />
                The World of Liqueurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Wine className="w-8 h-8 text-purple-500 mb-2" />
                  <h3 className="font-semibold mb-2">Sweet Spirits</h3>
                  <p className="text-sm text-gray-700">
                    Liqueurs are sweetened spirits flavored with fruits, herbs, spices, flowers, or nuts. They typically 
                    have lower alcohol content than base spirits.
                  </p>
                </div>
                <div>
                  <Award className="w-8 h-8 text-pink-500 mb-2" />
                  <h3 className="font-semibold mb-2">Versatile Mixers</h3>
                  <p className="text-sm text-gray-700">
                    Liqueurs add complexity, sweetness, and flavor to cocktails. They can be enjoyed neat as digestifs 
                    or used as key ingredients in classic drinks.
                  </p>
                </div>
                <div>
                  <Sparkles className="w-8 h-8 text-rose-500 mb-2" />
                  <h3 className="font-semibold mb-2">Endless Variety</h3>
                  <p className="text-sm text-gray-700">
                    From fruit-forward Cointreau to creamy Baileys to herbal Chartreuse, liqueurs offer incredible 
                    diversity for mixologists and cocktail enthusiasts.
                  </p>
                </div>
              </div>
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
                      <Wine className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-purple-100 text-purple-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-pink-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-pink-100 text-pink-800">{filteredCocktails.length}</Badge>
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
    </RequireAgeGate>
  );
}
