// client/src/hooks/useRecipesFilters.tsx

// Ensure there's only one context/provider in the app:
export * from "../pages/recipes/useRecipesFilters";

// Also re-export the catalog constants so pages that import from this hook keep working.
export {
  CUISINES,
  MEAL_TYPES,
  DIETARY,
  DIFFICULTY,
  ALLERGENS,
  ETHNICITY_REGIONS,
  ETHNICITIES,
} from "../pages/recipes/filters.catalog";
