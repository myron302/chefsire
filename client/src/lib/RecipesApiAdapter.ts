// client/src/lib/recipesApiAdapter.ts
import type { RecipesFiltersState } from "@/pages/recipes/useRecipesFilters";

// Ethnicity → API cuisine/tag mapping (start small; grow over time)
const ETHNICITY_TO_API: Record<string, string[]> = {
  "Southern / Soul Food": ["southern", "american"],
  Cajun: ["cajun"],
  Creole: ["creole"],
  "Levantine (Palestinian/Lebanese/Syrian/Jordanian)": [
    "lebanese",
    "syrian",
    "jordanian",
    "palestinian",
    "middle eastern",
  ],
  // add more as needed
};

// Allergen keyword heuristics (fallback if provider lacks explicit flags)
const ALLERGEN_INGREDIENTS: Record<string, string[]> = {
  Gluten: ["wheat flour", "semolina", "barley", "farro", "bulgur", "spelt", "rye"],
  Dairy: ["milk", "butter", "cream", "cheese", "yogurt", "ghee", "whey"],
  Eggs: ["egg", "albumen", "mayonnaise"],
  Peanuts: ["peanut", "groundnut"],
  "Tree Nuts": ["almond", "walnut", "pecan", "hazelnut", "pistachio", "cashew"],
  Soy: ["soy", "soybean", "tofu", "edamame", "soy sauce"],
  Fish: ["salmon", "tuna", "cod", "trout", "anchovy", "sardine", "haddock", "halibut"],
  Shellfish: ["shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "scallop"],
  Sesame: ["sesame", "tahini"],
  Mustard: ["mustard", "mustard seed"],
};

export type NormalizedRecipePost = {
  id: string;
  isRecipe: true;
  createdAt: string;
  image?: string | null;
  user: { displayName: string; avatar?: string | null };
  likes?: number;
  comments?: number;
  recipe: {
    title: string;
    cookTime?: number | null;
    servings?: number | null;
    difficulty?: "Easy" | "Medium" | "Hard" | "" | null;
    cuisine?: string | null;
    mealType?: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert" | null;
    ingredients: string[];
    instructions: string[];
    ratingSpoons?: number | null; // 0–5; we display with a Spoon icon
    dietTags?: string[];
    allergens?: string[];
    ethnicities?: string[];
  };
};

export function buildApiQuery(state: RecipesFiltersState) {
  const cuisines = new Set<string>();

  // From Cuisines picker
  state.cuisines.forEach((c) => cuisines.add(c.toLowerCase()));

  // From Ethnicities mapping
  state.ethnicities.forEach((e) => {
    (ETHNICITY_TO_API[e] || []).forEach((x) => cuisines.add(x));
  });

  // Diets many APIs support directly
  const diets = state.dietary
    .map((d) => d.toLowerCase())
    .filter((d) =>
      [
        "vegan",
        "vegetarian",
        "pescatarian",
        "gluten-free",
        "keto",
        "paleo",
        "mediterranean",
        "whole30",
        "dairy-free",
        "low-carb",
        "low-fat",
      ].includes(d)
    );

  return {
    q: "",
    cuisines: Array.from(cuisines),
    diets,
    mealTypes: state.mealTypes,
    maxReadyMinutes: state.maxCookTime,
    // carry these through to do local post-filtering
    excludeAllergens: state.allergens,
    requireTags: state.dietary, // includes Halal/Kosher
    minSpoons: state.minSpoons,
    difficulty: state.difficulty,
    onlyRecipes: state.onlyRecipes,
    sortBy: state.sortBy,
    pageSize: 24,
  };
}

// If/when your backend returns raw provider items, normalize them here
export function normalizeApiRecipe(api: any): NormalizedRecipePost {
  return {
    id: String(api.id ?? cryptoRandomId()),
    isRecipe: true,
    createdAt: api.date || api.createdAt || new Date().toISOString(),
    image: api.imageUrl || api.image || null,
    user: { displayName: api.author || "Unknown" },
    likes: api.popularity || 0,
    comments: api.commentsCount || 0,
    recipe: {
      title: api.title || "Untitled",
      cookTime: api.readyInMinutes ?? api.totalTime ?? null,
      servings: api.servings ?? null,
      difficulty: api.difficulty ?? "",
      cuisine: api.cuisine || null,
      mealType: api.mealType || null,
      ingredients: api.ingredients || [],
      instructions: api.instructions || [],
      ratingSpoons: api.rating ?? null,
      dietTags: (api.diets || api.tags || []).map((x: string) => String(x).trim()),
      allergens: api.allergens || [],
      ethnicities: api.cuisines || [],
    },
  };
}

// Local safety net for allergens + Halal/Kosher when API can't filter them
export function passesLocalRules(recipe: NormalizedRecipePost, state: RecipesFiltersState) {
  const r = recipe.recipe;

  // Allergens exclusion
  if (state.allergens.length) {
    const rAll = (r.allergens || []).map((x) => x.toLowerCase());
    const hitApi = state.allergens.some((sel) => rAll.includes(sel.toLowerCase()));

    const ing = (r.ingredients || []).join(" ").toLowerCase();
    const hitHeuristic = state.allergens.some((sel) =>
      (ALLERGEN_INGREDIENTS[sel] || []).some((word) => ing.includes(word))
    );

    if (hitApi || hitHeuristic) return false;
  }

  // Halal (crude)
  if (state.dietary.includes("Halal")) {
    const t = (r.ingredients || []).join(" ").toLowerCase();
    if (/(pork|bacon|prosciutto|ham)/.test(t)) return false;
    if (/(wine|rum|brandy|vodka|beer|tequila|bourbon)/.test(t)) return false;
  }

  // Kosher (high-level)
  if (state.dietary.includes("Kosher")) {
    const t = (r.ingredients || []).join(" ").toLowerCase();
    if (/(pork|bacon|prosciutto|ham|shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop)/.test(t)) return false;
    const hasMeat = /(beef|chicken|lamb|veal|turkey)/.test(t);
    const hasDairy = /(milk|butter|cream|cheese|yogurt|ghee)/.test(t);
    if (hasMeat && hasDairy) return false;
  }

  return true;
}

// tiny helper so demo items can get an id if missing
function cryptoRandomId() {
  // falls back if crypto.randomUUID not available in older browsers
  // @ts-ignore
  return (typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2));
}
