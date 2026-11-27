/**
 * The drink builders save through the server, and both ways they could fail did fail at once.
 *
 * The smoothie and caffeinated builders posted to `/api/custom-drinks`. The router is mounted at `/api/drinks`,
 * so every save 404'd -- the button did nothing, with no error a person would see. Behind that, the payload was
 * also invalid: protein, carbs, fiber and fat are NOT NULL decimals, which Drizzle takes as strings, and the
 * builders sent numbers for two of them and omitted the other two entirely. Fixing only the path would have
 * turned a silent 404 into a 400.
 *
 * Neither failure was reachable by any test, because nothing asserted what the builders send. These two do,
 * from opposite ends: one proves the payload shape satisfies the schema the route parses, the other proves no
 * client file posts to a drinks path that is not mounted. The second is the cheap one and catches the whole
 * class -- a prefix typo in any future builder.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { insertCustomDrinkSchema } from "../../../../shared/schema";

const CLIENT_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test("the payload the builders send is one the create route accepts", () => {
  // Exactly the shape client/src/pages/drinks/{smoothies,caffeinated}/index.tsx send, with userId added by the
  // route. Numbers where the column is an integer, strings where it is a decimal.
  const payload = {
    userId: "00000000-0000-4000-8000-000000000001",
    name: "Builder smoothie",
    category: "smoothies",
    ingredients: [{ name: "banana", amount: "1" }],
    calories: 240,
    carbs: "31.5",
    protein: "2",
    fiber: "0",
    fat: "0",
    fitnessGoal: "Everyday",
    difficulty: "Custom",
    prepTime: 4,
    rating: 5,
    isPublic: false,
  };
  const parsed = insertCustomDrinkSchema.safeParse(payload);
  assert.equal(parsed.success, true, `the builders' payload must parse: ${JSON.stringify((parsed as any).error?.issues ?? [], null, 2)}`);

  // The four decimals are NOT NULL, so dropping one is a 400 and not a silent default.
  for (const field of ["carbs", "protein", "fiber", "fat"] as const) {
    const { [field]: _dropped, ...without } = payload;
    assert.equal(
      insertCustomDrinkSchema.safeParse(without).success,
      false,
      `${field} is required, so this test would not notice if the builders stopped sending it`,
    );
  }

  // rating is an integer column: a half-star from a premade recipe has to be rounded before it is sent.
  assert.equal(insertCustomDrinkSchema.safeParse({ ...payload, rating: 4.8 }).success, false, "a fractional rating is refused");
});

test("no client file posts to a drinks endpoint that is not mounted", () => {
  // The router lives at /api/drinks. /api/custom-drinks, /api/drink-saves and friends simply do not exist, and a
  // fetch to one returns the SPA's own index.html rather than an error anybody notices.
  const offenders: string[] = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/["'`]\/api\/([a-z0-9-]+)/gi)) {
      const segment = match[1].toLowerCase();
      if (/^(custom-drinks|drink-saves|drink-collections|drink-recipes|drink-events|drink-challenges)$/.test(segment)) {
        offenders.push(`${relative(CLIENT_SRC, file)} -> /api/${segment}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `these belong under /api/drinks/:\n${offenders.join("\n")}`);
});
