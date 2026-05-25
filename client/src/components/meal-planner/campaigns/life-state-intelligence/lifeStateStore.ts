import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';
import { createDefaultLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';

const STORAGE_KEY = 'mealPlanner.lifeStateIntelligence.v1';
const MAX_SERIALIZED_LENGTH = 20_000;

const hasWindow = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeProfile = (input: unknown): NutritionLifeStateProfile | null => {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<NutritionLifeStateProfile>;
  if (typeof candidate.scheduleVolatilityScore !== 'number' || typeof candidate.contextualConfidence !== 'number') return null;
  return {
    ...createDefaultLifeStateProfile(),
    ...candidate,
    evolutionVersion: typeof candidate.evolutionVersion === 'number' ? candidate.evolutionVersion : 1,
    lastUpdatedAt: typeof candidate.lastUpdatedAt === 'string' ? candidate.lastUpdatedAt : new Date().toISOString(),
  };
};

export const getLifeStateProfile = (): NutritionLifeStateProfile | null => {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    if (raw.length > MAX_SERIALIZED_LENGTH) return null;
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveLifeStateProfile = (profile: NutritionLifeStateProfile): NutritionLifeStateProfile => {
  if (!hasWindow()) return profile;
  try {
    const serialized = JSON.stringify(profile);
    if (serialized.length <= MAX_SERIALIZED_LENGTH) {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch {
    // preserve graceful fallback
  }
  return profile;
};
