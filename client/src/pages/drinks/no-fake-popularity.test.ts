import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Built-in recipe data (drinks, pet food, baby food) carries invented rating, review-count and "trending" values.
 * None of it may be shown or used to rank recipes as if it were measured. Real review data lives in other pages.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["drinks", "pet-food", "recipes/baby-food"].map((d) => path.join(ROOT, d));
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

const files = DIRS.flatMap((d) => tsxFiles(d));

test("no sort option or default ranks built-in recipes by invented ratings or popularity", () => {
  assert.ok(files.length > 40);
  const offenders: string[] = [];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    const rel = path.relative(ROOT, f);
    if (/<option value="(rating|trending)"/.test(s)) offenders.push(`${rel}: rating/trending sort option`);
    if (/Highest Rated|Sort by Rating|Most Popular This Week/.test(s)) offenders.push(`${rel}: rating/popularity label`);
    if (/useState(<[^>]*>)?\((['"])(rating|trending)\2\)/.test(s)) offenders.push(`${rel}: defaults to rating/trending`);
    if (/b\.reviews\s*-\s*a\.reviews|\(b\.reviews \?\? 0\) - \(a\.reviews \?\? 0\)/.test(s)) offenders.push(`${rel}: sorts by review count`);
  }
  assert.deepEqual(offenders, []);
});

test("no built-in recipe card shows an invented rating or a Trending badge", () => {
  const offenders: string[] = [];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    const rel = path.relative(ROOT, f);
    if (/\.trending && \(/.test(s)) offenders.push(`${rel}: Trending badge`);
    if (/\{[a-zA-Z_]+\.rating\}|\{[a-zA-Z_]+\.metadata\.rating\}/.test(s)) offenders.push(`${rel}: renders a rating value`);
  }
  assert.deepEqual(offenders, []);
});
