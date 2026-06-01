import { formatMealTypeLabel } from "@/components/meal-planner/tab-domains/analyticsTabDomain";
import type {
  ActiveFixItTarget,
  FixItSlotRecommendation,
} from "@/components/meal-planner/hooks/fix-it/types";

type BuildFixItSlotRecommendationsArgs = {
  activeFixItTarget: ActiveFixItTarget | null;
  activeFixItSlotSignals: any[];
  calorieGoal: number;
  focusPlannerDay: (day: string) => void;
  handleAddMeal: (day?: string, type?: string) => void;
  handleAIRecipe: () => void;
  setActiveTab: (tab: string) => void;
};

export const buildFixItSlotRecommendations = ({
  activeFixItTarget,
  activeFixItSlotSignals,
  calorieGoal,
  focusPlannerDay,
  handleAddMeal,
  handleAIRecipe,
  setActiveTab,
}: BuildFixItSlotRecommendationsArgs): FixItSlotRecommendation[] => {
  if (!activeFixItTarget?.targetDay) return [];
  const targetDay = activeFixItTarget.targetDay;
  const slotSignals = activeFixItSlotSignals;
  const addMealForSlot = (mealType: string) => {
    focusPlannerDay(targetDay);
    handleAddMeal(targetDay, formatMealTypeLabel(mealType));
  };
  const openTargetedAI = () => {
    focusPlannerDay(targetDay);
    handleAIRecipe();
  };
  const openAnalytics = () => setActiveTab("analytics");
  const recommendations: FixItSlotRecommendation[] = [];
  const pushRecommendation = (recommendation: FixItSlotRecommendation) => {
    if (recommendations.some((existing) => existing.key === recommendation.key))
      return;
    if (recommendations.length >= 3) return;
    recommendations.push(recommendation);
  };

  if (activeFixItTarget.issueType === "missing-meals") {
    const emptySlots = slotSignals.filter((slot) => !slot.hasMeals);
    const preferredOrder = ["dinner", "lunch", "breakfast", "snack"];
    emptySlots
      .sort(
        (a, b) =>
          preferredOrder.indexOf(a.mealType) -
          preferredOrder.indexOf(b.mealType),
      )
      .slice(0, 2)
      .forEach((slot) => {
        pushRecommendation({
          key: `fill-${slot.mealType}`,
          text: `Fill ${slot.mealTypeLabel}`,
          cta: "Add Meal",
          onClick: () => addMealForSlot(slot.mealType),
        });
      });
    pushRecommendation({
      key: "missing-meals-ai",
      text: "Need quick ideas for open slots?",
      cta: "Open AI Suggestions",
      onClick: openTargetedAI,
    });
  }

  if (activeFixItTarget.issueType === "low-protein") {
    const lowestProteinSlot = slotSignals
      .filter((slot) => slot.hasMeals)
      .sort((a, b) => a.protein - b.protein)[0];
    const emptySlot = slotSignals.find((slot) => !slot.hasMeals);
    if (lowestProteinSlot)
      pushRecommendation({
        key: `protein-${lowestProteinSlot.mealType}`,
        text: `Add protein to ${lowestProteinSlot.mealTypeLabel}`,
        cta: "Add Meal",
        onClick: () => addMealForSlot(lowestProteinSlot.mealType),
      });
    if (emptySlot)
      pushRecommendation({
        key: `protein-fill-${emptySlot.mealType}`,
        text: `Fill ${emptySlot.mealTypeLabel} with a protein-forward meal`,
        cta: "Add Meal",
        onClick: () => addMealForSlot(emptySlot.mealType),
      });
    pushRecommendation({
      key: "low-protein-ai",
      text: "Get protein-forward meal ideas for this day",
      cta: "Open AI Suggestions",
      onClick: openTargetedAI,
    });
  }

  if (activeFixItTarget.issueType === "missing-details") {
    const missingDetailSlots = slotSignals.filter((slot) => slot.missingDetails);
    if (missingDetailSlots.length > 0)
      missingDetailSlots.slice(0, 2).forEach((slot) => {
        pushRecommendation({
          key: `details-${slot.mealType}`,
          text: `Complete calories/protein for ${slot.mealTypeLabel}`,
          cta: "Add Meal",
          onClick: () => addMealForSlot(slot.mealType),
        });
      });
    const emptySlots = slotSignals.filter((slot) => !slot.hasMeals);
    if (emptySlots.length > 0)
      emptySlots.slice(0, 1).forEach((slot) => {
        pushRecommendation({
          key: `details-fill-${slot.mealType}`,
          text: `Fill ${slot.mealTypeLabel} so nutrition details can be tracked`,
          cta: "Add Meal",
          onClick: () => addMealForSlot(slot.mealType),
        });
      });
    pushRecommendation({
      key: "details-ai",
      text: "Use AI suggestions to replace meals with complete nutrition data",
      cta: "Open AI Suggestions",
      onClick: openTargetedAI,
    });
  }

  if (activeFixItTarget.issueType === "calorie-balance") {
    const highestCalorieSlot = slotSignals
      .filter((slot) => slot.calories > 0)
      .sort((a, b) => b.calories - a.calories)[0];
    const lowestCalorieSlot = slotSignals
      .filter((slot) => slot.hasMeals)
      .sort((a, b) => a.calories - b.calories)[0];
    if (highestCalorieSlot)
      pushRecommendation({
        key: `calorie-heavy-${highestCalorieSlot.mealType}`,
        text: `Review calorie-heavy ${highestCalorieSlot.mealTypeLabel}`,
        cta: "Review Analytics",
        onClick: openAnalytics,
      });
    if (lowestCalorieSlot && lowestCalorieSlot.calories < calorieGoal * 0.2)
      pushRecommendation({
        key: `calorie-complete-${lowestCalorieSlot.mealType}`,
        text: `Complete calories for ${lowestCalorieSlot.mealTypeLabel}`,
        cta: "Add Meal",
        onClick: () => addMealForSlot(lowestCalorieSlot.mealType),
      });
    pushRecommendation({
      key: "calorie-balance-analytics",
      text: "Compare high and low days before adjusting portions",
      cta: "Review Analytics",
      onClick: openAnalytics,
    });
  }

  return recommendations.slice(0, 3);
};
