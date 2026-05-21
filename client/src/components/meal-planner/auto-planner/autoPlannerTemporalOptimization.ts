import { deriveDayRhythmProfile, calculateDailyLifestyleLoad, classifyDayEnergyLevel, type DayRhythmProfile } from './autoPlannerLifestyleAnalysis';

const mealComplexity = (meal: any) => Number(meal?.mealItems?.length || meal?.ingredients?.length || 1);

export const calculateMealEnergyFit = (meal: any, mealType: string, energyLevel: 'low' | 'medium' | 'high') => {
  const complexity = mealComplexity(meal);
  const morningPenalty = mealType === 'breakfast' ? Math.max(0, complexity - 4) : 0;
  const lowEnergyPenalty = energyLevel === 'low' ? Math.max(0, complexity - 5) : 0;
  const highEnergyBoost = energyLevel === 'high' ? Math.min(3, complexity) : 0;
  return Math.max(0, 100 - (morningPenalty * 8) - (lowEnergyPenalty * 6) + (highEnergyBoost * 2));
};

export const calculateRecoveryMealSupport = (meal: any, mealType: string, rhythm: DayRhythmProfile) => {
  const complexity = mealComplexity(meal);
  const isDinner = mealType === 'dinner';
  const recoveryBoost = rhythm.recoveryOriented && isDinner && complexity <= 5 ? 20 : 0;
  const overloadPenalty = rhythm.recoveryOriented && complexity >= 9 ? 20 : 0;
  return Math.max(0, Math.min(100, 50 + recoveryBoost - overloadPenalty));
};

export const analyzeWeeklyEnergyFlow = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const daily = weekDays.map((day, dayIndex) => {
    const rhythm = deriveDayRhythmProfile(day, dayIndex, weekDays.length);
    const meals = mealTypes.flatMap((mealType) => {
      const arr = Array.isArray(weeklyMeals?.[day]?.[mealType]) ? weeklyMeals[day][mealType] : weeklyMeals?.[day]?.[mealType] ? [weeklyMeals[day][mealType]] : [];
      return arr;
    }).filter(Boolean);
    const load = calculateDailyLifestyleLoad(day, meals, rhythm);
    const energyLevel = classifyDayEnergyLevel(load.lifestyleLoad);
    return { day, rhythm, load, energyLevel, meals };
  });

  const lateWeekLoad = daily.filter((d) => d.rhythm.lifecyclePhase === 'late-week').reduce((acc, d) => acc + d.load.lifestyleLoad, 0);
  const prepHeavyDinners = daily.reduce((acc, d) => {
    const dinners = Array.isArray(weeklyMeals?.[d.day]?.dinner) ? weeklyMeals[d.day].dinner : weeklyMeals?.[d.day]?.dinner ? [weeklyMeals[d.day].dinner] : [];
    const heavy = dinners.some((meal: any) => mealComplexity(meal) >= 8);
    return acc + (heavy ? 1 : 0);
  }, 0);

  return { daily, lateWeekLoad, prepHeavyDinners };
};
