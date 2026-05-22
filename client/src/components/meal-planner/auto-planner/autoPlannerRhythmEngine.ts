import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import { extractMealIngredients } from '../planner-graph/plannerMealExtraction';
import { calculateMealComplexity } from '../planner-graph/plannerComplexity';
import { analyzeWeeklyEnergyFlow, calculateMealEnergyFit, calculateRecoveryMealSupport } from './autoPlannerTemporalOptimization';
import { deriveDayRhythmProfile, classifyDayEnergyLevel } from './autoPlannerLifestyleAnalysis';

const ingredientList = (meal: any) => extractMealIngredients(meal).map((ingredient: any) => String(ingredient?.name || '').toLowerCase().trim()).filter(Boolean);

export const calculateMealShelfLifeWindow = (meal: any): 'fragile' | 'standard' | 'long-life' => {
  const names = ingredientList(meal);
  if (names.some((n) => /(berry|spinach|lettuce|fish|avocado|herb)/.test(n))) return 'fragile';
  if (names.some((n) => /(frozen|canned|beans|rice|pasta|lentil)/.test(n))) return 'long-life';
  return 'standard';
};

export const calculateLeftoverReusePotential = (meal: any) => {
  const complexity = Math.max(1, calculateMealComplexity(meal));
  const protein = Number(meal?.protein || 0);
  return Math.max(0, Math.min(100, (complexity >= 5 ? 35 : 15) + Math.min(40, protein)));
};

export const derivePrepWindowStrategy = (weekDays: readonly string[]) => {
  return weekDays.map((day, index) => {
    const rhythm = deriveDayRhythmProfile(day, index, weekDays.length);
    const prepWindowType = rhythm.prepFriendly ? 'batch-prep' : rhythm.likelyBusyEvening ? 'quick-assembly' : 'standard';
    return { day, prepWindowType };
  });
};

export const calculateIngredientFreshnessPressure = (dayIndex: number, shelfLife: 'fragile' | 'standard' | 'long-life') => {
  const base = shelfLife === 'fragile' ? 90 : shelfLife === 'standard' ? 55 : 20;
  return Math.max(0, Math.min(100, base - (dayIndex * (shelfLife === 'fragile' ? 15 : 8))));
};

export const analyzeGroceryLifecycle = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const entries: Array<{ day: string; dayIndex: number; shelfLife: 'fragile' | 'standard' | 'long-life'; freshnessPressure: number }> = [];
  weekDays.forEach((day, dayIndex) => mealTypes.forEach((mealType) => {
    const meals = getMealsForSlot(weeklyMeals, day, mealType);
    meals.forEach((meal: any) => {
      const shelfLife = calculateMealShelfLifeWindow(meal);
      entries.push({ day, dayIndex, shelfLife, freshnessPressure: calculateIngredientFreshnessPressure(dayIndex, shelfLife) });
    });
  }));
  return entries;
};

export const optimizeIngredientTiming = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const lifecycle = analyzeGroceryLifecycle(weeklyMeals, weekDays, mealTypes);
  const fragileLateWeek = lifecycle.filter((l) => l.shelfLife === 'fragile' && l.dayIndex >= Math.max(weekDays.length - 2, 0)).length;
  const fragileEarlyWeek = lifecycle.filter((l) => l.shelfLife === 'fragile' && l.dayIndex <= 2).length;
  return { lifecycle, fragileLateWeek, fragileEarlyWeek };
};

export const calculateTemporalMealFit = (meal: any, mealType: string, dayIndex: number, weekDays: readonly string[], lifestyleLoad: number) => {
  const rhythm = deriveDayRhythmProfile(weekDays[dayIndex], dayIndex, weekDays.length);
  const energy = classifyDayEnergyLevel(lifestyleLoad);
  const energyFit = calculateMealEnergyFit(meal, mealType, energy);
  const recoveryFit = calculateRecoveryMealSupport(meal, mealType, rhythm);
  const freshnessFit = calculateIngredientFreshnessPressure(dayIndex, calculateMealShelfLifeWindow(meal));
  return Math.round((energyFit * 0.45) + (recoveryFit * 0.25) + (freshnessFit * 0.30));
};

export const deriveLifestyleOptimizationSignals = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const energyFlow = analyzeWeeklyEnergyFlow(weeklyMeals, weekDays, mealTypes);
  const prepWindows = derivePrepWindowStrategy(weekDays);
  const ingredientTiming = optimizeIngredientTiming(weeklyMeals, weekDays, mealTypes);
  return { energyFlow, prepWindows, ingredientTiming };
};

export const optimizePrepTiming = (signals: ReturnType<typeof deriveLifestyleOptimizationSignals>) => {
  const batchDays = signals.prepWindows.filter((d) => d.prepWindowType === 'batch-prep').length;
  const quickDays = signals.prepWindows.filter((d) => d.prepWindowType === 'quick-assembly').length;
  return { batchDays, quickDays, recommended: batchDays >= 1 ? 'front-load prep on batch-prep days' : 'keep prep distributed evenly' };
};

export const optimizeFreshnessFlow = (signals: ReturnType<typeof deriveLifestyleOptimizationSignals>) => {
  const { fragileLateWeek, fragileEarlyWeek } = signals.ingredientTiming;
  return {
    fragileLateWeek,
    fragileEarlyWeek,
    improved: fragileLateWeek <= fragileEarlyWeek,
  };
};

export const optimizeWeeklyLifeRhythm = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const signals = deriveLifestyleOptimizationSignals(weeklyMeals, weekDays, mealTypes);
  const prepTiming = optimizePrepTiming(signals);
  const freshnessFlow = optimizeFreshnessFlow(signals);
  return { signals, prepTiming, freshnessFlow };
};
