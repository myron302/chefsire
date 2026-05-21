import { MEAL_TYPES, WEEK_DAYS, getMealNutritionTotals } from './nutritionMealPlannerUtils';
import { iterateWeeklyMeals } from './planner-graph/plannerIteration';
import { extractMealIngredients } from './planner-graph/plannerMealExtraction';
import { getMealsForSlot } from './planner-graph/plannerGraphUtils';
import { aggregatePlannerGroceries, normalizeMealIngredient, type PlannerGrocerySuggestion } from './plannerGroceryUtils';
import type { PrepOrchestration } from './prepOrchestrationUtils';

export type NutritionCoachCategory =
  | 'nutrition'
  | 'prep'
  | 'grocery'
  | 'readiness'
  | 'consistency'
  | 'budget'
  | 'recovery'
  | 'scheduling'
  | 'hydration'
  | 'adherence';

export type NutritionCoachSeverity = 'positive' | 'neutral' | 'warning' | 'high-priority';
export type NutritionCoachKind = 'positive' | 'warning' | 'recommendation';

export type NutritionCoachInsight = {
  id: string;
  category: NutritionCoachCategory;
  title: string;
  description: string;
  severity: NutritionCoachSeverity;
  priority: number;
  kind: NutritionCoachKind;
  relatedMeals: string[];
  relatedPrepSessions: string[];
  suggestedActions: string[];
  evidence: string[];
};

export type NutritionCoachScore = {
  id: 'nutritionConsistency' | 'prepEfficiency' | 'groceryReadiness' | 'weeklyMomentum' | 'planningCompleteness';
  label: string;
  value: number;
  trend: 'up' | 'steady' | 'attention';
  description: string;
};

export type NutritionCoachAnalysis = {
  insights: NutritionCoachInsight[];
  recommendations: string[];
  scores: NutritionCoachScore[];
  summary: {
    topPriority: NutritionCoachInsight | null;
    positiveCount: number;
    warningCount: number;
    recommendationCount: number;
    plannedSlots: number;
    totalSlots: number;
    activeDays: number;
    repeatedMealCount: number;
  };
};

export type NutritionCoachInput = {
  weeklyMeals: Record<string, any> | null | undefined;
  mealTypes?: readonly string[];
  weekDays?: readonly string[];
  calorieGoal: number;
  proteinGoal: number;
  water?: { glassesLogged?: number; dailyTarget?: number };
  grocery?: {
    pendingCount: number;
    completedCount: number;
    totalBuyCount: number;
    suggestions?: PlannerGrocerySuggestion[];
    pantryItemCount?: number;
    pantrySavings?: number;
  };
  prep?: {
    planned: boolean;
    completed: boolean;
    progress: number;
    activeBlockersCount: number;
    carryoverCount?: number;
    orchestration?: PrepOrchestration;
  };
  readiness?: {
    weekReadyNow: boolean;
    prepReadyForWeek: boolean;
  };
  adherence?: {
    currentStreak?: number;
  };
};

type PlannedMeal = {
  id: string;
  name: string;
  day: string;
  mealType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  hasNutrition: boolean;
  ingredientNames: string[];
};

