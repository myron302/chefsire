import fs from "node:fs";
import path from "node:path";
import { canonicalDrinkRecipeEntries, getCanonicalDrinkRecipeBySlug } from "../client/src/data/drinks/canonical";
import { drinkRouteRegistry } from "../client/src/data/drinks";

function getAllLeafDrinkPages(rootDir: string): string[] {
  const pages: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === "index.tsx") {
        const relative = path.relative(rootDir, fullPath).replaceAll(path.sep, "/");
        const segments = relative.split("/");
        if (segments.length === 3 && segments[0] !== "recipe") pages.push(relative);
      }
    }
  }

  walk(rootDir);
  return pages;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n|\.(?=\s|$)/).map((item) => item.trim()).filter(Boolean);
  return [];
}

const pagesRoot = path.resolve("client/src/pages/drinks");
const leafPages = getAllLeafDrinkPages(pagesRoot);

const pageFailures: string[] = [];
for (const page of leafPages) {
  const absPath = path.join(pagesRoot, page);
  const content = fs.readFileSync(absPath, "utf8");

  const hasCanonicalResolve = content.includes("resolveCanonicalDrinkSlug");
  const hasCanonicalRouting = content.includes("/drinks/recipe/") || content.includes("redirectToCanonicalRecipe(canonicalSlug, '/drinks/recipe')") || content.includes("openCanonicalFirstRecipe({");
  const hasRemixRouting = content.includes("/drinks/submit?remix=");

  const missing: string[] = [];
  if (!hasCanonicalResolve || !hasCanonicalRouting) missing.push("canonical route wiring");
  if (!hasRemixRouting) missing.push("remix wiring");

  if (content.includes("Canonical recipe") || content.includes("View recipe") || content.includes("Remix this drink")) missing.push("non-standard action label text");
  if (missing.length > 0) pageFailures.push(`- ${page}: missing ${missing.join(" and ")}`);
}

const canonicalFailures: string[] = [];
for (const routeEntry of drinkRouteRegistry) {
  for (const routeRecipe of routeEntry.recipes ?? []) {
    const slug = getCanonicalDrinkRecipeBySlug(String(routeRecipe?.slug ?? ""))?.slug;
    const byName = canonicalDrinkRecipeEntries.find(
      (entry) => entry.name.trim().toLowerCase() === String(routeRecipe?.name ?? "").trim().toLowerCase() && entry.sourceRoute === routeEntry.route,
    );
    const resolved = (slug ? getCanonicalDrinkRecipeBySlug(slug) : null) ?? byName;

    if (!resolved) {
      canonicalFailures.push(`- ${routeEntry.route} / ${routeRecipe?.name ?? "<unnamed>"}: canonical entry not resolved`);
      continue;
    }

    const ingredients = asList(resolved.recipe?.ingredients);
    const instructions = asList(resolved.recipe?.instructions);

    if (ingredients.length === 0 || instructions.length === 0) {
      canonicalFailures.push(
        `- ${resolved.slug} (${resolved.name}): ${ingredients.length === 0 ? "missing ingredients" : ""}${ingredients.length === 0 && instructions.length === 0 ? " and " : ""}${instructions.length === 0 ? "missing instructions" : ""}`,
      );
    }
  }
}

const hubFailures: string[] = [];
const drinksHub = fs.readFileSync(path.resolve("client/src/pages/drinks/index.tsx"), "utf8");
if (!drinksHub.includes('Link href="/drinks/smoothies"') || !drinksHub.includes("View All")) {
  hubFailures.push("- drinks/index.tsx: Featured 'View All' CTA is not wired to an actual route.");
}
if (!drinksHub.includes("featured") && !drinksHub.includes("Featured")) {
  hubFailures.push("- drinks/index.tsx: Featured section appears missing or static audit markers not found.");
}

if (pageFailures.length === 0 && canonicalFailures.length === 0 && hubFailures.length === 0) {
  console.log("✅ Drink canonical audit passed.");
  console.log(`Checked ${leafPages.length} leaf drink pages and ${canonicalDrinkRecipeEntries.length} canonical entries.`);
  process.exit(0);
}

console.error("❌ Drink canonical audit failed.");
if (pageFailures.length > 0) {
  console.error("\nLeaf page interaction issues:");
  console.error(pageFailures.join("\n"));
}
if (canonicalFailures.length > 0) {
  console.error("\nCanonical recipe data issues:");
  console.error(canonicalFailures.join("\n"));
}
if (hubFailures.length > 0) {
  console.error("\nHub CTA issues:");
  console.error(hubFailures.join("\n"));
}
process.exit(1);
