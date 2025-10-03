// client/src/pages/drinks/data/protein.ts
import { 
  Dumbbell, Clock, Leaf, Sparkles, Apple, Milk, 
  Droplets, Target, Heart, Zap, Crown, Bone,
  Gem, Eye, FlaskConical, Beaker, Weight, Gauge
} from 'lucide-react';

// Protein Shakes Subcategories
export const proteinSubcategories = [
  {
    id: 'whey',
    name: 'Whey Protein',
    description: 'Fast-absorbing dairy protein',
    icon: Dumbbell,
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=400&fit=crop',
    path: '/drinks/protein-shakes/whey',
    count: 6,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
    trending: true,
    avgCalories: 280,
    duration: 'Post-workout',
    topBenefit: 'Muscle Recovery'
  },
  {
    id: 'casein',
    name: 'Casein Protein',
    description: 'Slow-digesting protein for sustained release',
    icon: Clock,
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&h=400&fit=crop',
    path: '/drinks/protein-shakes/casein',
    count: 4,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-600',
    avgCalories: 240,
    duration: 'Before Bed',
    topBenefit: 'Overnight Recovery'
  },
  {
    id: 'plant-based',
    name: 'Plant-Based',
    description: 'Vegan protein from natural sources',
    icon: Leaf,
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
    path: '/drinks/protein-shakes/plant-based',
    count: 6,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-600',
    featured: true,
    avgCalories: 210,
    duration: 'Anytime',
    topBenefit: 'Clean Nutrition'
  },
  {
    id: 'collagen',
    name: 'Collagen',
    description: 'Beauty and joint support protein',
    icon: Sparkles,
    image: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=600&h=400&fit=crop',
    path: '/drinks/protein-shakes/collagen',
    count: 6,
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-600',
    trending: true,
    avgCalories: 180,
    duration: 'Morning',
    topBenefit: 'Skin & Joint Health'
  }
];

// Protein-specific data
export const proteinSources = [
  {
    id: 'greek-yogurt',
    name: 'Greek Yogurt',
    description: 'High protein, probiotics, creamy texture',
    icon: Milk,
    color: 'text-blue-600',
    proteinPer100g: 20,
    benefits: ['Probiotics', 'Calcium', 'Complete Protein', 'Creamy Texture'],
    bestFor: 'Breakfast & Recovery',
    cost: 'Low',
    allergens: ['Dairy']
  },
  {
    id: 'nut-butters',
    name: 'Nut Butters',
    description: 'Natural protein with healthy fats',
    icon: Apple,
    color: 'text-amber-600',
    proteinPer100g: 25,
    benefits: ['Healthy Fats', 'Vitamin E', 'Sustained Energy', 'Natural'],
    bestFor: 'Weight Gain & Satiety',
    cost: 'Medium',
    allergens: ['Nuts']
  },
  {
    id: 'cottage-cheese',
    name: 'Cottage Cheese',
    description: 'Casein protein for slow release',
    icon: Droplets,
    color: 'text-green-600',
    proteinPer100g: 18,
    benefits: ['Casein Protein', 'Low Fat', 'Slow Release', 'Versatile'],
    bestFor: 'Night Time & Satiety',
    cost: 'Low',
    allergens: ['Dairy']
  },
  {
    id: 'seeds-nuts',
    name: 'Seeds & Nuts',
    description: 'Plant protein with minerals',
    icon: Sparkles,
    color: 'text-purple-600',
    proteinPer100g: 15,
    benefits: ['Plant Protein', 'Minerals', 'Fiber', 'Omega Fats'],
    bestFor: 'Plant-Based & Nutrition',
    cost: 'Medium',
    allergens: ['Nuts (varies)']
  }
];

export const proteinTypes = [
  {
    id: 'pea',
    name: 'Pea Protein',
    description: 'Complete amino acid profile, easy digestion',
    icon: Leaf,
    color: 'text-green-600',
    benefits: ['Complete Protein', 'BCAA Rich', 'Iron Source', 'Allergen-Free'],
    digestibility: 98,
    sustainability: 'High',
    commonUses: ['Post-Workout', 'Meal Replacement']
  },
  {
    id: 'hemp',
    name: 'Hemp Protein',
    description: 'Omega fatty acids with complete nutrition',
    icon: Sparkles,
    color: 'text-emerald-600',
    benefits: ['Omega 3&6', 'High Fiber', 'Magnesium', 'Heart Health'],
    digestibility: 87,
    sustainability: 'Very High',
    commonUses: ['Morning Smoothie', 'General Wellness']
  },
  {
    id: 'rice-quinoa',
    name: 'Rice & Quinoa',
    description: 'Hypoallergenic ancient grain blend',
    icon: Apple,
    color: 'text-amber-600',
    benefits: ['Hypoallergenic', 'Ancient Grains', 'Complete Amino', 'Gentle'],
    digestibility: 94,
    sustainability: 'Medium',
    commonUses: ['Sensitive Stomachs', 'Clean Eating']
  },
  {
    id: 'soy',
    name: 'Soy Protein',
    description: 'Traditional complete protein powerhouse',
    icon: Target,
    color: 'text-blue-600',
    benefits: ['Complete Protein', 'Fast Absorption', 'Isoflavones', 'Proven'],
    digestibility: 100,
    sustainability: 'Medium',
    commonUses: ['Muscle Building', 'Athletic Performance']
  }
];

