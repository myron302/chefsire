import { MEAL_TYPES, WEEK_DAYS } from "./nutritionMealPlannerUtils";
import { iterateWeeklyMeals } from "./planner-graph/plannerIteration";
import {
  aggregatePlannerGroceries,
  normalizeMealIngredient,
  type PlannerGrocerySourceMeal,
  type PlannerGrocerySourceRow,
} from "./plannerGroceryUtils";

export type PrepComplexity = "Easy" | "Moderate" | "Hands-on";
export type PrepSessionType =
  | "batch"
  | "chop"
  | "assembly"
  | "overnight"
  | "snack-pack"
  | "sauce"
  | "freezer";

export type PrepStorageRecommendation = {
  primary: "refrigerate" | "freeze" | "pantry" | "assemble-fresh";
  bestWithinDays: number;
  reheatingFriendly: boolean;
  containerCount: number;
  notes: string[];
};

export type DerivedPrepTask = {
  id: string;
  name: string;
  prepType: PrepSessionType;
  generated: true;
  sourceMeals: PlannerGrocerySourceMeal[];
  sourceRecipeIds: Array<string | number>;
  linkedMeals: string[];
  linkedIngredients: string[];
  estimatedMinutes: number;
  complexity: PrepComplexity;
  recommendedContainers: string;
  storage: PrepStorageRecommendation;
  checklist: string[];
  completed: boolean;
};

export type DerivedPrepSession = {
  id: string;
  title: string;
  prepType: PrepSessionType;
  generated: true;
  summary: string;
  tasks: DerivedPrepTask[];
  linkedMeals: string[];
  linkedIngredients: string[];
  sourceMeals: PlannerGrocerySourceMeal[];
  sourceRecipeIds: Array<string | number>;
  estimatedMinutes: number;
  complexity: PrepComplexity;
  recommendedTimeframe: string;
};

export type BatchPrepIngredientGroup = {
  id: string;
  name: string;
  normalizedName: string;
  category: string;
  mealCount: number;
  linkedMeals: string[];
  sourceMeals: PlannerGrocerySourceMeal[];
  sourceRecipeIds: Array<string | number>;
  quantities: string[];
  rows: PlannerGrocerySourceRow[];
};

export type PrepOrchestrationSummary = {
  plannedMealCount: number;
  mealsCoveredByPrep: number;
  batchOpportunitiesFound: number;
  estimatedWeeklyPrepMinutes: number;
  estimatedWeeklyPrepSavingsMinutes: number;
  prepEfficiencyScore: number;
  completionPercent: number;
  completedGeneratedTasks: number;
  totalGeneratedTasks: number;
  readinessScore: number;
};

export type PrepTimelineStep = {
  id: string;
  label: string;
  minutes: number;
  detail: string;
};

export type PrepOrchestration = {
  sessions: DerivedPrepSession[];
  batchOpportunities: DerivedPrepTask[];
  sharedIngredients: BatchPrepIngredientGroup[];
  timeline: PrepTimelineStep[];
  storageGuidance: Array<{
    id: string;
    title: string;
    guidance: PrepStorageRecommendation;
    linkedIngredients: string[];
  }>;
  summary: PrepOrchestrationSummary;
};

export type PrepCompletionState = Record<string, boolean>;

type IngredientCategory =
  | "protein"
  | "produce"
  | "grain"
  | "sauce"
  | "snack"
  | "overnight"
  | "freezer"
  | "other";

const PROTEIN_WORDS = [
  "chicken",
  "beef",
  "turkey",
  "pork",
  "salmon",
  "tuna",
  "shrimp",
  "tofu",
  "tempeh",
  "egg",
  "bean",
  "lentil",
];
const PRODUCE_WORDS = [
  "broccoli",
  "spinach",
  "lettuce",
  "tomato",
  "pepper",
  "onion",
  "carrot",
  "potato",
  "zucchini",
  "mushroom",
  "vegetable",
  "apple",
  "banana",
  "berry",
  "fruit",
];
const GRAIN_WORDS = [
  "rice",
  "quinoa",
  "pasta",
  "oat",
  "oats",
  "bread",
  "tortilla",
  "noodle",
  "grain",
];
const SAUCE_WORDS = [
  "sauce",
  "dressing",
  "vinaigrette",
  "marinade",
  "salsa",
  "hummus",
  "dip",
];
const SNACK_WORDS = [
  "snack",
  "bar",
  "almond",
  "nuts",
  "yogurt",
  "cheese",
  "cracker",
];
const OVERNIGHT_WORDS = ["overnight", "oat", "oats", "chia"];
const FREEZER_WORDS = [
  "freezer",
  "frozen",
  "soup",
  "stew",
  "casserole",
  "chili",
];

