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
  if (!src.includes("redirectToCanonicalRecipe(canonicalSlug, '/pet-food/recipe')")) {
    issues.push("canonical route redirect fallback is not wired");
  }

  return { file, issues };
});

const hub = fs.readFileSync(path.resolve("client/src/pages/pet-food/index.tsx"), "utf8");
const hubIssues: string[] = [];
if (!hub.includes('Link href="/pet-food"') || !hub.includes("View All")) {
  hubIssues.push("Featured 'View All' button is not linked to /pet-food");
}
if (!hub.includes("const canonicalSlug = resolveCanonicalPetFoodSlug(recipe.name);") || !hub.includes("const targetPath = canonicalSlug ? `/pet-food/recipe/${canonicalSlug}` : recipe.path;")) {
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

  if (!bySlug) canonicalIssues.push(`${entry.slug}: not retrievable by slug`);
  if (byNameSlug !== entry.slug) canonicalIssues.push(`${entry.name}: name-to-slug resolution mismatch (${byNameSlug ?? "null"})`);
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
