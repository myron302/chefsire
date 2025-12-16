// client/src/pages/drinks/detoxes/tea/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Coffee, Clock, Heart, Star, Target, Flame, Leaf, Sparkles,
  Search, Share2, ArrowLeft, Zap, Camera, Droplets,
  Apple, FlaskConical, GlassWater, Waves, X, Check, Clipboard, RotateCcw
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit from '@/components/recipes/RecipeKit';
import { otherDrinkHubs, teaTypes } from '../../data/detoxes';

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// scaling helpers
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '1/4', 2: '1/2', 3: '3/4' };
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

// metric conversion for teas
const toMetric = (unit: string, amount: number) => {
  const mlPerCup = 240, mlPerOz = 30;
  switch (unit) {
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * 15), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * 5), unit: 'ml' };
    default: return { amount, unit };
  }
};

// ---------- Detox Teas Data (with 4 new recipes) ----------
const detoxTeas = [
  {
    id: 'green-detox-tea',
    name: 'Green Tea Metabolism Boost',
    description: 'Antioxidant-rich green tea with metabolism-enhancing herbs',
    nutrition: { calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, caffeine: 35 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 423,
    trending: true,
    featured: true,
    teaType: 'Green Tea',
    detoxFocus: 'Metabolic',
    category: 'Green',
    bestTime: 'Morning or before workout',
    duration: 'Daily',
    estimatedCost: 1.20,
    brewTemp: '175°F (80°C)',
    steepTime: '3-4 minutes',
    ingredients: ['1 tsp green tea leaves', '1 cup water', '1 slice lemon', '1 tsp honey'],
    benefits: ['Metabolism boost', 'Antioxidant rich', 'Fat burning', 'Energy enhancement'],
    specialInstructions: 'Do not oversteep to avoid bitterness'
  },
  {
    id: 'dandelion-detox',
    name: 'Dandelion Root Cleanse',
    description: 'Liver-cleansing herbal tea with dandelion and burdock',
    nutrition: { calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 8,
    rating: 4.5,
    reviews: 287,
    trending: false,
    featured: false,
    teaType: 'Herbal',
    detoxFocus: 'Liver',
    category: 'Root',
    bestTime: 'Between meals',
    duration: '2-3 weeks',
    estimatedCost: 1.80,
    brewTemp: '212°F (100°C)',
    steepTime: '7-10 minutes',
    ingredients: ['1 tbsp dandelion root', '1 tsp burdock root', '2 cups water', '1 cinnamon stick'],
    benefits: ['Liver detoxification', 'Digestive aid', 'Anti-inflammatory', 'Skin health'],
    specialInstructions: 'Best consumed warm for maximum liver benefits'
  },
  {
    id: 'ginger-turmeric-blend',
    name: 'Ginger Turmeric Anti-inflammatory',
    description: 'Warming spice blend for inflammation reduction and digestion',
    nutrition: { calories: 8, protein: 0, carbs: 2, fat: 0, fiber: 0, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 10,
    rating: 4.8,
    reviews: 512,
    trending: true,
    featured: true,
    teaType: 'Herbal',
    detoxFocus: 'Anti-inflammatory',
    category: 'Spice',
    bestTime: 'After meals',
    duration: 'Ongoing',
    estimatedCost: 2.50,
    brewTemp: '212°F (100°C)',
    steepTime: '8-12 minutes',
    ingredients: ['1 inch fresh ginger', '1 tsp turmeric powder', '2 cups water', '1 tsp honey', 'pinch black pepper'],
    benefits: ['Anti-inflammatory', 'Digestive support', 'Immune boosting', 'Pain relief'],
    specialInstructions: 'Add black pepper to enhance turmeric absorption'
  },
  {
    id: 'peppermint-digestive',
    name: 'Peppermint Digestive Aid',
    description: 'Soothing mint tea for digestive comfort and bloating relief',
    nutrition: { calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.6,
    reviews: 398,
    trending: false,
    featured: false,
    teaType: 'Herbal',
    detoxFocus: 'Digestive',
    category: 'Mint',
    bestTime: 'After meals or before bed',
    duration: 'As needed',
    estimatedCost: 1.50,
    brewTemp: '212°F (100°C)',
    steepTime: '5-7 minutes',
    ingredients: ['1 tbsp fresh peppermint leaves', '1 cup water', '1 tsp fennel seeds'],
    benefits: ['Digestive comfort', 'Bloating relief', 'Stress reduction', 'Fresh breath'],
    specialInstructions: 'Steep covered to preserve volatile oils'
  },
  {
    id: 'white-tea-antioxidant',
    name: 'White Tea Antioxidant Boost',
    description: 'Delicate white tea with high antioxidant content for cellular protection',
    nutrition: { calories: 3, protein: 0, carbs: 1, fat: 0, fiber: 0, caffeine: 25 },
    difficulty: 'Medium',
    prepTime: 7,
    rating: 4.4,
    reviews: 234,
    trending: false,
    featured: false,
    teaType: 'White Tea',
    detoxFocus: 'Antioxidant',
    category: 'White',
    bestTime: 'Morning or afternoon',
    duration: 'Daily',
    estimatedCost: 3.20,
    brewTemp: '185°F (85°C)',
    steepTime: '4-6 minutes',
    ingredients: ['1 tsp white tea leaves', '1 cup water', '1 rose bud', '1 tsp raw honey'],
    benefits: ['Antioxidant protection', 'Skin health', 'Anti-aging', 'Gentle energy'],
    specialInstructions: 'Use lower temperature to preserve delicate flavors'
  },
  // NEW RECIPES START HERE
  {
    id: 'hibiscus-liver-cleanse',
    name: 'Hibiscus Liver Cleanse',
    description: 'Vibrant hibiscus tea with liver-supporting herbs and citrus',
    nutrition: { calories: 6, protein: 0, carbs: 2, fat: 0, fiber: 0, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 8,
    rating: 4.7,
    reviews: 189,
    trending: true,
    featured: false,
    teaType: 'Herbal',
    detoxFocus: 'Liver',
    category: 'Floral',
    bestTime: 'Morning or between meals',
    duration: '1-2 weeks',
    estimatedCost: 2.80,
    brewTemp: '212°F (100°C)',
    steepTime: '6-8 minutes',
    ingredients: ['2 tbsp dried hibiscus', '1 cup water', '1 slice orange', '1 tsp honey', 'sprig of mint'],
    benefits: ['Liver detoxification', 'Blood pressure support', 'Rich in vitamin C', 'Diuretic properties'],
    specialInstructions: 'Can be served hot or iced'
  },
  {
    id: 'chamomile-sleep-tonic',
    name: 'Chamomile Sleep Tonic',
    description: 'Calming bedtime tea for restful sleep and nervous system support',
    nutrition: { calories: 3, protein: 0, carbs: 1, fat: 0, fiber: 0, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 6,
    rating: 4.9,
    reviews: 345,
    trending: true,
    featured: true,
    teaType: 'Herbal',
    detoxFocus: 'Relaxation',
    category: 'Floral',
    bestTime: '30 minutes before bed',
    duration: 'Daily',
    estimatedCost: 2.20,
    brewTemp: '212°F (100°C)',
    steepTime: '8-10 minutes',
    ingredients: ['2 tbsp chamomile flowers', '1 cup water', '1 tsp lavender buds', '1 tsp raw honey'],
    benefits: ['Sleep support', 'Stress reduction', 'Digestive calm', 'Anti-anxiety'],
    specialInstructions: 'Steep longer for stronger sedative effects'
  },
  {
    id: 'matcha-energy-elixir',
    name: 'Matcha Energy Elixir',
    description: 'Premium matcha green tea for sustained energy and mental clarity',
    nutrition: { calories: 4, protein: 1, carbs: 1, fat: 0, fiber: 0, caffeine: 70 },
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.8,
    reviews: 278,
    trending: false,
    featured: false,
    teaType: 'Green Tea',
    detoxFocus: 'Energy',
    category: 'Green',
    bestTime: 'Morning or pre-workout',
    duration: 'Daily',
    estimatedCost: 4.50,
    brewTemp: '175°F (80°C)',
    steepTime: 'Whisk until frothy',
    ingredients: ['1 tsp ceremonial matcha', '1/2 cup hot water', '1/2 cup almond milk', '1 tsp honey'],
    benefits: ['Sustained energy', 'Mental clarity', 'Metabolism boost', 'Antioxidant rich'],
    specialInstructions: 'Whisk vigorously to prevent clumping and create froth'
  },
  {
    id: 'rooibos-immune-defense',
    name: 'Rooibos Immune Defense',
    description: 'Caffeine-free rooibos with immune-boosting herbs and spices',
    nutrition: { calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 7,
    rating: 4.6,
    reviews: 167,
    trending: false,
    featured: false,
    teaType: 'Herbal',
    detoxFocus: 'Immune',
    category: 'Red',
    bestTime: 'Any time of day',
    duration: 'Seasonal or daily',
    estimatedCost: 3.00,
    brewTemp: '212°F (100°C)',
    steepTime: '5-7 minutes',
    ingredients: ['1 tbsp rooibos tea', '1 cup water', '1 slice lemon', '1 inch ginger', '1 tsp honey'],
    benefits: ['Immune support', 'Antioxidant rich', 'Caffeine-free energy', 'Anti-inflammatory'],
    specialInstructions: 'Can withstand longer steeping without bitterness'
  }
];

export default function DetoxTeasPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedTeaType, setSelectedTeaType] = useState('');
  const [selectedFocus, setSelectedFocus] = useState('');
  const [caffeineLevel, setCaffeineLevel] = useState(['Any']);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert detox teas to RecipeKit format
  const detoxRecipesWithMeasurements = useMemo(() => {
    return detoxTeas.map(tea => ({
      ...tea,
      recipe: {
        servings: 1,
        measurements: tea.ingredients.map((ing, index) => {
          // Parse ingredients into measured format
          const parts = ing.split(' ');
          if (parts.length >= 2 && !isNaN(parseFloat(parts[0]))) {
            const amount = parts[0];
            const unit = parts[1];
            const item = parts.slice(2).join(' ');
            return m(amount, unit, item);
          }
          return m('1', 'item', ing);
        }),
        directions: [
          `Heat water to ${tea.brewTemp}`,
          `Add tea ingredients to infuser or pot`,
          `Steep for ${tea.steepTime}`,
          'Strain and serve hot',
          ...(tea.specialInstructions ? [tea.specialInstructions] : [])
        ]
      }
    }));
  }, []);

  const handleShareTea = async (tea: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[tea.id] ?? (tea.recipe?.servings || 1);
    const preview = tea.ingredients.slice(0, 4).join(' • ');
    const text = `${tea.name} • ${tea.teaType} • ${tea.detoxFocus}\n${preview}${tea.ingredients.length > 4 ? ` …plus ${tea.ingredients.length - 4} more` : ''}`;
    const shareData = { title: tea.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${tea.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${tea.name}\n${text}\n${url}`);
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
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'detoxes' as const,
        description: `${selectedRecipe.teaType || ''} • ${selectedRecipe.detoxFocus || ''}`,
        ingredients: selectedRecipe.ingredients,
        nutrition: selectedRecipe.nutrition,
        difficulty: selectedRecipe.difficulty,
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        bestTime: selectedRecipe.bestTime,
        tags: selectedRecipe.benefits
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(20);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredTeas = () => {
    let filtered = detoxRecipesWithMeasurements.filter(tea => {
      const matchesSearch = tea.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           tea.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedTeaType || tea.teaType?.toLowerCase().includes(selectedTeaType.toLowerCase());
      const matchesFocus = !selectedFocus || tea.detoxFocus?.toLowerCase().includes(selectedFocus.toLowerCase());
      const matchesCaffeine = caffeineLevel[0] === 'Any' || 
        (caffeineLevel[0] === 'Caffeinated' && (tea.nutrition.caffeine || 0) > 0) ||
        (caffeineLevel[0] === 'Caffeine-Free' && (tea.nutrition.caffeine || 0) === 0);
      
      return matchesSearch && matchesType && matchesFocus && matchesCaffeine;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredTeas = getFilteredTeas();
  const featuredTeas = detoxRecipesWithMeasurements.filter(tea => tea.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
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
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="amber"
          pointsReward={20}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: selectedRecipe.nutrition || {},
            defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/detoxes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Detoxes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Coffee className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Teas</h1>
                <Badge className="bg-amber-100 text-amber-800">Cleansing</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowUniversalSearch(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                      <Icon className="h-4 w-4 mr-2 text-amber-600" />
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

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Detox Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/drinks/detoxes/juice">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Droplets className="h-4 w-4 mr-2 text-green-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Detox Juices</div>
                    <div className="text-xs text-gray-500">Cold-pressed cleansing</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes/water">
                <Button variant="outline" className="w-full justify-start hover:bg-cyan-50 hover:border-cyan-300">
                  <Waves className="h-4 w-4 mr-2 text-cyan-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Infused Waters</div>
                    <div className="text-xs text-gray-500">Fruit & herb hydration</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">4</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">50%</div>
              <div className="text-sm text-gray-600">Caffeine-Free</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">100%</div>
              <div className="text-sm text-gray-600">Natural</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{detoxTeas.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'tea-types', label: 'Tea Types', icon: Coffee },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-amber-600 shadow-sm !text-white hover:!text-white hover:bg-amber-700' : ''}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      placeholder="Search detox teas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={selectedTeaType}
                      onChange={(e) => setSelectedTeaType(e.target.value)}
                    >
                      <option value="">All Tea Types</option>
                      <option value="Green Tea">Green Tea</option>
                      <option value="Herbal">Herbal</option>
                      <option value="White Tea">White Tea</option>
                      <option value="Oolong">Oolong</option>
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={selectedFocus}
                      onChange={(e) => setSelectedFocus(e.target.value)}
                    >
                      <option value="">All Focus Areas</option>
                      <option value="Metabolic">Metabolic</option>
                      <option value="Digestive">Digestive</option>
                      <option value="Liver">Liver Support</option>
                      <option value="Anti-inflammatory">Anti-inflammatory</option>
                      <option value="Relaxation">Relaxation</option>
                      <option value="Energy">Energy</option>
                      <option value="Immune">Immune</option>
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={caffeineLevel[0]}
                      onChange={(e) => setCaffeineLevel([e.target.value])}
                    >
                      <option value="Any">Any Caffeine Level</option>
                      <option value="Caffeinated">Caffeinated</option>
                      <option value="Caffeine-Free">Caffeine-Free</option>
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="prepTime">Sort by Prep Time</option>
                      <option value="cost">Sort by Cost</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tea Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeas.map(tea => {
                const useMetric = !!metricFlags[tea.id];
                const servings = servingsById[tea.id] ?? (tea.recipe?.servings || 1);

                return (
                  <Card key={tea.id} onClick={(e) => { e.stopPropagation(); openRecipeModal(tea); }} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{tea.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{tea.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); addToFavorites({
                            id: tea.id,
                            name: tea.name,
                            category: 'detoxes',
                            description: tea.description,
                            ingredients: tea.ingredients,
                            nutrition: tea.nutrition,
                            difficulty: tea.difficulty,
                            prepTime: tea.prepTime,
                            rating: tea.rating,
                            bestTime: tea.bestTime
                          })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(tea.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-amber-100 text-amber-800">{tea.teaType}</Badge>
                        <Badge variant="outline">{tea.detoxFocus}</Badge>
                        {tea.nutrition.caffeine === 0 && <Badge className="bg-green-100 text-green-800">Caffeine-Free</Badge>}
                        {tea.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-amber-600">{tea.nutrition.calories}</div>
                          <div className="text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="font-bold text-green-600">{tea.nutrition.caffeine}mg</div>
                          <div className="text-gray-500">Caffeine</div>
                        </div>
                        <div>
                          <div className="font-bold text-orange-600">{tea.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY - MOVED TO BE IMMEDIATELY ABOVE RECIPE CARD */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{tea.rating}</span>
                          <span className="text-gray-500 text-sm">({tea.reviews})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {tea.difficulty}
                        </Badge>
                      </div>

                      {/* RecipeKit Preview */}
                      {tea.recipe?.measurements && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Recipe (serves {servings})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [tea.id]: clamp((prev[tea.id] ?? (tea.recipe?.servings || 1)) - 1) }))
                                }
                                aria-label="decrease servings"
                              >
                                −
                              </button>
                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [tea.id]: clamp((prev[tea.id] ?? (tea.recipe?.servings || 1)) + 1) }))
                                }
                                aria-label="increase servings"
                              >
                                +
                              </button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setServingsById(prev => {
                                  const next = { ...prev };
                                  next[tea.id] = tea.recipe?.servings || 1;
                                  return next;
                                })}
                                title="Reset servings"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                              </Button>
                            </div>
                          </div>

                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {tea.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show = useMetric && isNum
                                ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-amber-600 mt-0.5" />
                                  <span>
                                    <span className="text-amber-700 font-semibold">
                                      {show.amount} {show.unit}
                                    </span>{" "}
                                    {ing.item}
                                    {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                  </span>
                                </li>
                              );
                            })}
                            {tea.recipe.measurements.length > 4 && (
                              <li className="text-xs text-gray-600">
                                …plus {tea.recipe.measurements.length - 4} more •{" "}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openRecipeModal(tea)}
                                  className="underline underline-offset-2"
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
                              onClick={async (e) => { e.stopPropagation();
                                const lines = tea.ingredients.map((ing: string) => `- ${ing}`);
                                const txt = `${tea.name} (serves ${servings})\n${lines.join('\n')}`;
                                try {
                                  await navigator.clipboard.writeText(txt);
                                  alert('Recipe copied!');
                                } catch {
                                  alert('Unable to copy on this device.');
                                }
                              }}
                            >
                              <Clipboard className="w-4 h-4 mr-1" /> Copy
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleShareTea(tea, servings)}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            {/* Metric Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMetricFlags((prev) => ({ ...prev, [tea.id]: !prev[tea.id] }))
                              }
                            >
                              {useMetric ? 'US' : 'Metric'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Brewing Info */}
                      <div className="mb-4 bg-amber-50 p-3 rounded-lg">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Brew:</span>
                            <span className="font-medium ml-1">{tea.brewTemp}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Steep:</span>
                            <span className="font-medium ml-1">{tea.steepTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Duration and Time */}
                      <div className="space-y-2 mb-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Best Time:</span>
                          <span className="font-medium">{tea.bestTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">{tea.duration}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {tea.benefits.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Brew Tea Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-amber-600 hover:bg-amber-700"
                          onClick={(e) => { e.stopPropagation(); openRecipeModal(tea)}
                        >
                          <Coffee className="h-4 w-4 mr-2" />
                          Brew Tea (+20 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'tea-types' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tea Types & Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teaTypes.map((type, index) => (
                    <Card key={index} className="border-l-4 border-l-amber-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <type.icon className="h-5 w-5 text-amber-600" />
                          <h3 className="font-semibold">{type.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {type.benefits.map((benefit, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Featured Detox Teas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredTeas.map(tea => (
                    <Card key={tea.id} className="border-2 border-amber-300">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{tea.name}</CardTitle>
                          <Badge className="bg-amber-100 text-amber-800">Featured</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{tea.description}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Rating:</span>
                            <span className="font-semibold">{tea.rating} ⭐</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Prep Time:</span>
                            <span className="font-semibold">{tea.prepTime} mins</span>
                          </div>
                          <Button 
                            className="w-full bg-amber-600 hover:bg-amber-700"
                            onClick={(e) => { e.stopPropagation(); openRecipeModal(tea)}
                          >
                            <Coffee className="h-4 w-4 mr-2" />
                            View Recipe
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-amber-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-orange-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
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
