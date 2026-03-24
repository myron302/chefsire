export function redirectToCanonicalRecipe(
  canonicalSlug: string | null | undefined,
  recipeBasePath: `/drinks/recipe` | `/pet-food/recipe`
): boolean {
  if (!canonicalSlug || typeof window === "undefined") {
    return false;
  }

  window.location.href = `${recipeBasePath}/${encodeURIComponent(canonicalSlug)}`;
  return true;
}

export function buildFallbackRecipeSlug(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function redirectToRecipeWithFallback(
  canonicalSlug: string | null | undefined,
  fallbackNameOrSlug: string | null | undefined,
  recipeBasePath: `/drinks/recipe` | `/pet-food/recipe`
): boolean {
  if (redirectToCanonicalRecipe(canonicalSlug, recipeBasePath)) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const fallbackSlug = buildFallbackRecipeSlug(fallbackNameOrSlug);
  if (!fallbackSlug) {
    return false;
  }

  window.location.href = `${recipeBasePath}/${encodeURIComponent(fallbackSlug)}`;
  return true;
}
