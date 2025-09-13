// server/features/substitutions/substitutions.service.ts
import {
  SUBSTITUTIONS_CATALOG,
  ALL_INGREDIENT_KEYS,
  CatalogEntry,
  SubstitutionItem,
} from "./substitutions.catalog";

// Simple case-insensitive contains match
function matches(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function searchIngredients(query: string): string[] {
  if (!query.trim()) return [];
  return ALL_INGREDIENT_KEYS
    .filter((name) => matches(name, query))
    .slice(0, 15);
}

export function findCatalogEntry(ingredient: string): CatalogEntry | undefined {
  const q = ingredient.trim().toLowerCase();
  return SUBSTITUTIONS_CATALOG.find((entry) => {
    const base = entry.originalIngredient.toLowerCase() === q;
    const syn = (entry.synonyms || []).some((s) => s.toLowerCase() === q);
    return base || syn;
  });
}

export function getSubstitutions(ingredient: string): SubstitutionItem[] {
  const entry = findCatalogEntry(ingredient);
  return entry?.substitutions || [];
}

/**
 * Fallback “AI-like” suggestions.
 * You can later replace this with a real LLM call; keep the same return shape.
 */
export function generateAISubstitutions(ingredient: string): {
  query: string;
  substitutions: SubstitutionItem[];
} {
  const base = getSubstitutions(ingredient);
  if (base.length > 0) {
    // If we already have curated items, return those as “AI” too
    return { query: ingredient, substitutions: base.slice(0, 3) };
  }

  // Tiny rules-of-thumb for a few common items:
  const lower = ingredient.toLowerCase();
  if (lower.includes("cream")) {
    return {
      query: ingredient,
      substitutions: [
        {
          substituteIngredient: "evaporated milk",
          ratio: "1:1",
          notes: "Works in soups/sauces; won’t whip.",
        },
        {
          substituteIngredient: "whole milk + butter",
          ratio: "3/4 cup milk + 1/4 cup butter = 1 cup cream",
          notes: "Adds fat; not for whipping.",
        },
      ],
    };
  }
  if (lower.includes("butter")) {
    return {
      query: ingredient,
      substitutions: [
        { substituteIngredient: "olive oil", ratio: "1:0.75", notes: "Use less oil by volume." },
        { substituteIngredient: "applesauce (unsweetened)", ratio: "1:1 (baking)", notes: "Healthier swap in bakes." },
      ],
    };
  }
  if (lower.includes("egg")) {
    return {
      query: ingredient,
      substitutions: [
        { substituteIngredient: "ground flax + water", ratio: "1 Tbsp + 3 Tbsp = 1 egg", notes: "Let rest 5 minutes." },
        { substituteIngredient: "silken tofu (blended)", ratio: "1/4 cup = 1 egg", notes: "Neutral binder in baking." },
      ],
    };
  }

  // Default generic response
  return {
    query: ingredient,
    substitutions: [
      { substituteIngredient: "chef’s choice: similar fat/liquid", ratio: "≈1:1", notes: "Pick closest texture & flavor." },
    ],
  };
}
