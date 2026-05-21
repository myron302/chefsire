import { calculateDailyPrepStress } from './autoPlannerOptimizationEngine';

export type DayRhythmProfile = {
  day: string;
  dayIndex: number;
  isWeekend: boolean;
  likelyBusyEvening: boolean;
  prepFriendly: boolean;
  recoveryOriented: boolean;
  lifecyclePhase: 'early-week' | 'mid-week' | 'late-week';
};

export type DailyLifestyleLoad = {
  day: string;
  prepLoad: number;
  mealCount: number;
  stressLoad: number;
  workdayIntensity: number;
  lifestyleLoad: number;
};

export const deriveDayRhythmProfile = (day: string, dayIndex: number, weekLength: number): DayRhythmProfile => {
  const normalizedDay = String(day || '').toLowerCase();
  const isWeekend = normalizedDay.includes('sat') || normalizedDay.includes('sun') || dayIndex >= 5;
  const lifecyclePhase: DayRhythmProfile['lifecyclePhase'] = dayIndex >= Math.max(0, weekLength - 2) ? 'late-week' : dayIndex >= 2 ? 'mid-week' : 'early-week';
  const likelyBusyEvening = !isWeekend && (normalizedDay.includes('mon') || normalizedDay.includes('tue') || normalizedDay.includes('thu'));
  const prepFriendly = isWeekend || normalizedDay.includes('sun');
  const recoveryOriented = isWeekend || lifecyclePhase === 'late-week';
  return { day, dayIndex, isWeekend, likelyBusyEvening, prepFriendly, recoveryOriented, lifecyclePhase };
};

export const calculateDailyLifestyleLoad = (day: string, dayMeals: any[], rhythm: DayRhythmProfile): DailyLifestyleLoad => {
  const prepLoad = calculateDailyPrepStress(dayMeals);
  const mealCount = dayMeals.length;
  const stressLoad = Math.round(prepLoad + (rhythm.likelyBusyEvening ? 4 : 0) + (rhythm.isWeekend ? -2 : 2));
  const workdayIntensity = Math.max(0, Math.min(10, Math.round((stressLoad / Math.max(1, mealCount || 1)) + (rhythm.isWeekend ? -2 : 2))));
  const lifestyleLoad = Math.max(0, Math.round(stressLoad + (rhythm.lifecyclePhase === 'late-week' ? 3 : 0) - (rhythm.prepFriendly ? 2 : 0)));
  return { day, prepLoad, mealCount, stressLoad, workdayIntensity, lifestyleLoad };
};

export const classifyDayEnergyLevel = (lifestyleLoad: number): 'low' | 'medium' | 'high' => {
  if (lifestyleLoad >= 12) return 'low';
  if (lifestyleLoad >= 7) return 'medium';
  return 'high';
};
