import { type AutoPlannerMode } from './autoPlannerTypes';

export type PlannerSlotContext = {
  day: string;
  mealType: string;
  dayIndex: number;
  isLateWeek: boolean;
  mode: AutoPlannerMode;
};

export const deriveSlotContext = (day: string, mealType: string, dayIndex: number, weekLength: number, mode: AutoPlannerMode): PlannerSlotContext => ({
  day,
  mealType: String(mealType || '').toLowerCase(),
  dayIndex,
  isLateWeek: dayIndex >= Math.floor(weekLength * 0.6),
  mode,
});

export const analyzeProteinDistribution = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  return weekDays.map((d) => mealTypes.reduce((acc, m) => {
    const arr = Array.isArray(weeklyMeals?.[d]?.[m]) ? weeklyMeals[d][m] : weeklyMeals?.[d]?.[m] ? [weeklyMeals[d][m]] : [];
    return acc + arr.reduce((s: number, it: any) => s + Number(it?.protein || 0), 0);
  }, 0));
};

export const analyzeCalorieDistribution = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  return weekDays.map((d) => mealTypes.reduce((acc, m) => {
    const arr = Array.isArray(weeklyMeals?.[d]?.[m]) ? weeklyMeals[d][m] : weeklyMeals?.[d]?.[m] ? [weeklyMeals[d][m]] : [];
    return acc + arr.reduce((s: number, it: any) => s + Number(it?.calories || it?.kcal || 0), 0);
  }, 0));
};

const variancePenalty = (values: number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (!mean) return 0;
  const variance = values.reduce((acc, v) => acc + ((v - mean) ** 2), 0) / values.length;
  return Math.min(100, (Math.sqrt(variance) / mean) * 100);
};

export const calculateMacroBalanceScore = (proteinByDay: number[], caloriesByDay: number[]) => {
  const proteinPenalty = variancePenalty(proteinByDay);
  const caloriesPenalty = variancePenalty(caloriesByDay);
  return Math.max(0, Math.round(100 - ((proteinPenalty * 0.6) + (caloriesPenalty * 0.4))));
};
