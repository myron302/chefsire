import { NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export const NUTRITION_CAMPAIGN_CATALOG: NutritionCampaignDefinition[] = [
  {
    id: 'meal-prep-reset-7-day',
    title: '7-Day Meal Prep Reset',
    description: 'Rebuild weekly momentum with a prep-first rhythm.',
    durationDays: 7,
    theme: 'meal-prep',
    narrative: 'Build confidence by stabilizing prep touchpoints and reducing decision fatigue.',
    goals: ['Prep consistency', 'Weekly readiness', 'Reduced prep overload'],
    missions: [
      { id: 'prep-3', title: 'Complete 3 prep tasks', description: 'Finish at least 3 prep mission tasks this week.', metric: 'prep_tasks_completed', target: 3 },
      { id: 'breakfast-5', title: 'Plan 5 breakfasts', description: 'Set a consistent morning baseline.', metric: 'planned_breakfasts', target: 5 },
      { id: 'reduce-overload', title: 'Reduce prep overload', description: 'Improve overload management by at least 20 points.', metric: 'prep_overload_reduction', target: 20 },
    ],
    progressRules: [
      { metric: 'prep_tasks_completed', description: 'Tracks checked prep session tasks and generated prep completions.' },
      { metric: 'prep_overload_reduction', description: 'Uses readiness + prep blockage trend to estimate overload reduction.' },
    ],
    rewardCopy: 'Reset complete. Your planning system is now mission-ready for next week.',
    plannerIntegrationSignals: ['prep orchestration', 'readiness score', 'weekly meals'],
  },
  {
    id: 'protein-consistency-week',
    title: 'Protein Consistency Week',
    description: 'Build predictable protein coverage across the week.',
    durationDays: 7,
    theme: 'protein',
    narrative: 'Move from occasional high-protein days to a sustained daily pattern.',
    goals: ['Protein coverage', 'Breakfast anchor habits', 'Adherence consistency'],
    missions: [
      { id: 'protein-days-4', title: 'Hit protein goal 4 days', description: 'Reach daily protein target on at least 4 days.', metric: 'protein_goal_days', target: 4 },
      { id: 'breakfast-protein', title: 'Plan 5 breakfasts', description: 'Use breakfast as protein consistency anchor.', metric: 'planned_breakfasts', target: 5 },
      { id: 'variety-65', title: 'Maintain semantic variety', description: 'Keep flavor and cuisine variety healthy.', metric: 'semantic_variety_score', target: 65 },
    ],
    progressRules: [
      { metric: 'protein_goal_days', description: 'Uses nutrition coach daily protein goal coverage.' },
      { metric: 'semantic_variety_score', description: 'Uses semantic objective variety score when available.' },
    ],
    rewardCopy: 'Consistency unlocked. Your protein pattern is now resilient and repeatable.',
    plannerIntegrationSignals: ['nutrition coach scores', 'weekly meals', 'semantic intelligence'],
  },
  {
    id: 'pantry-power-week',
    title: 'Pantry Power Week',
    description: 'Convert pantry inventory into high-leverage meals.',
    durationDays: 7,
    theme: 'pantry',
    narrative: 'Turn what you already have into fewer grocery gaps and smoother prep.',
    goals: ['Pantry utilization', 'Leftover intelligence', 'Waste reduction'],
    missions: [
      { id: 'pantry-use-3', title: 'Use 3 pantry ingredients', description: 'Prioritize pantry items in planned meals.', metric: 'pantry_ingredients_used', target: 3 },
      { id: 'leftover-2', title: 'Create 2 leftover-friendly meals', description: 'Plan meals that intentionally create smart leftovers.', metric: 'leftover_friendly_meals', target: 2 },
      { id: 'grocery-resolve-6', title: 'Resolve 6 grocery items', description: 'Close out pending shopping blockers.', metric: 'grocery_items_resolved', target: 6 },
    ],
    progressRules: [
      { metric: 'pantry_ingredients_used', description: 'Tracks overlap between pantry-tagged groceries and planned meal ingredient names.' },
      { metric: 'leftover_friendly_meals', description: 'Uses leftover chain indicators from meal names/notes.' },
    ],
    rewardCopy: 'Pantry mastery achieved. You turned inventory into planning advantage.',
    plannerIntegrationSignals: ['grocery suggestions', 'pantry items', 'leftover-friendly meals'],
  },
  {
    id: 'fresh-start-grocery-week', title: 'Fresh Start Grocery Week', description: 'Close grocery gaps fast and improve readiness.', durationDays: 7, theme: 'grocery',
    narrative: 'Translate plan intent into stocked execution.', goals: ['Grocery completion','Readiness'],
    missions: [
      { id: 'groc6', title: 'Resolve 6 grocery items', description: 'Mark six pending items complete.', metric: 'grocery_items_resolved', target: 6 },
      { id: 'prep3', title: 'Complete 3 prep tasks', description: 'Use fresh groceries in prep sessions.', metric: 'prep_tasks_completed', target: 3 },
    ],
    progressRules: [{ metric: 'grocery_items_resolved', description: 'Uses grocery list completion state.' }], rewardCopy: 'Fresh start achieved. Your week is stocked and actionable.', plannerIntegrationSignals: ['grocery suggestions','readiness score'],
  },
  {
    id: 'recovery-comfort-week', title: 'Recovery & Comfort Week', description: 'Support recovery with lower-friction nutrition.', durationDays: 7, theme: 'recovery',
    narrative: 'Focus on consistency, comfort, and manageable prep load.', goals: ['Sustainable adherence','Prep relief'],
    missions: [
      { id: 'protein3', title: 'Hit protein goal 3 days', description: 'Support recovery targets.', metric: 'protein_goal_days', target: 3 },
      { id: 'overload15', title: 'Reduce prep overload', description: 'Lower prep pressure by 15 points.', metric: 'prep_overload_reduction', target: 15 },
    ],
    progressRules: [{ metric: 'prep_overload_reduction', description: 'Estimated from readiness and active blockers.' }], rewardCopy: 'Recovery rhythm set. You protected adherence with smart pacing.', plannerIntegrationSignals: ['nutrition coach scores','readiness'],
  },
  {
    id: 'smart-leftovers-challenge', title: 'Smart Leftovers Challenge', description: 'Create chain-friendly meals that save effort.', durationDays: 7, theme: 'leftovers',
    narrative: 'Use planned leftovers to compress prep and reduce waste.', goals: ['Leftover reuse','Pantry leverage'],
    missions: [
      { id: 'left2', title: 'Create 2 leftover-friendly meals', description: 'Plan at least two leftover-aware meals.', metric: 'leftover_friendly_meals', target: 2 },
      { id: 'pantry2', title: 'Use 2 pantry ingredients', description: 'Blend pantry items into leftover flow.', metric: 'pantry_ingredients_used', target: 2 },
    ],
    progressRules: [{ metric: 'leftover_friendly_meals', description: 'Inferred from meal naming patterns and reuse signals.' }], rewardCopy: 'Challenge complete. Your leftovers now work like a strategy layer.', plannerIntegrationSignals: ['weekly meals','semantic intelligence'],
  },
  {
    id: 'budget-friendly-nutrition-sprint', title: 'Budget-Friendly Nutrition Sprint', description: 'Hit nutrition targets while reducing shopping drag.', durationDays: 7, theme: 'budget',
    narrative: 'Balance cost-awareness with mission-grade nutrition coverage.', goals: ['Budget adherence','Protein consistency','Pantry use'],
    missions: [
      { id: 'pantry3', title: 'Use 3 pantry ingredients', description: 'Prioritize ingredients already on hand.', metric: 'pantry_ingredients_used', target: 3 },
      { id: 'protein3b', title: 'Hit protein goal 3 days', description: 'Maintain nutrition floor while budgeting.', metric: 'protein_goal_days', target: 3 },
      { id: 'groc4', title: 'Resolve 4 grocery items', description: 'Finish critical grocery items only.', metric: 'grocery_items_resolved', target: 4 },
    ],
    progressRules: [{ metric: 'pantry_ingredients_used', description: 'Measures pantry-assisted meal coverage.' }], rewardCopy: 'Sprint complete. You proved affordability and nutrition can compound.', plannerIntegrationSignals: ['pantry items','grocery completion','nutrition coach'],
  }
];
