import { birdRecipes } from "@/pages/pet-food/birds";
import { catRecipes } from "@/pages/pet-food/cats";
import { dogRecipes } from "@/pages/pet-food/dogs";
import { smallPetRecipes } from "@/pages/pet-food/small-pets";

type PetFoodPageRecipe = {
  id?: string;
  name?: string;
  image?: string;
  category?: string;
  difficulty?: string;
  prepTime?: number;
  rating?: number;
  reviews?: number;
  badges?: string[];
  nutrition?: Record<string, unknown>;
  recipe?: {
    measurements?: Array<{ amount: number | string; unit: string; item: string; note?: string }>;
    directions?: string[];
  };
};

type PetFoodSource = {
  route: string;
  title: string;
  recipes: PetFoodPageRecipe[];
};

const petFoodSources: PetFoodSource[] = [
  { route: "/pet-food/dogs", title: "Dog Food", recipes: dogRecipes },
  { route: "/pet-food/cats", title: "Cat Food", recipes: catRecipes },
  { route: "/pet-food/birds", title: "Bird Food", recipes: birdRecipes },
  { route: "/pet-food/small-pets", title: "Small Pets", recipes: smallPetRecipes },
];

function slugifyPetFoodName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function buildSlug(baseName: string, sourceRoute: string, usedSlugs: Set<string>): string {
  const baseSlug = slugifyPetFoodName(baseName);
  if (!baseSlug) return "pet-food-recipe";
  if (!usedSlugs.has(baseSlug)) return baseSlug;

  const routeSuffix = sourceRoute.replace("/pet-food/", "").replace(/\//g, "-");
  const routeSlug = slugifyPetFoodName(`${baseSlug}-${routeSuffix}`);
  if (routeSlug && !usedSlugs.has(routeSlug)) return routeSlug;

  let count = 2;
  while (usedSlugs.has(`${baseSlug}-${count}`)) count += 1;
  return `${baseSlug}-${count}`;
}

export type CanonicalPetFoodRecipeEntry = {
  slug: string;
  name: string;
  image?: string;
  sourceRoute: string;
  sourceTitle: string;
  ingredients: string[];
  instructions: string[];
  metadata: {
    id?: string;
    category?: string;
    difficulty?: string;
    prepTime?: number;
    rating?: number;
    reviews?: number;
    badges?: string[];
    nutrition?: Record<string, unknown>;
  };
};

export const canonicalPetFoodRecipeEntries: CanonicalPetFoodRecipeEntry[] = [];
export const canonicalPetFoodRecipeBySlug: Record<string, CanonicalPetFoodRecipeEntry> = {};

let loaded = false;

function ingredientLabel(ingredient: { amount: number | string; unit: string; item: string; note?: string }): string {
  const amount = String(ingredient.amount ?? "").trim();
  const unit = String(ingredient.unit ?? "").trim();
  const item = String(ingredient.item ?? "").trim();
  const note = String(ingredient.note ?? "").trim();
  return [amount, unit, item].filter(Boolean).join(" ") + (note ? ` (${note})` : "");
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;

  const usedSlugs = new Set<string>();
  for (const source of petFoodSources) {
    for (const recipe of source.recipes) {
      const name = String(recipe?.name ?? "").trim();
      if (!name) continue;
      const slug = buildSlug(name, source.route, usedSlugs);
      usedSlugs.add(slug);

      const entry: CanonicalPetFoodRecipeEntry = {
        slug,
        name,
        image: recipe.image,
        sourceRoute: source.route,
        sourceTitle: source.title,
        ingredients: (recipe.recipe?.measurements ?? []).map(ingredientLabel),
        instructions: recipe.recipe?.directions ?? [],
        metadata: {
          id: recipe.id,
          category: recipe.category,
          difficulty: recipe.difficulty,
          prepTime: recipe.prepTime,
          rating: recipe.rating,
          reviews: recipe.reviews,
          badges: recipe.badges,
          nutrition: recipe.nutrition,
        },
      };

      canonicalPetFoodRecipeEntries.push(entry);
      canonicalPetFoodRecipeBySlug[slug] = entry;
    }
  }
}

export function getCanonicalPetFoodRecipeBySlug(slug: string): CanonicalPetFoodRecipeEntry | null {
  ensureLoaded();
  return canonicalPetFoodRecipeBySlug[slug] ?? null;
}

export function resolveCanonicalPetFoodSlug(query: string): string | null {
  ensureLoaded();
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const exact = canonicalPetFoodRecipeEntries.find((entry) => entry.name.toLowerCase() === normalized);
  return exact?.slug ?? null;
}
