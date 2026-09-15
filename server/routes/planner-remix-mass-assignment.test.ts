/**
 * Planner, grocery, family-profile and remix updates, driven as real HTTP requests.
 *
 * The defect: three update handlers read the request body as an object and handed it straight to
 * drizzle's `.set(...)`:
 *
 *     const updates = req.body;
 *     await db.update(groceryListItems).set(updates).where(...)       // PATCH /grocery-list/:id
 *     await db.update(familyMealProfiles).set(updates).where(...)     // PATCH /family-profiles/:id
 *     await db.update(recipeRemixes).set(updates).where(...)          // PUT   /remixes/:id
 *
 * Drizzle maps every key it is given to that table's column, so the body WAS the update statement.
 * Naming a column was enough to write it: `userId` handed the row to another account, `id` changed
 * its identity, `createdAt`/`purchasedAt` rewrote audit timestamps, `originalRecipeId` and
 * `remixedRecipeId` repointed a remix's lineage, and `likesCount`/`savesCount`/`remixCount` let a
 * routine edit forge engagement. Ownership was checked -- the `where` was scoped to the caller -- but
 * a check on WHICH row is reached says nothing about WHICH COLUMNS may be written, which is the whole
 * of this defect.
 *
 * These tests are the allowlist as a client sees it: for each endpoint, a legitimate patch, then one
 * forged field at a time, then a mixed payload. The rule asserted for a forged field is the strong
 * one -- 400, and the row byte-identical afterwards -- because a strip-and-continue repair would give
 * a 200 that looks like the attack worked while the row silently kept its value, and that difference
 * is exactly what "rejected" has to mean here.
 *
 * There is no Postgres; `db` is a double that really applies an update to stored rows and records the
 * object each `.set(...)` received, so a test can assert both what the caller sees and what would have
 * reached the database. The double drops `undefined` entries exactly as drizzle's `mapUpdateSet` does,
 * which is what makes the PATCH-semantics assertions meaningful. Auth is real: tokens are signed with
 * the repository's own `signAuthToken`, so a request that asserts an identity any other way -- a body
 * field, a query parameter, an `x-user-id` header -- is treated as the account its token names.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  groceryListItems,
  familyMealProfiles,
  recipeRemixes,
  recipes,
  users,
} from "../../shared/schema";
import {
  PLANNER_REMIX_FORBIDDEN_FIELDS,
  familyMealProfilePatchSchema,
  groceryListItemPatchSchema,
  remixPatchSchema,
  toFamilyMealProfilePatch,
  toGroceryListItemPatch,
  toRemixPatch,
} from "../../shared/planner-remix-mutations";
import { signAuthToken } from "../lib/jwt-config";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://planner-remix-tests/none";

const { db } = await import("../db");

const OWNER = "owner-user-id";
const VICTIM = "victim-user-id";
const ATTACKER = "attacker-user-id";

const GROCERY_ID = "grocery-item-id";
const PROFILE_ID = "family-profile-id";
const REMIX_ID = "remix-id";

const CREATED_AT = new Date("2024-01-01T00:00:00.000Z");
const PURCHASED_AT = new Date("2024-02-02T00:00:00.000Z");

/** The stored grocery row, in its pre-attack state. */
const groceryRow = () => ({
  id: GROCERY_ID,
  userId: OWNER,
  mealPlanId: "meal-plan-id",
  listName: "My Grocery List",
  ingredientName: "Tomatoes",
  quantity: "3",
  unit: "lb",
  location: "Produce",
  category: "produce",
  estimatedPrice: "4.00",
  actualPrice: null,
  store: "Corner Market",
  aisle: "1",
  priority: "normal",
  isPantryItem: false,
  purchased: false,
  purchasedAt: PURCHASED_AT,
  notes: "ripe ones",
  isRunningLow: false,
  createdAt: CREATED_AT,
});

const profileRow = () => ({
  id: PROFILE_ID,
  userId: OWNER,
  familyMemberId: "family-member-id",
  name: "Sam",
  calorieTarget: 2000,
  macroGoals: { protein: 150, carbs: 200, fat: 65 },
  preferences: ["spicy"],
  dislikes: ["olives"],
  portionMultiplier: "1.00",
  isActive: true,
  createdAt: CREATED_AT,
});

const remixRow = () => ({
  id: REMIX_ID,
  originalRecipeId: "original-recipe-id",
  remixedRecipeId: "remixed-recipe-id",
  userId: OWNER,
  remixType: "variation",
  changes: { notes: "swapped the butter for oil" },
  likesCount: 7,
  savesCount: 3,
  remixCount: 1,
  isPublic: true,
  createdAt: CREATED_AT,
});

// --------------------------------------------------------------------------------------------
// The database double
// --------------------------------------------------------------------------------------------

type Store = { table: unknown; rows: any[] };

let stores: Store[] = [];
/** Every object a route handed to `.set(...)`, with the table it targeted. */
let setCalls: Array<{ table: unknown; value: Record<string, unknown> }> = [];

const dialect = new PgDialect();

/** The bound values inside a drizzle `where`, in the order the clause binds them. */
function paramsOf(node: any, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const entry of node) paramsOf(entry, out);
    return out;
  }
  if (node.constructor?.name === "Param" && "value" in node) {
    out.push(node.value);
    return out;
  }
  if (Array.isArray(node.queryChunks)) for (const chunk of node.queryChunks) paramsOf(chunk, out);
  return out;
}

function storeFor(table: unknown) {
  return stores.find((entry) => entry.table === table);
}

/**
 * Rows a `where` selects. The clauses in play are equality conjunctions over a single table, so the
 * bound parameters are matched against the row's own values -- which is enough to tell "my row" from
 * "someone else's row", the distinction the cross-user tests turn on.
 */
