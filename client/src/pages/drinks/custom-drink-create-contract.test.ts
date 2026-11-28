/**
 * The drink builders save through the server, and both ways they could fail did fail at once.
 *
 * The smoothie and caffeinated builders posted to `/api/custom-drinks`. The router is mounted at `/api/drinks`,
 * so every save 404'd -- the button did nothing, with no error a person would see. Behind that, the payload was
 * also invalid: protein, carbs, fiber and fat are NOT NULL decimals, which Drizzle takes as strings, and the
 * builders sent numbers for two of them and omitted the other two entirely. Fixing only the path would have
 * turned a silent 404 into a 400.
 *
 * Codex's P2 on #1514 was about THIS FILE rather than the fix: the first version of the payload test declared a
 * hard-coded fixture of its own and parsed that, so a builder reverting to numeric decimals, dropping
 * `fiber`/`fat` or sending a fractional rating would have left it green. It was a test that passed while
 * asserting nothing about the thing it was named after, guarding the exact defect the PR exists to fix -- and
 * the fixture was not even any of the four real payloads: it had no `drinkType`, and no `caffeine`/`sugar`.
 *
 * So the four payloads were extracted to `custom-drink-payload.ts`, the pages call those functions, and the
 * tests below call the same ones. There is one definition of each payload now, and these assertions are on it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { insertCustomDrinkSchema } from "../../../../shared/schema";
import {
  KEYS_WITH_NO_COLUMN,
  caffeinatedBuilderPayload,
  caffeinatedPremadePayload,
  smoothieBuilderPayload,
  smoothiePremadePayload,
} from "./custom-drink-payload";

const CLIENT_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** `userId` is added by the route from the session, so the payloads do not carry it and the schema needs it. */
const USER_ID = "00000000-0000-4000-8000-000000000001";
const asRequest = (payload: Record<string, unknown>) => ({ ...payload, userId: USER_ID });

/**
 * Inputs shaped like what the pages actually hold: ingredient totals that are not whole numbers, because
 * rounding them to a string is the thing that was wrong, and a fractional star rating, because the premade
 * cards carry 4.8 and the column is an integer.
 */
const SMOOTHIE_GOAL = { id: "post-workout", name: "Post-Workout" };
const SMOOTHIE_DRAFT = {
  ingredients: [
    { name: "banana", category: "fruit", calories: 105, protein: 1.3, carbs: 27, fiber: 3.1, icon: "🍌" },
    { name: "whey", category: "protein", calories: 120, protein: 24, carbs: 3, fiber: 0, icon: "🥛" },
    { name: "oats", category: "grain", calories: 150, protein: 5.3, carbs: 27.4, fiber: 4.2, icon: "🌾" },
  ],
  calories: 375.4,
  protein: 30.6,
  carbs: 57.44,
  fiber: 7.3,
};
const CAFFEINATED_GOAL = { id: "focus", name: "Focus" };
const CAFFEINATED_DRAFT = {
  ingredients: [
    { name: "espresso", category: "coffee", calories: 3, caffeine: 64, carbs: 0.5, sugar: 0, icon: "☕" },
    { name: "oat milk", category: "dairy", calories: 60, caffeine: 0, carbs: 9.17, sugar: 4.44, icon: "🥛" },
  ],
  calories: 63.2,
  caffeine: 64,
  carbs: 9.67,
  sugar: 4.44,
};
const SMOOTHIE_RECIPE = {
  name: "Green Recovery",
  workoutType: "Recovery",
  ingredients: ["spinach", "banana", "almond butter"],
  calories: 310,
  protein: 18.5,
  difficulty: "Easy",
  time: "5 min",
  rating: 4.8,
};
const CAFFEINATED_RECIPE = {
  name: "Cold Brew Focus",
  goalType: "Focus",
  ingredients: ["cold brew", "oat milk"],
  calories: 90,
  caffeine: 200,
  difficulty: "Easy",
  time: "3 min",
  rating: 4.5,
};

