import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';

const STORAGE_KEY = 'mealPlanner.behavioralIntelligence.v1';
const MAX_PATTERN_COUNT = 12;

const isBrowser = (): boolean => typeof window !== 'undefined' && Boolean(window.localStorage);

const capProfile = (profile: NutritionBehavioralIntelligenceProfile): NutritionBehavioralIntelligenceProfile => ({
  ...profile,
  successfulStrategyPatterns: profile.successfulStrategyPatterns.slice(-MAX_PATTERN_COUNT),
  failedStrategyPatterns: profile.failedStrategyPatterns.slice(-MAX_PATTERN_COUNT),
  remixPreferencePatterns: profile.remixPreferencePatterns.slice(-MAX_PATTERN_COUNT),
});

export const getBehavioralIntelligenceProfile = (): NutritionBehavioralIntelligenceProfile | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NutritionBehavioralIntelligenceProfile;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.lastUpdatedAt !== 'string' || typeof parsed.evolutionVersion !== 'number') return null;
    return capProfile(parsed);
  } catch {
    return null;
  }
};

export const saveBehavioralIntelligenceProfile = (profile: NutritionBehavioralIntelligenceProfile): NutritionBehavioralIntelligenceProfile => {
  const bounded = capProfile(profile);
  if (!isBrowser()) return bounded;
  try {
    window.localStorage.setItem(STORAGE_KEY, '{}');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // graceful fallback
  }
  return bounded;
};