function rowsMatching(table: unknown, clause: any) {
  const rows = storeFor(table)?.rows ?? [];
  if (!clause) return rows;
  const { sql } = dialect.sqlToQuery(clause);
  const bound = paramsOf(clause);
  const columns = [...sql.matchAll(/"([a-z_]+)"\."([a-z_]+)"/g)].map((match) => match[2]);
  return rows.filter((row) =>
    columns.every((column, index) => {
      const key = column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (index >= bound.length) return true;
      return row[key] === bound[index];
    })
  );
}

function installDatabaseDouble() {
  const anyDb = db as any;

  anyDb.execute = () => Promise.resolve({ rows: [] });

  anyDb.select = (fields?: any) => {
    let table: unknown;
    let whereClause: any = null;
    const chain: any = {
      from(t: unknown) { table = t; return chain; },
      innerJoin() { return chain; },
      leftJoin() { return chain; },
      where(clause: unknown) { whereClause = clause; return chain; },
      limit() { return chain; },
      offset() { return chain; },
      orderBy() { return chain; },
      groupBy() { return chain; },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => rowsMatching(table, whereClause))
          .then(resolve, reject);
      },
    };
    return chain;
  };

  anyDb.insert = (table: unknown) => ({
    values(value: any) {
      const row = { id: "inserted-row-id", createdAt: new Date(), ...value };
      storeFor(table)?.rows.push(row);
      const result: any = {
        onConflictDoUpdate() { return result; },
        onConflictDoNothing() { return result; },
        returning() { return result; },
        then: (resolve: any) => Promise.resolve([row]).then(resolve),
      };
      return result;
    },
  });

  anyDb.update = (table: unknown) => ({
    set(value: Record<string, unknown>) {
      setCalls.push({ table, value });
      // Drizzle's own `mapUpdateSet` drops `undefined` entries before building the statement, so an
      // omitted PATCH field never reaches SQL. The double has to do the same or the
      // preserved-on-omission assertions below would be testing the double, not the route.
      const applied = Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined)
      );
      return {
        where(clause: unknown) {
          const matched = rowsMatching(table, clause);
          for (const row of matched) Object.assign(row, applied);
          const result: any = {
            returning() { return result; },
            then: (resolve: any) => Promise.resolve(matched).then(resolve),
          };
          return result;
        },
      };
    },
  });

  anyDb.delete = (table: unknown) => ({
    where(clause: unknown) {
      const matched = rowsMatching(table, clause);
      const store = storeFor(table);
      if (store) store.rows = store.rows.filter((row) => !matched.includes(row));
      const result: any = {
        returning() { return result; },
        then: (resolve: any) => Promise.resolve(matched).then(resolve),
      };
      return result;
    },
  });
}

installDatabaseDouble();

const mealPlannerAdvancedRouter = (await import("./meal-planner-advanced")).default;
const remixesRouter = (await import("./remixes")).default;

const app = express();
app.use(express.json());
app.use("/api/meal-planner", mealPlannerAdvancedRouter);
app.use("/api/remixes", remixesRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

const asUser = (id: string) => ({ Authorization: `Bearer ${signAuthToken({ id })}` });

/** Reset the world: three rows owned by OWNER, plus the accounts `requireAuth` looks up. */
function given() {
  stores = [
    { table: groceryListItems, rows: [groceryRow()] },
    { table: familyMealProfiles, rows: [profileRow()] },
    { table: recipeRemixes, rows: [remixRow()] },
    {
      table: users,
      rows: [OWNER, VICTIM, ATTACKER].map((id) => ({
        id,
        username: `user-${id}`,
        avatar: null,
        nutritionPremium: false,
        nutritionTrialEndsAt: null,
      })),
    },
    {
      table: recipes,
      rows: [
        { id: "original-recipe-id", userId: VICTIM, title: "Original" },
        { id: "remixed-recipe-id", userId: OWNER, title: "Remixed" },
        { id: "other-recipe-id", userId: VICTIM, title: "Other" },
      ],
    },
  ];
  setCalls = [];
}

function stored(table: unknown, id: string) {
  return storeFor(table)?.rows.find((row) => row.id === id);
}

async function send(method: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: (() => { try { return JSON.parse(text); } catch { return null; } })(),
  };
}

/** Every `.set(...)` object a request produced, with drizzle's `undefined` filtering applied. */
function appliedSets() {
  return setCalls.map((call) =>
    Object.fromEntries(Object.entries(call.value).filter(([, value]) => value !== undefined))
  );
}

// ============================================================================================
// The three endpoints, as a table: what a legitimate edit is, and what must never be writable
// ============================================================================================

type Endpoint = {
  name: string;
  method: string;
  path: string;
  table: unknown;
  id: string;
  /** A patch the product legitimately sends, and the columns it is expected to change. */
  legitimate: Record<string, unknown>;
  /** Forged single-field payloads: a label -> the body, each of which must be refused. */
  forged: Record<string, Record<string, unknown>>;
};

