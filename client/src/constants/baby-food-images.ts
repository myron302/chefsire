/**
 * Comprehensive baby food image mappings using curated Unsplash URLs
 * This file provides high-quality images for all baby food categories
 */

// Fallback images for when specific images are not available
export const BABY_FOOD_FALLBACK_IMAGES = {
  default: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=600&h=400&fit=crop',
  purees: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=600&h=400&fit=crop',
  mashed: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=600&h=400&fit=crop',
  fingerFoods: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=600&h=400&fit=crop',
  toddler: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop',
} as const;

// =============================================================================
// AGE STAGE IMAGES - Main category hero images
// =============================================================================
export const BABY_AGE_STAGE_IMAGES = {
  purees: {
    hero: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=100&h=100&fit=crop',
    description: 'First Foods (4-6 Months)',
  },
  mashed: {
    hero: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=100&h=100&fit=crop',
    description: 'Exploring Textures (6-8 Months)',
  },
  fingerFoods: {
    hero: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=100&h=100&fit=crop',
    description: 'Self-Feeding (8-12 Months)',
  },
  toddler: {
    hero: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=100&h=100&fit=crop',
    description: 'Toddler Meals (12+ Months)',
  },
} as const;

// =============================================================================
// PUREE IMAGES (4-6 MONTHS) - First foods for babies
// =============================================================================
export const PUREE_IMAGES = {
  vegetables: {
    sweetPotato: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
    carrot: {
      image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=200&h=150&fit=crop',
    },
    peas: {
      image: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=200&h=150&fit=crop',
    },
    squash: {
      image: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=200&h=150&fit=crop',
    },
    greenBeans: {
      image: 'https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=200&h=150&fit=crop',
    },
    zucchini: {
      image: 'https://images.unsplash.com/photo-1596073419667-9d77d59f033f?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1596073419667-9d77d59f033f?w=200&h=150&fit=crop',
    },
  },
  fruits: {
    banana: {
      image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=200&h=150&fit=crop',
    },
    apple: {
      image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=200&h=150&fit=crop',
    },
    pear: {
      image: 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?w=200&h=150&fit=crop',
    },
    avocado: {
      image: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=200&h=150&fit=crop',
    },
    peach: {
      image: 'https://images.unsplash.com/photo-1588929132626-46260f5c6582?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1588929132626-46260f5c6582?w=200&h=150&fit=crop',
    },
    mango: {
      image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=200&h=150&fit=crop',
    },
  },
  cereals: {
    rice: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
    oatmeal: {
      image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=200&h=150&fit=crop',
    },
    barley: {
      image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200&h=150&fit=crop',
    },
  },
} as const;

// =============================================================================
// MASHED FOOD IMAGES (6-8 MONTHS) - Thicker textures
// =============================================================================
export const MASHED_FOOD_IMAGES = {
  combinations: {
    bananaAvocado: {
      image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200&h=150&fit=crop',
    },
    appleCinnamon: {
      image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=200&h=150&fit=crop',
    },
    carrotGinger: {
      image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=200&h=150&fit=crop',
    },
    peasMint: {
      image: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=200&h=150&fit=crop',
    },
    berriesCereal: {
      image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=200&h=150&fit=crop',
    },
    chickenVeggies: {
      image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200&h=150&fit=crop',
    },
    fishPotato: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
    lentilsVeggies: {
      image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200&h=150&fit=crop',
    },
  },
  proteins: {
    chicken: {
      image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200&h=150&fit=crop',
    },
    turkey: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
    fish: {
      image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200&h=150&fit=crop',
    },
    egg: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
    lentils: {
      image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200&h=150&fit=crop',
    },
    tofu: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
  },
} as const;

// =============================================================================
// FINGER FOOD IMAGES (8-12 MONTHS) - Self-feeding foods
// =============================================================================
export const FINGER_FOOD_IMAGES = {
  softFoods: {
    bananaSlices: {
      image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=200&h=150&fit=crop',
    },
    avocadoWedges: {
      image: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=200&h=150&fit=crop',
    },
    steamedCarrots: {
      image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=200&h=150&fit=crop',
    },
    softPasta: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    cheeseSticks: {
      image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=200&h=150&fit=crop',
    },
    watermelonCubes: {
      image: 'https://images.unsplash.com/photo-1563114773-84221bd62daa?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1563114773-84221bd62daa?w=200&h=150&fit=crop',
    },
  },
  baked: {
    teethingBiscuits: {
      image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=200&h=150&fit=crop',
    },
    oatBites: {
      image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=200&h=150&fit=crop',
    },
    veggieMuffins: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    quinoaBites: {
      image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=200&h=150&fit=crop',
    },
    bananaPancakes: {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=150&fit=crop',
    },
    sweetPotatoFries: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
  },
  proteins: {
    meatballs: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    fishSticks: {
      image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=200&h=150&fit=crop',
    },
    eggStrips: {
      image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=200&h=150&fit=crop',
    },
    tofuCubes: {
      image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=200&h=150&fit=crop',
    },
  },
} as const;

