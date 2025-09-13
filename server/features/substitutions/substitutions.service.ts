// server/features/substitutions/substitutions.service.ts
import {
  SUBSTITUTIONS_CATALOG,
  ALL_INGREDIENT_KEYS,
  CatalogEntry,
  SubstitutionItem,
} from "./substitutions.catalog";

const ciIncludes = (a: string, b: string) =>
  a.toLowerCase().includes(b.toLowerCase());

export function searchIngredientsLocal(q: string): string[] {
  if (!q.trim()) return [];
  return ALL_INGREDIENT_KEYS.filter((n) => ciIncludes(n, q)).slice(0, 15);
}

export function findEntryLocal(ingredient: string): CatalogEntry | undefined {
  const k = ingredient.trim().toLowerCase();
  return SUBSTITUTIONS_CATALOG.find((e) => {
    if (e.originalIngredient.toLowerCase() === k) return true;
    return (e.synonyms || []).some((s) => s.toLowerCase() === k);
  });
}

export function getSubsLocal(ingredient: string): SubstitutionItem[] {
  return findEntryLocal(ingredient)?.substitutions || [];
}

/** Lightweight “AI-like” fallback (replace with real LLM later if you want) */
export function aiSuggestLocal(ingredient: string): {
  query: string;
  substitutions: SubstitutionItem[];
} {
  const base = getSubsLocal(ingredient);
  if (base.length) return { query: ingredient, substitutions: base.slice(0, 3) };

  const k = ingredient.toLowerCase();
  if (k.includes("cream")) {
    return {
      query: ingredient,
      substitutions: [
        { substituteIngredient: "evaporated milk", ratio: "1:1", notes: "Great in sauces; won’t whip." },
        { substituteIngredient: "whole milk + butter", ratio: "3/4 cup + 1/4 cup = 1 cup cream", notes: "Not for whipping." },
      ],
    };
  }
  if (k.includes("butter")) {
    return {
      query: ingredient,
      substitutions: [
        { substituteIngredient: "olive oil", ratio: "1:0.75", notes: "Use ~25% less by volume." },
        { substituteIngredient: "applesauce (unsweetened)", ratio: "1:1 (baking)", notes: "Healthier in cakes/muffins." },
      ],
    };
  }
  if (k.includes("egg")) {
    return {
      query: ingredient,
      substitutions: [
        { substituteIngredient: "ground flax + water", ratio: "1 Tbsp + 3 Tbsp = 1 egg", notes: "Rest 5 minutes." },
        { substituteIngredient: "silken tofu (blended)", ratio: "1/4 cup = 1 egg", notes: "Neutral binder." },
      ],
    };
  }

  return {
    query: ingredient,
    substitutions: [
      { substituteIngredient: "closest texture/fat/liquid", ratio: "≈1:1", notes: "Pick nearest match by function." },
    ],
  };
}
