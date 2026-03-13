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
