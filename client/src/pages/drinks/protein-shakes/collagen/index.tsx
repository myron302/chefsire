import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple, Gem,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Activity, BarChart3, Crown, Dumbbell, Eye, Bone, Moon, Wine, ArrowRight, X, Check
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// Navigation data
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
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

// Collagen protein shake data
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
    certifications: ['Grass-Fed', 'Pasture-Raised', 'Non-GMO']
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
    certifications: ['Free-Range', 'Hormone-Free', 'Antibiotic-Free']
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
    certifications: ['Wild-Caught', 'MSC Certified', 'Sustainable']
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
    certifications: ['Multi-Source', 'Third-Party Tested', 'Quality Assured']
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
      vitamin_c: 80,
      silica: 50,
      lysine: 2.1
    },
    ingredients: ['Pea Protein', 'Vitamin C', 'Silica from Bamboo', 'L-Lysine', 'L-Proline', 'Cucumber Extract'],
    benefits: ['Vegan-Friendly', 'Collagen Support', 'Amino Precursors', 'Plant-Based'],
    absorption: 'Moderate',
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
    certifications: ['Vegan', 'Non-GMO', 'Organic', 'Plant-Based']
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
    certifications: ['Premium Grade', 'Lab Tested', 'Luxury']
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
  const [selectedShake, setSelectedShake] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // Share handlers
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

  const handleShareShake = async (shake: any) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${shake.name} • ${shake.primaryBenefit} • ${shake.source}\n${shake.description}`;
    const shareData = {
      title: shake.name,
      text,
      url
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  // Filter and sort shakes
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
  const trendingShakes = collagenShakes.filter(shake => shake.trending);

  const handleMakeShake = (shake: any) => {
    setSelectedShake(shake);
    setShowModal(true);
  };

  const handleCompleteShake = () => {
    if (selectedShake) {
      addToRecentlyViewed({
        id: selectedShake.id,
        name: selectedShake.name,
        category: 'protein-shakes',
        description: selectedShake.description,
        ingredients: selectedShake.ingredients,
        nutrition: selectedShake.nutrition,
        difficulty: selectedShake.difficulty,
        prepTime: selectedShake.prepTime,
        rating: selectedShake.rating,
        fitnessGoal: selectedShake.primaryBenefit,
        bestTime: selectedShake.bestTime
      });
      incrementDrinksMade();
      addPoints(35);
    }
    setShowModal(false);
    setSelectedShake(null);
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

      {/* Make Shake Modal */}
      {showModal && selectedShake && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedShake.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Collagen Types:</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedShake.collagenTypes.map((type: string, idx: number) => (
                    <Badge key={idx} className="bg-purple-100 text-purple-800 text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedShake.ingredients.map((ing: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Benefits:</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedShake.benefits.map((benefit: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {benefit}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-pink-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-pink-600">{selectedShake.nutrition.collagen}g</div>
                  <div className="text-xs text-gray-600">Collagen</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedShake.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-purple-600">{selectedShake.bioavailability}%</div>
                  <div className="text-xs text-gray-600">Bio</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-pink-600 hover:bg-pink-700"
                  onClick={handleCompleteShake}
                >
                  Complete Shake (+35 XP)
                </Button>
              </div>
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
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with extra bottom padding to clear the fixed footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search collagen proteins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                {/* Collagen Type Dropdown (includes Multi-Type) */}
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
              {filteredShakes.map(shake => (
                <Card key={shake.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{shake.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{shake.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: shake.id,
                          name: shake.name,
                          category: 'protein-shakes',
                          description: shake.description,
                          ingredients: shake.ingredients,
                          nutrition: shake.nutrition,
                          difficulty: shake.difficulty,
                          prepTime: shake.prepTime,
                          rating: shake.rating,
                          fitnessGoal: shake.primaryBenefit,
                          bestTime: shake.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-pink-100 text-pink-800">{shake.source}</Badge>
                      <Badge variant="outline">{shake.flavor}</Badge>
                      {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Collagen Types */}
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Collagen Types:</div>
                      <div className="flex flex-wrap gap-1">
                        {shake.collagenTypes.map((type, index) => (
                          <Badge key={index} className="bg-purple-100 text-purple-800 text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Nutrition Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-pink-600">{shake.nutrition.collagen}g</div>
                        <div className="text-gray-500">Collagen</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-purple-600">{shake.bioavailability}%</div>
                        <div className="text-gray-500">Bio</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                        <div className="text-gray-500">Price</div>
                      </div>
                    </div>

                    {/* Key Details */}
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{shake.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Absorption:</span>
                        <span className="font-medium">{shake.absorption}</span>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{shake.rating}</span>
                        <span className="text-gray-500 text-sm">({shake.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {shake.primaryBenefit}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-pink-600 hover:bg-pink-700"
                        onClick={() => handleMakeShake(shake)}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Make Shake
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleShareShake(shake)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                              <Badge key={index} variant="outline" className="text-xs">
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
                            <Badge key={index} variant="outline" className="text-xs">
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
              <Card key={shake.id} className="overflow-hidden hover:shadow-xl transition-shadow">
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
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{shake.rating}</span>
                      <span className="text-gray-500 text-sm">({shake.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Collagen Types Display */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Collagen Types:</h4>
                    <div className="flex flex-wrap gap-2">
                      {shake.collagenTypes.map((type, index) => (
                        <Badge key={index} className="bg-purple-100 text-purple-800">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Enhanced nutrition display */}
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-pink-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-pink-600">{shake.nutrition.collagen}g</div>
                      <div className="text-xs text-gray-600">Collagen</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{shake.bioavailability}%</div>
                      <div className="text-xs text-gray-600">Bio-Availability</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                      <div className="text-xs text-gray-600">Price</div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {shake.benefits.map((benefit, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Usage Info */}
                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-pink-600 font-semibold">{shake.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Absorption:</div>
                        <div className="text-blue-600 font-semibold">{shake.absorption}</div>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {shake.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-pink-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-pink-600 hover:bg-pink-700"
                      onClick={() => handleMakeShake(shake)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Make This Shake
                    </Button>
                    <Button variant="outline" onClick={() => handleShareShake(shake)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Spacer to ensure content clears the fixed footer on all screens */}
      <div aria-hidden className="h-24 sm:h-28" />

      {/* Bottom Stats Bar with safe-area padding */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-600" />
              <span className="text-gray-600">Collagen Products Found:</span>
              <span className="font-bold text-pink-600">{filteredShakes.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-gray-600">XP:</span>
              <span className="font-bold text-green-600">{userProgress.totalPoints}</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
