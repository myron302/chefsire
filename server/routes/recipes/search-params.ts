import { parseContentSourceFilter } from "@shared/content-source";

export const DEFAULT_RECIPES_PAGE_SIZE = 24;
export const DEFAULT_RECIPES_OFFSET = 0;
export const DEFAULT_TRENDING_LIMIT = 10;

export function parseListParam(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

export function parseNumberParam(input: unknown, defaultValue: number): number {
  const value =
    typeof input === "string" ? Number(input) : typeof input === "number" ? input : defaultValue;

  return Number.isFinite(value) ? value : defaultValue;
}

export function parseSearchQueryParam(query: Record<string, unknown>): string | undefined {
  const q = typeof query.q === "string" ? query.q : undefined;
  if (q !== undefined) return q;

  // Backward/compat mapping for clients that still send `search`.
  return typeof query.search === "string" ? query.search : undefined;
}

export function parseRecipeSearchParams(query: Record<string, unknown>) {
  return {
    q: parseSearchQueryParam(query),
    cuisines: parseListParam(query.cuisines),
    diets: parseListParam(query.diets),
    mealTypes: parseListParam(query.mealTypes),
    source: parseContentSourceFilter(query.source),
    pageSize: parseNumberParam(query.pageSize, DEFAULT_RECIPES_PAGE_SIZE),
    offset: parseNumberParam(query.offset, DEFAULT_RECIPES_OFFSET),
  };
}
