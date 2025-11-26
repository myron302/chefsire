/**
 * Comprehensive pet food image mappings using curated Unsplash URLs
 * This file provides high-quality images for all pet food categories
 */

// Fallback images for when specific images are not available
export const PET_FOOD_FALLBACK_IMAGES = {
  default: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&h=400&fit=crop',
  dogs: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop',
  cats: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=400&fit=crop',
  birds: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600&h=400&fit=crop',
  smallPets: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600&h=400&fit=crop',
} as const;

// =============================================================================
// PET CATEGORY IMAGES - Main category hero images
// =============================================================================
export const PET_CATEGORY_IMAGES = {
  dogs: {
    hero: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=100&h=100&fit=crop',
  },
  cats: {
    hero: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=100&h=100&fit=crop',
  },
  birds: {
    hero: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=100&h=100&fit=crop',
  },
  smallPets: {
    hero: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600&h=400&fit=crop',
    banner: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=1600&h=400&fit=crop',
    icon: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=100&h=100&fit=crop',
  },
} as const;

// =============================================================================
// DOG FOOD IMAGES - By life stage and recipe type
// =============================================================================
export const DOG_FOOD_IMAGES = {
  lifeStages: {
    puppy: {
      hero: 'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?w=600&h=400&fit=crop',
    },
    adult: {
      hero: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop',
    },
    senior: {
      hero: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=600&h=400&fit=crop',
    },
  },
  mealTypes: {
    chickenRice: {
      image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=150&fit=crop',
    },
    beefVegetables: {
      image: 'https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?w=200&h=150&fit=crop',
    },
    salmonSweet: {
      image: 'https://images.unsplash.com/photo-1530041686697-3defa45c8788?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1530041686697-3defa45c8788?w=200&h=150&fit=crop',
    },
    turkeyQuinoa: {
      image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=150&fit=crop',
    },
    lambBarley: {
      image: 'https://images.unsplash.com/photo-1600804340584-c7db2eacf0bf?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1600804340584-c7db2eacf0bf?w=200&h=150&fit=crop',
    },
    porkApple: {
      image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=200&h=150&fit=crop',
    },
    organVitamin: {
      image: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=200&h=150&fit=crop',
    },
    fishOmega: {
      image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=150&fit=crop',
    },
  },
  treats: {
    peanutButter: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
    bacon: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop',
    carrot: 'https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?w=400&h=300&fit=crop',
    dental: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
  },
  specialDiets: {
    weightManagement: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
    allergyFriendly: 'https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?w=400&h=300&fit=crop',
    jointHealth: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400&h=300&fit=crop',
    digestive: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
  },
} as const;

// =============================================================================
// CAT FOOD IMAGES - By life stage and recipe type
// =============================================================================
export const CAT_FOOD_IMAGES = {
  lifeStages: {
    kitten: {
      hero: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=600&h=400&fit=crop',
    },
    adult: {
      hero: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=400&fit=crop',
    },
    senior: {
      hero: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600&h=400&fit=crop',
    },
  },
  mealTypes: {
    salmonTuna: {
      image: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=200&h=150&fit=crop',
    },
    chickenLiver: {
      image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=150&fit=crop',
    },
    turkeyGiblets: {
      image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=200&h=150&fit=crop',
    },
    beefHeart: {
      image: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=200&h=150&fit=crop',
    },
    rabbitDuck: {
      image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=150&fit=crop',
    },
    whitefishShrimp: {
      image: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=200&h=150&fit=crop',
    },
    organBlend: {
      image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=200&h=150&fit=crop',
    },
    sardineAnchovy: {
      image: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=200&h=150&fit=crop',
    },
  },
  treats: {
    freeze_dried: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop',
    catnip: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
    dental: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=400&h=300&fit=crop',
  },
  specialDiets: {
    hairball: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop',
    urinary: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
    indoor: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=400&h=300&fit=crop',
    weight: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=400&h=300&fit=crop',
  },
} as const;

// =============================================================================
// BIRD FOOD IMAGES - By species type and food type
// =============================================================================
export const BIRD_FOOD_IMAGES = {
  species: {
    parrot: {
      hero: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600&h=400&fit=crop',
    },
    canary: {
      hero: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=600&h=400&fit=crop',
    },
    finch: {
      hero: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?w=600&h=400&fit=crop',
    },
    cockatiel: {
      hero: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=600&h=400&fit=crop',
    },
  },
  foodTypes: {
    seedMix: {
      image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=200&h=150&fit=crop',
    },
    pellets: {
      image: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=200&h=150&fit=crop',
    },
    fruitTreats: {
      image: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?w=200&h=150&fit=crop',
    },
    vegetableMix: {
      image: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=200&h=150&fit=crop',
    },
    nutMix: {
      image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=200&h=150&fit=crop',
    },
    sproutMix: {
      image: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=200&h=150&fit=crop',
    },
    eggFood: {
      image: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?w=200&h=150&fit=crop',
    },
    mineralBlock: {
      image: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=200&h=150&fit=crop',
    },
  },
} as const;

