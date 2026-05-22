import type { LongitudinalPlanningSnapshot } from '../planner-adaptation/adaptationTypes';
import type { ScheduleVolatilityProfile } from './personalityTypes';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const calculateWeeklyStabilityMap = (history: LongitudinalPlanningSnapshot[]) => {
  const baseStability = clamp(1 - history.reduce((sum, entry) => sum + entry.lateWeekDropoff, 0) / Math.max(1, history.length));
  return dayOrder.reduce<Record<string, number>>((acc, day, idx) => {
    const lateWeekPenalty = idx >= 4 ? 0.15 : 0;
    const midWeekVolatility = day === 'wednesday' ? 0.1 : 0;
    acc[day] = clamp(baseStability - lateWeekPenalty - midWeekVolatility);
    return acc;
  }, {});
};

export const detectVolatilePlanningZones = (stabilityMap: Record<string, number>) =>
  Object.entries(stabilityMap).filter(([, stability]) => stability < 0.55).map(([day]) => day);

export const deriveScheduleVolatilityProfile = (history: LongitudinalPlanningSnapshot[]): ScheduleVolatilityProfile => {
  const weeklyStabilityMap = calculateWeeklyStabilityMap(history);
  const volatilePlanningZones = detectVolatilePlanningZones(weeklyStabilityMap);
  const scheduleVolatility = clamp(1 - Object.values(weeklyStabilityMap).reduce((sum, value) => sum + value, 0) / dayOrder.length);
  const sundayResetStrength = weeklyStabilityMap.sunday || 0.5;
  return { weeklyStabilityMap, volatilePlanningZones, scheduleVolatility, sundayResetStrength };
};