export const fitnessGoals = [
  {
    id: 'muscle-building',
    name: 'Muscle Building',
    description: 'High protein for lean mass gains',
    icon: Dumbbell,
    color: 'bg-red-500',
    recommendedIntake: '25-30g protein',
    timing: 'Post-workout within 30 minutes'
  },
  {
    id: 'weight-management',
    name: 'Weight Management',
    description: 'Balanced nutrition for healthy weight',
    icon: Target,
    color: 'bg-blue-500',
    recommendedIntake: '20-25g protein',
    timing: 'Between meals or meal replacement'
  },
  {
    id: 'general-wellness',
    name: 'General Wellness',
    description: 'Daily nutrition and vitality',
    icon: Heart,
    color: 'bg-green-500',
    recommendedIntake: '15-20g protein',
    timing: 'Morning or afternoon'
  },
  {
    id: 'detox',
    name: 'Detox & Cleanse',
    description: 'Cleansing and alkalizing support',
    icon: Zap,
    color: 'bg-purple-500',
    recommendedIntake: '10-15g protein',
    timing: 'Morning on empty stomach'
  }
];

export const collagenTypes = [
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

export const collagenSources = [
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

export const beautyGoals = [
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

export const wheyTypes = [
  { 
    id: 'isolate', 
    name: 'Whey Isolate', 
    description: 'Fastest absorption, lowest carbs', 
    icon: Zap,
    absorptionTime: '30-60 min',
    proteinContent: '90-95%',
    bestFor: 'Post-workout, cutting'
  },
  { 
    id: 'concentrate', 
    name: 'Whey Concentrate', 
    description: 'Great taste, cost-effective', 
    icon: Award,
    absorptionTime: '60-90 min',
    proteinContent: '70-80%',
    bestFor: 'General use, mass gain'
  },
  { 
    id: 'hydrolyzed', 
    name: 'Hydrolyzed Whey', 
    description: 'Pre-digested, ultra-fast', 
    icon: Sparkles,
    absorptionTime: '15-30 min',
    proteinContent: '85-95%',
    bestFor: 'Elite athletes, recovery'
  }
];

// Casein protein data
export const caseinProteinShakes = [
  {
    id: 'casein-1',
    name: 'Midnight Muscle Fuel',
    description: 'Slow-digesting casein for overnight recovery',
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop',
    primaryProtein: 'Micellar Casein',
    proteinSources: ['Micellar Casein', 'Greek Yogurt'],
    proteinType: 'casein',
    flavor: 'Vanilla Cream',
    servingSize: '16 oz',
    nutrition: {
      calories: 240,
      protein: 32,
      carbs: 12,
      fat: 6,
      fiber: 2,
      calcium: 400
    },
    ingredients: ['Micellar Casein (30g)', 'Greek Yogurt (1/2 cup)', 'Almond Milk (1 cup)', 'Vanilla Extract', 'Cinnamon'],
    benefits: ['Overnight Recovery', 'Anti-Catabolic', 'Sustained Release', 'Muscle Preservation'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 892,
    trending: false,
    featured: true,
    estimatedCost: 3.25,
    bestTime: 'Before Bed',
    fitnessGoal: 'Overnight Recovery',
    naturalProtein: true,
    allergens: ['Dairy'],
    absorption: 'Slow',
    absorptionTime: '4-6 hours'
  },
  {
    id: 'casein-2',
    name: 'Chocolate Dream Delight',
    description: 'Rich chocolate casein pudding shake',
    primaryProtein: 'Casein Protein',
    proteinSources: ['Casein Protein', 'Cottage Cheese'],
    proteinType: 'casein',
    flavor: 'Chocolate Fudge',
    servingSize: '14 oz',
    nutrition: {
      calories: 280,
      protein: 35,
      carbs: 15,
      fat: 8,
      fiber: 4,
      calcium: 350
    },
    ingredients: ['Casein Protein (35g)', 'Cottage Cheese (1/2 cup)', 'Cocoa Powder', 'Stevia', 'Almond Milk'],
    benefits: ['Pudding Texture', 'Satiety', 'Slow Digestion', 'Rich Flavor'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 567,
    trending: true,
    featured: false,
    estimatedCost: 3.75,
    bestTime: 'Evening',
    fitnessGoal: 'Weight Management',
    naturalProtein: true,
    allergens: ['Dairy'],
    absorption: 'Slow',
    absorptionTime: '3-5 hours'
  }
];
