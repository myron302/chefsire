import type { NutritionTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';
import { createDefaultTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';

const STORAGE_KEY = 'mealPlanner.temporalRhythmIntelligence.v1';
const MAX_SERIALIZED_LENGTH = 24_000;

const hasWindow = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeProfile = (input: unknown): NutritionTemporalRhythmProfile | null => {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<NutritionTemporalRhythmProfile>;
  if (typeof candidate.rhythmStabilityScore !== 'number' || typeof candidate.temporalConfidence !== 'number') return null;
  return {
    ...createDefaultTemporalRhythmProfile(),
    ...candidate,
    evolutionVersion: typeof candidate.evolutionVersion === 'number' ? candidate.evolutionVersion : 1,
    lastUpdatedAt: typeof candidate.lastUpdatedAt === 'string' ? candidate.lastUpdatedAt : new Date().toISOString(),
  };
};

export const getTemporalRhythmProfile = (): NutritionTemporalRhythmProfile | null => {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_SERIALIZED_LENGTH) return null;
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveTemporalRhythmProfile = (profile: NutritionTemporalRhythmProfile): NutritionTemporalRhythmProfile => {
  if (!hasWindow()) return profile;
  try {
    const serialized = JSON.stringify(profile);
    if (serialized.length <= MAX_SERIALIZED_LENGTH) {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch {
    // graceful fallback
  }
  return profile;
};
