import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalPetFoodRecipeEntries,
  getCanonicalPetFoodRecipeBySlug,
} from "../client/src/data/pet-food/canonical";

type PetFoodIndexEntry = {
  slug: string;
  name: string;
  route: string;
  sourceRoute: string;
  sourceTitle: string;
  image: string | null;
};

type PetFoodIndexFile = {
  bySlug: Record<string, PetFoodIndexEntry>;
  generatedAt: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const generatedDirPath = path.join(repoRoot, "server", "generated");
const generatedFilePath = path.join(generatedDirPath, "pet-food-index.json");

function writeAtomically(filePath: string, contents: string) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, filePath);
}

function ensurePetFoodCanonicalLoaded() {
  if (canonicalPetFoodRecipeEntries.length > 0) return;
  // Triggers lazy load in canonical module.
  getCanonicalPetFoodRecipeBySlug("");
}

function main() {
  ensurePetFoodCanonicalLoaded();

  const bySlug: Record<string, PetFoodIndexEntry> = {};
  for (const entry of canonicalPetFoodRecipeEntries) {
    bySlug[entry.slug] = {
      slug: entry.slug,
      name: entry.name,
      image: typeof entry.image === "string" ? entry.image : null,
      route: `/pet-food/recipe/${entry.slug}`,
      sourceRoute: entry.sourceRoute,
      sourceTitle: entry.sourceTitle,
    };
  }

  const output: PetFoodIndexFile = {
    bySlug,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(generatedDirPath, { recursive: true });
  writeAtomically(generatedFilePath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`[generate-pet-food-index] Indexed ${Object.keys(bySlug).length} canonical pet food recipes.`);
}

main();
