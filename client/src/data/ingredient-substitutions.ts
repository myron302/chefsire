// client/src/data/ingredient-substitutions.ts
// Lightweight catalog + fuzzy search utilities for ingredient substitutions.
// You can safely extend the DATA entries over time.

export type SubOption = {
  name: string;
  note?: string;        // “1 Tbsp lemon juice per 1 Tbsp vinegar…”
};

export type SubEntry = {
  id: string;           // slug
  name: string;         // canonical ingredient name
  synonyms?: string[];  // alt spellings/brands/vernacular
  groupId: string;      // high-level category to cluster results
  pantryCategory:       // maps into your pantry categories for filtering
    | "produce" | "dairy" | "meat" | "seafood" | "grains"
    | "spices" | "pantry" | "frozen" | "canned" | "beverages" | "other";
  substitutes: SubOption[];
  caution?: string;     // allergy or failure modes to highlight
};

export const GROUPS: { id: string; name: string }[] = [
  { id: "dairy", name: "Dairy" },
  { id: "eggs", name: "Eggs" },
  { id: "oils-fats", name: "Fats & Oils" },
  { id: "acids", name: "Acids & Vinegars" },
  { id: "sweeteners", name: "Sugars & Syrups" },
  { id: "spices-herbs", name: "Spices & Herbs" },
  { id: "grains-flours", name: "Grains & Flours" },
  { id: "beans-nuts", name: "Legumes & Nuts" },
  { id: "produce", name: "Produce" },
  { id: "meat", name: "Meats" },
  { id: "seafood", name: "Seafood" },
  { id: "misc", name: "Misc" },
];

// ---- Seed data (concise but useful). Add freely.
export const DATA: SubEntry[] = [
  {
    id: "buttermilk",
    name: "Buttermilk",
    synonyms: ["cultured buttermilk"],
    groupId: "dairy",
    pantryCategory: "dairy",
    substitutes: [
      { name: "Milk + lemon juice", note: "1 cup milk + 1 Tbsp lemon, rest 5–10 min" },
      { name: "Milk + white vinegar", note: "1 cup milk + 1 Tbsp vinegar" },
      { name: "Plain yogurt + milk", note: "3/4 cup yogurt + 1/4 cup milk" },
    ],
  },
  {
    id: "sour-cream",
    name: "Sour Cream",
    synonyms: ["crema agria"],
    groupId: "dairy",
    pantryCategory: "dairy",
    substitutes: [
      { name: "Greek yogurt", note: "Use 1:1; add 1 tsp lemon if tang needed" },
      { name: "Crème fraîche", note: "1:1; slightly less tangy" },
    ],
  },
  {
    id: "heavy-cream",
    name: "Heavy Cream",
    synonyms: ["heavy whipping cream", "double cream"],
    groupId: "dairy",
    pantryCategory: "dairy",
    substitutes: [
      { name: "Evaporated milk", note: "1:1 for cooking (not for whipping)" },
      { name: "Half & half + butter", note: "7/8 cup half & half + 1/8 cup butter" },
    ],
    caution: "Won’t whip unless fat ~36%+.",
  },
  {
    id: "egg",
    name: "Egg",
    synonyms: ["hen egg", "eggs"],
    groupId: "eggs",
    pantryCategory: "pantry",
    substitutes: [
      { name: "Applesauce (unsweetened)", note: "1/4 cup per egg (binding)" },
      { name: "Ground flax + water", note: "1 Tbsp flax + 3 Tbsp water = 1 egg" },
      { name: "Silken tofu (blended)", note: "1/4 cup per egg (moisture)" },
    ],
    caution: "Choose sub based on function (binding/leavening/moisture).",
  },
  {
    id: "olive-oil",
    name: "Olive Oil",
    synonyms: ["extra virgin olive oil", "evoo"],
    groupId: "oils-fats",
    pantryCategory: "pantry",
    substitutes: [
      { name: "Avocado oil", note: "Neutral, high smoke point" },
      { name: "Canola or sunflower oil", note: "Neutral; 1:1" },
      { name: "Melted butter", note: "Richer flavor; lower smoke point" },
    ],
  },
  {
    id: "white-vinegar",
    name: "White Vinegar",
    synonyms: ["distilled vinegar"],
    groupId: "acids",
    pantryCategory: "pantry",
    substitutes: [
      { name: "Apple cider vinegar", note: "1:1; fruitier" },
      { name: "Lemon juice", note: "1:1 in marinades/dressings; watch pH" },
      { name: "Rice vinegar", note: "Milder; 1.25× for same acidity" },
    ],
  },
  {
    id: "brown-sugar",
    name: "Brown Sugar",
    synonyms: ["light brown sugar", "dark brown sugar"],
    groupId: "sweeteners",
    pantryCategory: "pantry",
    substitutes: [
      { name: "White sugar + molasses", note: "1 cup + 1 Tbsp molasses (light)" },
      { name: "White sugar + maple syrup", note: "Use part liquid; adjust moisture" },
    ],
  },
  {
    id: "all-purpose-flour",
    name: "All-Purpose Flour",
    synonyms: ["ap flour", "plain flour"],
    groupId: "grains-flours",
    pantryCategory: "grains",
    substitutes: [
      { name: "Bread flour", note: "Slightly chewier result" },
      { name: "Cake flour", note: "Tender crumb; add 2 Tbsp per cup AP" },
      { name: "GF blend", note: "Use a 1:1 gluten-free blend; add binder" },
    ],
  },
  {
    id: "cumin",
    name: "Cumin",
    synonyms: ["ground cumin", "comino"],
    groupId: "spices-herbs",
    pantryCategory: "spices",
    substitutes: [
      { name: "Coriander + chili powder", note: "Flavor adjacency" },
      { name: "Caraway (sparingly)", note: "Sharper; start at half" },
    ],
  },
  {
    id: "garam-masala",
    name: "Garam Masala",
    groupId: "spices-herbs",
    pantryCategory: "spices",
    substitutes: [
      { name: "Curry powder + extra cumin", note: "Not identical; close vibe" },
      { name: "DIY blend", note: "Cumin, coriander, cardamom, clove, cinnamon" },
    ],
  },
];

// ---- Fuzzy search (no deps)
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreMatch(q: string, target: string) {
  // ultra-simple contains + startsWith scoring
  if (target.startsWith(q)) return 1.0;
  if (target.includes(q)) return 0.8;
  return 0;
}

export type FindResult = {
  entry: SubEntry;
  score: number;
  matchedAs: "name" | "synonym";
};

export function findSubstitutions(query: string, opts?: { groupId?: string }) {
  const q = normalize(query);
  if (!q) return [] as FindResult[];

  const out: FindResult[] = [];
  for (const e of DATA) {
    if (opts?.groupId && e.groupId !== opts.groupId) continue;

    const nameScore = scoreMatch(q, normalize(e.name));
    if (nameScore > 0) out.push({ entry: e, score: nameScore, matchedAs: "name" });

    if (e.synonyms?.length) {
      for (const syn of e.synonyms) {
        const s = scoreMatch(q, normalize(syn));
        if (s > 0) out.push({ entry: e, score: s * 0.95, matchedAs: "synonym" });
      }
    }
  }
  // dedupe by id keeping best score
  const best = new Map<string, FindResult>();
  for (const r of out) {
    const prior = best.get(r.entry.id);
    if (!prior || r.score > prior.score) best.set(r.entry.id, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}