const ENDPOINTS: Endpoint[] = [
  {
    name: "PATCH /api/meal-planner/grocery-list/:id",
    method: "PATCH",
    path: `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    table: groceryListItems,
    id: GROCERY_ID,
    // Exactly what `client/src/pages/pantry/shopping-list.tsx` sends when a user edits an item.
    legitimate: {
      ingredientName: "Heirloom tomatoes",
      quantity: "4",
      unit: "lb",
      category: "produce",
      notes: "the striped ones",
    },
    forged: {
      ownership: { userId: VICTIM },
      "resource id": { id: "some-other-item-id" },
      "created timestamp": { createdAt: "2030-01-01T00:00:00.000Z" },
      "purchase timestamp": { purchasedAt: "2030-01-01T00:00:00.000Z" },
      "meal plan relationship": { mealPlanId: "another-meal-plan-id" },
      "mixed legitimate + ownership": { ingredientName: "Valid new name", userId: VICTIM },
      "unknown field": { somethingInvented: true },
    },
  },
  {
    name: "PATCH /api/meal-planner/family-profiles/:id",
    method: "PATCH",
    path: `/api/meal-planner/family-profiles/${PROFILE_ID}`,
    table: familyMealProfiles,
    id: PROFILE_ID,
    legitimate: {
      name: "Sam (teen)",
      calorieTarget: 2400,
      preferences: ["spicy", "grilled"],
      portionMultiplier: 1.25,
    },
    forged: {
      ownership: { userId: VICTIM },
      "resource id": { id: "some-other-profile-id" },
      "created timestamp": { createdAt: "2030-01-01T00:00:00.000Z" },
      "family member relationship": { familyMemberId: "another-households-member-id" },
      "mixed legitimate + ownership": { name: "Valid new name", userId: VICTIM },
      "unknown field": { householdId: "attacker-household" },
    },
  },
  {
    name: "PUT /api/remixes/:id",
    method: "PUT",
    path: `/api/remixes/${REMIX_ID}`,
    table: recipeRemixes,
    id: REMIX_ID,
    legitimate: {
      remixType: "ingredient_swap",
      changes: { notes: "used olive oil instead", removedIngredients: ["butter"] },
      isPublic: false,
    },
    forged: {
      ownership: { userId: VICTIM },
      "resource id": { id: "some-other-remix-id" },
      "created timestamp": { createdAt: "2030-01-01T00:00:00.000Z" },
      "source recipe relationship": { originalRecipeId: "other-recipe-id" },
      "output recipe relationship": { remixedRecipeId: "other-recipe-id" },
      "likes counter": { likesCount: 99999 },
      "saves counter": { savesCount: 99999 },
      "remix counter": { remixCount: 99999 },
      "mixed legitimate + counter": { remixType: "variation", likesCount: 99999 },
      "mixed legitimate + ownership": { isPublic: false, userId: VICTIM },
      "unknown remix type": { remixType: "not-a-real-remix-type" },
      "unknown field inside changes": { changes: { userId: VICTIM } },
    },
  },
];

for (const endpoint of ENDPOINTS) {
  // ------------------------------------------------------------------------------------------
  // Legitimate patch: it succeeds, and it changes only what it named
  // ------------------------------------------------------------------------------------------

  test(`${endpoint.name}: a legitimate patch succeeds`, async () => {
    given();
    const result = await send(endpoint.method, endpoint.path, endpoint.legitimate, asUser(OWNER));
    assert.equal(result.status, 200, result.text);
  });

  test(`${endpoint.name}: a legitimate patch changes only the fields it named`, async () => {
    given();
    const before = { ...stored(endpoint.table, endpoint.id) };
    await send(endpoint.method, endpoint.path, endpoint.legitimate, asUser(OWNER));
    const after = stored(endpoint.table, endpoint.id)!;

    // `purchasedAt` is the server's own derived value; the legitimate patches here do not touch
    // `purchased`, so it must be untouched too, and it is covered by the named keys below.
    const named = new Set(Object.keys(endpoint.legitimate));
    for (const key of Object.keys(before)) {
      if (named.has(key)) continue;
      assert.deepEqual(
        after[key],
        (before as any)[key],
        `${key} changed although the patch never named it`
      );
    }
    for (const key of named) {
      assert.notEqual(after[key], undefined, `${key} was not written`);
    }
  });

  test(`${endpoint.name}: omitted fields keep their stored values`, async () => {
    given();
    const before = { ...stored(endpoint.table, endpoint.id) };
    const [onlyKey, onlyValue] = Object.entries(endpoint.legitimate)[0];
    const result = await send(endpoint.method, endpoint.path, { [onlyKey]: onlyValue }, asUser(OWNER));
    assert.equal(result.status, 200, result.text);

    const after = stored(endpoint.table, endpoint.id)!;
    for (const key of Object.keys(before)) {
      if (key === onlyKey) continue;
      assert.deepEqual(
        after[key],
        (before as any)[key],
        `${key} was overwritten by a patch that omitted it`
      );
    }
    // Not null, not false, not 0, not "" -- omission has to mean "leave it alone" all the way down
    // to the statement, so the `.set(...)` object must not carry the omitted columns at all.
    for (const applied of appliedSets()) {
      for (const key of Object.keys(applied)) {
        assert.ok(
          key === onlyKey || key === "purchasedAt",
          `${key} reached .set(...) although the request omitted it`
        );
      }
    }
  });

  test(`${endpoint.name}: an empty patch is a 400, not a database error`, async () => {
    given();
    const result = await send(endpoint.method, endpoint.path, {}, asUser(OWNER));
    assert.equal(result.status, 400, result.text);
    assert.deepEqual(setCalls, [], "an empty patch must not reach the database at all");
  });

  // ------------------------------------------------------------------------------------------
  // Forged fields: rejected as a whole, row unchanged, nothing sent to the database
  // ------------------------------------------------------------------------------------------

  for (const [label, body] of Object.entries(endpoint.forged)) {
    test(`${endpoint.name}: ${label} is rejected`, async () => {
      given();
      const before = { ...stored(endpoint.table, endpoint.id) };
      const result = await send(endpoint.method, endpoint.path, body, asUser(OWNER));

      assert.equal(result.status, 400, `expected a 400, got ${result.status}: ${result.text}`);
      assert.deepEqual(
        stored(endpoint.table, endpoint.id),
        before,
        `the row changed despite a rejected request: ${result.text}`
      );
      assert.deepEqual(
        setCalls,
        [],
        "a rejected request must not reach .set(...) at all -- not even with the forged key stripped"
      );
    });
  }

  // ------------------------------------------------------------------------------------------
  // Cross-user: knowing an id is not authority over it
  // ------------------------------------------------------------------------------------------

  test(`${endpoint.name}: another user cannot patch this row by knowing its id`, async () => {
    given();
    const before = { ...stored(endpoint.table, endpoint.id) };
    const result = await send(endpoint.method, endpoint.path, endpoint.legitimate, asUser(ATTACKER));

    assert.equal(result.status, 404, result.text);
    assert.deepEqual(stored(endpoint.table, endpoint.id), before, "another user's row was modified");
  });

  test(`${endpoint.name}: the update is scoped to the authenticated owner, not just the row id`, async () => {
    given();
    await send(endpoint.method, endpoint.path, endpoint.legitimate, asUser(ATTACKER));
    // The attacker's request reached `.set(...)` only if the statement ran at all; what matters is
    // that its `where` bound the AUTHENTICATED id, so it matched nothing. The row check above proves
    // the outcome; this pins that the scoping is in the statement rather than a prior read.
    const row = stored(endpoint.table, endpoint.id)!;
    assert.equal(row.userId, OWNER);
  });

  // ------------------------------------------------------------------------------------------
  // Forged actor: identity comes from the token and nothing else
  // ------------------------------------------------------------------------------------------

  test(`${endpoint.name}: an x-user-id header does not change the actor`, async () => {
    given();
    const result = await send(endpoint.method, endpoint.path, endpoint.legitimate, {
      ...asUser(ATTACKER),
      "x-user-id": OWNER,
    });
    assert.equal(result.status, 404, `x-user-id was honoured as identity: ${result.text}`);
  });

  test(`${endpoint.name}: a userId query parameter does not change the actor`, async () => {
    given();
    const result = await send(
      endpoint.method,
      `${endpoint.path}?userId=${OWNER}`,
      endpoint.legitimate,
      asUser(ATTACKER)
    );
    assert.equal(result.status, 404, `a query parameter was honoured as identity: ${result.text}`);
  });

  test(`${endpoint.name}: an unauthenticated request is refused`, async () => {
    given();
    const before = { ...stored(endpoint.table, endpoint.id) };
    const result = await send(endpoint.method, endpoint.path, endpoint.legitimate);
    assert.equal(result.status, 401, result.text);
    assert.deepEqual(stored(endpoint.table, endpoint.id), before);
  });
}

// ============================================================================================
// The grocery purchase timestamp: server-derived, both ways
// ============================================================================================

test("PATCH /grocery-list/:id: marking an item purchased stamps purchasedAt server-side", async () => {
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { purchased: true },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);

  const row = stored(groceryListItems, GROCERY_ID)!;
  assert.equal(row.purchased, true);
  assert.ok(row.purchasedAt instanceof Date, "purchasedAt was not stamped by the server");
  assert.notDeepEqual(row.purchasedAt, PURCHASED_AT, "purchasedAt kept its old value");
});

test("PATCH /grocery-list/:id: un-purchasing an item clears purchasedAt", async () => {
  given();
  await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { purchased: false },
    asUser(OWNER)
  );
  const row = stored(groceryListItems, GROCERY_ID)!;
  assert.equal(row.purchased, false);
  assert.equal(row.purchasedAt, null);
});

test("PATCH /grocery-list/:id: a purchased flag plus a forged purchasedAt is refused", async () => {
  given();
  const before = { ...stored(groceryListItems, GROCERY_ID) };
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { purchased: true, purchasedAt: "1999-01-01T00:00:00.000Z" },
    asUser(OWNER)
  );
  assert.equal(result.status, 400, result.text);
  assert.deepEqual(stored(groceryListItems, GROCERY_ID), before);
});

// ============================================================================================
// POST /api/remixes -- the create path reads named fields, and now validates them
// ============================================================================================

test("POST /api/remixes: a legitimate creation succeeds", async () => {
  given();
  const result = await send(
    "POST",
    "/api/remixes",
    {
      originalRecipeId: "original-recipe-id",
      remixedRecipeId: "remixed-recipe-id",
      remixType: "dietary_conversion",
      changes: { notes: "made it vegan" },
    },
    asUser(ATTACKER)
  );
  assert.equal(result.status, 200, result.text);
  // Attribution comes from the token, never from the body.
  assert.equal(result.body.remix.userId, ATTACKER);
});

test("POST /api/remixes: a body-supplied userId is refused rather than honoured", async () => {
  given();
  const result = await send(
    "POST",
    "/api/remixes",
    {
      originalRecipeId: "original-recipe-id",
      remixedRecipeId: "remixed-recipe-id",
      userId: VICTIM,
    },
    asUser(ATTACKER)
  );
  assert.equal(result.status, 400, result.text);
  assert.deepEqual(storeFor(recipeRemixes)?.rows.map((row) => row.id), [REMIX_ID]);
});

test("POST /api/remixes: a body-supplied counter is refused", async () => {
  given();
  const result = await send(
    "POST",
    "/api/remixes",
    {
      originalRecipeId: "original-recipe-id",
      remixedRecipeId: "remixed-recipe-id",
      likesCount: 99999,
    },
    asUser(ATTACKER)
  );
  assert.equal(result.status, 400, result.text);
});

test("POST /api/remixes: an unrecognized remix type is refused", async () => {
  given();
  const result = await send(
    "POST",
    "/api/remixes",
    {
      originalRecipeId: "original-recipe-id",
      remixedRecipeId: "remixed-recipe-id",
      remixType: "arbitrary-client-string",
    },
    asUser(ATTACKER)
  );
  assert.equal(result.status, 400, result.text);
});

// ============================================================================================
// The contracts themselves: the allowlist is structural, not a list of blocked names
// ============================================================================================

const CONTRACTS = [
  { name: "grocery list item", schema: groceryListItemPatchSchema },
  { name: "family meal profile", schema: familyMealProfilePatchSchema },
  { name: "remix", schema: remixPatchSchema },
];

for (const contract of CONTRACTS) {
  test(`${contract.name} contract: every server-controlled field name is refused`, () => {
    for (const field of PLANNER_REMIX_FORBIDDEN_FIELDS) {
      const parsed = contract.schema.safeParse({ [field]: "anything" });
      assert.equal(parsed.success, false, `${field} was accepted by the ${contract.name} contract`);
    }
  });

  test(`${contract.name} contract: an unknown field is refused, not stripped`, () => {
    const parsed = contract.schema.safeParse({ totallyUnknownField: 1 });
    assert.equal(parsed.success, false);
  });
}

test("the patch builders emit no server-controlled column, whatever they are handed", () => {
  // The builders are the only thing that reaches `.set(...)`. Even handed an object carrying every
  // forbidden name, they can only produce the columns they spell out -- which is what makes the
  // repair structural rather than a filter that a future field could slip past.
  const hostile = Object.fromEntries(
    PLANNER_REMIX_FORBIDDEN_FIELDS.map((field) => [field, "forged"])
  ) as any;

  const built = [
    toGroceryListItemPatch(hostile, new Date()),
    toFamilyMealProfilePatch(hostile),
    toRemixPatch(hostile),
  ];

  for (const patch of built) {
    for (const field of PLANNER_REMIX_FORBIDDEN_FIELDS) {
      if (field === "purchasedAt") continue; // server-derived, never client-supplied
      assert.ok(!(field in patch), `${field} appeared in a built patch`);
    }
  }

  // `purchasedAt` appears only as the server's own value, and only when `purchased` was validated.
  const groceryPatch = toGroceryListItemPatch(hostile, new Date());
  assert.equal(groceryPatch.purchasedAt, undefined);
});

test("no planner or remix update handler passes a request body to .set(...)", async () => {
  // A grep is not a proof of behavior, but it is a proof about SHAPE: the defect was a variable that
  // was the request body flowing into `.set(...)`, and this pins that no such variable came back
  // under another name in these two files.
  const { readFile } = await import("node:fs/promises");
  for (const file of ["./meal-planner-advanced.ts", "./remixes.ts"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.ok(
      !/const\s+updates\s*=\s*(req\.body|\{\s*\.\.\.req\.body)/.test(source),
      `${file} still derives an update object from the request body`
    );
    for (const match of source.matchAll(/\.set\(([^)]*)\)/g)) {
      const argument = match[1].trim();
      assert.ok(
        !/^(req\.body|body|updates|input|data|payload)$/.test(argument),
        `${file} passes \`${argument}\` straight to .set(...)`
      );
    }
  }
});