const unique = <T>(values: T[]) => Array.from(new Set(values));

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const safeId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "prep";

const getPlannedMeals = (
  weeklyMeals: Record<string, any> | null | undefined,
) => {
  const meals: any[] = [];
  iterateWeeklyMeals(weeklyMeals, WEEK_DAYS, MEAL_TYPES, ({ day, mealType, meal }) => {
    meals.push({ ...meal, day, mealType });
  });

  return meals;
};

const inferIngredientCategory = (name: string): IngredientCategory => {
  const normalized = normalizeMealIngredient(name);
  const hasAny = (words: string[]) =>
    words.some((word) => normalized.includes(word));

  if (hasAny(PROTEIN_WORDS)) return "protein";
  if (hasAny(PRODUCE_WORDS)) return "produce";
  if (hasAny(GRAIN_WORDS)) return "grain";
  if (hasAny(SAUCE_WORDS)) return "sauce";
  if (hasAny(OVERNIGHT_WORDS)) return "overnight";
  if (hasAny(SNACK_WORDS)) return "snack";
  if (hasAny(FREEZER_WORDS)) return "freezer";
  return "other";
};

const categoryLabel = (category: IngredientCategory) =>
  ({
    protein: "Protein",
    produce: "Produce",
    grain: "Grains",
    sauce: "Sauce/Condiment",
    snack: "Snack",
    overnight: "Overnight",
    freezer: "Freezer-Friendly",
    other: "Shared Ingredient",
  })[category];

const PREP_TYPE_BY_CATEGORY: Record<IngredientCategory, PrepSessionType> = {
  protein: "batch",
  produce: "chop",
  grain: "batch",
  sauce: "sauce",
  snack: "snack-pack",
  overnight: "overnight",
  freezer: "freezer",
  other: "assembly",
};

const prepTypeForCategory = (category: IngredientCategory): PrepSessionType =>
  PREP_TYPE_BY_CATEGORY[category];

export const groupBatchPrepIngredients = (
  weeklyMeals: Record<string, any> | null | undefined,
): BatchPrepIngredientGroup[] => {
  const grouped = new Map<string, PlannerGrocerySourceRow[]>();

  aggregatePlannerGroceries(weeklyMeals).forEach((row) => {
    if (!row.normalizedName) return;
    grouped.set(row.normalizedName, [
      ...(grouped.get(row.normalizedName) || []),
      row,
    ]);
  });

  return Array.from(grouped.entries())
    .map(([normalizedName, rows]) => {
      const linkedMeals = unique(rows.map((row) => row.meal.mealName));
      const sourceRecipeIds = unique(
        rows
          .map((row) => row.meal.recipeId)
          .filter((value) => value !== undefined),
      );
      const quantities = unique(
        rows.map((row) => row.quantity).filter(Boolean) as string[],
      );
      const displayName = rows[0]?.displayName || titleCase(normalizedName);

      return {
        id: `shared-${safeId(normalizedName)}`,
        name: displayName,
        normalizedName,
        category:
          rows[0]?.category ||
          categoryLabel(inferIngredientCategory(displayName)),
        mealCount: linkedMeals.length,
        linkedMeals,
        sourceMeals: rows.map((row) => row.meal),
        sourceRecipeIds,
        quantities,
        rows,
      };
    })
    .filter((group) => group.mealCount > 1)
    .sort((a, b) => {
      if (a.mealCount !== b.mealCount) return b.mealCount - a.mealCount;
      return a.name.localeCompare(b.name);
    });
};

