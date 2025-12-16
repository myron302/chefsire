import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple, Gem,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Activity, BarChart3, Crown, Dumbbell, Eye, Bone, Moon, Wine, ArrowRight, X, Check
, Coffee} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';

// Navigation data
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'plant', name: 'Plant-Based', icon: Leaf, path: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'egg', name: 'Egg Protein', icon: Target, path: '/drinks/protein-shakes/egg', description: 'Complete amino' },
  { id: 'beef', name: 'Beef Protein', icon: Flame, path: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

// Helper for measurements
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const scaleAmount = (amt: number | string, factor: number): number | string => {
  if (typeof amt === 'number') return Math.round((amt * factor + Number.EPSILON) * 100) / 100;
  return amt;
};

// Collagen protein shake data - Updated with absorptionTime and leucineContent
const collagenShakes = [
  {
    id: 'collagen-1',
    name: 'Beauty Boost Berry',
    description: 'Type I & III collagen for radiant skin and strong nails',
    image: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=400&h=300&fit=crop',
    collagenTypes: ['Type I', 'Type III'],
    source: 'Grass-Fed Bovine',
    flavor: 'Mixed Berry',
    servingSize: '20g',
    nutrition: {
      calories: 70,
      protein: 18,
      carbs: 0,
      fat: 0,
      collagen: 18,
      vitamin_c: 60,
      biotin: 30
    },
    ingredients: ['Hydrolyzed Collagen Peptides', 'Natural Berry Flavors', 'Vitamin C', 'Biotin', 'Hyaluronic Acid'],
    benefits: ['Skin Elasticity', 'Hair Growth', 'Nail Strength', 'Anti-Aging'],
    absorption: 'Fast',
    absorptionTime: '15-30 minutes',
    leucineContent: 1.2,
    bioavailability: 95,
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.8,
    reviews: 2156,
    trending: true,
    featured: true,
    price: 39.99,
    bestTime: 'Morning',
    primaryBenefit: 'Skin Health',
    ageGroup: 'All Ages',
    certifications: ['Grass-Fed', 'Pasture-Raised', 'Non-GMO'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (20g)', 'hydrolyzed collagen peptides'),
        m(0.75, 'cup', 'unsweetened almond milk'),
        m(0.5, 'cup', 'mixed berries, frozen'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'vitamin C powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Add milk and collagen first, then berries and powders.',
        'Blend until smooth and creamy.'
      ]
    }
  },
  {
    id: 'collagen-2',
    name: 'Joint Support Vanilla',
    description: 'Type II collagen for cartilage and joint mobility',
    collagenTypes: ['Type II'],
    source: 'Chicken Sternum',
    flavor: 'Vanilla Cream',
    servingSize: '15g',
    nutrition: {
      calories: 50,
      protein: 12,
      carbs: 1,
      fat: 0,
      collagen: 12,
      glucosamine: 500,
      chondroitin: 400
    },
    ingredients: ['Type II Collagen', 'Glucosamine Sulfate', 'Chondroitin Sulfate', 'MSM', 'Natural Vanilla'],
    benefits: ['Joint Health', 'Cartilage Support', 'Mobility', 'Flexibility'],
    absorption: 'Moderate',
    absorptionTime: '30-45 minutes',
    leucineContent: 0.8,
    bioavailability: 87,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 1543,
    trending: false,
    featured: true,
    price: 45.99,
    bestTime: 'Post-Workout',
    primaryBenefit: 'Joint Health',
    ageGroup: '30+',
    certifications: ['Free-Range', 'Hormone-Free', 'Antibiotic-Free'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (15g)', 'type II collagen'),
        m(1, 'cup', 'coconut water'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(0.25, 'tsp', 'ground cinnamon'),
        m(1, 'tsp', 'glucosamine powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend liquids with collagen and supplements first.',
        'Add cinnamon and ice; blend until frothy.'
      ]
    }
  },
  {
    id: 'collagen-3',
    name: 'Marine Glow Tropical',
    description: 'Wild-caught marine collagen for premium absorption',
    collagenTypes: ['Type I'],
    source: 'Wild-Caught Fish',
    flavor: 'Tropical Mango',
    servingSize: '12g',
    nutrition: {
      calories: 45,
      protein: 11,
      carbs: 0,
      fat: 0,
      collagen: 11,
      omega_3: 200,
      selenium: 15
    },
    ingredients: ['Marine Collagen Peptides', 'Mango Extract', 'Omega-3 Fatty Acids', 'Selenium', 'Coconut Water Powder'],
    benefits: ['Premium Absorption', 'Skin Hydration', 'Antioxidants', 'Sustainable'],
    absorption: 'Very Fast',
    absorptionTime: '10-20 minutes',
    leucineContent: 1.1,
    bioavailability: 98,
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.7,
    reviews: 987,
    trending: true,
    featured: false,
    price: 52.99,
    bestTime: 'Morning',
    primaryBenefit: 'Premium Absorption',
    ageGroup: 'All Ages',
    certifications: ['Wild-Caught', 'MSC Certified', 'Sustainable'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (12g)', 'marine collagen peptides'),
        m(0.75, 'cup', 'pineapple juice'),
        m(0.25, 'cup', 'mango chunks, frozen'),
        m(1, 'tsp', 'coconut water powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Combine juice and collagen, then add fruit.',
        'Blend for 30 seconds until tropical and smooth.'
      ]
    }
  },
  {
    id: 'collagen-4',
    name: 'Multi-Collagen Complete',
    description: 'Types I, II, III, V & X for comprehensive support',
    collagenTypes: ['Type I', 'Type II', 'Type III', 'Type V', 'Type X'],
    source: 'Multi-Source Blend',
    flavor: 'Unflavored',
    servingSize: '22g',
    nutrition: {
      calories: 80,
      protein: 20,
      carbs: 0,
      fat: 0,
      collagen: 20,
      glycine: 3.2,
      proline: 2.8
    },
    ingredients: ['Bovine Collagen', 'Chicken Collagen', 'Fish Collagen', 'Eggshell Membrane', 'Bone Broth Powder'],
    benefits: ['Complete Spectrum', 'Versatile Use', 'Maximum Coverage', 'All-in-One'],
    absorption: 'Fast',
    absorptionTime: '20-35 minutes',
    leucineContent: 1.4,
    bioavailability: 92,
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.5,
    reviews: 1876,
    trending: false,
    featured: true,
    price: 48.99,
    bestTime: 'Anytime',
    primaryBenefit: 'Complete Support',
    ageGroup: 'All Ages',
    certifications: ['Multi-Source', 'Third-Party Tested', 'Quality Assured'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (22g)', 'multi-collagen blend'),
        m(1, 'cup', 'water or milk of choice'),
        m(0.5, 'banana', 'ripe'),
        m(1, 'tsp', 'cacao powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Stir collagen into liquid until dissolved.',
        'Add fruit and blend smooth.'
      ]
    }
  },
  {
    id: 'collagen-5',
    name: 'Vegan Collagen Builder',
    description: 'Plant-based collagen support with amino acid precursors',
    collagenTypes: ['Collagen Precursors'],
    source: 'Plant-Based',
    flavor: 'Cucumber Mint',
    servingSize: '25g',
    nutrition: {
      calories: 90,
      protein: 15,
      carbs: 8,
      fat: 0,
      collagen: 0,
      vitamin_c: 80,
      silica: 50,
      lysine: 2.1
    },
    ingredients: ['Pea Protein', 'Vitamin C', 'Silica from Bamboo', 'L-Lysine', 'L-Proline', 'Cucumber Extract'],
    benefits: ['Vegan-Friendly', 'Collagen Support', 'Amino Precursors', 'Plant-Based'],
    absorption: 'Moderate',
    absorptionTime: '45-60 minutes',
    leucineContent: 2.1,
    bioavailability: 78,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.2,
    reviews: 634,
    trending: true,
    featured: false,
    price: 42.99,
    bestTime: 'Morning',
    primaryBenefit: 'Vegan Alternative',
    ageGroup: 'All Ages',
    certifications: ['Vegan', 'Non-GMO', 'Organic', 'Plant-Based'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (25g)', 'vegan collagen builder'),
        m(1, 'cup', 'cucumber water'),
        m(2, 'leaves', 'fresh mint'),
        m(0.5, 'tsp', 'lime juice'),
        m(1, 'tsp', 'vitamin C powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Infuse water with cucumber and mint.',
        'Add builder and blend with lime and ice.'
      ]
    }
  },
  {
    id: 'collagen-6',
    name: 'Anti-Aging Gold Formula',
    description: 'Premium collagen with peptides and antioxidants',
    collagenTypes: ['Type I', 'Type III'],
    source: 'Grass-Fed Bovine',
    flavor: 'Golden Turmeric',
    servingSize: '25g',
    nutrition: {
      calories: 85,
      protein: 20,
      carbs: 2,
      fat: 0,
      collagen: 20,
      curcumin: 500,
      resveratrol: 100
    },
    ingredients: ['Hydrolyzed Collagen', 'Turmeric Extract', 'Resveratrol', 'CoQ10', 'Gold Leaf Extract'],
    benefits: ['Anti-Inflammatory', 'Antioxidant Rich', 'Premium Quality', 'Luxury Formula'],
    absorption: 'Fast',
    absorptionTime: '15-25 minutes',
    leucineContent: 1.3,
    bioavailability: 96,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 543,
    trending: false,
    featured: true,
    price: 79.99,
    bestTime: 'Evening',
    primaryBenefit: 'Anti-Aging',
    ageGroup: '35+',
    certifications: ['Premium Grade', 'Lab Tested', 'Luxury'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (25g)', 'anti-aging collagen'),
        m(0.75, 'cup', 'warm almond milk'),
        m(0.25, 'tsp', 'ground turmeric'),
        m(0.125, 'tsp', 'black pepper'),
        m(1, 'tsp', 'honey'),
        m(1, 'pinch', 'resveratrol powder')
      ],
      directions: [
        'Warm milk gently, stir in collagen and spices.',
        'Blend briefly for golden latte texture.'
      ]
    }
  }
];

const collagenTypes = [
  {
    id: 'type-i',
    name: 'Type I Collagen',
    description: 'Most abundant, supports skin, hair, nails',
    icon: Sparkles,
    color: 'text-pink-600',
    benefits: ['Skin Elasticity', 'Hair Strength', 'Nail Growth', 'Wound Healing'],
    sources: ['Marine', 'Bovine'],
    percentage: '90%',
    primaryUse: 'Beauty & Skin Health'
  },
  {
    id: 'type-ii',
    name: 'Type II Collagen',
    description: 'Cartilage support for joints',
    icon: Bone,
    color: 'text-blue-600',
    benefits: ['Joint Health', 'Cartilage Support', 'Mobility', 'Flexibility'],
    sources: ['Chicken Sternum'],
    percentage: '5%',
    primaryUse: 'Joint & Cartilage Health'
  },
  {
    id: 'type-iii',
    name: 'Type III Collagen',
    description: 'Blood vessels, organs, skin structure',
    icon: Heart,
    color: 'text-red-600',
    benefits: ['Cardiovascular', 'Organ Support', 'Skin Structure', 'Muscle Health'],
    sources: ['Bovine', 'Marine'],
    percentage: '3%',
    primaryUse: 'Internal Structure Support'
  },
  {
    id: 'multi-type',
    name: 'Multi-Type Blend',
    description: 'Comprehensive collagen support',
    icon: Crown,
    color: 'text-purple-600',
    benefits: ['Complete Coverage', 'Synergistic Effects', 'Versatile', 'Maximum Benefits'],
    sources: ['Multiple Sources'],
    percentage: '100%',
    primaryUse: 'Complete Body Support'
  }
];

const collagenSources = [
  {
    id: 'marine',
    name: 'Marine Collagen',
    description: 'From wild-caught fish, highest bioavailability',
    icon: Droplets,
    color: 'bg-blue-500',
    bioavailability: '98%',
    absorption: 'Very Fast',
    benefits: ['Premium Absorption', 'Sustainable', 'Type I Rich', 'Clean Source'],
    bestFor: 'Skin & Beauty'
  },
  {
    id: 'bovine',
    name: 'Bovine Collagen',
    description: 'From grass-fed cattle, types I & III',
    icon: Apple,
    color: 'bg-green-500',
    bioavailability: '95%',
    absorption: 'Fast',
    benefits: ['Complete Amino Profile', 'Cost Effective', 'Versatile', 'Well Researched'],
    bestFor: 'General Health'
  },
  {
    id: 'chicken',
    name: 'Chicken Collagen',
    description: 'From chicken sternum, type II rich',
    icon: Bone,
    color: 'bg-amber-500',
    bioavailability: '87%',
    absorption: 'Moderate',
    benefits: ['Joint Specific', 'Type II Rich', 'Cartilage Support', 'Mobility'],
    bestFor: 'Joint Health'
  },
  {
    id: 'plant-based',
    name: 'Plant-Based Support',
    description: 'Amino acid precursors for collagen synthesis',
    icon: Leaf,
    color: 'bg-emerald-500',
    bioavailability: '78%',
    absorption: 'Moderate',
    benefits: ['Vegan Friendly', 'Precursor Support', 'Sustainable', 'Ethical'],
    bestFor: 'Vegan Lifestyle'
  }
];

const beautyGoals = [
  {
    id: 'skin-health',
    name: 'Skin Health',
    description: 'Radiant, youthful skin',
    icon: Sparkles,
    color: 'bg-pink-500',
    recommendedTypes: ['Type I', 'Type III'],
    recommendedDosage: '10-15g daily',
    timeline: '4-8 weeks for visible results'
  },
  {
    id: 'joint-health',
    name: 'Joint Health',
    description: 'Mobility and flexibility support',
    icon: Bone,
    color: 'bg-blue-500',
    recommendedTypes: ['Type II'],
    recommendedDosage: '8-12g daily',
    timeline: '6-12 weeks for improvements'
  },
  {
    id: 'anti-aging',
    name: 'Anti-Aging',
    description: 'Comprehensive age-defying support',
    icon: Crown,
    color: 'bg-purple-500',
    recommendedTypes: ['Multi-Type'],
    recommendedDosage: '15-25g daily',
    timeline: '8-16 weeks for optimal results'
  },
  {
    id: 'hair-nails',
    name: 'Hair & Nails',
    description: 'Strength and growth support',
    icon: Gem,
    color: 'bg-amber-500',
    recommendedTypes: ['Type I'],
    recommendedDosage: '12-18g daily',
    timeline: '6-10 weeks for stronger growth'
  }
];

const idToExactType = (id: string) => {
  switch (id) {
    case 'type-i': return 'Type I';
    case 'type-ii': return 'Type II';
    case 'type-iii': return 'Type III';
    case 'multi-type': return 'Multi';
    default: return '';
  }
};

const normalize = (v: string) => (v || '').toLowerCase().replace(/[^a-z]/g, '');

export default function CollagenProteinPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedCollagenType, setSelectedCollagenType] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});

  // per-card refs to open RecipeKit modals
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({});

  // deep-link (?id=collagen-1) — scroll card into view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      const el = document.getElementById(`card-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleSharePage = async () => {
    const shareData = {
      title: 'Collagen Protein',
      text: 'Explore collagen protein options, types, sources, and benefits.',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const getFilteredShakes = () => {
    const q = searchQuery.trim().toLowerCase();

    let filtered = collagenShakes.filter(shake => {
      const matchesSearch =
        !q ||
        shake.name.toLowerCase().includes(q) ||
        shake.description.toLowerCase().includes(q);

      const matchesType =
        !selectedCollagenType
          ? true
          : selectedCollagenType === 'Multi'
            ? (shake.collagenTypes?.length || 0) > 1
            : shake.collagenTypes?.some(
                t => t.toLowerCase() === selectedCollagenType.toLowerCase()
              );

      const matchesSource =
        !selectedSource
          ? true
          : (shake.source || '').toLowerCase().includes(selectedSource.toLowerCase());

      const matchesGoal =
        !selectedGoal
          ? true
          : (shake.primaryBenefit || '').toLowerCase().includes(selectedGoal.toLowerCase());

      return matchesSearch && matchesType && matchesSource && matchesGoal;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'bioavailability': return (b.bioavailability || 0) - (a.bioavailability || 0);
        case 'price': return (a.price || 0) - (b.price || 0);
        case 'collagen': return (b.nutrition?.collagen || 0) - (a.nutrition?.collagen || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredShakes = getFilteredShakes();
  const featuredShakes = collagenShakes.filter(shake => shake.featured);

  const getServings = (shake: any) => servingsById[shake.id] ?? (shake.recipe?.servings || 1);
  const incrementServings = (shake: any, dir: 1 | -1) => {
    setServingsById(prev => {
      const current = prev[shake.id] ?? (shake.recipe?.servings || 1);
      const next = Math.min(12, Math.max(1, current + dir));
      return { ...prev, [shake.id]: next };
    });
  };

  const handleCompleteRecipe = (shake: any) => {
    addToRecentlyViewed({
      id: shake.id,
      name: shake.name,
      category: 'protein-shakes' as const,
      description: shake.description,
      ingredients: shake.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || shake.ingredients,
      nutrition: {
        calories: shake.nutrition.calories,
        protein: shake.nutrition.protein,
        carbs: shake.nutrition.carbs,
        fat: shake.nutrition.fat
      },
      difficulty: shake.difficulty as 'Easy' | 'Medium' | 'Hard',
      prepTime: shake.prepTime,
      rating: shake.rating,
      tags: shake.tags
    });
    incrementDrinksMade();
    addPoints(35);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
          onClick={() => setShowUniversalSearch(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUniversalSearch(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/protein-shakes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Protein Shakes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-pink-600" />
                <h1 className="text-2xl font-bold text-gray-900">Collagen Protein</h1>
                <Badge className="bg-pink-100 text-pink-800">Beauty</Badge>
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
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{hub.name}</div>
                        <div className="text-xs text-gray-500">{hub.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sister Subpages Navigation */}
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                      <Icon className="h-4 w-4 mr-2 text-pink-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Leucine & Absorption Info Section */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 p-3 rounded-lg">
                <Zap className="h-6 w-6 text-amber-600" />
              </div>
              <div className="md:max-w-3xl md:flex-1">
                <h3 className="text-lg font-bold mb-2">About Leucine & Collagen Absorption</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-1">Leucine Content</h4>
                    <p className="text-gray-600">
                      Collagen is lower in leucine than whey but higher in glycine and proline. 
                      Optimal for connective tissue support rather than pure muscle building.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Absorption Timing</h4>
                    <p className="text-gray-600">
                      Hydrolyzed collagen peptides absorb quickly. Best taken with vitamin C 
                      for optimal collagen synthesis and on an empty stomach for fastest absorption.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">94%</div>
              <div className="text-sm text-gray-600">Avg Bioavailability</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">16g</div>
              <div className="text-sm text-gray-600">Avg Collagen</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">5</div>
              <div className="text-sm text-gray-600">Collagen Types</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">6</div>
              <div className="text-sm text-gray-600">Premium Formulas</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'collagen-types', label: 'Collagen Types', icon: Sparkles },
            { id: 'sources', label: 'Sources', icon: Droplets },
            { id: 'beauty-goals', label: 'Beauty Goals', icon: Eye },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-white shadow-sm' : ''}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search collagen proteins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                {/* Collagen Type Dropdown (includes Multi-Type) */}
                <select
                  className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                  value={selectedCollagenType}
                  onChange={(e) => setSelectedCollagenType(e.target.value)}
                >
                  <option value="">All Collagen Types</option>
                  <option value="Type I">Type I</option>
                  <option value="Type II">Type II</option>
                  <option value="Type III">Type III</option>
                  <option value="Multi">Multi-Type</option>
                </select>

                <select
                  className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                >
                  <option value="">All Sources</option>
                  <option value="Marine">Marine</option>
                  <option value="Bovine">Bovine</option>
                  <option value="Chicken">Chicken</option>
                  <option value="Plant">Plant-Based</option>
                </select>

                <select
                  className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                  value={selectedGoal}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                >
                  <option value="">All Benefits</option>
                  <option value="Skin">Skin Health</option>
                  <option value="Joint">Joint Health</option>
                  <option value="Anti-Aging">Anti-Aging</option>
                  <option value="Beauty">Beauty</option>
                </select>

                <select
                  className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="bioavailability">Sort by Bioavailability</option>
                  <option value="price">Sort by Price</option>
                  <option value="collagen">Sort by Collagen Content</option>
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShakes.map(shake => {
                const servings = getServings(shake);
                const factor = (servings || 1) / (shake.recipe?.servings || 1);

                return (
                  <Card
                    key={shake.id}
                    id={`card-${shake.id}`}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => kitRefs.current[shake.id]?.open?.()}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{shake.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{shake.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToFavorites({
                            id: shake.id,
                            name: shake.name,
                            category: 'protein-shakes',
                            description: shake.description,
                            ingredients: shake.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || shake.ingredients,
                            nutrition: shake.nutrition,
                            difficulty: shake.difficulty,
                            prepTime: shake.prepTime,
                            rating: shake.rating,
                            fitnessGoal: shake.primaryBenefit,
                            bestTime: shake.bestTime
                          })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-5 w-5 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Badge className="bg-pink-100 text-pink-600 border-pink-200">{shake.source}</Badge>
                        <Badge variant="outline">{shake.flavor}</Badge>
                        {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition */}
                      <div className="grid grid-cols-4 gap-2 text-center mb-4">
                        <div>
                          <div className="font-bold text-pink-600">{shake.nutrition.collagen}g</div>
                          <div className="text-xs text-gray-500">Collagen</div>
                        </div>
                        <div>
                          <div className="font-bold text-blue-600">{shake.nutrition.calories}</div>
                          <div className="text-xs text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="font-bold text-green-600">{shake.nutrition.vitamin_c || '—'}{shake.nutrition.vitamin_c ? '%':''}</div>
                          <div className="text-xs text-gray-500">Vit C</div>
                        </div>
                        <div>
                          <div className="font-bold text-purple-600">${shake.price}</div>
                          <div className="text-xs text-gray-500">Price</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY - Immediately above recipe card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{shake.rating}</span>
                          <span className="text-gray-500 text-sm">({shake.reviews})</span>
                        </div>
                        <Badge variant="outline">{shake.difficulty}</Badge>
                      </div>

                      {/* RecipeKit component - handles both preview and modal */}
                      {shake.recipe?.measurements && (
                        <div className="mb-4">
                          <RecipeKit
                            ref={ref => {
                              kitRefs.current[shake.id] = ref;
                            }}
                            id={shake.id}
                            name={shake.name}
                            measurements={shake.recipe.measurements}
                            directions={shake.recipe.directions}
                            nutrition={shake.nutrition}
                            prepTime={shake.prepTime}
                            onComplete={() => handleCompleteRecipe(shake)}
                            accent="pink"
                          />
                        </div>
                      )}

                      {/* Absorption & Leucine Info Section Below Recipe Card */}
                      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-4">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Timer className="h-4 w-4 text-blue-600" />
                                <span className="font-semibold">Absorption</span>
                              </div>
                              <div className="text-blue-700">{shake.absorptionTime}</div>
                              <div className="text-xs text-gray-600 mt-1">{shake.absorption} absorption</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Zap className="h-4 w-4 text-purple-600" />
                                <span className="font-semibold">Leucine</span>
                              </div>
                              <div className="text-purple-700">{shake.leucineContent}g per serving</div>
                              <div className="text-xs text-gray-600 mt-1">Essential amino acid</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Tags (certifications) */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {shake.certifications.map((cert: string) => (
                          <Badge key={cert} variant="secondary" className="text-xs bg-pink-100 text-pink-600">{cert}</Badge>
                        ))}
                      </div>

                      {/* Full-width CTA — Make Shake */}
                      <Button
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          kitRefs.current[shake.id]?.open?.();
                        }}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Make Shake (+35 XP)
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Collagen Types Tab */}
        {activeTab === 'collagen-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {collagenTypes.map(type => {
              const Icon = type.icon;
              const typeExact = idToExactType(type.id);
              const typeShakes =
                type.id === 'multi-type'
                  ? collagenShakes.filter(s => (s.collagenTypes?.length || 0) > 1)
                  : collagenShakes.filter(s =>
                      s.collagenTypes?.some(t => t.toLowerCase() === typeExact.toLowerCase())
                    );
              
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${type.color}`} />
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Body Percentage</div>
                        <div className="text-2xl font-bold text-pink-600">{type.percentage}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.benefits.map((benefit, index) => (
                            <Badge key={index} variant="secondary" className="text-xs bg-pink-100 text-pink-600">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Primary Use:</div>
                        <div className="text-sm text-blue-800">{type.primaryUse}</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeShakes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Options</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedCollagenType(typeExact);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {type.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {collagenSources.map(source => {
              const Icon = source.icon;
              const sourceKey = normalize(source.name.split(' ')[0]);
              const sourceShakes = collagenShakes.filter(shake => 
                normalize(shake.source).includes(sourceKey)
              );
              
              return (
                <Card key={source.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${source.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${source.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{source.name}</CardTitle>
                        <p className="text-sm text-gray-600">{source.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 p-2 rounded text-center">
                          <div className="text-sm font-medium text-gray-700">Bioavailability</div>
                          <div className="text-lg font-bold text-green-600">{source.bioavailability}</div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded text-center">
                          <div className="text-sm font-medium text-gray-700">Absorption</div>
                          <div className="text-sm font-semibold text-blue-600">{source.absorption}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {source.benefits.map((benefit, index) => (
                            <Badge key={index} variant="secondary" className="text-xs bg-pink-100 text-pink-600">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${source.color.replace('bg-', 'text-')} mb-1`}>
                        {sourceShakes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Products</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedSource(source.name.split(' ')[0]);
                          setActiveTab('browse');
                        }}
                      >
                        View {source.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Beauty Goals Tab */}
        {activeTab === 'beauty-goals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {beautyGoals.map(goal => {
              const Icon = goal.icon;
              
              return (
                <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${goal.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${goal.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <p className="text-sm text-gray-600">{goal.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Recommended Types:</div>
                        <div className="flex flex-wrap gap-1">
                          {goal.recommendedTypes.map((type, index) => (
                            <Badge key={index} className="bg-pink-100 text-pink-800 text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Daily Dosage:</div>
                        <div className="text-sm text-blue-800">{goal.recommendedDosage}</div>
                      </div>
                      
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Expected Timeline:</div>
                        <div className="text-sm text-green-800">{goal.timeline}</div>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full"
                      onClick={() => {
                        setSelectedGoal(goal.name.split(' ')[0]);
                        setActiveTab('browse');
                      }}
                    >
                      View {goal.name} Options
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredShakes.map(shake => (
              <Card
                key={shake.id}
                className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => kitRefs.current[shake.id]?.open?.()}
              >
                <div className="relative">
                  <img 
                    src={shake.image || 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=400&h=300&fit=crop'}
                    alt={shake.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-pink-500 text-white">Featured Collagen</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-pink-800">{shake.bioavailability}% Bio</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{shake.name}</CardTitle>
                  <p className="text-gray-600">{shake.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-pink-100 text-pink-800">{shake.source}</Badge>
                    <Badge variant="outline">{shake.flavor}</Badge>
                    {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-2 text-center mb-4">
                    <div>
                      <div className="font-bold text-pink-600">{shake.nutrition.collagen}g</div>
                      <div className="text-xs text-gray-500">Collagen</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{shake.nutrition.calories}</div>
                      <div className="text-xs text-gray-500">Calories</div>
                    </div>
                    <div>
                      <div className="font-bold text-purple-600">{shake.bioavailability}%</div>
                      <div className="text-xs text-gray-500">Bio</div>
                    </div>
                    <div>
                      <div className="font-bold text-amber-600">${shake.price}</div>
                      <div className="text-xs text-gray-500">Price</div>
                    </div>
                  </div>

                  {/* Rating + Difficulty row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{shake.rating}</span>
                      <span className="text-gray-500 text-sm">({shake.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{shake.difficulty}</Badge>
                  </div>

                  {/* RecipeKit component */}
                  {shake.recipe?.measurements && (
                    <div className="mb-4">
                      <RecipeKit
                        ref={ref => {
                          kitRefs.current[shake.id] = ref;
                        }}
                        id={shake.id}
                        name={shake.name}
                        measurements={shake.recipe.measurements}
                        directions={shake.recipe.directions}
                        nutrition={shake.nutrition}
                        prepTime={shake.prepTime}
                        onComplete={() => handleCompleteRecipe(shake)}
                        accent="pink"
                      />
                    </div>
                  )}

                  {/* Absorption & Leucine Info Section Below Recipe Card */}
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-4">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Timer className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold">Absorption</span>
                          </div>
                          <div className="text-blue-700">{shake.absorptionTime}</div>
                          <div className="text-xs text-gray-600 mt-1">{shake.absorption} absorption</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-4 w-4 text-purple-600" />
                            <span className="font-semibold">Leucine</span>
                          </div>
                          <div className="text-purple-700">{shake.leucineContent}g per serving</div>
                          <div className="text-xs text-gray-600 mt-1">Essential amino acid</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tags (certifications) */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {shake.certifications.map((cert: string) => (
                      <Badge key={cert} variant="secondary" className="text-xs bg-pink-100 text-pink-600">{cert}</Badge>
                    ))}
                  </div>

                  {/* Full-width CTA — Make Shake */}
                  <Button
                    className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      kitRefs.current[shake.id]?.open?.();
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Make Shake (+35 XP)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-green-600">
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