test("POST /api/remixes: a creation missing its recipe ids keeps its original 400 message", async () => {
  // The pre-repair handler answered this case with its own message; validation must not degrade an
  // existing client's error into something unrecognizable.
  given();
  const result = await send("POST", "/api/remixes", { remixType: "variation" }, asUser(ATTACKER));
  assert.equal(result.status, 400, result.text);
  assert.equal(result.body.error, "originalRecipeId and remixedRecipeId are required");
});

// ============================================================================================
// The update contract must not be narrower than the creation contract
//
// Codex flagged this on the first revision of the repair: `ingredientName` carried a 200-character
// cap that existed nowhere else in the repository. `ingredient_name` is `TEXT NOT NULL` with no
// `varchar(n)` and no CHECK, `POST /grocery-list` validates only `if (!ingredientName)`, the week
// generator writes raw recipe ingredient strings by itself, and no client input has a `maxLength` --
// so rows longer than the cap are ordinary data. Because the edit dialog in `shopping-list.tsx`
// resends `ingredientName` on every save, that cap turned a quantity change on such a row into a
// 400: data the product created, and then refused to let anyone edit.
//
// These tests pin the rule that prevents it coming back -- a value creation accepts stays editable --
// on the same rows the mass-assignment tests above protect.
// ============================================================================================

