import { redirectToCanonicalRecipe } from "@/lib/canonical-routing";

export function openCanonicalFirstRecipe({
  recipeName,
  resolveCanonicalSlug,
  recipeBasePath,
  onFallback,
}: {
  recipeName: string;
  resolveCanonicalSlug: (name: string) => string | null | undefined;
  recipeBasePath: `/drinks/recipe` | `/pet-food/recipe`;
  onFallback: () => void;
}): void {
  const canonicalSlug = resolveCanonicalSlug(recipeName);
  if (redirectToCanonicalRecipe(canonicalSlug, recipeBasePath)) {
    return;
  }

  onFallback();
}

export function getCanonicalFirstPath({
  recipeName,
  fallbackPath,
  resolveCanonicalSlug,
  recipeBasePath,
}: {
  recipeName: string;
  fallbackPath: string;
  resolveCanonicalSlug: (name: string) => string | null | undefined;
  recipeBasePath: `/drinks/recipe` | `/pet-food/recipe`;
}): string {
  const canonicalSlug = resolveCanonicalSlug(recipeName);
  return canonicalSlug ? `${recipeBasePath}/${canonicalSlug}` : fallbackPath;
}
