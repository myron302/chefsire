import fs from "node:fs";
import path from "node:path";
import { canonicalPetFoodRecipeEntries, getCanonicalPetFoodRecipeBySlug, resolveCanonicalPetFoodSlug } from "../client/src/data/pet-food/canonical";

resolveCanonicalPetFoodSlug("dogs");

const petLeafPages = [
  "dogs/index.tsx",
  "cats/index.tsx",
  "birds/index.tsx",
  "small-pets/index.tsx",
];

const pageFailures: string[] = [];
for (const page of petLeafPages) {
  const absPath = path.resolve("client/src/pages/pet-food", page);
  const content = fs.readFileSync(absPath, "utf8");

  const missing: string[] = [];
  if (!content.includes("resolveCanonicalPetFoodSlug")) missing.push("canonical resolver wiring");
  if (!content.includes("/pet-food/recipe/") && !content.includes("redirectToCanonicalRecipe(canonicalSlug, '/pet-food/recipe')")) {
    missing.push("canonical route wiring");
  }
  if (!content.includes("View Recipe")) missing.push("standard 'View Recipe' label");
  if (!content.includes("Canonical Recipe")) missing.push("canonical label");

  if (missing.length > 0) pageFailures.push(`- ${page}: missing ${missing.join(" and ")}`);
}

const canonicalFailures: string[] = [];
if (canonicalPetFoodRecipeEntries.length === 0) {
  canonicalFailures.push("- canonical pet food index is empty");
}
for (const entry of canonicalPetFoodRecipeEntries) {
  const resolved = getCanonicalPetFoodRecipeBySlug(entry.slug);
  if (!resolved) {
    canonicalFailures.push(`- ${entry.slug}: canonical slug not resolvable`);
    continue;
  }

  if (!Array.isArray(resolved.ingredients) || resolved.ingredients.length === 0) {
    canonicalFailures.push(`- ${entry.slug} (${entry.name}): missing ingredients`);
  }
  if (!Array.isArray(resolved.instructions) || resolved.instructions.length === 0) {
    canonicalFailures.push(`- ${entry.slug} (${entry.name}): missing instructions`);
  }
}

const hubFailures: string[] = [];
const petHub = fs.readFileSync(path.resolve("client/src/pages/pet-food/index.tsx"), "utf8");
if (!petHub.includes('Link href="/pet-food/dogs"') || !petHub.includes("View All")) {
  hubFailures.push("- pet-food/index.tsx: Featured 'View All' CTA is not wired to an actual route.");
}

if (!petHub.includes("featuredRecipes.map") || !petHub.includes("href={recipe.path}")) {
  hubFailures.push("- pet-food/index.tsx: Featured cards are not wired as route links.");
}

if (pageFailures.length === 0 && canonicalFailures.length === 0 && hubFailures.length === 0) {
  console.log("✅ Pet food pages audit passed.");
  console.log(`Checked ${petLeafPages.length} leaf pet food pages and ${canonicalPetFoodRecipeEntries.length} canonical entries.`);
  process.exit(0);
}

console.error("❌ Pet food pages audit failed.");
if (pageFailures.length > 0) {
  console.error("\nLeaf page interaction issues:");
  console.error(pageFailures.join("\n"));
}
if (canonicalFailures.length > 0) {
  console.error("\nCanonical recipe data issues:");
  console.error(canonicalFailures.join("\n"));
}
if (hubFailures.length > 0) {
  console.error("\nHub CTA/card issues:");
  console.error(hubFailures.join("\n"));
}
process.exit(1);