/** Longer than the cap that used to be here, and longer than any cap a future edit might add. */
const LONG_NAME = `Organic vine-ripened San Marzano tomatoes ${"very ".repeat(120)}fresh`;

assert.ok(LONG_NAME.length > 200, "the fixture must exceed the cap this regression is about");

/** Creates a grocery item through the real `POST /grocery-list` handler and returns its row. */
async function createGroceryItem(body: Record<string, unknown>, actor = OWNER) {
  const result = await send("POST", "/api/meal-planner/grocery-list", body, asUser(actor));
  return { result, row: result.body?.item ? stored(groceryListItems, result.body.item.id) : undefined };
}

test("POST /grocery-list accepts an ingredient name far longer than 200 characters", async () => {
  // Establishes the premise the rest of this section rests on: such a row is legitimate data, not
  // something only a hand-crafted fixture could produce.
  given();
  const { result, row } = await createGroceryItem({ ingredientName: LONG_NAME, quantity: "2" });
  assert.equal(result.status, 200, result.text);
  assert.equal(row?.ingredientName, LONG_NAME);
});

test("PATCH /grocery-list/:id: a quantity-only edit succeeds on a long-named row", async () => {
  given();
  const { row } = await createGroceryItem({ ingredientName: LONG_NAME, quantity: "2" });
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${row!.id}`,
    { quantity: "5" },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(stored(groceryListItems, row!.id)!.quantity, "5");
  assert.equal(stored(groceryListItems, row!.id)!.ingredientName, LONG_NAME, "the name was altered");
});

test("PATCH /grocery-list/:id: the UI's full edit payload succeeds on a long-named row", async () => {
  // The exact shape `client/src/pages/pantry/shopping-list.tsx` sends, which resends the stored name
  // verbatim -- the path that made the cap a blocking bug rather than a theoretical one.
  given();
  const { row } = await createGroceryItem({ ingredientName: LONG_NAME, quantity: "2" });
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${row!.id}`,
    {
      ingredientName: LONG_NAME,
      quantity: "6",
      unit: "lb",
      category: "produce",
      notes: "the striped ones",
    },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  const after = stored(groceryListItems, row!.id)!;
  assert.equal(after.ingredientName, LONG_NAME);
  assert.equal(after.quantity, "6");
});

