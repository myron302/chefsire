import fs from "node:fs";
import path from "node:path";
import { canonicalPetFoodRecipeEntries, getCanonicalPetFoodRecipeBySlug, resolveCanonicalPetFoodSlug } from "../client/src/data/pet-food/canonical";

resolveCanonicalPetFoodSlug("dogs");

type CheckResult = { file: string; issues: string[] };

const leafPages = [
  "dogs/index.tsx",
  "cats/index.tsx",
  "birds/index.tsx",
  "small-pets/index.tsx",
];

function readPetPage(file: string): string {
  return fs.readFileSync(path.resolve("client/src/pages/pet-food", file), "utf8");
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n|\.(?=\s|$)/).map((item) => item.trim()).filter(Boolean);
  return [];
}

const leafResults: CheckResult[] = leafPages.map((file) => {
  const src = readPetPage(file);
  const issues: string[] = [];

  if (!src.includes("resolveCanonicalPetFoodSlug(recipe.name)")) {
    issues.push("missing per-card canonical slug resolution");
  }
  if (!src.includes("onClick={() => handleRecipeCardNavigation(recipe)}")) {
    issues.push("card click is not wired to canonical-first navigation");
  }
  if (!src.includes("event.key === 'Enter' || event.key === ' '")) {
    issues.push("keyboard card activation is missing");
  }
  if (!src.includes("View Recipe")) {
    issues.push("missing visible View Recipe CTA");
  }
  if (!src.includes("handleRecipeCardNavigation(recipe);")) {
    issues.push("View Recipe button does not use canonical-first handler");
  }
  const hasCanonicalOpenWiring = src.includes("openCanonicalFirstRecipe({") || src.includes("redirectToCanonicalRecipe(canonicalSlug, '/pet-food/recipe')");
  if (!hasCanonicalOpenWiring) {
    issues.push("canonical route redirect fallback is not wired");
  }
  if (src.includes("View recipe") || src.includes("Canonical recipe")) {
    issues.push("non-standard action label casing");
  }

  return { file, issues };
});

const hub = fs.readFileSync(path.resolve("client/src/pages/pet-food/index.tsx"), "utf8");
const hubIssues: string[] = [];
if (!hub.includes('Link href="/pet-food"') || !hub.includes("View All")) {
  hubIssues.push("Featured 'View All' button is not linked to /pet-food");
}
if (!hub.includes("resolveCanonicalPetFoodSlug") || !hub.includes("/pet-food/recipe") || !hub.includes("targetPath")) {
  hubIssues.push("Featured recipe cards are not canonical-first");
}
if (!hub.includes("<Link key={recipe.id} href={targetPath}>")) {
  hubIssues.push("Featured cards are not wrapped with interactive links");
}

const canonicalIssues: string[] = [];
if (!canonicalPetFoodRecipeEntries.length) {
  canonicalIssues.push("canonical pet-food index is empty");
}
for (const entry of canonicalPetFoodRecipeEntries) {
  const bySlug = getCanonicalPetFoodRecipeBySlug(entry.slug);
  const byNameSlug = resolveCanonicalPetFoodSlug(entry.name);
  const ingredients = asList((entry as any).ingredients ?? entry.recipe?.ingredients);
  const instructions = asList((entry as any).instructions ?? entry.recipe?.instructions);
  const measurements = Array.isArray(entry.recipe?.measurements) ? entry.recipe.measurements.length : 0;
  const directions = Array.isArray(entry.recipe?.directions) ? entry.recipe.directions.length : 0;

  if (!bySlug) canonicalIssues.push(`${entry.slug}: not retrievable by slug`);
  if (byNameSlug !== entry.slug) canonicalIssues.push(`${entry.name}: name-to-slug resolution mismatch (${byNameSlug ?? "null"})`);

  const hasIngredients = ingredients.length > 0 || measurements > 0;
  const hasInstructions = instructions.length > 0 || directions > 0;
  if (!hasIngredients || !hasInstructions) {
    canonicalIssues.push(
      `${entry.slug} (${entry.name}): ${!hasIngredients ? "missing ingredients/measurements" : ""}${!hasIngredients && !hasInstructions ? " and " : ""}${!hasInstructions ? "missing instructions/directions" : ""}`,
    );
  }
}

const failedLeaf = leafResults.filter((r) => r.issues.length > 0);
if (!failedLeaf.length && !hubIssues.length && !canonicalIssues.length) {
  console.log("✅ Pet-food page audit passed.");
  console.log(`Checked ${leafPages.length} leaf pages, featured section wiring, and ${canonicalPetFoodRecipeEntries.length} canonical recipes.`);
  process.exit(0);
}

console.error("❌ Pet-food page audit failed.");
for (const result of failedLeaf) {
  console.error(`\n${result.file}`);
  for (const issue of result.issues) console.error(`- ${issue}`);
}
if (hubIssues.length) {
  console.error("\nHub page issues:");
  for (const issue of hubIssues) console.error(`- ${issue}`);
}
if (canonicalIssues.length) {
  console.error("\nCanonical issues:");
  for (const issue of canonicalIssues) console.error(`- ${issue}`);
}
process.exit(1);
