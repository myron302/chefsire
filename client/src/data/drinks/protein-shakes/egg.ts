type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

export const eggProteinRecipes = [
  {
    id: 'egg-1',
    name: 'Classic Egg White Power',
    flavor: 'Cinnamon Banana',
    protein: 28,
    carbs: 15,
    calories: 210,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 156,
    tags: ['Lactose-Free', 'Post-Workout', 'Muscle Building'],
    benefits: ['Complete amino acids', 'Easy digestion', 'No lactose'],
    ingredients: ['Egg White Protein', 'Banana', 'Oats', 'Cinnamon', 'Almond Milk'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.8g',
    bestTime: 'Post-workout or morning',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg white protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(0.5, 'banana', 'ripe, frozen preferred'),
        m(2, 'tbsp', 'rolled oats'),
        m(0.5, 'tsp', 'cinnamon'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'honey', 'optional sweetener'),
        m(1, 'pinch', 'nutmeg', 'optional')
      ],
      directions: [
        'Add milk, then protein and dry ingredients, then fruit.',
        'Blend 40–60 seconds until creamy.'
      ]
    }
  },
  {
    id: 'egg-2',
    name: 'Vanilla Egg Protein Delight',
    flavor: 'Vanilla Cream',
    protein: 30,
    carbs: 20,
    calories: 240,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 203,
    tags: ['High Protein', 'Morning Boost', 'Muscle Recovery'],
    benefits: ['Sustained energy', 'Rich in BCAAs', 'Smooth texture'],
    ingredients: ['Egg Protein', 'Vanilla', 'Greek Yogurt', 'Honey', 'Ice'],
    absorptionTime: '60-90 minutes',
    leucineContent: '3.0g',
    bestTime: 'Morning or post-workout',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', '2% milk or almond milk'),
        m(0.25, 'cup', 'Greek yogurt'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey or stevia to taste'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tbsp', 'chia seeds', 'for fiber'),
        m(0.25, 'tsp', 'cinnamon')
      ],
      directions: [
        'Blend liquids + protein 10 seconds.',
        'Add yogurt and sweetener; blend smooth.'
      ]
    }
  },
  {
    id: 'egg-3',
    name: 'Berry Egg Fusion',
    flavor: 'Mixed Berry',
    protein: 26,
    carbs: 18,
    calories: 220,
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 187,
    tags: ['Antioxidants', 'Recovery', 'Lactose-Free'],
    benefits: ['Antioxidant rich', 'Anti-inflammatory', 'Heart health'],
    ingredients: ['Egg Protein', 'Mixed Berries', 'Spinach', 'Chia', 'Coconut Water'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.6g',
    bestTime: 'Post-workout or snack',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', 'coconut water'),
        m(0.75, 'cup', 'mixed berries, frozen'),
        m(1, 'handful', 'spinach'),
        m(1, 'tsp', 'chia seeds'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'lemon juice', 'optional'),
        m(1, 'tsp', 'flax seeds', 'optional')
      ],
      directions: [
        'Blend all until smooth; pulse to keep berry texture if preferred.'
      ]
    }
  },
  {
    id: 'egg-4',
    name: 'Chocolate Egg Power',
    flavor: 'Cocoa PB',
    protein: 32,
    carbs: 22,
    calories: 260,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 245,
    tags: ['Indulgent', 'Post-Workout', 'Strength'],
    benefits: ['Muscle growth', 'Energy boost', 'Great taste'],
    ingredients: ['Egg Protein', 'Cocoa', 'Peanut Butter', 'Banana', 'Milk'],
    absorptionTime: '60-90 minutes',
    leucineContent: '3.2g',
    bestTime: 'Post-workout or meal replacement',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'tbsp', 'unsweetened cocoa powder'),
        m(1, 'tbsp', 'peanut butter'),
        m(0.5, 'banana', 'ripe'),
        m(1, 'cup', 'milk or almond milk'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'maple syrup', 'optional'),
        m(1, 'pinch', 'sea salt')
      ],
      directions: [
        'Blend all 45–60 seconds until silky; add milk to thin as needed.'
      ]
    }
  },
  {
    id: 'egg-5',
    name: 'Green Egg Power Smoothie',
    flavor: 'Green Apple',
    protein: 27,
    carbs: 16,
    calories: 205,
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.5,
    reviews: 134,
    tags: ['Detox', 'Nutrient-Dense', 'Alkalizing'],
    benefits: ['Nutrient-dense', 'Digestive health', 'Clean protein'],
    ingredients: ['Egg Protein', 'Kale', 'Avocado', 'Apple', 'Lemon'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.7g',
    bestTime: 'Morning or pre-workout',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'cup', 'water or coconut water'),
        m(1, 'handful', 'kale'),
        m(0.25, 'medium', 'avocado'),
        m(0.5, 'small', 'green apple, cored'),
        m(1, 'tsp', 'fresh lemon juice'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'ginger', 'optional')
      ],
      directions: [
        'Blend until bright and smooth; adjust lemon to taste.'
      ]
    }
  },
  {
    id: 'egg-6',
    name: 'Tropical Egg Protein',
    flavor: 'Mango Pineapple',
    protein: 29,
    carbs: 25,
    calories: 250,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 178,
    tags: ['Tropical', 'Anti-Inflammatory', 'Recovery'],
    benefits: ['Tropical flavor', 'Anti-inflammatory', 'Immune boost'],
    ingredients: ['Egg Protein', 'Mango', 'Pineapple', 'Coconut Milk', 'Turmeric'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.9g',
    bestTime: 'Post-workout or breakfast',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.5, 'cup', 'mango, frozen'),
        m(0.5, 'cup', 'pineapple, frozen'),
        m(0.75, 'cup', 'light coconut milk'),
        m(0.25, 'tsp', 'ground turmeric'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'coconut flakes', 'optional'),
        m(1, 'pinch', 'black pepper', 'for turmeric absorption')
      ],
      directions: [
        'Blend all ingredients until smooth; add milk for thinner texture.'
      ]
    }
  },
  {
    id: 'egg-7',
    name: 'Coffee Egg Energizer',
    flavor: 'Mocha Latte',
    protein: 31,
    carbs: 12,
    calories: 230,
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 198,
    tags: ['Morning Boost', 'Energy', 'Focus'],
    benefits: ['Caffeine boost', 'Mental focus', 'Sustained energy'],
    ingredients: ['Egg Protein', 'Coffee', 'Cocoa', 'Milk', 'Vanilla'],
    absorptionTime: '60-90 minutes',
    leucineContent: '3.1g',
    bestTime: 'Morning or pre-workout',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.5, 'cup', 'cold brew coffee'),
        m(0.5, 'cup', 'milk or almond milk'),
        m(1, 'tbsp', 'cocoa powder'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'maple syrup', 'optional'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Blend coffee with protein and cocoa until smooth',
        'Add milk and sweetener; blend until frothy'
      ]
    }
  },
  {
    id: 'egg-8',
    name: 'Pumpkin Spice Egg Protein',
    flavor: 'Pumpkin Spice',
    protein: 28,
    carbs: 19,
    calories: 235,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 167,
    tags: ['Seasonal', 'Comfort', 'Fiber Rich'],
    benefits: ['Seasonal flavor', 'High fiber', 'Vitamin A'],
    ingredients: ['Egg Protein', 'Pumpkin', 'Spices', 'Yogurt', 'Oats'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.8g',
    bestTime: 'Morning or snack',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.25, 'cup', 'pumpkin puree'),
        m(0.5, 'cup', 'Greek yogurt'),
        m(0.5, 'cup', 'milk or almond milk'),
        m(0.5, 'tsp', 'pumpkin pie spice'),
        m(2, 'tbsp', 'rolled oats'),
        m(1, 'tsp', 'honey', 'optional'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Combine all ingredients in blender',
        'Blend until smooth and creamy like pumpkin pie'
      ]
    }
  },
  {
    id: 'egg-9',
    name: 'Matcha Egg Green Tea',
    flavor: 'Matcha Green Tea',
    protein: 27,
    carbs: 14,
    calories: 215,
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 189,
    tags: ['Antioxidants', 'Energy', 'Metabolism'],
    benefits: ['Antioxidant boost', 'Metabolism support', 'Calm energy'],
    ingredients: ['Egg Protein', 'Matcha', 'Spinach', 'Avocado', 'Coconut Water'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.7g',
    bestTime: 'Morning or afternoon',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'tsp', 'matcha powder'),
        m(1, 'cup', 'coconut water'),
        m(1, 'handful', 'spinach'),
        m(0.25, 'avocado', 'for creaminess'),
        m(1, 'tsp', 'honey', 'optional'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'lemon juice', 'optional')
      ],
      directions: [
        'Blend matcha with liquid first to dissolve',
        'Add remaining ingredients and blend until vibrant green'
      ]
    }
  }
];
