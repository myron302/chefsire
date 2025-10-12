import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Leaf, Heart, Star, Search, ArrowLeft, Sparkles, Wine, Zap, Moon,
  Target, Flame, Apple, Sprout, Dumbbell, Share2, ArrowRight, X, Check, Camera
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
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'egg', name: 'Egg Protein', icon: Target, path: '/drinks/protein-shakes/egg', description: 'Complete amino' },
  { id: 'beef', name: 'Beef Protein', icon: Flame, path: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// ---- Servings helpers ----
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));

// convert decimals like 0.25, 0.5, 0.75 to nice fractions "1/4", "1/2", "3/4"
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4; // snap to quarter
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
  if (Number.isNaN(n)) return baseAmount; // fallback: leave string amounts (e.g., "1 pinch") unchanged
  return toNiceFraction(n * servings);
};

const getScaledMeasurements = (list: Measured[], servings: number) =>
  list.map((ing) => ({
    ...ing,
    amountScaled: scaleAmount(ing.amount, servings),
  }));

// Plant-based protein shake data (with measured recipes)
const plantBasedShakes = [
  {
    id: 'plant-1',
    name: 'Pea Power Green Machine',
    description: 'Complete amino acid profile with organic pea protein',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
    proteinSource: 'Pea Protein Isolate',
    proteinType: 'pea',
    flavor: 'Vanilla Mint',
    servingSize: '30g',
    nutrition: { calories: 120, protein: 25, carbs: 3, fat: 1, fiber: 2, iron: 4.5, bcaa: 5.2 },
    ingredients: ['Organic Pea Protein Isolate', 'Natural Vanilla', 'Stevia', 'Mint Extract', 'MCT Oil'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'pea protein isolate'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(1, 'cup', 'spinach, loosely packed'),
        m(0.5, 'frozen banana', 'banana'),
        m(0.5, 'tsp', 'pure vanilla extract'),
        m(2, 'leaves', 'fresh mint', 'or 1–2 drops mint extract'),
        m(1, 'tsp', 'MCT oil', 'optional'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Add liquids first, then powders, then solids.',
        'Blend 40–60 seconds until silky; add ice to thicken.',
        'Taste and adjust mint/vanilla; serve cold.'
      ]
    },
    benefits: ['Complete Amino Profile', 'Easy Digestion', 'Allergen-Free', 'Sustainable'],
    certifications: ['Organic', 'Non-GMO', 'Vegan', 'Gluten-Free'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 847,
    trending: true,
    featured: true,
    price: 32.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Nuts'],
    sustainability: 'Carbon Negative',
    fitnessGoal: 'Muscle Building',
    bestTime: 'Post-Workout'
  },
  {
    id: 'plant-2',
    name: 'Hemp Heart Hero',
    description: 'Omega-rich hemp protein with natural nutty flavor',
    proteinSource: 'Hemp Protein Powder',
    proteinType: 'hemp',
    flavor: 'Natural Nutty',
    servingSize: '30g',
    nutrition: { calories: 110, protein: 20, carbs: 4, fat: 3, fiber: 8, omega3: 2.5, magnesium: 180 },
    ingredients: ['Organic Hemp Protein', 'Natural Flavors', 'Coconut MCT', 'Chia Seeds'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'hemp protein'),
        m(1, 'cup', 'oat milk'),
        m(1, 'tbsp', 'chia seeds'),
        m(1, 'tsp', 'maple syrup', 'optional'),
        m(0.25, 'tsp', 'cinnamon'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Soak chia in oat milk for 5 minutes (optional thicker body).',
        'Blend with hemp protein, cinnamon, sweetener, and ice.',
        'Pulse to desired texture.'
      ]
    },
    benefits: ['Omega 3 & 6', 'High Fiber', 'Complete Protein', 'Heart Health'],
    certifications: ['Organic', 'Raw', 'Vegan', 'Non-GMO'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 623,
    trending: false,
    featured: true,
    price: 29.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten'],
    sustainability: 'Regenerative',
    fitnessGoal: 'General Wellness',
    bestTime: 'Morning'
  },
  {
    id: 'plant-3',
    name: 'Rice & Quinoa Complete',
    description: 'Hypoallergenic blend with ancient grains',
    proteinSource: 'Brown Rice + Quinoa',
    proteinType: 'rice-quinoa',
    flavor: 'Chocolate Cacao',
    servingSize: '32g',
    nutrition: { calories: 125, protein: 24, carbs: 5, fat: 1, fiber: 3, iron: 3.2, lysine: 1.8 },
    ingredients: ['Brown Rice Protein', 'Quinoa Protein', 'Raw Cacao', 'Coconut Sugar', 'Vanilla'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (32g)', 'rice–quinoa protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(1, 'tbsp', 'raw cacao powder'),
        m(1, 'tsp', 'coconut sugar', 'or monk fruit to taste'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'pinch', 'sea salt'),
        m(5, 'ice cubes', 'ice')
      ],
      directions: [
        'Combine all; blend until creamy.',
        'Add extra cacao or sweetener to taste.'
      ]
    },
    benefits: ['Hypoallergenic', 'Complete Amino', 'Ancient Grains', 'Antioxidants'],
    certifications: ['Organic', 'Fair Trade', 'Vegan', 'Sprouted'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 734,
    trending: true,
    featured: false,
    price: 34.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Nuts', 'Legumes'],
    sustainability: 'Water Efficient',
    fitnessGoal: 'Weight Management',
    bestTime: 'Meal Replacement'
  },
  {
    id: 'plant-4',
    name: 'Soy Supreme Classic',
    description: 'Traditional complete protein with all essential amino acids',
    proteinSource: 'Soy Protein Isolate',
    proteinType: 'soy',
    flavor: 'Strawberry Vanilla',
    servingSize: '28g',
    nutrition: { calories: 105, protein: 25, carbs: 2, fat: 0.5, fiber: 1, isoflavones: 25, leucine: 2.1 },
    ingredients: ['Non-GMO Soy Protein Isolate', 'Natural Strawberry', 'Vanilla Extract', 'Stevia'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (28g)', 'soy protein isolate'),
        m(1, 'cup', 'soy milk or almond milk'),
        m(0.5, 'cup', 'frozen strawberries'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey or stevia to taste'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend milk + protein first 10 seconds.',
        'Add strawberries, vanilla, sweetener; blend smooth.'
      ]
    },
    benefits: ['Complete Protein', 'Fast Absorption', 'Isoflavones', 'Muscle Recovery'],
    certifications: ['Non-GMO', 'Vegan', 'Organic'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 956,
    trending: false,
    featured: true,
    price: 28.99,
    allergenFree: ['Dairy', 'Gluten', 'Nuts'],
    sustainability: 'Nitrogen Fixing',
    fitnessGoal: 'Muscle Building',
    bestTime: 'Post-Workout'
  },
  {
    id: 'plant-5',
    name: 'Pumpkin Seed Power',
    description: 'Mineral-rich protein from organic pumpkin seeds',
    proteinSource: 'Pumpkin Seed Protein',
    proteinType: 'seed',
    flavor: 'Cinnamon Spice',
    servingSize: '30g',
    nutrition: { calories: 115, protein: 18, carbs: 6, fat: 2, fiber: 4, zinc: 2.3, magnesium: 160 },
    ingredients: ['Organic Pumpkin Seed Protein', 'Ceylon Cinnamon', 'Nutmeg', 'Monk Fruit'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'pumpkin seed protein'),
        m(1, 'cup', 'cashew milk or water'),
        m(0.5, 'tsp', 'Ceylon cinnamon'),
        m(0.125, 'tsp', 'fresh nutmeg', 'optional'),
        m(1, 'tsp', 'monk fruit or maple syrup'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend all until frothy; spice to taste.',
        'Great warm: gently heat milk first, then blend briefly.'
      ]
    },
    benefits: ['Mineral Rich', 'Prostate Health', 'Immune Support', 'Seasonal Flavor'],
    certifications: ['Organic', 'Raw', 'Vegan', 'Sprouted'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.2,
    reviews: 445,
    trending: false,
    featured: false,
    price: 36.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Nuts', 'Legumes'],
    sustainability: 'Upcycled',
    fitnessGoal: 'General Wellness',
    bestTime: 'Afternoon'
  },
  {
    id: 'plant-6',
    name: 'Algae Omega Fusion',
    description: 'Spirulina and chlorella for complete nutrition',
    proteinSource: 'Spirulina + Chlorella',
    proteinType: 'algae',
    flavor: 'Tropical Green',
    servingSize: '25g',
    nutrition: { calories: 95, protein: 16, carbs: 8, fat: 1, fiber: 2, chlorophyll: 150, b12: 2.4 },
    ingredients: ['Organic Spirulina', 'Chlorella', 'Pineapple Extract', 'Coconut Water Powder'],
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'tbsp (~25g)', 'algae protein blend (spirulina/chlorella)'),
        m(0.75, 'cup', 'coconut water'),
        m(0.25, 'cup', 'frozen pineapple'),
        m(0.5, 'banana', 'ripe'),
        m(1, 'tsp', 'lime juice'),
        m(5, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend until bright green and smooth.',
        'Add extra pineapple if you prefer sweeter.'
      ]
    },
    benefits: ['Detoxification', 'B-Vitamins', 'Antioxidants', 'Alkalizing'],
    certifications: ['Organic', 'Raw', 'Vegan', 'Superfood'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.1,
    reviews: 367,
    trending: true,
    featured: false,
    price: 42.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Nuts', 'Legumes'],
    sustainability: 'Ocean Positive',
    fitnessGoal: 'Detox',
    bestTime: 'Morning'
  },

  // -------- New additions --------
  {
    id: 'plant-7',
    name: 'Matcha Pea Energizer',
    description: 'Clean caffeine + pea protein for focused energy',
    proteinSource: 'Pea Protein Isolate',
    proteinType: 'pea',
    flavor: 'Matcha Vanilla',
    servingSize: '30g',
    nutrition: { calories: 140, protein: 26, carbs: 6, fat: 2, fiber: 2 },
    ingredients: ['Pea Protein', 'Ceremonial Matcha', 'Vanilla', 'Dates'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'pea protein'),
        m(1, 'tsp', 'matcha powder'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(1, 'whole', 'Medjool date', 'pitted (or 1 tsp honey)'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend milk + matcha first to fully disperse.',
        'Add remaining, blend until smooth.'
      ]
    },
    benefits: ['Steady Energy', 'Complete Protein', 'Antioxidants'],
    certifications: ['Vegan', 'Non-GMO', 'Gluten-Free'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 512,
    trending: true,
    featured: true,
    price: 33.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Nuts'],
    sustainability: 'Carbon Neutral',
    fitnessGoal: 'General Wellness',
    bestTime: 'Morning'
  },
  {
    id: 'plant-8',
    name: 'PB Oat Recovery',
    description: 'Comfort classic with oats and peanut butter',
    proteinSource: 'Oat + Peanut',
    proteinType: 'seed',
    flavor: 'Peanut Butter',
    servingSize: '35g',
    nutrition: { calories: 260, protein: 24, carbs: 20, fat: 9, fiber: 5 },
    ingredients: ['Oat Milk', 'Peanut Butter', 'Banana', 'Vanilla'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30–35g)', 'plant protein (neutral)'),
        m(1, 'cup', 'oat milk'),
        m(1, 'tbsp', 'natural peanut butter'),
        m(0.5, 'banana', 'ripe, frozen preferred'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'pinch', 'sea salt'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend until creamy; add splash of milk if too thick.',
        'Top with oat crumble or cacao nibs (optional).'
      ]
    },
    benefits: ['Recovery', 'Satiety', 'Comfort Flavor'],
    certifications: ['Vegan', 'Non-GMO'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 389,
    trending: false,
    featured: false,
    price: 27.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten'],
    sustainability: 'Low Water',
    fitnessGoal: 'Muscle Building',
    bestTime: 'Post-Workout'
  },
  {
    id: 'plant-9',
    name: 'Berry Antioxidant Blend',
    description: 'Polyphenol-rich berries with rice–quinoa protein',
    proteinSource: 'Rice + Quinoa',
    proteinType: 'rice-quinoa',
    flavor: 'Mixed Berry',
    servingSize: '32g',
    nutrition: { calories: 180, protein: 24, carbs: 22, fat: 2, fiber: 6 },
    ingredients: ['Rice–Quinoa Protein', 'Mixed Berries', 'Flaxseed'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (32g)', 'rice–quinoa protein'),
        m(0.75, 'cup', 'almond milk'),
        m(0.75, 'cup', 'frozen mixed berries'),
        m(1, 'tbsp', 'ground flaxseed'),
        m(1, 'tsp', 'honey or agave', 'optional'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend milk + protein first; add berries + flax.',
        'Pulse to keep berry texture or blend fully smooth.'
      ]
    },
    benefits: ['Antioxidants', 'Omega-3 (ALA)', 'Hypoallergenic'],
    certifications: ['Vegan', 'Gluten-Free'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 271,
    trending: true,
    featured: false,
    price: 31.99,
    allergenFree: ['Dairy', 'Soy', 'Nuts* (if using almond milk, swap if needed)'],
    sustainability: 'Water Efficient',
    fitnessGoal: 'Weight Management',
    bestTime: 'Snack'
  },
  {
    id: 'plant-10',
    name: 'Golden Turmeric Hemp',
    description: 'Anti-inflammatory golden milk meets hemp protein',
    proteinSource: 'Hemp Protein',
    proteinType: 'hemp',
    flavor: 'Golden Spice',
    servingSize: '30g',
    nutrition: { calories: 170, protein: 21, carbs: 12, fat: 5, fiber: 7 },
    ingredients: ['Hemp Protein', 'Turmeric', 'Ginger', 'Black Pepper'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'hemp protein'),
        m(1, 'cup', 'coconut milk (light)'),
        m(0.5, 'tsp', 'ground turmeric'),
        m(0.25, 'tsp', 'ground ginger'),
        m(1, 'pinch', 'black pepper', 'bioavailability'),
        m(1, 'tsp', 'maple syrup', 'to taste'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend all; for latte vibe, warm milk first and blend briefly.',
        'Adjust sweetness/spice to taste.'
      ]
    },
    benefits: ['Anti-Inflammatory', 'Fiber', 'Omega 3&6'],
    certifications: ['Vegan', 'Non-GMO', 'Gluten-Free'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 198,
    trending: false,
    featured: true,
    price: 30.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Nuts'],
    sustainability: 'Regenerative',
    fitnessGoal: 'General Wellness',
    bestTime: 'Evening'
  }
];

const proteinTypes = [
  { id: 'pea', name: 'Pea Protein', description: 'Complete amino acid profile, easy digestion', icon: Sprout, color: 'text-green-600', benefits: ['Complete Protein', 'BCAA Rich', 'Iron Source', 'Allergen-Free'], digestibility: 98, sustainability: 'High', commonUses: ['Post-Workout', 'Meal Replacement'] },
  { id: 'hemp', name: 'Hemp Protein', description: 'Omega fatty acids with complete nutrition', icon: Leaf, color: 'text-emerald-600', benefits: ['Omega 3&6', 'High Fiber', 'Magnesium', 'Heart Health'], digestibility: 87, sustainability: 'Very High', commonUses: ['Morning Smoothie', 'General Wellness'] },
  { id: 'rice-quinoa', name: 'Rice & Quinoa', description: 'Hypoallergenic ancient grain blend', icon: Apple, color: 'text-amber-600', benefits: ['Hypoallergenic', 'Ancient Grains', 'Complete Amino', 'Gentle'], digestibility: 94, sustainability: 'Medium', commonUses: ['Sensitive Stomachs', 'Clean Eating'] },
  { id: 'soy', name: 'Soy Protein', description: 'Traditional complete protein powerhouse', icon: Target, color: 'text-blue-600', benefits: ['Complete Protein', 'Fast Absorption', 'Isoflavones', 'Proven'], digestibility: 100, sustainability: 'Medium', commonUses: ['Muscle Building', 'Athletic Performance'] }
];

const fitnessGoals = [
  { id: 'muscle-building', name: 'Muscle Building', description: 'High protein for lean mass gains', icon: Dumbbell, color: 'bg-red-500', recommendedIntake: '25-30g protein', timing: 'Post-workout within 30 minutes' },
  { id: 'weight-management', name: 'Weight Management', description: 'Balanced nutrition for healthy weight', icon: Target, color: 'bg-blue-500', recommendedIntake: '20-25g protein', timing: 'Between meals or meal replacement' },
  { id: 'general-wellness', name: 'General Wellness', description: 'Daily nutrition and vitality', icon: Heart, color: 'bg-green-500', recommendedIntake: '15-20g protein', timing: 'Morning or afternoon' },
  { id: 'detox', name: 'Detox & Cleanse', description: 'Cleansing and alkalizing support', icon: Sparkles, color: 'bg-purple-500', recommendedIntake: '10-15g protein', timing: 'Morning on empty stomach' }
];

export default function PlantBasedProteinPage() {
  const {
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState<'browse'|'protein-types'|'goals'|'featured'>('browse');
  const [selectedProteinType, setSelectedProteinType] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedAllergen, setSelectedAllergen] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating'|'protein'|'price'|'calories'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [selectedShake, setSelectedShake] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // Per-recipe servings (1–6)
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const getServings = (id: string) => clamp(servingsById[id] ?? 1);
  const setServings = (id: string, n: number) => setServingsById((prev) => ({ ...prev, [id]: clamp(n) }));
  const bumpServings = (id: string, delta: number) => setServings(id, getServings(id) + delta);

  const handleSharePage = async () => {
    const shareData = {
      title: 'Plant-Based Protein',
      text: 'Explore plant-based protein options, types, and benefits.',
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
    const measured = shake?.recipe?.measurements?.slice(0,4).map((r: any) => `${r.amount} ${r.unit} ${r.item}`).join(' · ');
    const text = `${shake.name} • ${shake.fitnessGoal} • ${shake.proteinSource}\n${shake.description}\nRecipe: ${measured || 'see page'}`;
    const shareData = { title: shake.name, text, url };
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

  const getFilteredShakes = () => {
    let filtered = plantBasedShakes.filter(shake => {
      const matchesSearch =
        shake.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shake.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedProteinType || shake.proteinType === selectedProteinType;
      const matchesGoal = !selectedGoal || shake.fitnessGoal.toLowerCase().includes(selectedGoal.toLowerCase());
      const matchesAllergen =
        !selectedAllergen ||
        shake.allergenFree.some((a: string) => (a || '').toLowerCase().includes(selectedAllergen.toLowerCase()));
      return matchesSearch && matchesType && matchesGoal && matchesAllergen;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'price': return (a.price || 0) - (b.price || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredShakes = getFilteredShakes();
  const featuredShakes = plantBasedShakes.filter(shake => shake.featured);

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
        fitnessGoal: selectedShake.fitnessGoal,
        bestTime: selectedShake.bestTime
      });
      incrementDrinksMade();
      addPoints(25);
    }
    setShowModal(false);
    setSelectedShake(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
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

      {/* Make Shake Modal (bigger & darker recipe text) */}
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
              <div className="grid grid-cols-3 gap-2 p-3 bg-green-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedShake.nutrition.protein}g</div>
                  <div className="text-xs text-gray-600">Protein</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedShake.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-purple-600">{selectedShake.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Recipe • {getServings(selectedShake.id)} {getServings(selectedShake.id) === 1 ? 'serving' : 'servings'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 border rounded text-sm"
                      onClick={() => bumpServings(selectedShake.id, -1)}
                      aria-label="decrease servings"
                    >
                      −
                    </button>
                    <div className="min-w-[2ch] text-center text-sm">{getServings(selectedShake.id)}</div>
                    <button
                      className="px-2 py-1 border rounded text-sm"
                      onClick={() => bumpServings(selectedShake.id, +1)}
                      aria-label="increase servings"
                    >
                      +
                    </button>
                  </div>
                </div>

                {(() => {
                  const scaled = getScaledMeasurements(selectedShake.recipe?.measurements || [], getServings(selectedShake.id));
                  return (
                    <ul className="space-y-2 text-base leading-6 text-gray-800 font-sans tracking-normal">
                      {scaled.map((ing: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5" />
                          <span>
                            <span className="text-green-700 font-semibold">
                              {ing.amountScaled} {ing.unit}
                            </span>{" "}
                            {ing.item}
                            {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              {Array.isArray(selectedShake.recipe?.directions) && (
                <div>
                  <h3 className="font-semibold mb-2 text-gray-900">Directions</h3>
                  <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
                    {selectedShake.recipe.directions.map((step: string, i: number) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleCompleteShake}>
                  Complete Shake (+25 XP)
                </Button>
                <Button variant="outline" onClick={() => handleShareShake(selectedShake)}>
                  <Share2 className="h-4 w-4 mr-2" /> Share
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
                <Leaf className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Plant-Based Protein</h1>
                <Badge className="bg-green-100 text-green-800">Vegan</Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}>
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

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
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-600" />
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
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">21g</div><div className="text-sm text-gray-600">Avg Protein</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">0mg</div><div className="text-sm text-gray-600">Cholesterol</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">100%</div><div className="text-sm text-gray-600">Plant-Based</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{plantBasedShakes.length}</div><div className="text-sm text-gray-600">Protein Options</div></CardContent></Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'protein-types', label: 'Protein Types', icon: Leaf },
            { id: 'goals', label: 'By Goal', icon: Target },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map((tab: any) => {
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
                  placeholder="Search plant-based proteins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedProteinType} onChange={(e) => setSelectedProteinType(e.target.value)}>
                  <option value="">All Protein Types</option>
                  {proteinTypes.map(type => (<option key={type.id} value={type.id}>{type.name}</option>))}
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}>
                  <option value="">All Goals</option>
                  {fitnessGoals.map(goal => (<option key={goal.id} value={goal.name}>{goal.name}</option>))}
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedAllergen} onChange={(e) => setSelectedAllergen(e.target.value)}>
                  <option value="">All Allergen-Free</option>
                  <option value="Dairy">Dairy-Free</option>
                  <option value="Soy">Soy-Free</option>
                  <option value="Gluten">Gluten-Free</option>
                  <option value="Nuts">Nut-Free</option>
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="price">Sort by Price</option>
                  <option value="calories">Sort by Calories</option>
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
                          fitnessGoal: shake.fitnessGoal,
                          bestTime: shake.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-100 text-green-800">{shake.proteinSource}</Badge>
                      <Badge variant="outline">{shake.flavor}</Badge>
                      {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Nutrition Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div><div className="text-xl font-bold text-green-600">{shake.nutrition.protein}g</div><div className="text-gray-500">Protein</div></div>
                      <div><div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div><div className="text-gray-500">Cal</div></div>
                      <div><div className="text-xl font-bold text-purple-600">{(shake.nutrition as any).fiber ?? '—'}{(shake.nutrition as any).fiber ? 'g':''}</div><div className="text-gray-500">Fiber</div></div>
                      <div><div className="text-xl font-bold text-amber-600">${shake.price}</div><div className="text-gray-500">Price</div></div>
                    </div>

                    {/* Certifications */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {shake.certifications.map((cert: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">{cert}</Badge>
                      ))}
                    </div>

                    {/* Compact measured recipe preview with Servings control */}
                    {shake.recipe?.measurements && (
                      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-900">
                            Recipe (serves {getServings(shake.id)})
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 border rounded text-sm"
                              onClick={() => bumpServings(shake.id, -1)}
                              aria-label="decrease servings"
                            >
                              −
                            </button>
                            <div className="min-w-[2ch] text-center text-sm">{getServings(shake.id)}</div>
                            <button
                              className="px-2 py-1 border rounded text-sm"
                              onClick={() => bumpServings(shake.id, +1)}
                              aria-label="increase servings"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const scaled = getScaledMeasurements(shake.recipe.measurements, getServings(shake.id));
                          return (
                            <ul className="text-base leading-6 text-gray-800 space-y-1 font-sans tracking-normal">
                              {scaled.slice(0, 4).map((ing: any, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                                  <span>
                                    <span className="text-green-700 font-semibold">
                                      {ing.amountScaled} {ing.unit}
                                    </span>{" "}
                                    {ing.item}
                                    {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                  </span>
                                </li>
                              ))}
                              {scaled.length > 4 && (
                                <li className="text-sm text-gray-600">…plus {scaled.length - 4} more</li>
                              )}
                            </ul>
                          );
                        })()}
                      </div>
                    )}

                    {/* Rating + difficulty */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{shake.rating}</span>
                        <span className="text-gray-500 text-sm">({shake.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{shake.difficulty}</Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleMakeShake(shake)}>
                        <Dumbbell className="h-4 w-4 mr-2" />
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

        {/* Protein Types Tab */}
        {activeTab === 'protein-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {proteinTypes.map(type => {
              const Icon = type.icon;
              const typeShakes = plantBasedShakes.filter(shake => shake.proteinType === type.id);
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
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-700 mb-1">Digestibility</div>
                        <div className="text-2xl font-bold text-green-600">{type.digestibility}%</div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Key Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.benefits.map((benefit, index) => (
                            <Badge key={index} variant="outline" className="text-xs">{benefit}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>{typeShakes.length}</div>
                      <div className="text-sm text-gray-600 mb-3">Available Options</div>
                      <Button className="w-full" onClick={() => { setSelectedProteinType(type.id); setActiveTab('browse'); }}>
                        Explore {type.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {fitnessGoals.map(goal => {
              const Icon = goal.icon;
              const goalShakes = plantBasedShakes.filter(shake =>
                shake.fitnessGoal.toLowerCase().includes(goal.name.toLowerCase())
              );
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
                        <div className="text-sm font-medium text-gray-700 mb-1">Recommended Intake:</div>
                        <div className="text-lg font-bold text-green-600">{goal.recommendedIntake}</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Timing:</div>
                        <div className="text-sm text-blue-800">{goal.timing}</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${goal.color.replace('bg-', 'text-')} mb-1`}>{goalShakes.length}</div>
                      <div className="text-sm text-gray-600 mb-3">Perfect Matches</div>
                      <Button className="w-full" onClick={() => { setSelectedGoal(goal.name); setActiveTab('browse'); }}>
                        View {goal.name} Options
                      </Button>
                    </div>
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
                    src={shake.image || 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop'}
                    alt={shake.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white">Featured Plant Protein</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-green-800">{shake.sustainability}</Badge>
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="text-xl">{shake.name}</CardTitle>
                  <p className="text-gray-600">{shake.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-green-100 text-green-800">{shake.proteinSource}</Badge>
                    <Badge variant="outline">{shake.flavor}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{shake.rating}</span>
                      <span className="text-gray-500 text-sm">({shake.reviews})</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-green-50 rounded-lg">
                    <div className="text-center"><div className="text-xl font-bold text-green-600">{shake.nutrition.protein}g</div><div className="text-xs text-gray-600">Protein</div></div>
                    <div className="text-center"><div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div><div className="text-xs text-gray-600">Calories</div></div>
                    <div className="text-center"><div className="text-xl font-bold text-purple-600">{(shake.nutrition as any).fiber ?? '—'}{(shake.nutrition as any).fiber ? 'g':''}</div><div className="text-xs text-gray-600">Fiber</div></div>
                    <div className="text-center"><div className="text-xl font-bold text-amber-600">${shake.price}</div><div className="text-xs text-gray-600">Price</div></div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Allergen-Free:</h4>
                    <div className="flex flex-wrap gap-1">
                      {shake.allergenFree.map((allergen: string, index: number) => (
                        <Badge key={index} className="bg-blue-100 text-blue-800 text-xs">{allergen}-Free</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {shake.benefits.map((benefit: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">{benefit}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Full measured list quick view with Servings control */}
                  {shake.recipe?.measurements && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Recipe (serves {getServings(shake.id)})</h4>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={() => bumpServings(shake.id, -1)}
                            aria-label="decrease servings"
                          >
                            −
                          </button>
                          <div className="min-w-[2ch] text-center text-sm">{getServings(shake.id)}</div>
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={() => bumpServings(shake.id, +1)}
                            aria-label="increase servings"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const scaled = getScaledMeasurements(shake.recipe.measurements, getServings(shake.id));
                        return (
                          <div className="text-base leading-6 text-gray-800 space-y-1 font-sans tracking-normal">
                            {scaled.map((ing: any, index: number) => (
                              <div key={index} className="flex items-start gap-2">
                                <Leaf className="h-4 w-4 text-green-600 mt-0.5" />
                                <span>
                                  <span className="text-green-700 font-semibold">
                                    {ing.amountScaled} {ing.unit}
                                  </span>{" "}
                                  {ing.item}
                                  {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleMakeShake(shake)}>
                      <Dumbbell className="h-4 w-4 mr-2" />
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

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-600">Level {userProgress.level}</Badge>
                  <Badge variant="outline" className="text-blue-600">{userProgress.totalPoints} XP</Badge>
                  <Badge variant="outline" className="text-green-600">{userProgress.totalDrinksMade} Drinks Made</Badge>
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
