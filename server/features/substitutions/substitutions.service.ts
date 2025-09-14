// server/features/substitutions/substitutions.service.ts
import {
  SUBSTITUTIONS_CATALOG,
  ALL_INGREDIENT_KEYS,
  type CatalogEntry,
  type SubstitutionItem,
} from "./substitutions.catalog";

/* ────────────────────────────────────────────────────────────────────────────
 * Normalization + Aliases
 * ────────────────────────────────────────────────────────────────────────── */
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s%]/g, "") // keep % for milk-fat terms like "2% milk"
    .trim();
}

/** Map common variants → canonical keys */
const ALIASES: Record<string, string> = {
  // dairy family
  "milk": "milk",
  "whole milk": "milk",
  "2% milk": "milk",
  "low fat milk": "milk",
  "reduced fat milk": "milk",
  "skim milk": "milk",
  "nonfat milk": "milk",
  "fat free milk": "milk",

  "sour cream": "sour cream",
  "sourcream": "sour cream",
  "sour creme": "sour cream",

  "heavy cream": "heavy cream",
  "heavy whipping cream": "heavy cream",
  "whipping cream": "heavy cream",
  "double cream": "heavy cream",

  "buttermilk": "buttermilk",
  "butter milk": "buttermilk",

  "yogurt": "yogurt",
  "yoghurt": "yogurt",
  "greek yogurt": "yogurt",
  "plain yogurt": "yogurt",

  // baking basics
  "baking soda": "baking soda",
  "bicarbonate of soda": "baking soda",
  "bicarb": "baking soda",

  "baking powder": "baking powder",

  "granulated sugar": "granulated sugar",
  "white sugar": "granulated sugar",
  "caster sugar": "granulated sugar",

  "brown sugar": "brown sugar",
  "light brown sugar": "brown sugar",
  "dark brown sugar": "brown sugar",

  // existing
  "butter": "butter",
  "egg": "eggs",
  "eggs": "eggs",
};