type DayNutrition = {
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const percent = (part: number, total: number) => Math.round((part / Math.max(1, total)) * 100);
const unique = <T,>(values: T[]) => Array.from(new Set(values.filter(Boolean)));
const toTitle = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const getPlannedMeals = (
  weeklyMeals: Record<string, any> | null | undefined,
  weekDays: readonly string[],
  mealTypes: readonly string[],
): PlannedMeal[] => {
  const meals: PlannedMeal[] = [];
  iterateWeeklyMeals(weeklyMeals, weekDays, mealTypes, ({ day, mealType, meal, index }) => {
    const totals = getMealNutritionTotals(meal);
    const ingredientNames = extractMealIngredients(meal).map((item) => String(item?.name || '').trim()).filter(Boolean);
    meals.push({
      id: String(meal?.entryId || meal?.id || `${day}-${mealType}-${index}`),
      name: String(meal?.name || meal?.title || `${toTitle(mealType)} meal`).trim(),
      day,
      mealType,
      ...totals,
      hasNutrition: totals.calories > 0 || totals.protein > 0 || totals.carbs > 0 || totals.fat > 0,
      ingredientNames,
    });
  });

  return meals;
};

const getDayNutrition = (meals: PlannedMeal[], weekDays: readonly string[]): DayNutrition[] => (
  weekDays.map((day) => {
    const dayMeals = meals.filter((meal) => meal.day === day);
    return dayMeals.reduce((totals, meal) => ({
      day,
      calories: totals.calories + meal.calories,
      protein: totals.protein + meal.protein,
      carbs: totals.carbs + meal.carbs,
      fat: totals.fat + meal.fat,
      mealsLogged: totals.mealsLogged + 1,
    }), { day, calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 });
  })
);

export const analyzeMealConsistency = (
  meals: PlannedMeal[],
  dayNutrition: DayNutrition[],
  proteinGoal: number,
  calorieGoal: number,
) => {
  const activeDays = dayNutrition.filter((day) => day.mealsLogged > 0);
  const trackedProteinDays = activeDays.filter((day) => day.protein > 0);
  const trackedCalorieDays = activeDays.filter((day) => day.calories > 0);
  const proteinGoalDays = trackedProteinDays.filter((day) => day.protein >= proteinGoal * 0.9).length;
  const calorieTargetDays = trackedCalorieDays.filter((day) => day.calories >= calorieGoal * 0.85 && day.calories <= calorieGoal * 1.15).length;
  const missingNutritionMeals = meals.filter((meal) => !meal.hasNutrition);
  const avgProtein = trackedProteinDays.length > 0
    ? trackedProteinDays.reduce((sum, day) => sum + day.protein, 0) / trackedProteinDays.length
    : 0;
  const proteinSpread = trackedProteinDays.length >= 3
    ? Math.max(...trackedProteinDays.map((day) => day.protein)) - Math.min(...trackedProteinDays.map((day) => day.protein))
    : 0;
  const calorieSpread = trackedCalorieDays.length >= 3
    ? Math.max(...trackedCalorieDays.map((day) => day.calories)) - Math.min(...trackedCalorieDays.map((day) => day.calories))
    : 0;

  return {
    activeDays,
    trackedProteinDays,
    trackedCalorieDays,
    proteinGoalDays,
    calorieTargetDays,
    missingNutritionMeals,
    avgProtein,
    proteinSpread,
    calorieSpread,
  };
};

export const analyzeMacroCoverage = (dayNutrition: DayNutrition[], proteinGoal: number, calorieGoal: number) => {
  const plannedDays = dayNutrition.filter((day) => day.mealsLogged > 0);
  const lowProteinDays = plannedDays.filter((day) => day.protein > 0 && day.protein < proteinGoal * 0.75);
  const underFueledDays = plannedDays.filter((day) => day.calories > 0 && day.calories < calorieGoal * 0.7);
  const highVariance = plannedDays.filter((day) => day.calories > 0).length >= 3
    && Math.max(...plannedDays.map((day) => day.calories || calorieGoal)) - Math.min(...plannedDays.filter((day) => day.calories > 0).map((day) => day.calories)) > Math.max(700, calorieGoal * 0.35);

  return { plannedDays, lowProteinDays, underFueledDays, highVariance };
};

export const analyzePrepEfficiency = (input: NutritionCoachInput['prep']) => {
  const orchestration = input?.orchestration;
  const generatedScore = orchestration?.summary.prepEfficiencyScore ?? 0;
  const readinessScore = orchestration?.summary.readinessScore ?? 0;
  const estimatedMinutes = orchestration?.summary.estimatedWeeklyPrepMinutes ?? 0;
  const savingsMinutes = orchestration?.summary.estimatedWeeklyPrepSavingsMinutes ?? 0;
  const batchOpportunities = orchestration?.batchOpportunities ?? [];
  const totalGeneratedTasks = orchestration?.summary.totalGeneratedTasks ?? 0;
  const completedGeneratedTasks = orchestration?.summary.completedGeneratedTasks ?? 0;

  return {
    generatedScore,
    readinessScore,
    estimatedMinutes,
    savingsMinutes,
    batchOpportunities,
    totalGeneratedTasks,
    completedGeneratedTasks,
    completionPercent: Math.max(input?.progress ?? 0, orchestration?.summary.completionPercent ?? 0),
  };
};

export const analyzePlannerReadiness = (input: NutritionCoachInput, plannedSlots: number, totalSlots: number) => {
  const planningCompleteness = percent(plannedSlots, totalSlots);
  const groceryReady = !input.grocery || input.grocery.totalBuyCount === 0 || input.grocery.pendingCount === 0;
  const prepReady = Boolean(input.readiness?.prepReadyForWeek);
  const weekReady = Boolean(input.readiness?.weekReadyNow);

  return { planningCompleteness, groceryReady, prepReady, weekReady };
};

const getRepeatedMeals = (meals: PlannedMeal[]) => {
  const byName = new Map<string, PlannedMeal[]>();
  meals.forEach((meal) => {
    const normalized = normalizeMealIngredient(meal.name);
    if (!normalized) return;
    byName.set(normalized, [...(byName.get(normalized) || []), meal]);
  });
  return Array.from(byName.values()).filter((rows) => rows.length >= 3);
};

const getRepeatedIngredients = (meals: PlannedMeal[]) => {
  const byIngredient = new Map<string, { displayName: string; meals: PlannedMeal[] }>();
  meals.forEach((meal) => {
    meal.ingredientNames.forEach((name) => {
      const normalized = normalizeMealIngredient(name);
      if (!normalized) return;
      const current = byIngredient.get(normalized) || { displayName: name, meals: [] };
      current.meals.push(meal);
      byIngredient.set(normalized, current);
    });
  });
  return Array.from(byIngredient.values()).filter((row) => row.meals.length >= 3);
};

const makeInsight = (insight: NutritionCoachInsight): NutritionCoachInsight => insight;

export const calculateNutritionMomentum = (scores: NutritionCoachScore[]) => (
  clampScore(scores.reduce((sum, score) => sum + score.value, 0) / Math.max(1, scores.length))
);

export const deriveCoachingRecommendations = (insights: NutritionCoachInsight[]) => (
  insights
    .filter((insight) => insight.kind !== 'positive')
    .sort((a, b) => b.priority - a.priority)
    .flatMap((insight) => insight.suggestedActions)
    .filter((action, index, all) => all.indexOf(action) === index)
    .slice(0, 6)
);

export const deriveNutritionCoachInsights = (input: NutritionCoachInput): NutritionCoachAnalysis => {
  const weekDays = input.weekDays || WEEK_DAYS;
  const mealTypes = input.mealTypes || MEAL_TYPES;
  const totalSlots = weekDays.length * mealTypes.length;
  const meals = getPlannedMeals(input.weeklyMeals, weekDays, mealTypes);
  const dayNutrition = getDayNutrition(meals, weekDays);
  const plannedSlots = weekDays.reduce((sum, day) => (
    sum + mealTypes.filter((mealType) => getMealsForSlot(input.weeklyMeals || {}, day, mealType).length > 0).length
  ), 0);
  const missingSlots = totalSlots - plannedSlots;
  const missingDays = dayNutrition.filter((day) => day.mealsLogged === 0);
  const weekendGaps = missingDays.filter((day) => day.day === 'Saturday' || day.day === 'Sunday');
  const consistency = analyzeMealConsistency(meals, dayNutrition, input.proteinGoal, input.calorieGoal);
  const macros = analyzeMacroCoverage(dayNutrition, input.proteinGoal, input.calorieGoal);
  const prep = analyzePrepEfficiency(input.prep);
  const readiness = analyzePlannerReadiness(input, plannedSlots, totalSlots);
  const repeatedMeals = getRepeatedMeals(meals);
  const repeatedIngredients = getRepeatedIngredients(meals);
  const pantryIngredientRows = aggregatePlannerGroceries(input.weeklyMeals).filter((row) => (
    input.grocery?.suggestions || []
  ).some((suggestion) => suggestion.normalizedName === row.normalizedName && suggestion.pantryMatchStatus !== 'missing'));
  const groceryReadinessPct = input.grocery
    ? input.grocery.totalBuyCount === 0 ? 100 : percent(input.grocery.completedCount, input.grocery.totalBuyCount)
    : 100;
  const hydrationPct = percent(input.water?.glassesLogged || 0, input.water?.dailyTarget || 8);

  const scoresWithoutMomentum: NutritionCoachScore[] = [
    {
      id: 'nutritionConsistency',
      label: 'Nutrition Consistency',
      value: clampScore((percent(consistency.proteinGoalDays, 7) * 0.45) + (percent(consistency.calorieTargetDays, 7) * 0.35) + (consistency.missingNutritionMeals.length === 0 && meals.length > 0 ? 20 : 0)),
      trend: consistency.proteinGoalDays >= 4 && consistency.calorieTargetDays >= 4 ? 'up' : consistency.trackedProteinDays.length >= 3 ? 'steady' : 'attention',
      description: `${consistency.proteinGoalDays}/7 protein-paced days and ${consistency.calorieTargetDays}/7 calorie-paced days.`,
    },
    {
      id: 'prepEfficiency',
      label: 'Prep Efficiency',
      value: clampScore((prep.generatedScore * 0.45) + (prep.completionPercent * 0.35) + (prep.readinessScore * 0.2)),
      trend: prep.completionPercent >= 70 ? 'up' : prep.batchOpportunities.length > 0 ? 'steady' : 'attention',
      description: `${prep.batchOpportunities.length} batch opportunities with ${prep.completionPercent}% prep completion.`,
    },
    {
      id: 'groceryReadiness',
      label: 'Grocery Readiness',
      value: clampScore(groceryReadinessPct),
      trend: groceryReadinessPct >= 85 ? 'up' : groceryReadinessPct >= 50 ? 'steady' : 'attention',
      description: input.grocery ? `${input.grocery.completedCount}/${Math.max(1, input.grocery.totalBuyCount)} grocery items ready.` : 'No grocery list items required yet.',
    },
    {
      id: 'planningCompleteness',
      label: 'Planning Completeness',
      value: clampScore(readiness.planningCompleteness),
      trend: readiness.planningCompleteness >= 90 ? 'up' : readiness.planningCompleteness >= 60 ? 'steady' : 'attention',
      description: `${plannedSlots}/${totalSlots} weekly meal slots are planned.`,
    },
  ];

  const scores: NutritionCoachScore[] = [
    ...scoresWithoutMomentum,
    {
      id: 'weeklyMomentum',
      label: 'Weekly Momentum',
      value: calculateNutritionMomentum(scoresWithoutMomentum),
      trend: readiness.weekReady || scoresWithoutMomentum.every((score) => score.value >= 75) ? 'up' : scoresWithoutMomentum.some((score) => score.value < 45) ? 'attention' : 'steady',
      description: readiness.weekReady ? 'Planning, grocery, and prep signals are aligned.' : 'Momentum blends planning, grocery, prep, and macro pacing.',
    },
  ];

  const insights: NutritionCoachInsight[] = [];

  if (meals.length === 0) {
    insights.push(makeInsight({
      id: 'coach-start-week-plan',
      category: 'scheduling',
      title: 'Start with anchor meals',
      description: 'No meals are planned yet. Add a few anchor meals first so the coach can analyze nutrition pacing, grocery readiness, and prep opportunities.',
      severity: 'neutral',
      priority: 80,
      kind: 'recommendation',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Plan one breakfast, one lunch, and one dinner before filling snacks.'],
      evidence: [`${plannedSlots}/${totalSlots} slots planned`],
    }));
  }

  if (missingSlots > 0 && meals.length > 0) {
    insights.push(makeInsight({
      id: 'coach-missing-meal-coverage',
      category: 'scheduling',
      title: `${missingSlots} planner slot${missingSlots === 1 ? '' : 's'} still open`,
      description: missingDays.length > 0
        ? `${missingDays.map((day) => day.day).slice(0, 3).join(', ')} ${missingDays.length === 1 ? 'has' : 'have'} no meals planned yet.`
        : 'A few meal periods are still open. Filling them improves grocery and prep accuracy.',
      severity: missingSlots >= 8 ? 'high-priority' : 'warning',
      priority: missingSlots >= 8 ? 95 : 78,
      kind: 'warning',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Fill open lunches or dinners first, then add snacks only where useful.'],
      evidence: [`${plannedSlots}/${totalSlots} slots planned`],
    }));
  } else if (plannedSlots === totalSlots && totalSlots > 0) {
    insights.push(makeInsight({
      id: 'coach-full-planning-coverage',
      category: 'scheduling',
      title: 'Full weekly planning coverage',
      description: 'Every meal slot has at least one planned meal, giving grocery, prep, and macro insights complete weekly context.',
      severity: 'positive',
      priority: 70,
      kind: 'positive',
      relatedMeals: meals.slice(0, 6).map((meal) => meal.name),
      relatedPrepSessions: [],
      suggestedActions: ['Review grocery and prep scores before the week starts.'],
      evidence: [`${plannedSlots}/${totalSlots} slots planned`],
    }));
  }

  if (consistency.trackedProteinDays.length >= 3) {
    if (consistency.proteinGoalDays >= 5 || consistency.proteinSpread <= Math.max(30, input.proteinGoal * 0.35)) {
      insights.push(makeInsight({
        id: 'coach-protein-consistency',
        category: 'nutrition',
        title: 'Protein intake looks consistent',
        description: `You are averaging ${Math.round(consistency.avgProtein)}g protein across tracked days, with ${consistency.proteinGoalDays}/7 days near your target.`,
        severity: 'positive',
        priority: 68,
        kind: 'positive',
        relatedMeals: meals.filter((meal) => meal.protein >= 25).slice(0, 4).map((meal) => meal.name),
        relatedPrepSessions: [],
        suggestedActions: ['Keep protein-forward meals distributed across breakfast, lunch, and dinner.'],
        evidence: [`Average protein ${Math.round(consistency.avgProtein)}g`, `${consistency.proteinGoalDays}/7 target days`],
      }));
    } else if (macros.lowProteinDays.length > 0) {
      insights.push(makeInsight({
        id: 'coach-low-protein-days',
        category: 'nutrition',
        title: `${macros.lowProteinDays.length} low-protein day${macros.lowProteinDays.length === 1 ? '' : 's'} detected`,
        description: `${macros.lowProteinDays.map((day) => day.day).slice(0, 3).join(', ')} ${macros.lowProteinDays.length === 1 ? 'is' : 'are'} materially below your protein goal.`,
        severity: 'warning',
        priority: 85,
        kind: 'warning',
        relatedMeals: meals.filter((meal) => macros.lowProteinDays.some((day) => day.day === meal.day)).map((meal) => meal.name).slice(0, 5),
        relatedPrepSessions: [],
        suggestedActions: ['Add a protein-forward option to the lowest-protein day before changing every meal.'],
        evidence: macros.lowProteinDays.map((day) => `${day.day}: ${Math.round(day.protein)}g`),
      }));
    }
  }

  if (macros.highVariance) {
    insights.push(makeInsight({
      id: 'coach-calorie-pacing-variance',
      category: 'recovery',
      title: 'Calorie pacing varies across the week',
      description: 'Tracked calories swing meaningfully between days. Consider balancing portion sizes before making aggressive changes.',
      severity: 'neutral',
      priority: 62,
      kind: 'recommendation',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Compare your highest and lowest calorie days and adjust portions gradually.'],
      evidence: [`Weekly calorie spread: ${Math.round(consistency.calorieSpread)} kcal`],
    }));
  }

  if (consistency.missingNutritionMeals.length > 0 && meals.length > 0) {
    insights.push(makeInsight({
      id: 'coach-missing-nutrition-details',
      category: 'adherence',
      title: 'Some planned meals need nutrition details',
      description: `${consistency.missingNutritionMeals.length} meal${consistency.missingNutritionMeals.length === 1 ? '' : 's'} missing calories or macros reduce the accuracy of coaching scores.`,
      severity: 'neutral',
      priority: 58,
      kind: 'recommendation',
      relatedMeals: consistency.missingNutritionMeals.slice(0, 5).map((meal) => meal.name),
      relatedPrepSessions: [],
      suggestedActions: ['Add calories and protein to repeated meals first for the biggest analytics improvement.'],
      evidence: [`${consistency.missingNutritionMeals.length}/${meals.length} meals missing macro details`],
    }));
  }

  if (hydrationPct >= 100) {
    insights.push(makeInsight({
      id: 'coach-hydration-complete',
      category: 'hydration',
      title: 'Hydration target is complete today',
      description: 'Your current hydration log has reached today’s target. Keep the same steady rhythm tomorrow.',
      severity: 'positive',
      priority: 52,
      kind: 'positive',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Keep water visible during prep and meals to make this easier to repeat.'],
      evidence: [`${input.water?.glassesLogged || 0}/${input.water?.dailyTarget || 8} glasses`],
    }));
  } else if (hydrationPct < 60 && meals.length > 0) {
    insights.push(makeInsight({
      id: 'coach-hydration-lagging',
      category: 'hydration',
      title: 'Hydration is lagging today',
      description: `You are at ${hydrationPct}% of today’s water target. This is a simple consistency lever alongside meal planning.`,
      severity: 'neutral',
      priority: 55,
      kind: 'recommendation',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Pair a glass of water with the next planned meal or prep block.'],
      evidence: [`${input.water?.glassesLogged || 0}/${input.water?.dailyTarget || 8} glasses`],
    }));
  }

  if (repeatedMeals.length > 0) {
    const first = repeatedMeals[0];
    insights.push(makeInsight({
      id: `coach-repetition-${normalizeMealIngredient(first[0].name).replace(/[^a-z0-9]+/g, '-')}`,
      category: 'consistency',
      title: 'Meal repetition may create fatigue',
      description: `${first[0].name} appears ${first.length} times this week. Repetition is efficient, but one swap can keep the plan easier to follow.`,
      severity: 'neutral',
      priority: 50,
      kind: 'recommendation',
      relatedMeals: first.map((meal) => meal.name),
      relatedPrepSessions: [],
      suggestedActions: ['Keep the same macro profile and rotate flavor, sauce, or produce.'],
      evidence: unique(first.map((meal) => `${meal.day} ${meal.mealType}`)),
    }));
  }

  if (repeatedIngredients.length > 0) {
    const best = repeatedIngredients.sort((a, b) => b.meals.length - a.meals.length)[0];
    insights.push(makeInsight({
      id: `coach-batch-${normalizeMealIngredient(best.displayName).replace(/[^a-z0-9]+/g, '-')}`,
      category: 'prep',
      title: `${best.displayName} is a batch-prep opportunity`,
      description: `${best.displayName} appears across ${best.meals.length} meals. A shared prep session can reduce repeated cooking steps.`,
      severity: 'positive',
      priority: 72,
      kind: 'positive',
      relatedMeals: unique(best.meals.map((meal) => meal.name)).slice(0, 6),
      relatedPrepSessions: prep.batchOpportunities.map((task) => task.name).slice(0, 3),
      suggestedActions: [`Batch prep ${best.displayName} once and portion it for the linked meals.`],
      evidence: unique(best.meals.map((meal) => `${meal.day} ${meal.mealType}`)).slice(0, 6),
    }));
  }

  if (prep.estimatedMinutes >= 120 && !input.prep?.completed) {
    insights.push(makeInsight({
      id: 'coach-prep-overload',
      category: 'prep',
      title: 'Prep load is concentrated',
      description: `Generated prep tasks estimate about ${prep.estimatedMinutes} minutes. Splitting prep into two sessions may be easier to execute.`,
      severity: 'warning',
      priority: 82,
      kind: 'warning',
      relatedMeals: [],
      relatedPrepSessions: input.prep?.orchestration?.sessions.map((session) => session.title).slice(0, 4) || [],
      suggestedActions: ['Move chopping or snack packing to a shorter midweek prep block.'],
      evidence: [`${prep.estimatedMinutes} estimated prep minutes`, `${prep.completionPercent}% complete`],
    }));
  } else if (prep.savingsMinutes >= 30) {
    insights.push(makeInsight({
      id: 'coach-prep-efficiency-savings',
      category: 'prep',
      title: 'Prep orchestration can save time',
      description: `Current prep grouping may save about ${prep.savingsMinutes} minutes versus prepping every meal separately.`,
      severity: 'positive',
      priority: 64,
      kind: 'positive',
      relatedMeals: [],
      relatedPrepSessions: input.prep?.orchestration?.sessions.map((session) => session.title).slice(0, 4) || [],
      suggestedActions: ['Complete generated batch-prep tasks before individual meal assembly.'],
      evidence: [`${prep.savingsMinutes} estimated minutes saved`],
    }));
  }

  if (input.prep?.activeBlockersCount && input.prep.activeBlockersCount > 0) {
    insights.push(makeInsight({
      id: 'coach-prep-blockers',
      category: 'readiness',
      title: 'Prep blockers need attention',
      description: `${input.prep.activeBlockersCount} active prep blocker${input.prep.activeBlockersCount === 1 ? '' : 's'} may prevent the week from becoming ready.`,
      severity: 'high-priority',
      priority: 98,
      kind: 'warning',
      relatedMeals: [],
      relatedPrepSessions: input.prep?.orchestration?.sessions.map((session) => session.title).slice(0, 3) || [],
      suggestedActions: ['Resolve grocery-linked blockers first, then mark prep tasks complete as they are done.'],
      evidence: [`${input.prep.activeBlockersCount} active blockers`],
    }));
  }

  if (input.grocery && input.grocery.totalBuyCount > 0) {
    if (groceryReadinessPct >= 85) {
      insights.push(makeInsight({
        id: 'coach-grocery-readiness-strong',
        category: 'grocery',
        title: 'Grocery readiness is strong',
        description: `${input.grocery.completedCount}/${input.grocery.totalBuyCount} grocery items are ready, so prep execution is less likely to stall.`,
        severity: 'positive',
        priority: 66,
        kind: 'positive',
        relatedMeals: [],
        relatedPrepSessions: [],
        suggestedActions: ['Use the grocery-ready window to finish prep tasks while ingredients are fresh.'],
        evidence: [`${groceryReadinessPct}% grocery readiness`],
      }));
    } else if (input.grocery.pendingCount > 0) {
      insights.push(makeInsight({
        id: 'coach-grocery-readiness-warning',
        category: 'grocery',
        title: 'Grocery readiness is holding back the plan',
        description: `${input.grocery.pendingCount} grocery item${input.grocery.pendingCount === 1 ? '' : 's'} remain unresolved for this week’s plan.`,
        severity: input.grocery.pendingCount >= 5 ? 'warning' : 'neutral',
        priority: input.grocery.pendingCount >= 5 ? 76 : 57,
        kind: 'warning',
        relatedMeals: unique((input.grocery.suggestions || []).flatMap((suggestion) => suggestion.linkedMealNames)).slice(0, 5),
        relatedPrepSessions: [],
        suggestedActions: ['Clear high-use grocery suggestions before starting batch prep.'],
        evidence: [`${input.grocery.pendingCount} pending grocery items`],
      }));
    }
  }

  if (pantryIngredientRows.length >= 3) {
    insights.push(makeInsight({
      id: 'coach-pantry-waste-reduction',
      category: 'budget',
      title: 'Pantry usage is reducing duplicate buys',
      description: `${pantryIngredientRows.length} planned ingredient uses appear covered by pantry-aware grocery matches.`,
      severity: 'positive',
      priority: 54,
      kind: 'positive',
      relatedMeals: unique(pantryIngredientRows.map((row) => row.meal.mealName)).slice(0, 5),
      relatedPrepSessions: [],
      suggestedActions: ['Prioritize pantry-matched ingredients early in the week to reduce waste risk.'],
      evidence: unique(pantryIngredientRows.map((row) => row.displayName)).slice(0, 6),
    }));
  } else if ((input.grocery?.suggestions || []).filter((suggestion) => suggestion.pantryMatchStatus === 'missing').length >= 5) {
    insights.push(makeInsight({
      id: 'coach-pantry-check-opportunity',
      category: 'budget',
      title: 'Pantry check could reduce the list',
      description: 'Several derived grocery suggestions are not matched to pantry items yet. A quick pantry pass may prevent duplicate purchases.',
      severity: 'neutral',
      priority: 49,
      kind: 'recommendation',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Check pantry staples before buying repeated grains, sauces, or proteins.'],
      evidence: [`${(input.grocery?.suggestions || []).filter((suggestion) => suggestion.pantryMatchStatus === 'missing').length} unmatched suggestions`],
    }));
  }

  if (weekendGaps.length > 0 && meals.length > 0) {
    insights.push(makeInsight({
      id: 'coach-weekend-gap',
      category: 'scheduling',
      title: 'Weekend planning gap detected',
      description: `${weekendGaps.map((day) => day.day).join(' and ')} ${weekendGaps.length === 1 ? 'has' : 'have'} no meals planned. Weekend gaps often create last-minute grocery changes.`,
      severity: 'neutral',
      priority: 60,
      kind: 'recommendation',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Add one flexible leftover or freezer-friendly meal for the weekend.'],
      evidence: weekendGaps.map((day) => `${day.day}: 0 meals`),
    }));
  }

  if (readiness.weekReady) {
    insights.push(makeInsight({
      id: 'coach-week-ready',
      category: 'readiness',
      title: 'Weekly readiness is aligned',
      description: 'Planning coverage, grocery readiness, and prep execution signals are all aligned for this week.',
      severity: 'positive',
      priority: 88,
      kind: 'positive',
      relatedMeals: meals.slice(0, 5).map((meal) => meal.name),
      relatedPrepSessions: input.prep?.orchestration?.sessions.map((session) => session.title).slice(0, 3) || [],
      suggestedActions: ['Maintain momentum by logging completion as meals and prep tasks are finished.'],
      evidence: ['Week ready signal is active'],
    }));
  } else if (readiness.planningCompleteness >= 70 && readiness.groceryReady && !readiness.prepReady) {
    insights.push(makeInsight({
      id: 'coach-readiness-prep-lag',
      category: 'readiness',
      title: 'Grocery readiness is ahead of prep',
      description: 'Your grocery signal is strong, but prep readiness has not caught up yet.',
      severity: 'warning',
      priority: 84,
      kind: 'warning',
      relatedMeals: [],
      relatedPrepSessions: input.prep?.orchestration?.sessions.map((session) => session.title).slice(0, 4) || [],
      suggestedActions: ['Complete the highest-impact generated prep task before adding more plan complexity.'],
      evidence: [`Planning ${readiness.planningCompleteness}%`, `Prep ready: ${readiness.prepReady ? 'yes' : 'no'}`],
    }));
  }

  if ((input.adherence?.currentStreak || 0) >= 3) {
    insights.push(makeInsight({
      id: 'coach-adherence-streak',
      category: 'adherence',
      title: `${input.adherence?.currentStreak} day logging streak`,
      description: 'Your recent consistency gives the coach better signal quality for weekly recommendations.',
      severity: 'positive',
      priority: 51,
      kind: 'positive',
      relatedMeals: [],
      relatedPrepSessions: [],
      suggestedActions: ['Keep logging simple: complete meals first, then refine macro details.'],
      evidence: [`${input.adherence?.currentStreak} day streak`],
    }));
  }

  const sortedInsights = insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 12);
  const recommendations = deriveCoachingRecommendations(sortedInsights);

  return {
    insights: sortedInsights,
    recommendations,
    scores,
    summary: {
      topPriority: sortedInsights.find((insight) => insight.kind !== 'positive') || sortedInsights[0] || null,
      positiveCount: sortedInsights.filter((insight) => insight.kind === 'positive').length,
      warningCount: sortedInsights.filter((insight) => insight.kind === 'warning').length,
      recommendationCount: sortedInsights.filter((insight) => insight.kind === 'recommendation').length,
      plannedSlots,
      totalSlots,
      activeDays: consistency.activeDays.length,
      repeatedMealCount: repeatedMeals.reduce((sum, group) => sum + group.length, 0),
    },
  };
};
