export const espressoDrinks = [
  {
    id: 'classic-espresso',
    name: 'Classic Espresso Shot',
    description: 'Pure, intense coffee flavor in a small shot',
    ingredients: [
      '1 shot espresso',
      '7 g coffee grounds'
    ],
    benefits: ['Quick energy', 'Mental clarity', 'Focus boost', 'Low calorie'],
    nutrition: { calories: 3, caffeine: 64, carbs: 0, sugar: 0, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 892,
    drinkType: 'Espresso',
    energyLevel: 'Moderate',
    featured: true,
    trending: false,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&h=300&fit=crop',
    estimatedCost: 0.50
  },
  {
    id: 'doppio',
    name: 'Doppio',
    description: 'Double shot of espresso for double the energy',
    ingredients: [
      '2 shots espresso',
      '14 g coffee grounds'
    ],
    benefits: ['High energy', 'Intense flavor', 'Quick caffeine', 'Alertness'],
    nutrition: { calories: 6, caffeine: 128, carbs: 0, sugar: 0, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 567,
    drinkType: 'Espresso',
    energyLevel: 'High',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 1.00
  },
  {
    id: 'macchiato',
    name: 'Espresso Macchiato',
    description: 'Espresso "marked" with a dollop of foamed milk',
    ingredients: [
      '1 shot espresso',
      '1 tbsp foamed milk'
    ],
    benefits: ['Smooth taste', 'Less intense', 'Balanced flavor', 'Creamy'],
    nutrition: { calories: 10, caffeine: 64, carbs: 1, sugar: 1, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 423,
    drinkType: 'Milk',
    energyLevel: 'Moderate',
    featured: true,
    trending: false,
    bestTime: 'Morning',
    estimatedCost: 1.25
  },
  {
    id: 'americano',
    name: 'Caffè Americano',
    description: 'Espresso diluted with hot water for a fuller cup',
    ingredients: [
      '2 shots espresso',
      '6 oz hot water'
    ],
    benefits: ['Sustained energy', 'Smooth flavor', 'Less intense', 'Hydrating'],
    nutrition: { calories: 6, caffeine: 128, carbs: 0, sugar: 0, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 789,
    drinkType: 'Espresso',
    energyLevel: 'Moderate',
    featured: false,
    trending: true,
    bestTime: 'Anytime',
    estimatedCost: 1.50
  },
  {
    id: 'ristretto',
    name: 'Ristretto',
    description: 'Short shot of espresso for concentrated flavor',
    ingredients: [
      '0.75 oz espresso',
      '7 g coffee grounds'
    ],
    benefits: ['Intense flavor', 'Less bitter', 'Smooth finish', 'Quick'],
    nutrition: { calories: 2, caffeine: 50, carbs: 0, sugar: 0, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 2,
    rating: 4.8,
    reviews: 345,
    drinkType: 'Espresso',
    energyLevel: 'Moderate',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    estimatedCost: 0.50
  },
  {
    id: 'lungo',
    name: 'Lungo',
    description: 'Long shot of espresso with more water',
    ingredients: [
      '2 oz espresso',
      '7 g coffee grounds'
    ],
    benefits: ['Milder taste', 'More volume', 'Balanced caffeine', 'Smooth'],
    nutrition: { calories: 4, caffeine: 80, carbs: 0, sugar: 0, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 234,
    drinkType: 'Espresso',
    energyLevel: 'Moderate',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    estimatedCost: 0.75
  },
  {
    id: 'cortado',
    name: 'Cortado',
    description: 'Equal parts espresso and steamed milk',
    ingredients: [
      '2 shots espresso',
      '2 oz steamed milk'
    ],
    benefits: ['Balanced', 'Creamy', 'Less acidic', 'Smooth'],
    nutrition: { calories: 45, caffeine: 128, carbs: 3, sugar: 3, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.9,
    reviews: 678,
    drinkType: 'Milk',
    energyLevel: 'High',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 2.00
  },
  {
    id: 'affogato',
    name: 'Affogato',
    description: 'Espresso poured over vanilla gelato',
    ingredients: [
      '1 shot espresso',
      '1 scoop vanilla gelato'
    ],
    benefits: ['Dessert drink', 'Sweet treat', 'Energy boost', 'Indulgent'],
    nutrition: { calories: 180, caffeine: 64, carbs: 24, sugar: 22, added_sugar: 18 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 456,
    drinkType: 'Dessert',
    energyLevel: 'Moderate',
    featured: false,
    trending: false,
    bestTime: 'Afternoon',
    estimatedCost: 3.50
  }
];
