export const selectContinuityAnchors = (plannedBreakfasts: number, prepTasksCompleted: number) => ({
  plannedBreakfasts,
  prepTasksCompleted,
});

export const selectRecoveryStability = (prepOverloadReduction: number, leftoverFriendlyMeals: number) => ({
  prepOverloadReduction,
  leftoverFriendlyMeals,
});

export const selectMomentumProtection = (proteinGoalHitDays: number, semanticVarietyScore: number) => ({
  proteinGoalHitDays,
  semanticVarietyScore,
});

export const selectCadenceConsistency = (plannedBreakfasts: number, groceryCompletedCount: number) => ({
  plannedBreakfasts,
  groceryCompletedCount,
});

export const selectStabilizationReadiness = (
  prepTasksCompleted: number,
  prepOverloadReduction: number,
  groceryCompletedCount: number,
) => ({
  prepTasksCompleted,
  prepOverloadReduction,
  groceryCompletedCount,
});

export const selectContinuitySummary = (
  continuityAnchors: ReturnType<typeof selectContinuityAnchors>,
  recoveryStability: ReturnType<typeof selectRecoveryStability>,
  momentumProtection: ReturnType<typeof selectMomentumProtection>,
) => ({
  continuityAnchors,
  recoveryStability,
  momentumProtection,
});

export const selectPrepReadinessSummary = (prepTasksCompleted: number, groceryCompletedCount: number) => ({
  prepTasksCompleted,
  groceryCompletedCount,
});
