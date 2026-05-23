import type { MealSemanticProfile, MealSemanticTag } from './semanticTypes';

const KEYWORD_MAP: Array<{ pattern: RegExp; tags: MealSemanticTag[]; weight?: number }> = [
  { pattern: /soup|ramen|stew|broth/i, tags: ['cozy', 'restorative', 'recovery-friendly', 'comfort'], weight: 0.9 },
  { pattern: /bowl/i, tags: ['modular', 'routine-friendly', 'batch-friendly'], weight: 0.8 },
  { pattern: /salad|grilled/i, tags: ['fresh', 'light', 'energizing'], weight: 0.8 },
  { pattern: /casserole|bake|lasagna|mac/i, tags: ['heavy', 'comfort', 'cozy', 'prep-heavy'], weight: 0.85 },
  { pattern: /smoothie|shake/i, tags: ['low-effort', 'recovery-friendly', 'light'], weight: 0.85 },
  { pattern: /taco|charcuterie|platter|board/i, tags: ['social', 'modular', 'novelty-oriented'], weight: 0.8 },
];

export const classifyMealSemantics = (meal: any): MealSemanticTag[] => {
  const text = `${meal?.title || meal?.name || ''} ${meal?.description || ''}`;
  const tags = new Set<MealSemanticTag>();
  KEYWORD_MAP.forEach(({ pattern, tags: mapped }) => {
    if (pattern.test(text)) mapped.forEach((tag) => tags.add(tag));
  });

  if (Number(meal?.mealItems?.length || 0) >= 7) tags.add('prep-heavy');
  if (Number(meal?.mealItems?.length || 0) <= 3) tags.add('low-effort');
  if (meal?.leftoverFriendly || meal?.prepFriendly) tags.add('batch-friendly');
  if (!tags.size) tags.add('routine-friendly');
  return Array.from(tags);
};

export const deriveSemanticMealIdentity = (tags: MealSemanticTag[]): string => {
  if (tags.includes('comfort') && tags.includes('recovery-friendly')) return 'comfort-recovery anchor';
  if (tags.includes('fresh') && tags.includes('light')) return 'fresh-light stabilizer';
  if (tags.includes('social')) return 'social-flex meal';
  if (tags.includes('modular')) return 'modular continuity meal';
  if (tags.includes('heavy')) return 'hearty comfort meal';
  return 'routine stability meal';
};

export const deriveMealSemanticProfile = (meal: any): MealSemanticProfile => {
  const tags = classifyMealSemantics(meal);
  const semanticWeights = Object.fromEntries(tags.map((tag) => [tag, 0.5])) as MealSemanticProfile['semanticWeights'];
  const text = `${meal?.title || meal?.name || ''} ${meal?.description || ''}`;
  KEYWORD_MAP.forEach(({ pattern, tags: mapped, weight = 0.7 }) => {
    if (pattern.test(text)) mapped.forEach((tag) => { semanticWeights[tag] = Math.max(semanticWeights[tag] || 0, weight); });
  });

  const confidence = Math.min(1, 0.45 + tags.length * 0.08);
  return {
    tags,
    semanticWeights,
    confidence,
    identity: deriveSemanticMealIdentity(tags),
  };
};
