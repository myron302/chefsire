type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

export const beefProteinShakes = [
  {
    id: 'beef-1',
    name: 'Carnivore Power Blast',
    description: 'Slow-digesting micellar casein for 8-hour muscle feeding',
    flavor: 'Natural Beef',
    protein: 28,
    carbs: 2,
    calories: 120,
    creatine: 0.5,
    iron: 4.5,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 523,
    trending: true,
    featured: true,
    price: 45.99,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Muscle Building',
    absorptionTime: '60-90 minutes',
    leucineContent: '2.3g',
    tags: ['Grass-Fed', 'Paleo-Friendly', 'Muscle Building', 'Natural Creatine'],
    benefits: ['Natural Creatine', 'High Iron', 'Complete Amino Profile', 'Paleo-Friendly'],
    ingredients: ['Grass-Fed Beef Protein Isolate', 'Natural Flavors', 'Sea Salt', 'Digestive Enzymes'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'grass-fed beef protein'),
        m(1, 'cup', 'cold water or milk'),
        m(1, 'tsp', 'honey or maple syrup', 'optional'),
        m(1, 'pinch', 'sea salt'),
        m(4, 'ice cubes', 'ice', 'optional')
      ],
      directions: [
        'Add liquid first, then slowly add beef protein while blending',
        'Blend for 45-60 seconds until completely smooth',
        'Add ice for colder, thicker consistency'
      ]
    }
  },
  {
    id: 'beef-2',
    name: 'Primal Strength Formula',
    description: 'Rich chocolate casein for evening muscle repair',
    flavor: 'Chocolate Beef',
    protein: 26,
    carbs: 3,
    calories: 125,
    creatine: 0.4,
    iron: 3.8,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 445,
    trending: false,
    featured: true,
    price: 42.99,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Strength',
    absorptionTime: '45-75 minutes',
    leucineContent: '2.1g',
    tags: ['Hydrolyzed', 'Joint Support', 'Keto-Friendly', 'Strength'],
    benefits: ['Joint Support', 'Muscle Recovery', 'Gut Health', 'Keto-Friendly'],
    ingredients: ['Hydrolyzed Beef Protein', 'Beef Collagen', 'Cocoa Powder', 'Monk Fruit', 'MCT Oil'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (32g)', 'hydrolyzed beef protein'),
        m(1, 'cup', 'almond milk'),
        m(1, 'tbsp', 'cocoa powder'),
        m(1, 'tsp', 'MCT oil'),
        m(1, 'pinch', 'sea salt')
      ],
      directions: [
        'Mix protein with small amount of liquid first to create paste',
        'Gradually add remaining liquid while blending',
        'Blend until rich and chocolatey'
      ]
    }
  },
  {
    id: 'beef-3',
    name: 'Paleo Performance Shake',
    description: 'Natural banana with tryptophan for better sleep',
    flavor: 'Vanilla Bean',
    protein: 27,
    carbs: 2,
    calories: 115,
    creatine: 0.45,
    iron: 5.0,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 367,
    trending: false,
    featured: false,
    price: 39.99,
    bestTime: 'Morning',
    fitnessGoal: 'General Wellness',
    absorptionTime: '50-80 minutes',
    leucineContent: '2.0g',
    tags: ['Paleo Certified', 'Clean Ingredients', 'Iron Rich', 'General Wellness'],
    benefits: ['Paleo Approved', 'Clean Ingredients', 'Natural Energy', 'Iron Rich'],
    ingredients: ['Grass-Fed Beef Protein', 'Vanilla Bean Extract', 'Stevia', 'Himalayan Salt'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (28g)', 'beef protein isolate'),
        m(1, 'cup', 'coconut water'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey', 'optional'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Combine all ingredients in blender',
        'Blend until smooth and frothy',
        'Enjoy as morning energy boost'
      ]
    }
  },
  {
    id: 'beef-4',
    name: 'Beef & Berry Recovery',
    description: 'Antioxidant-rich blueberry casein for overnight repair',
    flavor: 'Mixed Berry',
    protein: 25,
    carbs: 8,
    calories: 140,
    creatine: 0.4,
    iron: 4.2,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 289,
    trending: false,
    featured: false,
    price: 46.99,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Recovery',
    absorptionTime: '55-85 minutes',
    leucineContent: '1.9g',
    tags: ['Antioxidant Boost', 'Muscle Recovery', 'Fiber Rich', 'Immune Support'],
    benefits: ['Antioxidant Boost', 'Muscle Recovery', 'Fiber Rich', 'Immune Support'],
    ingredients: ['Grass-Fed Beef Protein', 'Mixed Berry Blend', 'Acai Powder', 'Chia Seeds', 'Natural Berry Flavor'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'beef protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(0.5, 'cup', 'mixed berries, frozen'),
        m(1, 'tsp', 'acai powder'),
        m(1, 'tsp', 'chia seeds'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend beef protein with almond milk first',
        'Add frozen berries and acai powder',
        'Blend until smooth, stir in chia seeds last'
      ]
    }
  },
  {
    id: 'beef-5',
    name: 'Coffee Beef Energizer',
    description: 'Decaf coffee casein for evening caffeine lovers',
    flavor: 'Mocha',
    protein: 26,
    carbs: 4,
    calories: 130,
    creatine: 0.42,
    iron: 3.5,
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.6,
    reviews: 412,
    trending: true,
    featured: false,
    price: 44.99,
    bestTime: 'Pre-Workout',
    fitnessGoal: 'Mental Performance',
    absorptionTime: '40-70 minutes',
    leucineContent: '2.2g',
    tags: ['Pre-Workout', 'Sustained Energy', 'Mental Focus', 'Keto'],
    benefits: ['Sustained Energy', 'Mental Focus', 'Pre-Workout Boost', 'Mood Support'],
    ingredients: ['Hydrolyzed Beef Protein', 'Coffee Extract', 'Cocoa Powder', 'L-Theanine', 'Natural Mocha Flavor'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (33g)', 'mocha beef protein'),
        m(1, 'cup', 'cold brew coffee'),
        m(2, 'tbsp', 'cream or milk alternative'),
        m(1, 'tsp', 'cocoa powder'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Brew coffee and let cool completely',
        'Blend coffee with beef protein and cocoa',
        'Add cream and blend until frothy'
      ]
    }
  },
  {
    id: 'beef-6',
    name: 'Tropical Beef Fusion',
    description: 'Creamy peanut butter casein for sustained nourishment',
    flavor: 'Pina Colada',
    protein: 24,
    carbs: 7,
    calories: 135,
    creatine: 0.38,
    iron: 3.2,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 198,
    trending: false,
    featured: true,
    price: 49.99,
    bestTime: 'Any Time',
    fitnessGoal: 'General Wellness',
    absorptionTime: '60-90 minutes',
    leucineContent: '1.8g',
    tags: ['Electrolyte Balance', 'Hydration', 'Tropical Taste', 'Digestive Support'],
    benefits: ['Electrolyte Balance', 'Digestive Support', 'Tropical Taste', 'Hydration'],
    ingredients: ['Beef Protein Isolate', 'Pineapple Extract', 'Coconut Cream Powder', 'Natural Flavors', 'Sea Salt'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (29g)', 'tropical beef protein'),
        m(1, 'cup', 'coconut water'),
        m(0.25, 'cup', 'pineapple chunks, frozen'),
        m(1, 'tsp', 'coconut cream powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend beef protein with coconut water',
        'Add frozen pineapple and coconut cream',
        'Blend until tropical smoothie consistency'
      ]
    }
  }
];
