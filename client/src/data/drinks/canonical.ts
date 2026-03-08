import { drinkRouteRegistry, type DrinkRouteRegistryEntry } from "./index";
import { slugifyDrinkName, type DrinkRecipe } from "./types";

export type CanonicalDrinkRecipeEntry = {
  slug: string;
  name: string;
  sourceRoute: string;
  sourceTitle: string;
  recipe: DrinkRecipe;
};

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

      const slug = buildSlug(name, usedSlugs, routeEntry.route);
      usedSlugs.add(slug);

      entries.push({
        slug,
        name,
        sourceRoute: routeEntry.route,
        sourceTitle: routeEntry.title,
        recipe,
      });
    }
  }

  return entries;
}

export const canonicalDrinkRecipeEntries = collectCanonicalDrinkRecipeEntries(drinkRouteRegistry);

export const canonicalDrinkRecipeBySlug: Record<string, CanonicalDrinkRecipeEntry> =
  canonicalDrinkRecipeEntries.reduce<Record<string, CanonicalDrinkRecipeEntry>>((acc, entry) => {
    acc[entry.slug] = entry;
    return acc;
  }, {});

export function getCanonicalDrinkRecipeBySlug(slug: string): CanonicalDrinkRecipeEntry | null {
  return canonicalDrinkRecipeBySlug[slug] ?? null;
}
