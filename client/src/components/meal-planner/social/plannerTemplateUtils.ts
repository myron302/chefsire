import { WEEK_DAYS } from '@/components/meal-planner/nutritionMealPlannerUtils';

export type PlannerTemplate = {
  id: string;
  title: string;
  theme: string;
  creator: string;
  nutritionFocus: string;
  prepStyle: string;
  tags: string[];
  week: Record<string, any>;
};

export const derivePlannerTemplateMetadata = (template: PlannerTemplate) => ({
  title: template.title,
  theme: template.theme,
  tags: template.tags,
  nutritionFocus: template.nutritionFocus,
  prepStyle: template.prepStyle,
  slotCount: WEEK_DAYS.reduce((acc, day) => acc + Object.values(template.week?.[day] || {}).flat().filter(Boolean).length, 0),
});

export const clonePlannerWeek = (week: Record<string, any>) => JSON.parse(JSON.stringify(week || {}));

export const applyTemplateToWeek = (
  currentWeek: Record<string, any>,
  templateWeek: Record<string, any>,
  mode: 'replace' | 'append' = 'replace',
  dayFilter?: string,
  mealTypeFilter?: string,
) => {
  const next = clonePlannerWeek(currentWeek);
  WEEK_DAYS.forEach((day) => {
    if (dayFilter && dayFilter !== day) return;
    const sourceDay = templateWeek?.[day] || {};
    if (!next[day]) next[day] = {};
    Object.entries(sourceDay).forEach(([mealType, value]) => {
      if (mealTypeFilter && mealTypeFilter !== mealType) return;
      const sourceMeals = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
      if (mode === 'replace') next[day][mealType] = sourceMeals;
      else {
        const existing = Array.isArray(next[day][mealType]) ? next[day][mealType] : next[day][mealType] ? [next[day][mealType]] : [];
        next[day][mealType] = [...existing, ...sourceMeals];
      }
    });
  });
  return next;
};