export const calculatePrepComplexity = (
  ingredientCount: number,
  mealCount: number,
  prepType: PrepSessionType,
): PrepComplexity => {
  const typeWeight =
    prepType === "batch" || prepType === "freezer"
      ? 2
      : prepType === "assembly"
        ? 1
        : 0;
  const score = ingredientCount + Math.max(0, mealCount - 1) + typeWeight;

  if (score >= 7) return "Hands-on";
  if (score >= 4) return "Moderate";
  return "Easy";
};

export const estimatePrepDuration = (
  ingredientCount: number,
  mealCount: number,
  prepType: PrepSessionType,
) => {
  const baseByType: Record<PrepSessionType, number> = {
    batch: 20,
    chop: 12,
    assembly: 10,
    overnight: 8,
    "snack-pack": 8,
    sauce: 10,
    freezer: 18,
  };

  return Math.min(
    120,
    baseByType[prepType] + ingredientCount * 4 + Math.max(0, mealCount - 1) * 5,
  );
};

export const deriveStorageRecommendations = (
  prepType: PrepSessionType,
  linkedIngredients: string[],
  mealCount: number,
): PrepStorageRecommendation => {
  const normalizedIngredients = linkedIngredients.map((ingredient) =>
    normalizeMealIngredient(ingredient),
  );
  const hasProtein = normalizedIngredients.some((ingredient) =>
    PROTEIN_WORDS.some((word) => ingredient.includes(word)),
  );
  const hasProduce = normalizedIngredients.some((ingredient) =>
    PRODUCE_WORDS.some((word) => ingredient.includes(word)),
  );
  const hasGrain = normalizedIngredients.some((ingredient) =>
    GRAIN_WORDS.some((word) => ingredient.includes(word)),
  );
  const containerCount = Math.max(1, Math.ceil(mealCount));

  if (prepType === "freezer") {
    return {
      primary: "freeze",
      bestWithinDays: 2,
      reheatingFriendly: true,
      containerCount,
      notes: [
        "Cool cooked items before freezing.",
        "Label containers with meal name and prep date.",
      ],
    };
  }

  if (prepType === "assembly" && hasProduce) {
    return {
      primary: "assemble-fresh",
      bestWithinDays: 2,
      reheatingFriendly: false,
      containerCount,
      notes: [
        "Keep wet toppings or dressings separate until serving.",
        "Use airtight containers for cut produce.",
      ],
    };
  }

  return {
    primary: "refrigerate",
    bestWithinDays: hasProtein ? 3 : hasProduce ? 3 : hasGrain ? 4 : 3,
    reheatingFriendly:
      prepType === "batch" || prepType === "overnight" || hasGrain,
    containerCount,
    notes: [
      "Use covered containers and refrigerate promptly.",
      "Freeze portions you do not expect to eat soon.",
    ],
  };
};

export const buildPrepWorkflow = (
  prepType: PrepSessionType,
  linkedIngredients: string[],
  linkedMeals: string[],
): string[] => {
  const ingredientsText = linkedIngredients.slice(0, 3).join(", ");
  const mealText = linkedMeals.slice(0, 3).join(", ");

  if (prepType === "batch") {
    return [
      `Gather and stage ${ingredientsText}.`,
      "Cook shared bases in one batch where appropriate.",
      `Portion for ${mealText}${linkedMeals.length > 3 ? ` and ${linkedMeals.length - 3} more` : ""}.`,
      "Label containers before refrigerating or freezing.",
    ];
  }

  if (prepType === "chop") {
    return [
      `Wash and trim ${ingredientsText}.`,
      "Chop, dry, and separate delicate items from sturdy items.",
      "Store in airtight containers for quick assembly.",
    ];
  }

  if (prepType === "overnight") {
    return [
      `Measure ${ingredientsText}.`,
      "Assemble jars or containers the night before serving.",
      "Keep toppings separate when texture matters.",
    ];
  }

  if (prepType === "snack-pack") {
    return [
      `Set out ${ingredientsText}.`,
      "Portion grab-and-go snack packs.",
      "Group snacks by day or meal window.",
    ];
  }

  if (prepType === "sauce") {
    return [
      `Prep ${ingredientsText}.`,
      "Mix sauce, dressing, or condiment components.",
      "Store separately so meals stay fresh until serving.",
    ];
  }

  if (prepType === "freezer") {
    return [
      `Batch-cook freezer-friendly components for ${mealText}.`,
      "Cool portions before sealing containers.",
      "Label and freeze backup portions.",
    ];
  }

  return [
    `Stage shared components: ${ingredientsText}.`,
    `Assemble containers for ${mealText}.`,
    "Hold sauces or crunchy toppings separately when possible.",
  ];
};

