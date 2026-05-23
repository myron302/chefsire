import { deriveMealSemanticProfile } from './semanticMealIdentity';

export const calculateSemanticVarietyScore = (meals: any[]): number => {
  if (!meals.length) return 0;
  const universe = new Set<string>();
  meals.forEach((meal) => deriveMealSemanticProfile(meal).tags.forEach((tag) => universe.add(tag)));
  return Math.min(100, Math.round((universe.size / 12) * 100));
};

export const detectSemanticFatigue = (meals: any[]): string[] => {
  const counts: Record<string, number> = {};
  meals.forEach((meal) => deriveMealSemanticProfile(meal).tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
  const fatigue: string[] = [];
  if ((counts.cozy || 0) >= 4 && (counts.heavy || 0) >= 4) fatigue.push('Too many cozy/heavy meals may raise fatigue risk.');
  if ((counts.comfort || 0) >= 5 && (counts.fresh || 0) <= 1) fatigue.push('Comfort dominance detected; inject fresh/light meals.');
  if ((counts['routine-friendly'] || 0) >= 6 && (counts['novelty-oriented'] || 0) <= 1) fatigue.push('Routine cadence is high; add novelty to reduce boredom.');
  return fatigue;
};

export const deriveSemanticMealBalance = (meals: any[]): string[] => {
  const counts: Record<string, number> = {};
  meals.forEach((meal) => deriveMealSemanticProfile(meal).tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
  const notes: string[] = [];
  if ((counts['recovery-friendly'] || 0) >= 2) notes.push('Recovery-friendly coverage is present across the week.');
  if ((counts.social || 0) >= 1) notes.push('Social meal anchors support adherence flexibility.');
  if ((counts.light || 0) > (counts.heavy || 0)) notes.push('Light-vs-heavy balance favors lower weeknight load.');
  else notes.push('Hearty meal load is elevated; protect post-work recovery slots.');
  return notes;
};
