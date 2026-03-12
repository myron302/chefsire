import { drinkRouteRegistry, type DrinkRouteRegistryEntry } from "./index";
import { slugifyDrinkName, type DrinkRecipe } from "./types";

export type CanonicalDrinkRecipeEntry = {
  slug: string;
  name: string;
  sourceRoute: string;
  sourceTitle: string;
  recipe: DrinkRecipe;
};

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|\.(?=\s|$)/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeRecipe(recipe: DrinkRecipe, sourceTitle: string): DrinkRecipe {
  const nestedRecipe = recipe?.recipe;
  const nestedMeasurements = Array.isArray(nestedRecipe?.measurements)
    ? nestedRecipe.measurements
        .map((measurement: any) => {
          const amount = String(measurement?.amount ?? "").trim();
          const unit = String(measurement?.unit ?? "").trim();
          const item = String(measurement?.item ?? "").trim();
          const note = String(measurement?.note ?? "").trim();
          const line = [amount, unit, item].filter(Boolean).join(" ").trim();
          if (!line) return "";
          return note ? `${line} (${note})` : line;
        })
        .filter(Boolean)
    : [];

  const normalizedIngredients = asStringList(recipe?.ingredients);
  const normalizedInstructions = asStringList(recipe?.instructions);
  const fallbackIngredients = nestedMeasurements;
  const fallbackInstructions = asStringList(nestedRecipe?.directions ?? recipe?.steps ?? recipe?.method);
  const defaultInstruction = `Follow the preparation method shown on the ${sourceTitle} card and serve immediately.`;

  return {
    ...recipe,
    ingredients: normalizedIngredients.length > 0 ? normalizedIngredients : fallbackIngredients,
    instructions:
      normalizedInstructions.length > 0
        ? normalizedInstructions
        : fallbackInstructions.length > 0
          ? fallbackInstructions
          : [defaultInstruction],
  };
}

function buildSlug(baseName: string, existingSlugs: Set<string>, sourceRoute: string): string {
  const baseSlug = slugifyDrinkName(baseName);
  if (!baseSlug) return "drink-recipe";

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  const routeSuffix = sourceRoute
    .replace(/^\/drinks\//, "")
    .split("/")
    .filter(Boolean)
    .join("-");

  const routeSlug = slugifyDrinkName(`${baseSlug}-${routeSuffix}`);
  if (routeSlug && !existingSlugs.has(routeSlug)) {
    return routeSlug;
  }

  let count = 2;
  while (existingSlugs.has(`${baseSlug}-${count}`)) {
    count += 1;
  }

  return `${baseSlug}-${count}`;
}

function collectCanonicalDrinkRecipeEntries(
  routeRegistry: DrinkRouteRegistryEntry[]
): CanonicalDrinkRecipeEntry[] {
  const entries: CanonicalDrinkRecipeEntry[] = [];
  const usedSlugs = new Set<string>();

  for (const routeEntry of routeRegistry) {
    for (const recipe of routeEntry.recipes ?? []) {
      const name = String(recipe?.name ?? "").trim();
      if (!name) continue;

      const normalizedRecipe = normalizeRecipe(recipe, routeEntry.title);

      const slug = buildSlug(name, usedSlugs, routeEntry.route);
      usedSlugs.add(slug);

      entries.push({
        slug,
        name,
        sourceRoute: routeEntry.route,
        sourceTitle: routeEntry.title,
        recipe: normalizedRecipe,
      });
    }
  }

  return entries;
}

export const canonicalDrinkRecipeEntries: CanonicalDrinkRecipeEntry[] = [];

export const canonicalDrinkRecipeBySlug: Record<string, CanonicalDrinkRecipeEntry> = {};

let canonicalDrinkRecipesInitialized = false;

function ensureCanonicalDrinkRecipesLoaded() {
  if (canonicalDrinkRecipesInitialized) return;
  canonicalDrinkRecipesInitialized = true;

  const entries = collectCanonicalDrinkRecipeEntries(drinkRouteRegistry);
  canonicalDrinkRecipeEntries.push(...entries);

  for (const entry of entries) {
    canonicalDrinkRecipeBySlug[entry.slug] = entry;
  }
}

export function getCanonicalDrinkRecipeBySlug(slug: string): CanonicalDrinkRecipeEntry | null {
  ensureCanonicalDrinkRecipesLoaded();
  return canonicalDrinkRecipeBySlug[slug] ?? null;
}

type ResolveCanonicalDrinkSlugInput = {
  slug?: string | null;
  name?: string | null;
  sourceRoute?: string | null;
};

export function resolveCanonicalDrinkSlug({ slug, name, sourceRoute }: ResolveCanonicalDrinkSlugInput): string | null {
  ensureCanonicalDrinkRecipesLoaded();
  const slugValue = String(slug ?? "").trim();
  if (slugValue && canonicalDrinkRecipeBySlug[slugValue]) return slugValue;

  const normalizedName = String(name ?? "").trim().toLowerCase();
  if (!normalizedName) return null;

  const normalizedSourceRoute = String(sourceRoute ?? "").trim();

  const exactMatch = canonicalDrinkRecipeEntries.find((entry) =>
    entry.name.trim().toLowerCase() === normalizedName &&
    (!normalizedSourceRoute || entry.sourceRoute === normalizedSourceRoute)
  );
  if (exactMatch) return exactMatch.slug;

  const fallbackNameMatch = canonicalDrinkRecipeEntries.find(
    (entry) => entry.name.trim().toLowerCase() === normalizedName
  );

  return fallbackNameMatch?.slug ?? null;
}