// =============================================================================
// SMALL PET FOOD IMAGES - By species type and food type
// =============================================================================
export const SMALL_PET_FOOD_IMAGES = {
  species: {
    rabbit: {
      hero: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600&h=400&fit=crop',
    },
    guineaPig: {
      hero: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&h=400&fit=crop',
    },
    hamster: {
      hero: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=600&h=400&fit=crop',
    },
    gerbil: {
      hero: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=600&h=400&fit=crop',
    },
    chinchilla: {
      hero: 'https://images.unsplash.com/photo-1617791160588-241658c0f566?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1617791160588-241658c0f566?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1617791160588-241658c0f566?w=600&h=400&fit=crop',
    },
    ferret: {
      hero: 'https://images.unsplash.com/photo-1588019314444-63b5f6da7ab3?w=1200&h=600&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1588019314444-63b5f6da7ab3?w=300&h=200&fit=crop',
      card: 'https://images.unsplash.com/photo-1588019314444-63b5f6da7ab3?w=600&h=400&fit=crop',
    },
  },
  foodTypes: {
    hay: {
      image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=200&h=150&fit=crop',
    },
    pellets: {
      image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=200&h=150&fit=crop',
    },
    vegetables: {
      image: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=200&h=150&fit=crop',
    },
    fruits: {
      image: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=200&h=150&fit=crop',
    },
    treats: {
      image: 'https://images.unsplash.com/photo-1617791160588-241658c0f566?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1617791160588-241658c0f566?w=200&h=150&fit=crop',
    },
    herbs: {
      image: 'https://images.unsplash.com/photo-1588019314444-63b5f6da7ab3?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1588019314444-63b5f6da7ab3?w=200&h=150&fit=crop',
    },
    vitaminC: {
      image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=200&h=150&fit=crop',
    },
    seedMix: {
      image: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400&h=300&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=200&h=150&fit=crop',
    },
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get pet category image by category and size
 */
export function getPetCategoryImage(
  category: keyof typeof PET_CATEGORY_IMAGES,
  size: 'hero' | 'thumbnail' | 'card' | 'banner' | 'icon' = 'card'
): string {
  return PET_CATEGORY_IMAGES[category]?.[size] ?? PET_FOOD_FALLBACK_IMAGES.default;
}

/**
 * Get dog food image by life stage
 */
export function getDogLifeStageImage(
  stage: keyof typeof DOG_FOOD_IMAGES.lifeStages,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return DOG_FOOD_IMAGES.lifeStages[stage]?.[size] ?? PET_FOOD_FALLBACK_IMAGES.dogs;
}

/**
 * Get cat food image by life stage
 */
export function getCatLifeStageImage(
  stage: keyof typeof CAT_FOOD_IMAGES.lifeStages,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return CAT_FOOD_IMAGES.lifeStages[stage]?.[size] ?? PET_FOOD_FALLBACK_IMAGES.cats;
}

/**
 * Get bird species image
 */
export function getBirdSpeciesImage(
  species: keyof typeof BIRD_FOOD_IMAGES.species,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return BIRD_FOOD_IMAGES.species[species]?.[size] ?? PET_FOOD_FALLBACK_IMAGES.birds;
}

/**
 * Get small pet species image
 */
export function getSmallPetSpeciesImage(
  species: keyof typeof SMALL_PET_FOOD_IMAGES.species,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return SMALL_PET_FOOD_IMAGES.species[species]?.[size] ?? PET_FOOD_FALLBACK_IMAGES.smallPets;
}

// Type exports for TypeScript users
export type PetCategory = keyof typeof PET_CATEGORY_IMAGES;
export type DogLifeStage = keyof typeof DOG_FOOD_IMAGES.lifeStages;
export type DogMealType = keyof typeof DOG_FOOD_IMAGES.mealTypes;
export type CatLifeStage = keyof typeof CAT_FOOD_IMAGES.lifeStages;
export type CatMealType = keyof typeof CAT_FOOD_IMAGES.mealTypes;
export type BirdSpecies = keyof typeof BIRD_FOOD_IMAGES.species;
export type BirdFoodType = keyof typeof BIRD_FOOD_IMAGES.foodTypes;
export type SmallPetSpecies = keyof typeof SMALL_PET_FOOD_IMAGES.species;
export type SmallPetFoodType = keyof typeof SMALL_PET_FOOD_IMAGES.foodTypes;
