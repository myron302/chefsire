import canonicalDrinkData from "../../generated/drink-canonical.json";
import type { DrinkRecipe } from "./types";

export type CanonicalDrinkRecipeEntry = {
  slug: string;
  name: string;
  sourceRoute: string;
  sourceTitle: string;
  recipe: DrinkRecipe;
};
type CanonicalDrinkDataFile = {
  entries?: CanonicalDrinkRecipeEntry[];
  bySlug?: Record<string, CanonicalDrinkRecipeEntry>;
};

const canonicalDrinkJson = canonicalDrinkData as CanonicalDrinkDataFile;

export const canonicalDrinkRecipeEntries: CanonicalDrinkRecipeEntry[] = Array.isArray(canonicalDrinkJson.entries)
  ? canonicalDrinkJson.entries
  : [];

export const canonicalDrinkRecipeBySlug: Record<string, CanonicalDrinkRecipeEntry> = canonicalDrinkJson.bySlug ?? {};

export function getCanonicalDrinkRecipeBySlug(slug: string): CanonicalDrinkRecipeEntry | null {
  return canonicalDrinkRecipeBySlug[slug] ?? null;
}

type ResolveCanonicalDrinkSlugInput = {
  slug?: string | null;
  name?: string | null;
  sourceRoute?: string | null;
};

export function resolveCanonicalDrinkSlug({ slug, name, sourceRoute }: ResolveCanonicalDrinkSlugInput): string | null {
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