test("PATCH /grocery-list/:id: a long-named row is still protected from mass assignment", async () => {
  // Loosening the value domain must not loosen the allowlist. Same row, same forged payloads.
  given();
  const { row } = await createGroceryItem({ ingredientName: LONG_NAME, quantity: "2" });
  const before = { ...stored(groceryListItems, row!.id) };

  for (const forged of [
    { userId: VICTIM },
    { id: "some-other-item-id" },
    { createdAt: "2030-01-01T00:00:00.000Z" },
    { purchasedAt: "2030-01-01T00:00:00.000Z" },
    { mealPlanId: "another-meal-plan-id" },
    { quantity: "5", userId: VICTIM },
    { somethingInvented: true },
  ]) {
    setCalls = [];
    const result = await send("PATCH", `/api/meal-planner/grocery-list/${row!.id}`, forged, asUser(OWNER));
    assert.equal(result.status, 400, `${JSON.stringify(forged)} was accepted: ${result.text}`);
    assert.deepEqual(stored(groceryListItems, row!.id), before, `the row changed for ${JSON.stringify(forged)}`);
    assert.deepEqual(setCalls, [], "a rejected request reached .set(...)");
  }
});

test("PATCH /grocery-list/:id: another user still cannot patch a long-named row", async () => {
  given();
  const { row } = await createGroceryItem({ ingredientName: LONG_NAME, quantity: "2" });
  const before = { ...stored(groceryListItems, row!.id) };
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${row!.id}`,
    { quantity: "5" },
    asUser(ATTACKER)
  );
  assert.equal(result.status, 404, result.text);
  assert.deepEqual(stored(groceryListItems, row!.id), before);
});

// --------------------------------------------------------------------------------------------
// Same class, every other text column: anything creation stores, editing accepts
// --------------------------------------------------------------------------------------------

test("PATCH /grocery-list/:id: every text column round-trips a value creation accepted", async () => {
  // The audit that followed Codex's finding: each of these carried an invented cap. A round-trip
  // edit -- read the row, send it back unchanged but for one field -- has to work for all of them,
  // because that is what a fuller edit UI would do.
  const long = "x".repeat(5000);
  given();
  const { result: created, row } = await createGroceryItem({
    ingredientName: long,
    listName: long,
    quantity: long,
    unit: long,
    category: long,
    store: long,
    aisle: long,
    priority: long,
    notes: long,
  });
  assert.equal(created.status, 200, created.text);

  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${row!.id}`,
    {
      ingredientName: long,
      listName: long,
      quantity: long,
      unit: long,
      location: long,
      category: long,
      store: long,
      aisle: long,
      priority: long,
      notes: long,
    },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(stored(groceryListItems, row!.id)!.notes, long);
});

test("PATCH /family-profiles/:id: long strings and unbounded jsonb values are accepted", async () => {
  given();
  const long = "y".repeat(5000);
  const result = await send(
    "PATCH",
    `/api/meal-planner/family-profiles/${PROFILE_ID}`,
    {
      name: long,
      calorieTarget: 1000000,
      macroGoals: { protein: 999999, carbs: 0.5, fat: -3 },
      preferences: [long, ""],
      dislikes: [long],
    },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  const after = stored(familyMealProfiles, PROFILE_ID)!;
  assert.equal(after.name, long);
  assert.equal(after.calorieTarget, 1000000);
});

test("PUT /remixes/:id: a long changes payload is accepted", async () => {
  given();
  const long = "z".repeat(5000);
  const result = await send(
    "PUT",
    `/api/remixes/${REMIX_ID}`,
    {
      changes: {
        notes: long,
        difficultyChange: long,
        addedIngredients: [long],
        prepTimeChange: 99999,
        nutritionChanges: { [long]: 1.5 },
      },
    },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(stored(recipeRemixes, REMIX_ID)!.changes.notes, long);
});

test("POST /api/remixes: the create and update contracts accept the same remix types", async () => {
  // The one narrowing this change makes is `remixType`, and it is only safe because creation enforces
  // the same enum -- so nothing POST can store is something PUT would then refuse.
  for (const remixType of ["variation", "dietary_conversion", "portion_adjustment", "ingredient_swap"]) {
    given();
    const created = await send(
      "POST",
      "/api/remixes",
      { originalRecipeId: "original-recipe-id", remixedRecipeId: "remixed-recipe-id", remixType },
      asUser(OWNER)
    );
    assert.equal(created.status, 200, created.text);

    const edited = await send("PUT", `/api/remixes/${REMIX_ID}`, { remixType }, asUser(OWNER));
    assert.equal(edited.status, 200, edited.text);
  }
});

// --------------------------------------------------------------------------------------------
// The limits that remain are the database's own, and they produce a 400 rather than a 500
// --------------------------------------------------------------------------------------------

test("PATCH /grocery-list/:id: a price within decimal(8,2) is accepted, beyond it is a 400", async () => {
  given();
  const ok = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { estimatedPrice: -999999.99, actualPrice: 999999.99 },
    asUser(OWNER)
  );
  assert.equal(ok.status, 200, ok.text);
  assert.equal(stored(groceryListItems, GROCERY_ID)!.actualPrice, "999999.99");

  given();
  const tooBig = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { estimatedPrice: 1000000 },
    asUser(OWNER)
  );
  assert.equal(tooBig.status, 400, tooBig.text);
  assert.deepEqual(setCalls, [], "an out-of-range numeric must not reach the database");
});

test("PATCH /family-profiles/:id: a multiplier within decimal(3,2) is accepted, beyond it is a 400", async () => {
  given();
  const ok = await send(
    "PATCH",
    `/api/meal-planner/family-profiles/${PROFILE_ID}`,
    { portionMultiplier: 9.99 },
    asUser(OWNER)
  );
  assert.equal(ok.status, 200, ok.text);
  assert.equal(stored(familyMealProfiles, PROFILE_ID)!.portionMultiplier, "9.99");

  given();
  const tooBig = await send(
    "PATCH",
    `/api/meal-planner/family-profiles/${PROFILE_ID}`,
    { portionMultiplier: 10 },
    asUser(OWNER)
  );
  assert.equal(tooBig.status, 400, tooBig.text);
});