function toKey(input: string): string {
  const n = norm(input);
  return ALIASES[n] || n;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Supplemental catalog (merged with your existing one)
 * This guarantees results for common items even if the base catalog lacks them.
 * ────────────────────────────────────────────────────────────────────────── */
const SUPPLEMENT_CATALOG: Record<string, SubstitutionItem[]> = {
  butter: [
    {
      substituteIngredient: "Olive oil",
      ratio: "¾ cup oil = 1 cup butter",
      category: "oils",
      notes: "Good for sautéing and many bakes; flavor changes slightly. Chill cookie dough.",
      nutrition: {
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
        substitute: { calories: 1910, fat: 216, carbs: 0, protein: 0 },
      },
    },
    {
      substituteIngredient: "Coconut oil",
      ratio: "1:1 by volume",
      category: "oils",
      notes: "Adds coconut aroma; solid at room temp helps structure.",
      nutrition: {
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
        substitute: { calories: 1879, fat: 218, carbs: 0, protein: 0 },
      },
    },
    {
      substituteIngredient: "Unsweetened applesauce",
      ratio: "½ cup applesauce = 1 cup butter (cakes/muffins)",
      category: "baking",
      notes: "Cuts fat; texture more moist/denser. Reduce other liquids slightly.",
      nutrition: {
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
        substitute: { calories: 100, fat: 0, carbs: 27, protein: 0 },
      },
    },
  ],

  eggs: [
    {
      substituteIngredient: "Ground flax + water",
      ratio: "1 Tbsp ground flax + 3 Tbsp water = 1 egg",
      category: "vegan",
      notes: "Let sit 5–10 min to gel; great binder for cookies, muffins, pancakes.",
      nutrition: {
        original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
        substitute: { calories: 55, fat: 4.3, carbs: 3, protein: 1.9 },
      },
    },
    {
      substituteIngredient: "Unsweetened applesauce",
      ratio: "¼ cup applesauce = 1 egg (cakes/muffins)",
      category: "baking",
      notes: "Adds moisture; not for meringues or airy foams.",
      nutrition: {
        original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
        substitute: { calories: 25, fat: 0, carbs: 7, protein: 0 },
      },
    },
    {
      substituteIngredient: "Silken tofu (blended)",
      ratio: "¼ cup puree = 1 egg",
      category: "vegan",
      notes: "Neutral; good structure in brownies/denser cakes.",
      nutrition: {
        original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
        substitute: { calories: 45, fat: 2.5, carbs: 1.2, protein: 5 },
      },
    },
  ],

  milk: [
    {
      substituteIngredient: "Unsweetened almond milk",
      ratio: "1:1 in most recipes",
      category: "plant-based dairy",
      notes: "Neutral; low protein, slightly thin. Add 1–2 tsp oil for richer bakes.",
      nutrition: {
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 40, fat: 3, carbs: 1, protein: 1 },
      },
    },
    {
      substituteIngredient: "Soy milk (unsweetened)",
      ratio: "1:1 in most recipes",
      category: "plant-based dairy",
      notes: "Closest protein to dairy; works well in custards and baking.",
      nutrition: {
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 100, fat: 4, carbs: 5, protein: 7 },
      },
    },
    {
      substituteIngredient: "Oat milk (barista/full-fat)",
      ratio: "1:1 in most recipes",
      category: "plant-based dairy",
      notes: "Creamy; slightly sweeter. Watch added sugars.",
      nutrition: {
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 120, fat: 5, carbs: 16, protein: 3 },
      },
    },
    {
      substituteIngredient: "½ water + ½ heavy cream",
      ratio: "½ cup water + ½ cup cream = 1 cup milk",
      category: "dairy",
      notes: "Emergency swap when only cream is on hand; richer than milk.",
      nutrition: {
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 205, fat: 22, carbs: 3, protein: 3 },
      },
    },
  ],

  "sour cream": [
    {
      substituteIngredient: "Plain Greek yogurt",
      ratio: "1:1",
      category: "dairy",
      notes: "Tangy and thick; strain for extra thickness.",
      nutrition: {
        original: { calories: 445, fat: 45, carbs: 9, protein: 5 },
        substitute: { calories: 220, fat: 11, carbs: 9, protein: 20 },
      },
    },
    {
      substituteIngredient: "Crème fraîche",
      ratio: "1:1",
      category: "dairy",
      notes: "Richer, less tangy; great for dolloping and sauces.",
      nutrition: {
        original: { calories: 445, fat: 45, carbs: 9, protein: 5 },
        substitute: { calories: 455, fat: 45, carbs: 4, protein: 6 },
      },
    },
    {
      substituteIngredient: "Buttermilk + melted butter",
      ratio: "¾ cup buttermilk + 3 Tbsp butter = 1 cup sour cream",
      category: "dairy",
      notes: "Works in batters/doughs; not for dolloping.",
      nutrition: {
        original: { calories: 445, fat: 45, carbs: 9, protein: 5 },
        substitute: { calories: 360, fat: 31, carbs: 12, protein: 7 },
      },
    },
  ],

  buttermilk: [
    {
      substituteIngredient: "Milk + acid (lemon or vinegar)",
      ratio: "1 Tbsp acid + milk to 1 cup; rest 5–10 min",
      category: "dairy",
      notes: "Good for pancakes/biscuits; not as thick/tangy as real buttermilk.",
      nutrition: {
        original: { calories: 152, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 149, fat: 8, carbs: 12, protein: 8 },
      },
    },
    {
      substituteIngredient: "Plain yogurt + water",
      ratio: "¾ cup yogurt + ¼ cup water = 1 cup",
      category: "dairy",
      notes: "Very close in acidity for baking.",
      nutrition: {
        original: { calories: 152, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 170, fat: 7, carbs: 14, protein: 9 },
      },
    },
  ],

  "heavy cream": [
    {
      substituteIngredient: "Milk + butter (melted)",
      ratio: "¼ cup melted butter + ¾ cup milk = 1 cup cream",
      category: "dairy",
      notes: "Good in sauces and many bakes; won’t whip.",
      nutrition: {
        original: { calories: 821, fat: 88, carbs: 7, protein: 5 },
        substitute: { calories: 515, fat: 46, carbs: 12, protein: 8 },
      },
    },
    {
      substituteIngredient: "Half-and-half + butter",
      ratio: "⅓ cup melted butter + ⅔ cup half-and-half = 1 cup",
      category: "dairy",
      notes: "Richer than half-and-half; still won’t whip.",
      nutrition: {
        original: { calories: 821, fat: 88, carbs: 7, protein: 5 },
        substitute: { calories: 640, fat: 65, carbs: 9, protein: 5 },
      },
    },
    {
      substituteIngredient: "Evaporated milk (undiluted)",
      ratio: "1:1 in sauces/soups",
      category: "dairy (canned)",
      notes: "Good for body without as much fat; not for whipping.",
      nutrition: {
        original: { calories: 821, fat: 88, carbs: 7, protein: 5 },
        substitute: { calories: 338, fat: 19, carbs: 25, protein: 17 },
      },
    },
  ],

  yogurt: [
    {
      substituteIngredient: "Sour cream",
      ratio: "1:1",
      category: "dairy",
      notes: "Richer and less protein; tang similar.",
      nutrition: {
        original: { calories: 220, fat: 11, carbs: 9, protein: 20 },
        substitute: { calories: 445, fat: 45, carbs: 9, protein: 5 },
      },
    },
    {
      substituteIngredient: "Buttermilk",
      ratio: "1:1 in batters/marinades",
      category: "dairy",
      notes: "Thinner; similar acidity; add thickener for dips.",
      nutrition: {
        original: { calories: 220, fat: 11, carbs: 9, protein: 20 },
        substitute: { calories: 152, fat: 8, carbs: 12, protein: 8 },
      },
    },
  ],

  "baking soda": [
    {
      substituteIngredient: "Baking powder",
      ratio: "Use 3× amount (reduce other acids)",
      category: "leavening",
      notes: "Baking powder contains acid already; adjust recipe acids down slightly.",
    },
    {
      substituteIngredient: "Potassium bicarbonate",
      ratio: "1:1 (plus pinch of salt)",
      category: "leavening",
      notes: "Sodium-free alternative; add a small pinch of salt to mimic taste.",
    },
  ],

  "baking powder": [
    {
      substituteIngredient: "Baking soda + acid",
      ratio: "¼ tsp baking soda + ½ tsp cream of tartar = 1 tsp powder",
      category: "leavening",
      notes: "Mix fresh; add ¼ tsp cornstarch if storing.",
    },
  ],

  "granulated sugar": [
    {
      substituteIngredient: "Brown sugar (light)",
      ratio: "1:1 by volume",
      category: "sweetener",
      notes: "Adds moisture/molasses flavor; slightly chewier bakes.",
    },
    {
      substituteIngredient: "Honey",
      ratio: "¾ cup honey = 1 cup sugar (reduce other liquid by ¼ cup)",
      category: "sweetener",
      notes: "Adds moisture and browning; lower oven temp by 25°F.",
    },
  ],

  "brown sugar": [
    {
      substituteIngredient: "Granulated sugar + molasses",
      ratio: "1 cup sugar + 1 Tbsp molasses = 1 cup light brown sugar",
      category: "sweetener",
      notes: "Use 2 Tbsp molasses for dark brown sugar.",
    },
  ],
};

