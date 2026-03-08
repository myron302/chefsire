import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CanonicalDrinkIndexEntry = {
  slug: string;
  name: string;
  route: string;
  sourceRoute: string;
  sourceTitle?: string;
  image?: string | null;
};

type CanonicalDrinkIndexFile = {
  bySlug?: Record<string, CanonicalDrinkIndexEntry>;
  recipes?: Record<string, CanonicalDrinkIndexEntry>;
};

let drinkIndexCache: CanonicalDrinkIndexFile | null | undefined;

function loadDrinkIndex(): CanonicalDrinkIndexFile | null {
  if (drinkIndexCache !== undefined) {
    return drinkIndexCache;
  }

  try {
    const servicesDir = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(servicesDir, "..", "generated", "drink-index.json");
    const json = fs.readFileSync(filePath, "utf8");
    drinkIndexCache = JSON.parse(json) as CanonicalDrinkIndexFile;
  } catch {
    drinkIndexCache = null;
  }

  return drinkIndexCache;
}

export function getCanonicalDrinkBySlug(slug: string): CanonicalDrinkIndexEntry | null {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  const index = loadDrinkIndex();
  if (!index) return null;

  if (index.bySlug?.[normalizedSlug]) {
    return index.bySlug[normalizedSlug];
  }

  const recipes = index.recipes ? Object.values(index.recipes) : [];
  return recipes.find((entry) => entry.slug === normalizedSlug) ?? null;
}