const taskNameForGroup = (
  category: IngredientCategory,
  ingredientNames: string[],
  mealCount: number,
) => {
  if (category === "protein")
    return `Batch prep protein for ${mealCount} meals`;
  if (category === "grain") return `Batch prep grains for ${mealCount} meals`;
  if (category === "produce")
    return `Chop and portion produce for ${mealCount} meals`;
  if (category === "sauce")
    return `Prep sauces and condiments for ${mealCount} meals`;
  if (category === "overnight")
    return `Set up overnight prep for ${mealCount} meals`;
  if (category === "snack") return `Pack snacks for ${mealCount} meals`;
  if (category === "freezer") return `Build freezer-ready backup portions`;
  return `Prep shared ${ingredientNames[0] || "components"} for ${mealCount} meals`;
};

const sessionTitleForType = (
  prepType: PrepSessionType,
  category: IngredientCategory,
) => {
  if (prepType === "batch" && category === "protein") return "Protein Prep";
  if (prepType === "batch" && category === "grain") return "Sunday Batch Prep";
  if (prepType === "chop") return "Vegetable Prep";
  if (prepType === "assembly") return "Lunch Assembly";
  if (prepType === "overnight") return "Overnight Prep";
  if (prepType === "snack-pack") return "Snack Prep";
  if (prepType === "sauce") return "Sauce/Condiment Prep";
  if (prepType === "freezer") return "Freezer Prep";
  return "Batch Cook";
};

