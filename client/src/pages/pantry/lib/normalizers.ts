import type { PantryItem } from "./types";

export function normalizePantryItemsResponse(data: any): PantryItem[] {
  return data?.items || [];
}

export function normalizeExpiringItemsResponse(data: any): PantryItem[] {
  return data?.items || [];
}

export function normalizeAllergenWarningsResponse(data: any): any[] {
  return data?.warnings || [];
}