// =============================================================================
// TODDLER MEAL IMAGES (12+ MONTHS) - Family meals
// =============================================================================
export const TODDLER_MEAL_IMAGES = {
  meals: {
    macAndCheese: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    chickenVeggies: {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=150&fit=crop',
    },
    spaghettiBolognese: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    fishFingers: {
      image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=200&h=150&fit=crop',
    },
    vegetableStir: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    shepherdsPie: {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=150&fit=crop',
    },
    quesadilla: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    friedRice: {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=150&fit=crop',
    },
  },
  snacks: {
    fruitPlatter: {
      image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=200&h=150&fit=crop',
    },
    veggieSticks: {
      image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=200&h=150&fit=crop',
    },
    yogurtBowl: {
      image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=200&h=150&fit=crop',
    },
    crackersCheese: {
      image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=200&h=150&fit=crop',
    },
    smoothie: {
      image: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=200&h=150&fit=crop',
    },
    homemadeGranola: {
      image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=200&h=150&fit=crop',
    },
  },
  breakfast: {
    oatmealBerries: {
      image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=200&h=150&fit=crop',
    },
    scrambledEggs: {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=150&fit=crop',
    },
    frenchToast: {
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop',
    },
    pancakes: {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=150&fit=crop',
    },
    smoothieBowl: {
      image: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=200&h=150&fit=crop',
    },
    avocadoToast: {
      image: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=200&h=150&fit=crop',
    },
  },
} as const;

// =============================================================================
// ALLERGEN INTRODUCTION IMAGES
// =============================================================================
export const ALLERGEN_IMAGES = {
  peanuts: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
  eggs: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
  dairy: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
  fish: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
  wheat: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
  treeNuts: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
  soy: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
  shellfish: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get baby food age stage image by stage and size
 */
export function getBabyAgeStageImage(
  stage: keyof typeof BABY_AGE_STAGE_IMAGES,
  size: 'hero' | 'thumbnail' | 'card' | 'banner' | 'icon' = 'card'
): string {
  return BABY_AGE_STAGE_IMAGES[stage]?.[size] ?? BABY_FOOD_FALLBACK_IMAGES.default;
}

/**
 * Get puree image by category and type
 */
export function getPureeImage(
  category: keyof typeof PUREE_IMAGES,
  type: string
): string {
  const categoryImages = PUREE_IMAGES[category];
  if (categoryImages && type in categoryImages) {
    return (categoryImages as Record<string, { image: string }>)[type]?.image ?? BABY_FOOD_FALLBACK_IMAGES.purees;
  }
  return BABY_FOOD_FALLBACK_IMAGES.purees;
}

/**
 * Get finger food image by category and type
 */
export function getFingerFoodImage(
  category: keyof typeof FINGER_FOOD_IMAGES,
  type: string
): string {
  const categoryImages = FINGER_FOOD_IMAGES[category];
  if (categoryImages && type in categoryImages) {
    return (categoryImages as Record<string, { image: string }>)[type]?.image ?? BABY_FOOD_FALLBACK_IMAGES.fingerFoods;
  }
  return BABY_FOOD_FALLBACK_IMAGES.fingerFoods;
}

/**
 * Get toddler meal image by category and type
 */
export function getToddlerMealImage(
  category: keyof typeof TODDLER_MEAL_IMAGES,
  type: string
): string {
  const categoryImages = TODDLER_MEAL_IMAGES[category];
  if (categoryImages && type in categoryImages) {
    return (categoryImages as Record<string, { image: string }>)[type]?.image ?? BABY_FOOD_FALLBACK_IMAGES.toddler;
  }
  return BABY_FOOD_FALLBACK_IMAGES.toddler;
}

/**
 * Get allergen image
 */
export function getAllergenImage(
  allergen: keyof typeof ALLERGEN_IMAGES
): string {
  return ALLERGEN_IMAGES[allergen] ?? BABY_FOOD_FALLBACK_IMAGES.default;
}

// Type exports for TypeScript users
export type BabyAgeStage = keyof typeof BABY_AGE_STAGE_IMAGES;
export type PureeCategory = keyof typeof PUREE_IMAGES;
export type MashedFoodCategory = keyof typeof MASHED_FOOD_IMAGES;
export type FingerFoodCategory = keyof typeof FINGER_FOOD_IMAGES;
export type ToddlerMealCategory = keyof typeof TODDLER_MEAL_IMAGES;
export type AllergenType = keyof typeof ALLERGEN_IMAGES;
