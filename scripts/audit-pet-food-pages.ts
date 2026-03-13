import fs from "node:fs";
import path from "node:path";
import { canonicalPetFoodRecipeEntries, resolveCanonicalPetFoodSlug } from "../client/src/data/pet-food/canonical";
import { dogRecipes } from "../client/src/pages/pet-food/dogs";
import { catRecipes } from "../client/src/pages/pet-food/cats";
import { birdRecipes } from "../client/src/pages/pet-food/birds";
import { smallPetRecipes } from "../client/src/pages/pet-food/small-pets";

const pageFiles = [
  "client/src/pages/pet-food/index.tsx",
  "client/src/pages/pet-food/dogs/index.tsx",
  "client/src/pages/pet-food/cats/index.tsx",
  "client/src/pages/pet-food/birds/index.tsx",
  "client/src/pages/pet-food/small-pets/index.tsx",
];

const pageFailures: string[] = [];

for (const file of pageFiles) {
  const content = fs.readFileSync(path.resolve(file), "utf8");

  if (file.endsWith("/index.tsx") && file !== "client/src/pages/pet-food/index.tsx") {
    if (!content.includes("resolveCanonicalPetFoodSlug") || !content.includes("/pet-food/recipe/")) {
      pageFailures.push(`- ${file}: missing canonical route wiring`);
    }
    if (!content.includes("onClick={() => openRecipeModal(recipe)}")) {
      pageFailures.push(`- ${file}: card/button click does not route through canonical-first handler`);
    }
  }

  if (file === "client/src/pages/pet-food/index.tsx") {
    if (!content.includes("featuredRecipes.map") || !content.includes("resolveCanonicalPetFoodSlug(recipe.name)")) {
      pageFailures.push(`- ${file}: featured recipe cards are not canonical-routed`);
    }
    if (!content.includes("Link href=\"/pet-food/dogs\"")) {
      pageFailures.push(`- ${file}: View All CTA does not have a working route target`);
    }
  }
}

type RecipeShape = { name?: string };

const renderedRecipeCollections: Array<{ route: string; recipes: RecipeShape[] }> = [
  { route: "/pet-food/dogs", recipes: dogRecipes },
  { route: "/pet-food/cats", recipes: catRecipes },
  { route: "/pet-food/birds", recipes: birdRecipes },
  { route: "/pet-food/small-pets", recipes: smallPetRecipes },
];

const canonicalFailures: string[] = [];
for (const collection of renderedRecipeCollections) {
  for (const recipe of collection.recipes) {
    const name = String(recipe?.name ?? "").trim();
    if (!name) {
      canonicalFailures.push(`- ${collection.route}: unnamed recipe cannot resolve canonical slug`);
      continue;
    }

    const slug = resolveCanonicalPetFoodSlug(name);
    if (!slug) {
      canonicalFailures.push(`- ${collection.route} / ${name}: canonical slug resolution failed`);
    }
  }
}

if (pageFailures.length === 0 && canonicalFailures.length === 0) {
  console.log("✅ Pet-food page interaction audit passed.");
  console.log(`Checked ${pageFiles.length} pages and ${canonicalPetFoodRecipeEntries.length} canonical recipes.`);
  process.exit(0);
}

console.error("❌ Pet-food page interaction audit failed.");
if (pageFailures.length > 0) {
  console.error("\nPage wiring issues:");
  console.error(pageFailures.join("\n"));
}
if (canonicalFailures.length > 0) {
  console.error("\nCanonical resolution issues:");
  console.error(canonicalFailures.join("\n"));
}
process.exit(1);
