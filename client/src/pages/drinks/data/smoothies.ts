import { 
  Apple, Zap, Leaf, IceCream, Coffee, Dumbbell, Crown,
  Target, Activity, Flame, Droplets, Sparkles, Cookie,
  Cake, Heart, Trophy, Sun, TreePine, Milk, Banana,
  GlassWater, FlaskConical
} from 'lucide-react';

export const otherDrinkHubs = [
  {
    id: 'smoothies',
    name: 'Smoothies',
    description: 'Nutrient-packed blends',
    icon: Apple,
    route: '/drinks/smoothies',
    color: 'bg-green-500',
    count: '847 recipes'
  },
  {
    id: 'protein-shakes',
    name: 'Protein Shakes',
    description: 'Fitness-focused nutrition',
    icon: Dumbbell,
    route: '/drinks/protein-shakes',
    color: 'bg-blue-500',
    count: '523 recipes'
  },
  {
    id: 'detoxes',
    name: 'Detoxes & Cleanses',
    description: 'Purifying beverages',
    icon: Leaf,
    route: '/drinks/detoxes',
    color: 'bg-teal-500',
    count: '26 recipes'
  },
  {
    id: 'potent-potables',
    name: 'Potent Potables',
    description: 'Cocktails & beverages',
    icon: GlassWater,
    route: '/drinks/potent-potables',
    color: 'bg-purple-500',
    count: '1247 recipes'
  }
];

export const smoothieSubcategories = [
  {
    id: 'protein',
    name: 'High-Protein',
    description: 'Natural protein for muscle building',
    icon: Zap,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/protein',
    count: 24,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
    trending: true,
    avgCalories: 320,
    duration: 'Post-workout',
    topBenefit: 'Muscle Building'
  },
  {
    id: 'green',
    name: 'Green Superfood',
    description: 'Nutrient-dense greens and superfoods',
    icon: Leaf,
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/green',
    count: 28,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-600',
    featured: true,
    avgCalories: 210,
    duration: 'Morning',
    topBenefit: 'Detoxification'
  },
  {
    id: 'dessert',
    name: 'Dessert',
    description: 'Guilt-free indulgent flavors',
    icon: IceCream,
    image: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/dessert',
    count: 32,
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-600',
    avgCalories: 280,
    duration: 'Evening',
    topBenefit: 'Satisfaction'
  },
  {
    id: 'breakfast',
    name: 'Breakfast',
    description: 'Morning fuel with balanced nutrition',
    icon: Coffee,
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/breakfast',
    count: 26,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-600',
    trending: true,
    avgCalories: 420,
    duration: 'Morning',
    topBenefit: 'Sustained Energy'
  },
  {
    id: 'workout',
    name: 'Workout',
    description: 'Pre and post-workout energy',
    icon: Dumbbell,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/workout',
    count: 22,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-600',
    featured: true,
    avgCalories: 350,
    duration: 'Workout',
    topBenefit: 'Performance'
  }
];

