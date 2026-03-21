type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

export const wheyProteinShakes = [
  {
    id: 'whey-1',
    name: 'Classic Vanilla Post-Workout',
    description: 'Fast-absorbing whey isolate for maximum protein synthesis',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop',
    nutrition: { calories: 180, protein: 35, carbs: 3, fat: 1 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1247,
    trending: false,
    featured: true,
    tags: ['Whey Isolate', 'Fast absorption', 'Muscle recovery', 'Low carb'],
    ingredients: ['Whey protein isolate (30g)', 'Water or almond milk', 'Vanilla extract', 'Ice cubes'],
    instructions: 'Blend for 30 seconds. Consume within 30 minutes post-workout for optimal absorption.',
    benefits: ['Fast protein absorption', 'Muscle recovery', 'Low carb'],
    bestTime: 'Post-workout (0-30 minutes)',
    fitnessGoal: 'Muscle Building',
    wheyType: 'Whey Isolate',
    absorptionTime: '30-60 minutes',
    leucineContent: '2.5g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey isolate'),
        m(1, 'cup', 'water or unsweetened almond milk'),
        m(0.25, 'tsp', 'vanilla extract'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Add liquid first, then powder and vanilla, then ice.',
        'Blend 30–45 seconds until smooth.'
      ]
    }
  },
  {
    id: 'whey-2',
    name: 'Chocolate Peanut Butter Powerhouse',
    description: 'Rich chocolate whey with natural peanut butter for mass gaining',
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
    nutrition: { calories: 420, protein: 40, carbs: 15, fat: 18 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.9,
    reviews: 567,
    trending: false,
    featured: true,
    tags: ['Whey Concentrate', 'High Calorie', 'Mass Gain', 'Chocolate'],
    ingredients: ['Whey protein concentrate (35g)', 'Natural peanut butter (2 tbsp)', 'Banana', 'Whole milk', 'Honey'],
    instructions: 'Blend until creamy. Add extra milk if too thick. Perfect for bulking phases.',
    benefits: ['High protein', 'Calorie dense', 'Great taste', 'Sustained energy'],
    bestTime: 'Post-workout or meal replacement',
    fitnessGoal: 'Mass Gaining',
    wheyType: 'Whey Concentrate',
    absorptionTime: '60-90 minutes',
    leucineContent: '3.2g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey concentrate, chocolate preferred'),
        m(2, 'tbsp', 'natural peanut butter'),
        m(1, 'small', 'banana, ripe'),
        m(1, 'cup', 'whole milk'),
        m(1, 'tsp', 'honey (optional)'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend milk + powder 10 seconds.',
        'Add banana, peanut butter, honey, and ice; blend creamy.'
      ]
    }
  },
  {
    id: 'whey-3',
    name: 'Strawberry Lean Machine',
    description: 'Low-calorie whey isolate perfect for cutting phases',
    nutrition: { calories: 160, protein: 30, carbs: 5, fat: 1 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 234,
    trending: true,
    featured: false,
    tags: ['Whey Isolate', 'Low Calorie', 'Cutting', 'Fat Loss'],
    ingredients: ['Whey protein isolate (30g)', 'Frozen strawberries', 'Water', 'Stevia', 'Ice'],
    instructions: 'Blend with ice for refreshing texture. Ideal for maintaining muscle during calorie deficit.',
    benefits: ['Low calorie', 'Fat burning support', 'Refreshing', 'Muscle preservation'],
    bestTime: 'Morning or pre-workout',
    fitnessGoal: 'Fat Loss',
    wheyType: 'Whey Isolate',
    absorptionTime: '30-60 minutes',
    leucineContent: '2.4g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey isolate, vanilla or strawberry'),
        m(0.75, 'cup', 'frozen strawberries'),
        m(1, 'cup', 'cold water'),
        m(1, 'tsp', 'stevia or to taste'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend all ingredients 30–45 seconds; adjust sweetness to taste.'
      ]
    }
  },
  {
    id: 'whey-4',
    name: 'Pre-Workout Energy Blast',
    description: 'Whey protein with natural energy boosters for enhanced performance',
    nutrition: { calories: 320, protein: 32, carbs: 25, fat: 6 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 189,
    trending: false,
    featured: false,
    tags: ['Whey Concentrate', 'Pre-workout', 'Energy', 'Performance'],
    ingredients: ['Whey protein concentrate (30g)', 'Cold brew coffee', 'Banana', 'Oats', 'Cinnamon'],
    instructions: 'Blend well. Consume 30-60 minutes before workout for sustained energy and protein.',
    benefits: ['Energy boost', 'Sustained fuel', 'Performance enhancement', 'Muscle protection'],
    bestTime: 'Pre-workout (30-60 minutes)',
    fitnessGoal: 'Performance',
    wheyType: 'Whey Concentrate',
    absorptionTime: '60-90 minutes',
    leucineContent: '2.8g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey concentrate, vanilla'),
        m(0.75, 'cup', 'cold brew coffee'),
        m(0.5, 'small', 'banana'),
        m(2, 'tbsp', 'rolled oats'),
        m(0.25, 'tsp', 'ground cinnamon'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend coffee + powder first; add banana, oats, cinnamon, ice; blend smooth.'
      ]
    }
  },
  {
    id: 'whey-5',
    name: 'Hydrolyzed Recovery Formula',
    description: 'Premium hydrolyzed whey for ultra-fast absorption',
    nutrition: { calories: 200, protein: 38, carbs: 6, fat: 2 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 89,
    trending: true,
    featured: true,
    tags: ['Hydrolyzed Whey', 'Premium', 'Ultra-fast', 'Recovery'],
    ingredients: ['Hydrolyzed whey protein (35g)', 'Coconut water', 'Sea salt', 'Lemon juice'],
    instructions: 'Mix gently - no blending needed. Consume immediately post-workout.',
    benefits: ['Fastest absorption', 'Superior recovery', 'Reduced muscle soreness', 'Premium quality'],
    bestTime: 'Immediately post-workout',
    fitnessGoal: 'Elite Performance',
    wheyType: 'Hydrolyzed Whey',
    absorptionTime: '15-30 minutes',
    leucineContent: '3.8g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'hydrolyzed whey protein'),
        m(1, 'cup', 'coconut water'),
        m(1, 'pinch', 'sea salt'),
        m(0.5, 'tsp', 'fresh lemon juice'),
      ],
      directions: [
        'Shake in a bottle 10–15 seconds; no blender required.'
      ]
    }
  },
  {
    id: 'whey-6',
    name: 'Bedtime Casein-Whey Blend',
    description: 'Slow and fast protein combination for overnight recovery',
    nutrition: { calories: 280, protein: 35, carbs: 8, fat: 8 },
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.5,
    reviews: 156,
    trending: false,
    featured: false,
    tags: ['Whey-Casein Blend', 'Night Formula', 'Slow Release', 'Recovery'],
    ingredients: ['Whey protein (20g)', 'Casein protein (15g)', 'Almond milk', 'Greek yogurt', 'Vanilla'],
    instructions: 'Blend until smooth. Consume 30 minutes before bed for overnight muscle recovery.',
    benefits: ['Sustained protein release', 'Overnight recovery', 'Muscle preservation', 'Better sleep'],
    bestTime: 'Before bed (30 minutes)',
    fitnessGoal: 'Recovery & Growth',
    wheyType: 'Whey-Casein Blend',
    absorptionTime: '2-8 hours',
    leucineContent: '3.0g',
    recipe: {
      servings: 1,
      measurements: [
        m(2/3, 'scoop (30g)', 'whey protein (≈20g)'),
        m(0.5, 'scoop (30g)', 'micellar casein (≈15g)'),
        m(0.75, 'cup', 'unsweetened almond milk'),
        m(0.25, 'cup', 'plain Greek yogurt'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend liquids + proteins 15 seconds.',
        'Add yogurt, vanilla, ice; blend silky.'
      ]
    }
  }
];
