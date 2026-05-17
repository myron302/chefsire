import type { NutritionCoachInsight, NutritionCoachScore } from '@/components/meal-planner/nutritionCoachUtils';

export const coachSeverityStyles: Record<NutritionCoachInsight['severity'], string> = {
  positive: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  neutral: 'border-blue-200 bg-blue-50/70 text-blue-800',
  warning: 'border-amber-200 bg-amber-50/80 text-amber-800',
  'high-priority': 'border-red-200 bg-red-50/80 text-red-800',
};

export const coachCategoryStyles: Record<NutritionCoachInsight['category'], string> = {
  nutrition: 'bg-blue-100 text-blue-800',
  prep: 'bg-purple-100 text-purple-800',
  grocery: 'bg-emerald-100 text-emerald-800',
  readiness: 'bg-orange-100 text-orange-800',
  consistency: 'bg-indigo-100 text-indigo-800',
  budget: 'bg-green-100 text-green-800',
  recovery: 'bg-rose-100 text-rose-800',
  scheduling: 'bg-slate-100 text-slate-800',
  hydration: 'bg-cyan-100 text-cyan-800',
  adherence: 'bg-yellow-100 text-yellow-800',
};

export const coachScoreGradient = (value: number) => {
  if (value >= 80) return 'from-emerald-500 to-green-500';
  if (value >= 60) return 'from-blue-500 to-cyan-500';
  if (value >= 40) return 'from-amber-500 to-orange-500';
  return 'from-red-500 to-rose-500';
};

export const coachTrendLabel = (trend: NutritionCoachScore['trend']) => (
  trend === 'up' ? 'Strong' : trend === 'steady' ? 'Stable' : 'Needs attention'
);
