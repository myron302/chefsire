/**
 * Image Constants Index
 * 
 * This file exports all image constants for easy importing.
 * Use these curated Unsplash URLs for consistent, high-quality imagery
 * throughout the application.
 * 
 * @example
 * // Import specific image constants
 * import { DRINK_HUB_IMAGES, getDrinkImage } from '@/constants/images';
 * 
 * // Use the image constant directly
 * const smoothieHero = DRINK_HUB_IMAGES.smoothies.hero;
 * 
 * // Or use the helper function
 * const smoothieCard = getDrinkImage('smoothies', 'card');
 */

// Drink Images
export {
  DRINK_FALLBACK_IMAGES,
  DRINK_HUB_IMAGES,
  SMOOTHIE_IMAGES,
  CAFFEINATED_IMAGES,
  PROTEIN_SHAKE_IMAGES,
  POTENT_POTABLES_IMAGES,
  getDrinkImage,
  getSmoothieImage,
  getCaffeinatedImage,
  getProteinShakeImage,
  getPotentPotablesImage,
  type DrinkHubCategory,
  type SmoothieCategory,
  type CaffeinatedCategory,
  type ProteinShakeCategory,
  type PotentPotablesCategory,
} from './drink-images';

// Pet Food Images
export {
  PET_FOOD_FALLBACK_IMAGES,
  PET_CATEGORY_IMAGES,
  DOG_FOOD_IMAGES,
  CAT_FOOD_IMAGES,
  BIRD_FOOD_IMAGES,
  SMALL_PET_FOOD_IMAGES,
  getPetCategoryImage,
  getDogLifeStageImage,
  getCatLifeStageImage,
  getBirdSpeciesImage,
  getSmallPetSpeciesImage,
  type PetCategory,
  type DogLifeStage,
  type DogMealType,
  type CatLifeStage,
  type CatMealType,
  type BirdSpecies,
  type BirdFoodType,
  type SmallPetSpecies,
  type SmallPetFoodType,
} from './pet-food-images';

// Baby Food Images
export {
  BABY_FOOD_FALLBACK_IMAGES,
  BABY_AGE_STAGE_IMAGES,
  PUREE_IMAGES,
  MASHED_FOOD_IMAGES,
  FINGER_FOOD_IMAGES,
  TODDLER_MEAL_IMAGES,
  ALLERGEN_IMAGES,
  getBabyAgeStageImage,
  getPureeImage,
  getFingerFoodImage,
  getToddlerMealImage,
  getAllergenImage,
  type BabyAgeStage,
  type PureeCategory,
  type MashedFoodCategory,
  type FingerFoodCategory,
  type ToddlerMealCategory,
  type AllergenType,
} from './baby-food-images';

/**
 * Generic fallback image for any category
 */
export const GENERIC_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&h=400&fit=crop';

/**
 * Get an image URL with specific dimensions
 * Useful for customizing Unsplash image sizes on the fly
 */
export function getUnsplashImageWithSize(
  baseUrl: string,
  width: number,
  height: number,
  fit: 'crop' | 'fill' | 'scale' = 'crop'
): string {
  // Extract the base URL without query params
  const urlWithoutParams = baseUrl.split('?')[0];
  return `${urlWithoutParams}?w=${width}&h=${height}&fit=${fit}`;
}

/**
 * Get a responsive image set for srcset attribute
 */
export function getResponsiveImageSet(
  baseUrl: string,
  sizes: { width: number; height: number }[]
): string {
  return sizes
    .map(({ width, height }) => `${getUnsplashImageWithSize(baseUrl, width, height)} ${width}w`)
    .join(', ');
}
