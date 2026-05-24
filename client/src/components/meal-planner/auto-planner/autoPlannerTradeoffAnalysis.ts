import { analyzeCalorieDistribution, analyzeProteinDistribution, calculateMacroBalanceScore } from './autoPlannerContextAnalysis';
import { calculateGroceryFragmentation, calculateIngredientOverlapScore, calculateMealFatigueScore, calculatePantryReuseEfficiency, calculateWeeklyPlannerStress } from './autoPlannerMetrics';
import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import { calculateMealComplexity } from '../planner-graph/plannerComplexity';

const gatherMeals = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => (
  weekDays.flatMap((day) => mealTypes.flatMap((mealType) => getMealsForSlot(weeklyMeals, day, mealType))).filter(Boolean)
);

export const calculateRecoverySpacing = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const dayStress = weekDays.map((d) => mealTypes.reduce((acc, mealType) => {
    const meals = getMealsForSlot(weeklyMeals, d, mealType);
    return acc + meals.reduce((sum, meal) => sum + Math.max(1, calculateMealComplexity(meal)), 0);
  }, 0));
  const heavyThreshold = Math.max(3, Math.round(dayStress.reduce((a, b) => a + b, 0) / Math.max(1, dayStress.length)));
  let penalties = 0;
  for (let i = 1; i < dayStress.length; i += 1) {
    if (dayStress[i] >= heavyThreshold && dayStress[i - 1] >= heavyThreshold) penalties += 1;
  }
  return Math.max(0, 100 - penalties * 20);
};

export const calculateWeeklyBalanceScore = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const stress = calculateWeeklyPlannerStress(weeklyMeals, weekDays, mealTypes);
  const recoverySpacing = calculateRecoverySpacing(weeklyMeals, weekDays, mealTypes);
  return Math.max(0, Math.min(100, Math.round((100 - Math.min(100, stress * 5)) * 0.6 + recoverySpacing * 0.4)));
};

export const calculateAdvancedFatigueScore = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const meals = gatherMeals(weeklyMeals, weekDays, mealTypes);
  const baseFatigue = calculateMealFatigueScore(meals);
  const prepTypeMap = new Map<string, number>();
  meals.forEach((meal) => {
    const prepType = String(meal?.prepStyle || meal?.cookingMethod || meal?.texture || '').toLowerCase();
    if (!prepType) return;
    prepTypeMap.set(prepType, (prepTypeMap.get(prepType) || 0) + 1);
  });
  const prepRepetition = Array.from(prepTypeMap.values()).filter((count) => count >= 3).length;
  return Math.min(100, baseFatigue + prepRepetition * 8);
};

export const detectMealPatternRepetition = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const meals = gatherMeals(weeklyMeals, weekDays, mealTypes);
  const repeatedNames = new Map<string, number>();
  meals.forEach((meal) => {
    const key = String(meal?.name || '').toLowerCase().trim();
    if (!key) return;
    repeatedNames.set(key, (repeatedNames.get(key) || 0) + 1);
  });
  return Array.from(repeatedNames.entries()).filter(([, count]) => count >= 2);
};

export const analyzeWeeklyVarietyRhythm = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const repetition = detectMealPatternRepetition(weeklyMeals, weekDays, mealTypes).length;
  const overlap = calculateIngredientOverlapScore(gatherMeals(weeklyMeals, weekDays, mealTypes));
  return Math.max(0, Math.min(100, 100 - repetition * 10 - Math.max(0, overlap - 55)));
};

export const calculateTradeoffPenalty = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const fatigue = calculateAdvancedFatigueScore(weeklyMeals, weekDays, mealTypes);
  const fragmentation = calculateGroceryFragmentation(gatherMeals(weeklyMeals, weekDays, mealTypes));
  const pantry = calculatePantryReuseEfficiency(gatherMeals(weeklyMeals, weekDays, mealTypes));
  const pantryFatigueTension = pantry > 60 ? Math.max(0, fatigue - 50) : 0;
  return Math.round((fatigue * 0.35) + (fragmentation * 0.35) + (pantryFatigueTension * 0.3));
};

export const calculateCompositeOptimizationScore = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const protein = analyzeProteinDistribution(weeklyMeals, weekDays, mealTypes);
  const calories = analyzeCalorieDistribution(weeklyMeals, weekDays, mealTypes);
  const macro = calculateMacroBalanceScore(protein, calories);
  const pantry = calculatePantryReuseEfficiency(gatherMeals(weeklyMeals, weekDays, mealTypes));
  const fragmentation = 100 - calculateGroceryFragmentation(gatherMeals(weeklyMeals, weekDays, mealTypes));
  const fatigue = 100 - calculateAdvancedFatigueScore(weeklyMeals, weekDays, mealTypes);
  const weeklyBalance = calculateWeeklyBalanceScore(weeklyMeals, weekDays, mealTypes);
  const variety = analyzeWeeklyVarietyRhythm(weeklyMeals, weekDays, mealTypes);
  const tradeoffPenalty = calculateTradeoffPenalty(weeklyMeals, weekDays, mealTypes);

  return Math.max(0, Math.min(100, Math.round(
    macro * 0.2 + pantry * 0.12 + fragmentation * 0.14 + fatigue * 0.16 + weeklyBalance * 0.18 + variety * 0.2 - tradeoffPenalty * 0.12,
  )));
};

export const deriveOptimizationTradeoffs = (before: Record<string, any>, after: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const messages: string[] = [];
  const pantryDelta = calculatePantryReuseEfficiency(gatherMeals(after, weekDays, mealTypes)) - calculatePantryReuseEfficiency(gatherMeals(before, weekDays, mealTypes));
  const fatigueDelta = calculateAdvancedFatigueScore(after, weekDays, mealTypes) - calculateAdvancedFatigueScore(before, weekDays, mealTypes);
  const stressDelta = calculateWeeklyPlannerStress(after, weekDays, mealTypes) - calculateWeeklyPlannerStress(before, weekDays, mealTypes);
  const groceryDelta = calculateGroceryFragmentation(gatherMeals(after, weekDays, mealTypes)) - calculateGroceryFragmentation(gatherMeals(before, weekDays, mealTypes));

  if (pantryDelta > 0 && fatigueDelta <= 5) messages.push('Pantry reuse increased while maintaining acceptable variety.');
  if (stressDelta < 0 && groceryDelta <= 4) messages.push('Prep stress reduced with only minimal grocery fragmentation increase.');
  if (fatigueDelta <= 0 && groceryDelta <= 0) messages.push('Ingredient overlap improved without increasing meal repetition.');

  return messages;
};