export const derivePrepSessions = (
  weeklyMeals: Record<string, any> | null | undefined,
  completionState: PrepCompletionState = {},
): PrepOrchestration => {
  const plannedMeals = getPlannedMeals(weeklyMeals);
  const sharedIngredients = groupBatchPrepIngredients(weeklyMeals);
  const tasks = sharedIngredients.map((group): DerivedPrepTask => {
    const category = inferIngredientCategory(group.name);
    const prepType = prepTypeForCategory(category);
    const linkedIngredients = [group.name];
    const complexity = calculatePrepComplexity(
      linkedIngredients.length,
      group.mealCount,
      prepType,
    );
    const estimatedMinutes = estimatePrepDuration(
      linkedIngredients.length,
      group.mealCount,
      prepType,
    );
    const id = `generated-prep-${safeId(prepType)}-${safeId(group.normalizedName)}`;
    const storage = deriveStorageRecommendations(
      prepType,
      linkedIngredients,
      group.mealCount,
    );

    return {
      id,
      name: taskNameForGroup(category, linkedIngredients, group.mealCount),
      prepType,
      generated: true,
      sourceMeals: group.sourceMeals,
      sourceRecipeIds: group.sourceRecipeIds,
      linkedMeals: group.linkedMeals,
      linkedIngredients,
      estimatedMinutes,
      complexity,
      recommendedContainers: `${storage.containerCount} airtight container${storage.containerCount === 1 ? "" : "s"}`,
      storage,
      checklist: buildPrepWorkflow(
        prepType,
        linkedIngredients,
        group.linkedMeals,
      ),
      completed: Boolean(completionState[id]),
    };
  });

  const tasksByType = new Map<PrepSessionType, DerivedPrepTask[]>();
  tasks.forEach((task) => {
    tasksByType.set(task.prepType, [
      ...(tasksByType.get(task.prepType) || []),
      task,
    ]);
  });

  const sessions: DerivedPrepSession[] = Array.from(tasksByType.entries())
    .map(([prepType, sessionTasks]) => {
      const ingredients = unique(
        sessionTasks.flatMap((task) => task.linkedIngredients),
      );
      const linkedMeals = unique(
        sessionTasks.flatMap((task) => task.linkedMeals),
      );
      const sourceMeals = sessionTasks.flatMap((task) => task.sourceMeals);
      const sourceRecipeIds = unique(
        sessionTasks.flatMap((task) => task.sourceRecipeIds),
      );
      const estimatedMinutes = sessionTasks.reduce(
        (sum, task) => sum + task.estimatedMinutes,
        0,
      );
      const maxComplexity: PrepComplexity = sessionTasks.some(
        (task) => task.complexity === "Hands-on",
      )
        ? "Hands-on"
        : sessionTasks.some((task) => task.complexity === "Moderate")
          ? "Moderate"
          : "Easy";
      const primaryCategory = inferIngredientCategory(ingredients[0] || "");

      return {
        id: `session-${safeId(prepType)}`,
        title: sessionTitleForType(prepType, primaryCategory),
        prepType,
        generated: true as const,
        summary: `Prep ${ingredients.slice(0, 3).join(", ")} for ${linkedMeals.length} meal${linkedMeals.length === 1 ? "" : "s"}.`,
        tasks: sessionTasks,
        linkedMeals,
        linkedIngredients: ingredients,
        sourceMeals,
        sourceRecipeIds,
        estimatedMinutes,
        complexity: maxComplexity,
        recommendedTimeframe:
          prepType === "overnight"
            ? "Night before serving"
            : prepType === "snack-pack"
              ? "Early week or as needed"
              : "Weekend batch window",
      };
    })
    .sort((a, b) => b.linkedMeals.length - a.linkedMeals.length);

  const timeline = sessions.map((session, index) => ({
    id: `timeline-${session.id}`,
    label: session.title,
    minutes: session.estimatedMinutes,
    detail:
      index === 0
        ? "Start with the most shared components."
        : session.prepType === "assembly"
          ? "Assemble once cooked or chopped components are ready."
          : "Continue with grouped prep to reduce context switching.",
  }));

  const storageGuidance = tasks.slice(0, 6).map((task) => ({
    id: `storage-${task.id}`,
    title: task.name,
    guidance: task.storage,
    linkedIngredients: task.linkedIngredients,
  }));

  const linkedMealNames = unique(tasks.flatMap((task) => task.linkedMeals));
  const totalGeneratedTasks = tasks.length;
  const completedGeneratedTasks = tasks.filter((task) => task.completed).length;
  const completionPercent =
    totalGeneratedTasks === 0
      ? 0
      : Math.round((completedGeneratedTasks / totalGeneratedTasks) * 100);
  const estimatedWeeklyPrepMinutes = sessions.reduce(
    (sum, session) => sum + session.estimatedMinutes,
    0,
  );
  const estimatedWeeklyPrepSavingsMinutes = Math.max(
    0,
    tasks.reduce(
      (sum, task) => sum + Math.max(8, (task.linkedMeals.length - 1) * 8),
      0,
    ),
  );
  const prepEfficiencyScore =
    totalGeneratedTasks === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (linkedMealNames.length / Math.max(1, plannedMeals.length)) * 55 +
              Math.min(sharedIngredients.length, 8) * 5.5,
          ),
        );
  const readinessScore = Math.min(
    100,
    Math.round(completionPercent * 0.65 + prepEfficiencyScore * 0.35),
  );

  return {
    sessions,
    batchOpportunities: tasks,
    sharedIngredients,
    timeline,
    storageGuidance,
    summary: {
      plannedMealCount: plannedMeals.length,
      mealsCoveredByPrep: linkedMealNames.length,
      batchOpportunitiesFound: tasks.length,
      estimatedWeeklyPrepMinutes,
      estimatedWeeklyPrepSavingsMinutes,
      prepEfficiencyScore,
      completionPercent,
      completedGeneratedTasks,
      totalGeneratedTasks,
      readinessScore,
    },
  };
};