test("PATCH /grocery-list/:id: a non-numeric price is a 400, not a database error", async () => {
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { estimatedPrice: "not a number" },
    asUser(OWNER)
  );
  assert.equal(result.status, 400, result.text);
  assert.deepEqual(setCalls, []);
});

test("the patch contracts carry no invented maximum on a text column", async () => {
  // A shape assertion on the contract itself, so a future `.max(n)` on one of these columns has to
  // be a deliberate decision with this test in front of it rather than an accident.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../shared/planner-remix-mutations.ts", import.meta.url),
    "utf8"
  );
  const helpers = source.slice(
    source.indexOf("const requiredText"),
    source.indexOf("const decimalField")
  );
  assert.ok(!/\.max\(/.test(helpers), "a text-column helper regained a maximum length");
});

// ============================================================================================
// Decimal columns keep PostgreSQL's semantics through the mutation path
//
// Codex flagged this on 9a150e5: the price validator normalized through a JavaScript number,
// `Number(value).toFixed(scale)`. That rewrote decimals the client sent -- `"1.005"` became
// `"1.00"` where Postgres stores `1.01` -- and its range check ran BEFORE rounding, so
// `"999999.994"` was rejected even though `numeric(8, 2)` rounds it to `999999.99`. It also hid
// genuine overflows: `Number("999999.995").toFixed(2)` is `"999999.99"`.
//
// Validation now decides only whether a value fits; the value itself reaches the database as it
// arrived, so Postgres does the rounding it has always done -- which is what `POST /grocery-list`
// relied on before this PR, since it passed its price straight to drizzle. `shared/pg-numeric.test.ts`
// pins the arithmetic against measured Postgres output; these tests pin the wire behavior.
// ============================================================================================

/** What actually reached `.set(...)` for one column, across a request. */
function setValueFor(column: string) {
  for (const call of setCalls) {
    if (column in call.value && call.value[column] !== undefined) return call.value[column];
  }
  return undefined;
}

test("PATCH /grocery-list/:id: \"1.005\" reaches the database as \"1.005\", never \"1.00\"", async () => {
  // The exact regression. If this value is normalized in JS it becomes "1.00" and the cent is lost;
  // passed through, Postgres rounds the decimal and stores 1.01.
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { actualPrice: "1.005" },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);

  const sent = setValueFor("actualPrice");
  assert.equal(sent, "1.005", `the decimal was rewritten before the database saw it: ${sent}`);
  assert.notEqual(sent, "1.00", "this is the float-rounding defect Codex reported");
  assert.equal(stored(groceryListItems, GROCERY_ID)!.actualPrice, "1.005");
});

test("PATCH /grocery-list/:id: negative and other half-way decimals are not rewritten either", async () => {
  for (const [input, floatWouldGive] of [
    ["-1.005", "-1.00"],
    ["2.675", "2.67"],
    ["1.015", "1.01"],
    ["0.005", "0.01"],
  ] as Array<[string, string]>) {
    given();
    const result = await send(
      "PATCH",
      `/api/meal-planner/grocery-list/${GROCERY_ID}`,
      { estimatedPrice: input },
      asUser(OWNER)
    );
    assert.equal(result.status, 200, result.text);
    const sent = setValueFor("estimatedPrice");
    assert.equal(sent, input, `${input} was rewritten to ${sent}`);
    if (floatWouldGive !== input) {
      assert.notEqual(sent, floatWouldGive, `${input} came back as the float-rounded ${floatWouldGive}`);
    }
  }
});

test("PATCH /grocery-list/:id: 999999.994 is accepted -- it rounds into numeric(8,2)", async () => {
  // Codex's boundary case. The previous check compared the UNROUNDED magnitude against the column
  // maximum and rejected a value Postgres stores as 999999.99.
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { actualPrice: "999999.994" },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(setValueFor("actualPrice"), "999999.994");
});

test("PATCH /grocery-list/:id: -999999.994 is accepted as well", async () => {
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { actualPrice: "-999999.994" },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
});

test("PATCH /grocery-list/:id: a value that overflows after rounding is a 400, not a 500", async () => {
  // 999999.995 rounds to 1000000.00, which numeric(8,2) cannot hold. Postgres would raise
  // `numeric field overflow`; the request must be refused before the driver sees it.
  for (const input of ["999999.995", "-999999.995", "999999.999", "1000000", "5e6"]) {
    given();
    const result = await send(
      "PATCH",
      `/api/meal-planner/grocery-list/${GROCERY_ID}`,
      { estimatedPrice: input },
      asUser(OWNER)
    );
    assert.equal(result.status, 400, `${input} was not refused: ${result.text}`);
    assert.deepEqual(setCalls, [], `${input} reached the database`);
  }
});

test("PATCH /grocery-list/:id: exact numeric(8,2) limits are accepted", async () => {
  for (const input of ["999999.99", "-999999.99", "0", "0.00"]) {
    given();
    const result = await send(
      "PATCH",
      `/api/meal-planner/grocery-list/${GROCERY_ID}`,
      { estimatedPrice: input },
      asUser(OWNER)
    );
    assert.equal(result.status, 200, `${input} was refused: ${result.text}`);
  }
});

test("PATCH /grocery-list/:id: extra fractional digits, leading zeros and exponents are accepted", async () => {
  for (const input of ["0.0049999", "007.5", "1.20", "1.", ".5", "-.5", "+1.5", "1e2", "1.5e1", "1E-3"]) {
    given();
    const result = await send(
      "PATCH",
      `/api/meal-planner/grocery-list/${GROCERY_ID}`,
      { actualPrice: input },
      asUser(OWNER)
    );
    assert.equal(result.status, 200, `${input} was refused: ${result.text}`);
    assert.equal(setValueFor("actualPrice"), input, `${input} was rewritten`);
  }
});

