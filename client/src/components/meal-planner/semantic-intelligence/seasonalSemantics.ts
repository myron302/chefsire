import { deriveMealSemanticProfile } from './semanticMealIdentity';

export const calculateMealEnergyProfile = (meal: any): 'low' | 'medium' | 'high' => {
  const complexity = Number(meal?.mealItems?.length || 0);
  if (complexity >= 7 || /roast|casserole|braise/i.test(`${meal?.title || meal?.name || ''}`)) return 'high';
  if (complexity <= 3 || /smoothie|salad|bowl/i.test(`${meal?.title || meal?.name || ''}`)) return 'low';
  return 'medium';
};

export const deriveSeasonalMealAffinity = (meal: any) => {
  const profile = deriveMealSemanticProfile(meal);
  const winter = (profile.tags.includes('cozy') ? 0.7 : 0.2) + (profile.tags.includes('heavy') ? 0.2 : 0);
  const summer = (profile.tags.includes('fresh') ? 0.7 : 0.2) + (profile.tags.includes('light') ? 0.2 : 0);
  const spring = (profile.tags.includes('energizing') ? 0.6 : 0.3);
  const fall = (profile.tags.includes('comfort') ? 0.6 : 0.3);
  return { spring: Number(spring.toFixed(2)), summer: Number(summer.toFixed(2)), fall: Number(fall.toFixed(2)), winter: Number(winter.toFixed(2)) };
};

export const deriveTemporalMealSemantics = (meal: any, mealType: string) => {
  const energy = calculateMealEnergyProfile(meal);
  return {
    weeknight: energy === 'low' ? 0.8 : 0.4,
    weekend: energy === 'high' ? 0.8 : 0.5,
    'post-work': energy === 'low' ? 0.85 : 0.35,
    'prep-window': meal?.prepFriendly || meal?.leftoverFriendly ? 0.85 : 0.45,
    mealType,
  };
};