/** [label, the payload the page sends] -- the real functions, called the way the pages call them. */
const PAYLOADS: Array<[string, Record<string, unknown>]> = [
  ["smoothie builder", smoothieBuilderPayload(SMOOTHIE_GOAL, SMOOTHIE_DRAFT)],
  ["smoothie premade recipe", smoothiePremadePayload(SMOOTHIE_RECIPE)],
  ["caffeinated builder", caffeinatedBuilderPayload(CAFFEINATED_GOAL, CAFFEINATED_DRAFT)],
  ["caffeinated premade recipe", caffeinatedPremadePayload(CAFFEINATED_RECIPE)],
];

for (const [label, payload] of PAYLOADS) {
  test(`${label}: the payload it sends is one the create route accepts`, () => {
    const parsed = insertCustomDrinkSchema.safeParse(asRequest(payload));
    assert.equal(
      parsed.success,
      true,
      `${label} would be rejected with 400: ${JSON.stringify((parsed as any).error?.issues ?? [], null, 2)}`,
    );
  });

  test(`${label}: the four decimals are strings, and all four are present`, () => {
    // This is the original defect stated directly against the payload rather than a fixture: a number here is
    // a 400, and so is an omission, because all four columns are NOT NULL with no default.
    for (const field of ["protein", "carbs", "fiber", "fat"] as const) {
      assert.equal(
        typeof (payload as any)[field],
        "string",
        `${label} sends ${field} as ${typeof (payload as any)[field]}; the column is decimal, which Drizzle takes as a string`,
      );
      const { [field]: _dropped, ...without } = asRequest(payload);
      assert.equal(
        insertCustomDrinkSchema.safeParse(without).success,
        false,
        `${field} must be required by the schema, or this assertion proves nothing`,
      );
    }
  });

  test(`${label}: rating and the other integer columns are whole numbers`, () => {
    for (const field of ["calories", "prepTime", "rating"] as const) {
      const value = (payload as any)[field];
      assert.equal(typeof value, "number", `${label} sends ${field} as ${typeof value}; the column is an integer`);
      assert.equal(Number.isInteger(value), true, `${label} sends a fractional ${field} (${value}); the column is an integer`);
    }
  });

  test(`${label}: every key it sends survives the schema, except the ones with no column`, () => {
    // insertCustomDrinkSchema is a non-strict Zod object, so the route's .parse() STRIPS an unknown key and the
    // save succeeds having thrown the value away. That is how `caffeine` -- the figure a caffeinated drink is
    // built around -- is lost today. Asserting the list is exhaustive means a fifth phantom field added later
    // fails here instead of disappearing the same quiet way.
    const parsed = insertCustomDrinkSchema.parse(asRequest(payload)) as Record<string, unknown>;
    const dropped = Object.keys(payload).filter((key) => !(key in parsed));
    assert.deepEqual(
      dropped.sort(),
      [...KEYS_WITH_NO_COLUMN].filter((key) => key in payload).sort(),
      `${label} sends keys that custom_drinks silently discards: ${dropped.join(", ")}`,
    );
  });
}

test("the pages build their request bodies with the shared payload functions, not inline", () => {
  // The extraction above is only worth something while it is the single definition. An inline object literal
  // in a save handler would be invisible to every assertion in this file, which is how the first version of
  // this test came to prove nothing.
  const offenders: string[] = [];
  for (const page of ["smoothies/index.tsx", "caffeinated/index.tsx"]) {
    const text = readFileSync(join(CLIENT_SRC, "pages/drinks", page), "utf8");
    for (const body of text.matchAll(/body:\s*JSON\.stringify\(\s*([^)\n]*)/g)) {
      if (body[1].trim().startsWith("{")) offenders.push(`${page} -> inline object in a request body`);
    }
    if (!/custom-drink-payload/.test(text)) offenders.push(`${page} -> does not import the shared payloads`);
  }
  assert.deepEqual(offenders, [], `these should call a function from custom-drink-payload.ts:\n${offenders.join("\n")}`);
});

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

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
