import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CanonicalPetFoodIndexEntry = {
  slug: string;
  name: string;
  route: string;
  sourceRoute: string;
  sourceTitle?: string;
  image?: string | null;
};

type CanonicalPetFoodIndexFile = {
  bySlug?: Record<string, CanonicalPetFoodIndexEntry>;
};

let petFoodIndexCache: CanonicalPetFoodIndexFile | null | undefined;

function loadPetFoodIndex(): CanonicalPetFoodIndexFile | null {
  if (petFoodIndexCache !== undefined) {
    return petFoodIndexCache;
  }

  try {
    const servicesDir = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(servicesDir, "..", "generated", "pet-food-index.json");
    const json = fs.readFileSync(filePath, "utf8");
    petFoodIndexCache = JSON.parse(json) as CanonicalPetFoodIndexFile;
  } catch {
    petFoodIndexCache = null;
  }

  return petFoodIndexCache;
}

export function getCanonicalPetFoodBySlug(slug: string): CanonicalPetFoodIndexEntry | null {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  const index = loadPetFoodIndex();
  if (!index) return null;

  if (index.bySlug?.[normalizedSlug]) {
    return index.bySlug[normalizedSlug];
  }

  return null;
}