test("PATCH /grocery-list/:id: a malformed decimal is a 400", async () => {
  for (const input of ["", "abc", "1.2.3", "--1", "1e", "1,5", ".", "0x10", "$1.00"]) {
    given();
    const result = await send(
      "PATCH",
      `/api/meal-planner/grocery-list/${GROCERY_ID}`,
      { actualPrice: input },
      asUser(OWNER)
    );
    assert.equal(result.status, 400, `${JSON.stringify(input)} was accepted: ${result.text}`);
    assert.deepEqual(setCalls, []);
  }
});

test("PATCH /grocery-list/:id: a JSON number price still works, and keeps its own spelling", async () => {
  // `NutritionMealPlanner.tsx` posts a number, so numbers must remain valid; the conversion is the
  // number's shortest round-trip decimal, not a re-rounding of it.
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { estimatedPrice: 1.005, actualPrice: 0 },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(setValueFor("estimatedPrice"), "1.005");
  assert.equal(setValueFor("actualPrice"), "0");
});

test("PATCH /grocery-list/:id: a non-finite number price is a 400", async () => {
  // JSON cannot carry NaN or Infinity, but a client can send the strings, and `'NaN'::numeric` is a
  // legal Postgres value that would poison the report totals that sum this column.
  for (const input of ["NaN", "Infinity", "-Infinity"]) {
    given();
    const result = await send(
      "PATCH",
      `/api/meal-planner/grocery-list/${GROCERY_ID}`,
      { actualPrice: input },
      asUser(OWNER)
    );
    assert.equal(result.status, 400, `${input} was accepted: ${result.text}`);
  }
});

test("PATCH /grocery-list/:id: clearing a price with null still works", async () => {
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { estimatedPrice: null },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(stored(groceryListItems, GROCERY_ID)!.estimatedPrice, null);
});

// --------------------------------------------------------------------------------------------
// numeric(3, 2) has ONE integer digit -- its boundary is not numeric(8, 2)'s
// --------------------------------------------------------------------------------------------

test("PATCH /family-profiles/:id: portionMultiplier respects numeric(3,2), not numeric(8,2)", async () => {
  for (const [input, expected] of [
    ["9.99", 200],
    ["-9.99", 200],
    ["9.994", 200], // rounds to 9.99
    ["1.005", 200], // rounds to 1.01
    ["0.5", 200],
    ["9.995", 400], // rounds to 10.00 -- one integer digit cannot hold it
    ["-9.995", 400],
    ["10", 400],
    ["999999.99", 400], // valid for numeric(8,2), invalid here
  ] as Array<[string, number]>) {
    given();
    const result = await send(
      "PATCH",
      `/api/meal-planner/family-profiles/${PROFILE_ID}`,
      { portionMultiplier: input },
      asUser(OWNER)
    );
    assert.equal(result.status, expected, `${input} expected ${expected}: ${result.text}`);
  }
});

test("PATCH /family-profiles/:id: portionMultiplier \"1.005\" is not rewritten to \"1.00\"", async () => {
  given();
  const result = await send(
    "PATCH",
    `/api/meal-planner/family-profiles/${PROFILE_ID}`,
    { portionMultiplier: "1.005" },
    asUser(OWNER)
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(setValueFor("portionMultiplier"), "1.005");
  assert.equal(stored(familyMealProfiles, PROFILE_ID)!.portionMultiplier, "1.005");
});

// --------------------------------------------------------------------------------------------
// Loosening normalization must not loosen the allowlist
// --------------------------------------------------------------------------------------------

test("a price field cannot be used to smuggle a forbidden column", async () => {
  given();
  const before = { ...stored(groceryListItems, GROCERY_ID) };
  for (const forged of [
    { actualPrice: "1.005", userId: VICTIM },
    { actualPrice: "1.005", id: "some-other-item-id" },
    { actualPrice: "1.005", purchasedAt: "2030-01-01T00:00:00.000Z" },
    { estimatedPrice: "1.005", createdAt: "2030-01-01T00:00:00.000Z" },
  ]) {
    setCalls = [];
    const result = await send(
      "PATCH",
      `/api/meal-planner/grocery-list/${GROCERY_ID}`,
      forged,
      asUser(OWNER)
    );
    assert.equal(result.status, 400, `${JSON.stringify(forged)} was accepted: ${result.text}`);
    assert.deepEqual(stored(groceryListItems, GROCERY_ID), before);
    assert.deepEqual(setCalls, []);
  }
});

test("another user cannot set a price on someone else's item", async () => {
  given();
  const before = { ...stored(groceryListItems, GROCERY_ID) };
  const result = await send(
    "PATCH",
    `/api/meal-planner/grocery-list/${GROCERY_ID}`,
    { actualPrice: "1.005" },
    asUser(ATTACKER)
  );
  assert.equal(result.status, 404, result.text);
  assert.deepEqual(stored(groceryListItems, GROCERY_ID), before);
});

test("no decimal in the mutation contracts is normalized through a JavaScript number", async () => {
  // A shape assertion, so the float conversion cannot return under another name. The two `Number(...)`
  // uses left in `pg-numeric.ts` operate on a single digit and on an integer exponent, never on a
  // decimal value, and are asserted by name rather than banned outright.
  const { readFile } = await import("node:fs/promises");
  const contracts = await readFile(
    new URL("../../shared/planner-remix-mutations.ts", import.meta.url),
    "utf8"
  );
  const code = contracts.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const banned of ["toFixed", "parseFloat", "parseInt", "Number("]) {
    assert.ok(!code.includes(banned), `${banned} reappeared in the mutation contracts`);
  }

  const helper = await readFile(new URL("../../shared/pg-numeric.ts", import.meta.url), "utf8");
  const helperCode = helper.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const banned of ["toFixed", "parseFloat", "parseInt"]) {
    assert.ok(!helperCode.includes(banned), `${banned} appeared in the decimal helper`);
  }
  const numberUses = [...helperCode.matchAll(/Number\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.deepEqual(
    numberUses.sort(),
    ["exponentText", "out[i]"],
    `an unexpected Number(...) in the decimal helper: ${numberUses.join(", ")}`
  );
});