export const workoutSmoothies = [
  {
    id: 'workout-1',
    name: 'Pre-Workout Power Boost',
    description: 'Natural energy blend with caffeine from green tea and guarana',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
    nutrition: { calories: 280, protein: 12, carbs: 45, fat: 6 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 892,
    trending: true,
    featured: true,
    tags: ['Pre-workout', 'Energy', 'Caffeine', 'Natural'],
    ingredients: ['Banana', 'Green tea matcha', 'Guarana', 'Coconut water', 'Dates', 'Chia seeds'],
    instructions: 'Blend all ingredients until smooth. Consume 30-45 minutes before workout.',
    benefits: ['Sustained energy', 'Enhanced focus', 'Natural caffeine', 'Electrolyte balance'],
    bestTime: 'Pre-workout (30-45 min)',
    workoutType: 'Pre-workout',
    energyLevel: 'High',
    caffeineContent: '80mg'
  },
  {
    id: 'workout-2',
    name: 'Post-Workout Recovery Shake',
    description: 'Protein-rich recovery blend optimized for muscle repair',
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400&h=300&fit=crop',
    nutrition: { calories: 420, protein: 25, carbs: 48, fat: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 1203,
    trending: false,
    featured: true,
    tags: ['Post-workout', 'Recovery', 'High protein', 'Muscle repair'],
    ingredients: ['Vanilla protein powder', 'Banana', 'Blueberries', 'Greek yogurt', 'Almond milk', 'Honey'],
    instructions: 'Blend until creamy. Consume within 30 minutes post-workout for optimal recovery.',
    benefits: ['Muscle recovery', 'Protein synthesis', 'Glycogen replenishment', 'Reduced soreness'],
    bestTime: 'Post-workout (0-30 min)',
    workoutType: 'Post-workout',
    energyLevel: 'Recovery',
    proteinContent: '25g'
  },
  {
    id: 'workout-3',
    name: 'Endurance Fuel Smoothie',
    description: 'Complex carb blend for sustained energy during long workouts',
    nutrition: { calories: 350, protein: 8, carbs: 65, fat: 4 },
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.6,
    reviews: 567,
    trending: true,
    featured: false,
    tags: ['Endurance', 'Complex carbs', 'Sustained energy', 'Hydration'],
    ingredients: ['Oats', 'Sweet potato', 'Apple', 'Spinach', 'Coconut water', 'Ginger'],
    instructions: 'Steam sweet potato first, then blend all ingredients. Perfect for endurance activities.',
    benefits: ['Sustained energy', 'Complex carbohydrates', 'Hydration', 'Anti-inflammatory'],
    bestTime: 'Pre-workout (60-90 min)',
    workoutType: 'Endurance',
    energyLevel: 'Sustained',
    carbContent: '65g'
  },
  {
    id: 'workout-4',
    name: 'HIIT Recovery Smoothie',
    description: 'Quick recovery blend for high-intensity interval training',
    nutrition: { calories: 300, protein: 20, carbs: 35, fat: 8 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 445,
    trending: false,
    featured: false,
    tags: ['HIIT', 'Quick recovery', 'Antioxidants', 'Anti-inflammatory'],
    ingredients: ['Tart cherry juice', 'Protein powder', 'Spinach', 'Pineapple', 'Ginger', 'Coconut milk'],
    instructions: 'Blend until smooth. The tart cherries help reduce inflammation from intense training.',
    benefits: ['Reduced inflammation', 'Quick recovery', 'Antioxidants', 'Muscle repair'],
    bestTime: 'Post-HIIT (immediately)',
    workoutType: 'HIIT',
    energyLevel: 'Recovery',
    antioxidants: 'High'
  },
  {
    id: 'workout-5',
    name: 'Strength Training Builder',
    description: 'High-protein blend optimized for muscle building and strength',
    nutrition: { calories: 480, protein: 30, carbs: 42, fat: 18 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 723,
    trending: false,
    featured: true,
    tags: ['Strength training', 'Muscle building', 'High protein', 'Calorie dense'],
    ingredients: ['Chocolate protein powder', 'Peanut butter', 'Banana', 'Oats', 'Whole milk', 'Creatine'],
    instructions: 'Blend all ingredients. Add creatine for enhanced strength gains. Perfect for bulking phases.',
    benefits: ['Muscle building', 'Strength gains', 'Calorie dense', 'Creatine boost'],
    bestTime: 'Post-strength training',
    workoutType: 'Strength',
    energyLevel: 'Building',
    creatineContent: '5g'
  },
  {
    id: 'workout-6',
    name: 'Morning Yoga Energizer',
    description: 'Light, energizing blend perfect for yoga and mindful movement',
    nutrition: { calories: 180, protein: 6, carbs: 32, fat: 4 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 334,
    trending: false,
    featured: false,
    tags: ['Yoga', 'Morning', 'Light', 'Mindful'],
    ingredients: ['Mango', 'Coconut water', 'Lime', 'Mint', 'Spirulina', 'Agave'],
    instructions: 'Blend gently for a light, refreshing smoothie. Perfect before yoga or gentle movement.',
    benefits: ['Light energy', 'Hydration', 'Mental clarity', 'Digestive friendly'],
    bestTime: 'Pre-yoga (30 min)',
    workoutType: 'Yoga',
    energyLevel: 'Gentle',
    mindfulness: 'Enhanced'
  }
];

export const workoutTypes = [
  { 
    id: 'pre-workout', 
    name: 'Pre-Workout', 
    icon: Zap,
    color: 'bg-orange-500',
    description: 'Energy and focus for peak performance',
    timing: '30-60 minutes before',
    focus: 'Energy & Focus'
  },
  { 
    id: 'post-workout', 
    name: 'Post-Workout', 
    icon: Target,
    color: 'bg-green-500',
    description: 'Recovery and muscle repair',
    timing: '0-30 minutes after',
    focus: 'Recovery & Repair'
  },
  { 
    id: 'endurance', 
    name: 'Endurance', 
    icon: Activity,
    color: 'bg-blue-500',
    description: 'Sustained energy for long activities',
    timing: '60-90 minutes before',
    focus: 'Sustained Energy'
  },
  { 
    id: 'strength', 
    name: 'Strength Training', 
    icon: Dumbbell,
    color: 'bg-red-500',
    description: 'Muscle building and strength gains',
    timing: 'Post-workout',
    focus: 'Muscle Building'
  },
  { 
    id: 'hiit', 
    name: 'HIIT Recovery', 
    icon: Flame,
    color: 'bg-purple-500',
    description: 'Quick recovery from intense training',
    timing: 'Immediately after',
    focus: 'Quick Recovery'
  },
  { 
    id: 'yoga', 
    name: 'Yoga & Mindful', 
    icon: Leaf,
    color: 'bg-teal-500',
    description: 'Light energy for mindful movement',
    timing: '30 minutes before',
    focus: 'Mindful Energy'
  }
];

export const proteinSmoothies = [
  {
    id: 'protein-smoothie-1',
    name: 'Greek Goddess Berry Blast',
    description: 'Greek yogurt and berries for creamy protein power',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
    primaryProtein: 'Greek Yogurt',
    proteinSources: ['Greek Yogurt', 'Protein Powder', 'Chia Seeds'],
    flavor: 'Mixed Berry',
    servingSize: '16 oz',
    nutrition: {
      calories: 320,
      protein: 28,
      carbs: 35,
      fat: 8,
      fiber: 12,
      sugar: 22,
      calcium: 350
    },
    ingredients: ['Greek Yogurt (1 cup)', 'Mixed Berries (1 cup)', 'Vanilla Protein Powder (1 scoop)', 'Chia Seeds (1 tbsp)', 'Honey (1 tbsp)', 'Almond Milk (1/2 cup)'],
    benefits: ['High Protein', 'Probiotics', 'Antioxidants', 'Sustained Energy'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1456,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Breakfast',
    fitnessGoal: 'Muscle Building',
    naturalProtein: true,
    allergens: ['Dairy'],
    category: 'Breakfast Smoothies'
  },
  // ... protein smoothies 2-8 would continue here
];

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
  // ... other protein sources
];

export const smoothieCategories = [
  {
    id: 'breakfast',
    name: 'Breakfast Smoothies',
    description: 'Morning fuel with balanced nutrition',
    icon: Crown,
    color: 'bg-yellow-500',
    proteinTarget: '20-25g',
    timing: 'Within 1 hour of waking'
  },
  // ... other categories
];

export const greenSmoothies = [
  {
    id: 'green-smoothie-1',
    name: 'Ultimate Green Goddess',
    description: 'Spinach, kale, and spirulina for maximum nutrition',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
    primaryGreens: 'Spinach & Kale',
    greensContent: ['Baby Spinach', 'Kale', 'Spirulina', 'Chlorella'],
    flavor: 'Fresh Green',
    servingSize: '16 oz',
    nutrition: {
      calories: 185,
      protein: 8,
      carbs: 28,
      fat: 6,
      fiber: 12,
      sugar: 18,
      iron: 4.2,
      vitamin_k: 350,
      folate: 125
    },
    ingredients: ['Baby Spinach (2 cups)', 'Kale (1 cup)', 'Green Apple (1 medium)', 'Cucumber (1/2 medium)', 'Spirulina (1 tsp)', 'Lemon Juice (2 tbsp)', 'Coconut Water (1 cup)', 'Fresh Mint (6 leaves)'],
    benefits: ['Detoxification', 'Alkalizing', 'High Iron', 'Antioxidants', 'Energy Boost'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 892,
    trending: true,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Morning',
    fitnessGoal: 'Detox',
    superfoods: ['Spirulina', 'Chlorella'],
    allergens: [],
    category: 'Detox Greens'
  },
  // ... green smoothies 2-8 would continue here
];

export const greensTypes = [
  {
    id: 'spinach',
    name: 'Spinach',
    description: 'Mild flavor, nutrient powerhouse',
    icon: Leaf,
    color: 'text-green-600',
    nutritionHighlights: ['Iron', 'Folate', 'Vitamin K'],
    flavor: 'Very Mild',
    benefits: ['High Iron', 'Folate Rich', 'Versatile', 'Kid-Friendly'],
    bestFor: 'Beginners',
    cost: 'Low',
    seasonality: 'Year-Round'
  },
  // ... other greens types
];

export const greenCategories = [
  {
    id: 'beginner',
    name: 'Beginner-Friendly',
    description: 'Mild greens masked with sweet fruits',
    icon: Heart,
    color: 'bg-pink-500',
    greensLevel: 'Light',
    sweetness: 'High'
  },
  // ... other green categories
];

export const dessertSmoothies = [
  {
    id: 'dessert-1',
    name: 'Chocolate Brownie Bliss',
    description: 'Rich chocolate indulgence without the guilt',
    image: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400&h=300&fit=crop',
    dessertType: 'Chocolate',
    flavorProfile: 'Rich & Decadent',
    guiltFactor: 'None',
    category: 'Chocolate Lovers',
    nutrition: { calories: 280, protein: 15, carbs: 38, fat: 8, fiber: 10, added_sugar: 0 },
    ingredients: ['Cocoa Powder', 'Banana', 'Greek Yogurt', 'Almond Butter', 'Dates', 'Vanilla'],
    healthySwaps: ['Dates for sugar', 'Cocoa for chocolate', 'Greek yogurt for cream'],
    benefits: ['Antioxidants', 'Protein Rich', 'Natural Sweetness'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 2345,
    trending: true,
    estimatedCost: 3.50,
    bestTime: 'Dessert'
  },
  // ... dessert smoothies 2-3 would continue here
];

export const dessertTypes = [
  {
    id: 'chocolate',
    name: 'Chocolate Dreams',
    description: 'Rich cocoa-based treats',
    icon: Cookie,
    color: 'text-amber-600',
    keyBenefit: 'Antioxidants',
    healthyIngredients: ['Cocoa Powder', 'Dark Chocolate', 'Cacao Nibs'],
    popularFlavors: ['Brownie', 'Mocha', 'Mint Chip'],
    avgCalories: 300,
    guiltLevel: 'None'
  },
  // ... other dessert types
];

export const dessertCategories = [
  {
    id: 'guilt-free',
    name: 'Guilt-Free Treats',
    description: 'Zero added sugar, all natural',
    icon: Heart,
    color: 'bg-green-500',
    calorieRange: '200-300',
    sweetenerType: 'Dates, Banana, Honey'
  },
  // ... other dessert categories
];

export const breakfastSmoothies = [
  {
    id: 'breakfast-1',
    name: 'Power Morning Fuel',
    description: 'Complete nutrition to kickstart your day',
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop',
    breakfastType: 'Complete Meal',
    energyLevel: 'High',
    satietyLevel: 'Very High',
    category: 'Complete Breakfast',
    nutrition: { calories: 420, protein: 22, carbs: 58, fat: 12, fiber: 14, caffeine: 0 },
    ingredients: ['Steel-Cut Oats', 'Greek Yogurt', 'Banana', 'Berries', 'Almond Butter', 'Chia Seeds'],
    morningBenefits: ['Sustained Energy', 'Complete Nutrition', 'High Fiber'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 1892,
    trending: true,
    bestTime: 'Early Morning',
    energyDuration: '4-5h'
  },
  // ... breakfast smoothie 2 would continue here
];

export const breakfastTypes = [
  {
    id: 'complete',
    name: 'Complete Meal',
    description: 'Full breakfast replacement',
    icon: Crown,
    color: 'text-amber-600',
    energyProfile: 'Sustained Release',
    keyNutrients: ['Complex Carbs', 'Protein', 'Healthy Fats'],
    idealFor: 'Meal Replacement',
    satietyDuration: '4-5 hours',
    avgCalories: 400
  },
  // ... other breakfast types
];

export const breakfastCategories = [
  {
    id: 'sustained-energy',
    name: 'Sustained Energy',
    description: 'Long-lasting morning fuel',
    icon: Sun,
    color: 'bg-yellow-500',
    energyDuration: '4-5 hours',
    macroFocus: 'Complex Carbs + Protein'
  },
  // ... other breakfast categories
];

export const ingredients = {
  fruits: [
    { name: "Banana", calories: 89, protein: 1.1, carbs: 22.8, fiber: 2.6, icon: "🍌", boost: "potassium" },
    { name: "Strawberry", calories: 32, protein: 0.7, carbs: 7.7, fiber: 2.0, icon: "🍓", boost: "vitamin-c" },
    { name: "Blueberry", calories: 57, protein: 0.7, carbs: 14.5, fiber: 2.4, icon: "🫐", boost: "antioxidants" },
    { name: "Mango", calories: 60, protein: 0.8, carbs: 15.0, fiber: 1.6, icon: "🥭", boost: "vitamin-a" },
    { name: "Pineapple", calories: 50, protein: 0.5, carbs: 13.1, fiber: 1.4, icon: "🍍", boost: "bromelain" }
  ],
  vegetables: [
    { name: "Spinach", calories: 7, protein: 0.9, carbs: 1.1, fiber: 0.7, icon: "🥬", boost: "iron" },
    { name: "Kale", calories: 8, protein: 0.6, carbs: 1.4, fiber: 0.6, icon: "🥬", boost: "vitamin-k" },
    { name: "Carrot", calories: 10, protein: 0.2, carbs: 2.3, fiber: 0.7, icon: "🥕", boost: "beta-carotene" },
    { name: "Beetroot", calories: 13, protein: 0.4, carbs: 2.8, fiber: 0.8, icon: "🟣", boost: "nitrates" }
  ],
  liquids: [
    { name: "Almond Milk", calories: 15, protein: 0.6, carbs: 0.6, fiber: 0.3, icon: "🥛", boost: "calcium" },
    { name: "Coconut Water", calories: 19, protein: 0.7, carbs: 3.7, fiber: 1.1, icon: "🥥", boost: "electrolytes" },
    { name: "Greek Yogurt", calories: 59, protein: 10.0, carbs: 3.6, fiber: 0, icon: "🥛", boost: "probiotics" },
    { name: "Oat Milk", calories: 16, protein: 0.3, carbs: 1.9, fiber: 0.7, icon: "🥛", boost: "fiber" }
  ],
  boosters: [
    { name: "Protein Powder", calories: 120, protein: 25.0, carbs: 2.0, fiber: 1.0, icon: "💪", boost: "muscle-building" },
    { name: "Chia Seeds", calories: 58, protein: 2.0, carbs: 5.1, fiber: 4.9, icon: "🌰", boost: "omega-3" },
    { name: "Flax Seeds", calories: 55, protein: 1.9, carbs: 3.0, fiber: 2.8, icon: "🌰", boost: "lignans" },
    { name: "Spirulina", calories: 4, protein: 0.8, carbs: 0.2, fiber: 0.1, icon: "🟢", boost: "chlorophyll" }
  ]
};

export const workoutGoals = [
  { id: 'pre-workout', name: 'Pre-Workout Energy', icon: '⚡', color: 'bg-orange-500', focus: 'carbs' },
  { id: 'post-workout', name: 'Post-Workout Recovery', icon: '💪', color: 'bg-blue-500', focus: 'protein' },
  { id: 'weight-loss', name: 'Weight Loss', icon: '🔥', color: 'bg-red-500', focus: 'low-cal' },
  { id: 'muscle-gain', name: 'Muscle Building', icon: '🏋️', color: 'bg-green-500', focus: 'protein' },
  { id: 'endurance', name: 'Endurance', icon: '🏃', color: 'bg-purple-500', focus: 'electrolytes' },
  { id: 'recovery', name: 'Recovery', icon: '😌', color: 'bg-pink-500', focus: 'antioxidants' }
];

export const premadeRecipes = [
  {
    id: 1,
    name: "Green Goddess Power",
    ingredients: ["Spinach", "Banana", "Mango", "Coconut Water", "Chia Seeds"],
    calories: 245,
    protein: 8.2,
    difficulty: "Easy",
    time: "3 min",
    rating: 4.8,
    likes: 1247,
    workoutType: "pre-workout",
    image: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    name: "Chocolate Protein Beast",
    ingredients: ["Banana", "Protein Powder", "Almond Milk", "Flax Seeds"],
    calories: 320,
    protein: 28.5,
    difficulty: "Easy", 
    time: "2 min",
    rating: 4.9,
    likes: 2156,
    workoutType: "post-workout",
    image: "https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    name: "Berry Antioxidant Blast",
    ingredients: ["Blueberry", "Strawberry", "Greek Yogurt", "Spirulina"],
    calories: 180,
    protein: 12.8,
    difficulty: "Medium",
    time: "4 min", 
    rating: 4.7,
    likes: 892,
    workoutType: "recovery",
    image: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop"
  }
];
