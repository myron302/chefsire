import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Built-in recipe data (drinks, pet food, baby food) carries invented rating, review-count and "trending" values.
 * None of it may be shown, used to rank recipes, or turned into a popularity claim. Real review data lives in other
 * pages (excluded below) and in the database.
 */
const PAGES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(PAGES, "..");
const DIRS = ["drinks", "pet-food", "recipes/baby-food"].map((d) => path.join(PAGES, d));
// Shared code that surfaces built-in drinks outside those folders.
const SHARED = ["components/UniversalSearch.tsx", "contexts/DrinksContext.tsx"].map((f) => path.join(SRC, f));
// Pages in these folders that show REAL, user-submitted reviews.
const REAL_REVIEW_PAGES = new Set(["collection-detail.tsx", "creator-dashboard.tsx"]);

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith(".tsx") && !REAL_REVIEW_PAGES.has(entry)) out.push(full);
  }
  return out;
}

const files = [...DIRS.flatMap((d) => tsxFiles(d)), ...SHARED];
const rel = (f: string) => path.relative(SRC, f);

const RULES: Array<[RegExp, string]> = [
  // Ranking by invented values.
  [/<option value="(rating|trending)"/, "rating/trending sort option"],
  [/useState(<[^>]*>)?\((['"])(rating|trending)\2\)/, "defaults to a rating/trending sort"],
  [/\b[ab]\.(rating|reviews)\b[^;\n]*-\s*\(?\s*[ab]\.(rating|reviews)\b/, "sorts by rating or review count"],
  [/includes\((['"])trending\1\)/, "trending filter"],
  // Labels and claims.
  [/Highest Rated|Top Rated|Sort by Rating|Most Popular This Week|Avg Rating|Average Rating/, "rating/popularity label"],
  [/\d\.\d\s*★/, "hardcoded star rating"],
  [/\.trending\s*&&/, "Trending badge"],
  // Rendered values.
  [/\{[\w.?]+\.rating\}|\{[\w.?]+\.metadata\.rating\}/, "renders a rating value"],
  [/\{[\w.?]+\.reviews\}|\breviews<\/span>/, "renders a review count"],
];

test("built-in recipe pages and shared drink code never rank by, label, or show invented ratings/popularity", () => {
  assert.ok(files.length > 40, `scanned ${files.length} files`);
  const offenders: string[] = [];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    for (const [re, what] of RULES) if (re.test(s)) offenders.push(`${rel(f)}: ${what}`);
  }
  assert.deepEqual(offenders, []);
});

test("the rules catch the forms that slipped through before", () => {
  const samples = [
    "{cocktail.trending && <Badge className=\"x\">Trending</Badge>}",
    "<div className=\"t\">4.6★</div><div>Avg Rating</div>",
    "{drink.rating}",
    "<span>{drink.reviews} reviews</span>",
    ".sort((a, b) => (b.reviews || 0) - (a.reviews || 0))",
    "if (activeFilters.includes('trending')) {",
  ];
  for (const sample of samples) assert.ok(RULES.some(([re]) => re.test(sample)), sample);
});
