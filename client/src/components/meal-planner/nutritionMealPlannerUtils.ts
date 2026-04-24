export const DEFAULT_NUTRITION_GOALS = {
  dailyCalorieGoal: 2000,
  macroGoals: { protein: 150, carbs: 200, fat: 65 },
};

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export type NutritionLookupResult = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servingSize: string;
};

export const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateOnly = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(value);
};

export const getCurrentWeekAnchor = (selectedDate: string) => {
  const now = parseDateOnly(selectedDate);
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return formatLocalDate(now);
};

export const getDateForWeekday = (weekAnchorDate: string, weekday: string) => {
  const anchor = parseDateOnly(weekAnchorDate);
  const index = WEEK_DAYS.indexOf(weekday as (typeof WEEK_DAYS)[number]);
  const dayOffset = index >= 0 ? index : 0;
  anchor.setDate(anchor.getDate() + dayOffset);
  return formatLocalDate(anchor);
};

export const getSlotItems = (weeklyMeals: Record<string, any>, day: string, mealType: string): any[] => {
  const val = weeklyMeals?.[day]?.[mealType];
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
};

export const getSlotTotals = (weeklyMeals: Record<string, any>, day: string, mealType: string) => {
  const items = getSlotItems(weeklyMeals, day, mealType);
  return items.reduce((acc, m) => ({
    calories: acc.calories + (Number(m?.calories) || 0),
    protein: acc.protein + (Number(m?.protein) || 0),
    carbs: acc.carbs + (Number(m?.carbs) || 0),
    fat: acc.fat + (Number(m?.fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
};

export const calculateTodayNutritionTotals = (meals: Record<string, any>) => {
  const todayName = DAY_NAMES[new Date().getDay()];
  const todayMeals = meals[todayName] || {};

  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  Object.values(todayMeals).forEach((slotValue: any) => {
    const items = Array.isArray(slotValue) ? slotValue : slotValue ? [slotValue] : [];
    items.forEach((meal: any) => {
      totals.calories += Number(meal?.calories || 0);
      totals.protein += Number(meal?.protein || 0);
      totals.carbs += Number(meal?.carbs || 0);
      totals.fat += Number(meal?.fat || 0);
    });
  });

  return totals;
};

export const getNutritionGrade = (meal: any, dailyCalorieGoal: number): string => {
  let score = 100;
  const mealCals = Number(meal.calories) || 0;
  const protein = Number(meal.protein) || 0;
  const fat = Number(meal.fat) || 0;
  const fiber = Number(meal.fiber) || 0;

  const proteinDensity = mealCals > 0 ? (protein / mealCals) * 100 : 0;
  if (proteinDensity < 3) score -= 30;
  else if (proteinDensity < 5) score -= 15;
  else if (proteinDensity >= 7) score += 10;

  const fatPct = mealCals > 0 ? ((fat * 9) / mealCals) * 100 : 0;
  if (fatPct > 50) score -= 20;
  else if (fatPct > 40) score -= 10;

  if (fiber >= 5) score += 10;
  else if (fiber >= 3) score += 5;
  else if (fiber === 0) score -= 10;

  if (dailyCalorieGoal > 0 && mealCals > dailyCalorieGoal * 0.5) score -= 15;

  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
};

export const gradeClass = (grade: string) => ({
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-700',
}[grade] || 'bg-gray-100 text-gray-700');

const NUTRITION_TABLE: Record<string, NutritionLookupResult> = {
  egg: { calories: 78, protein: 6, carbs: 1, fat: 5, fiber: 0, servingSize: '1 large egg' },
  eggs: { calories: 156, protein: 12, carbs: 1, fat: 10, fiber: 0, servingSize: '2 large eggs' },
  bacon: { calories: 161, protein: 12, carbs: 0, fat: 12, fiber: 0, servingSize: '3 strips' },
  toast: { calories: 79, protein: 3, carbs: 15, fat: 1, fiber: 1, servingSize: '1 slice' },
  oatmeal: { calories: 158, protein: 5, carbs: 27, fat: 3, fiber: 4, servingSize: '1 cup cooked' },
  pancakes: { calories: 350, protein: 9, carbs: 56, fat: 10, fiber: 2, servingSize: '3 medium' },
  waffles: { calories: 310, protein: 8, carbs: 45, fat: 12, fiber: 1, servingSize: '2 waffles' },
  yogurt: { calories: 150, protein: 17, carbs: 9, fat: 4, fiber: 0, servingSize: '1 cup' },
  banana: { calories: 89, protein: 1, carbs: 23, fat: 0, fiber: 3, servingSize: '1 medium' },
  apple: { calories: 72, protein: 0, carbs: 19, fat: 0, fiber: 3, servingSize: '1 medium' },
  orange: { calories: 62, protein: 1, carbs: 15, fat: 0, fiber: 3, servingSize: '1 medium' },
  avocado: { calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, servingSize: '1/2 avocado' },
  chicken: { calories: 335, protein: 38, carbs: 0, fat: 19, fiber: 0, servingSize: '1 breast' },
  salmon: { calories: 367, protein: 39, carbs: 0, fat: 22, fiber: 0, servingSize: '1 fillet (170g)' },
  beef: { calories: 350, protein: 30, carbs: 0, fat: 24, fiber: 0, servingSize: '4 oz' },
  rice: { calories: 206, protein: 4, carbs: 45, fat: 0, fiber: 1, servingSize: '1 cup cooked' },
  pasta: { calories: 220, protein: 8, carbs: 43, fat: 1, fiber: 3, servingSize: '1 cup cooked' },
  salad: { calories: 150, protein: 5, carbs: 12, fat: 8, fiber: 4, servingSize: '1 bowl' },
  burger: { calories: 540, protein: 27, carbs: 40, fat: 28, fiber: 2, servingSize: '1 burger' },
  sandwich: { calories: 350, protein: 18, carbs: 40, fat: 12, fiber: 3, servingSize: '1 sandwich' },
  pizza: { calories: 570, protein: 23, carbs: 68, fat: 21, fiber: 3, servingSize: '2 slices' },
  soup: { calories: 180, protein: 8, carbs: 22, fat: 6, fiber: 4, servingSize: '1.5 cups' },
  steak: { calories: 420, protein: 38, carbs: 0, fat: 28, fiber: 0, servingSize: '6 oz' },
  tuna: { calories: 290, protein: 40, carbs: 0, fat: 13, fiber: 0, servingSize: '1 can (5oz)' },
  shrimp: { calories: 200, protein: 38, carbs: 3, fat: 3, fiber: 0, servingSize: '4 oz' },
  broccoli: { calories: 55, protein: 4, carbs: 11, fat: 0, fiber: 5, servingSize: '1 cup' },
  spinach: { calories: 41, protein: 5, carbs: 7, fat: 0, fiber: 4, servingSize: '1 cup cooked' },
  sweet_potato: { calories: 103, protein: 2, carbs: 24, fat: 0, fiber: 4, servingSize: '1 medium' },
  milk: { calories: 149, protein: 8, carbs: 12, fat: 8, fiber: 0, servingSize: '1 cup' },
  cheese: { calories: 113, protein: 7, carbs: 0, fat: 9, fiber: 0, servingSize: '1 oz' },
  almonds: { calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 3, servingSize: '1 oz (23 nuts)' },
  bread: { calories: 79, protein: 3, carbs: 15, fat: 1, fiber: 1, servingSize: '1 slice' },
};

export const clientSideNutritionLookup = (name: string): NutritionLookupResult => {
  const lower = name.toLowerCase();
  const parts = lower.split(/[,&+]|\band\b|\bwith\b/).map((s) => s.trim()).filter(Boolean);

  if (parts.length > 1) {
    let combined = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    let matched = 0;
    const servings: string[] = [];
    for (const part of parts) {
      for (const [key, val] of Object.entries(NUTRITION_TABLE)) {
        if (part.includes(key.replace('_', ' '))) {
          combined = {
            calories: combined.calories + val.calories,
            protein: combined.protein + val.protein,
            carbs: combined.carbs + val.carbs,
            fat: combined.fat + val.fat,
            fiber: combined.fiber + val.fiber,
          };
          servings.push(val.servingSize);
          matched++;
          break;
        }
      }
    }

    if (matched > 0) {
      return { ...combined, servingSize: servings.join(' + ') };
    }
  }

  for (const [key, val] of Object.entries(NUTRITION_TABLE)) {
    if (lower.includes(key.replace('_', ' '))) return val;
  }

  return { calories: 400, protein: 25, carbs: 40, fat: 14, fiber: 4, servingSize: '1 serving' };
};

export const toGroceryExportItems = (groceryList: any[]) => groceryList.map((item: any) => ({
  name: item.name || item.item,
  quantity: parseFloat(item.amount?.split(' ')[0]) || 1,
  unit: item.amount?.split(' ').slice(1).join(' ') || '',
  category: item.category || 'Other',
  checked: item.checked || false,
}));

export type TemplateMergeMode = 'replace' | 'append';
export type TemplateSlotDiffStatus = 'add' | 'replace' | 'unchanged' | 'skip-existing';
export type TemplateSlotDiffRow = {
  key: string;
  day: string;
  mealType: string;
  currentCount: number;
  templateCount: number;
  status: TemplateSlotDiffStatus;
};

const toMealItems = (value: any): any[] => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
};

export const buildTemplateSlotDiff = (
  currentWeek: Record<string, any>,
  templateWeek: Record<string, any>,
  mergeMode: TemplateMergeMode,
): TemplateSlotDiffRow[] => {
  const rows: TemplateSlotDiffRow[] = [];

  for (const day of WEEK_DAYS) {
    for (const mealType of MEAL_TYPES) {
      const currentItems = toMealItems(currentWeek?.[day]?.[mealType]);
      const templateItems = toMealItems(templateWeek?.[day]?.[mealType]);
      if (templateItems.length === 0) continue;

      const currentSerialized = JSON.stringify(currentItems);
      const templateSerialized = JSON.stringify(templateItems);
      const sameItems = currentSerialized === templateSerialized;

      let status: TemplateSlotDiffStatus;
      if (currentItems.length === 0) {
        status = 'add';
      } else if (sameItems) {
        status = 'unchanged';
      } else if (mergeMode === 'append') {
        status = 'skip-existing';
      } else {
        status = 'replace';
      }

      rows.push({
        key: `${day}-${mealType}`,
        day,
        mealType,
        currentCount: currentItems.length,
        templateCount: templateItems.length,
        status,
      });
    }
  }

  return rows;
};
