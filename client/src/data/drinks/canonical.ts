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