/* ────────────────────────────────────────────────────────────────────────────
 * Internal helpers (search + lookup across BOTH catalogs)
 * ────────────────────────────────────────────────────────────────────────── */
const EXTRA_KEYS = Object.keys(SUPPLEMENT_CATALOG);
const UNION_KEYS = Array.from(new Set([...ALL_INGREDIENT_KEYS, ...EXTRA_KEYS]));

function findEntryInBaseCatalog(key: string): CatalogEntry | undefined {
  const k = norm(key);
  return SUBSTITUTIONS_CATALOG.find((e) => {
    const orig = norm(e.originalIngredient);
    if (orig === k) return true;
    const syns = (e.synonyms || []).map(norm);
    return syns.includes(k);
  });
}

function getFromAnyCatalog(key: string): SubstitutionItem[] {
  const base = findEntryInBaseCatalog(key)?.substitutions || [];
  const extra = SUPPLEMENT_CATALOG[key] || [];
  // Prefer base items first, then add extras that aren't duplicates by name
  const seen = new Set<string>();
  const out: SubstitutionItem[] = [];
  for (const item of [...base, ...extra]) {
    const n = norm(item.substituteIngredient || "");
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(item);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Public API (keeps old names AND your current *Local exports)
 * ────────────────────────────────────────────────────────────────────────── */
const ciIncludes = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());

export function searchIngredients(q: string): string[] {
  const s = norm(q);
  if (!s) return [];
  const starts = UNION_KEYS.filter((k) => k.startsWith(s));
  const contains = UNION_KEYS.filter((k) => !k.startsWith(s) && ciIncludes(k, s));
  return [...starts, ...contains].slice(0, 20);
}

export function getSubstitutions(ingredient: string): SubstitutionItem[] {
  const key = toKey(ingredient);
  return getFromAnyCatalog(key);
}

export function generateAISubstitutions(q: string) {
  const query = (q || "").trim();
  const substitutions = query ? getSubstitutions(query) : [];
  return { query, substitutions };
}

/* ── Your existing *Local names (kept so other parts of app don’t break) ── */

export function searchIngredientsLocal(q: string): string[] {
  return searchIngredients(q);
}

export function findEntryLocal(ingredient: string): CatalogEntry | undefined {
  const key = toKey(ingredient);
  return findEntryInBaseCatalog(key);
}

export function getSubsLocal(ingredient: string): SubstitutionItem[] {
  return getSubstitutions(ingredient);
}

/** Lightweight “AI-like” fallback (kept for compatibility) */
export function aiSuggestLocal(ingredient: string): {
  query: string;
  substitutions: SubstitutionItem[];
} {
  const query = (ingredient || "").trim();
  const subs = query ? getSubstitutions(query) : [];
  return { query, substitutions: subs.slice(0, 3) };
}
