/**
 * CS-CL-03: PATCH /api/drinks/custom-drinks/:id as real HTTP against the real router and the real
 * storage layer. Only the database is a double: it records every `.set(...)` object and the rendered
 * WHERE (SQL + bound params), and applies an update only if the bound owner matches the stored row.
 */
import "../test-support/accept-test-sessions";
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { insertCustomDrinkSchema } from "../../shared/schema";
import { signAuthToken } from "../lib/jwt-config";

process.env.DATABASE_URL ||= "postgres://u:p@custom-drink-tests.invalid/none";

const OWNER = "owner-id";
const VICTIM = "victim-id";
const ATTACKER = "attacker-id";
const DRINK = "drink-1";
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id, av: 1 } as any)}` });

const fresh = () => ({
  id: DRINK, userId: OWNER, name: "Green", category: "smoothies", drinkType: "green",
  ingredients: [], calories: 100, protein: "1.00", carbs: "2.00", fiber: "3.00", fat: "4.00",
  description: "d", imageUrl: null, fitnessGoal: null, difficulty: null, prepTime: 5, rating: 5,
  isPublic: false, likesCount: 7, savesCount: 8, sharesCount: 9,
  createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
});
let row = fresh();
const rawQueries: string[] = [];
let sets: Array<{ value: any; sql: string; params: unknown[] }> = [];
const paramsOf = (n: any, out: unknown[] = []): unknown[] => {
  if (!n || typeof n !== "object") return out;
  if (n.constructor?.name === "Param" && "value" in n) { out.push(n.value); return out; }
  if (Array.isArray(n.queryChunks)) n.queryChunks.forEach((c: any) => paramsOf(c, out));
  return out;
};

const { pool } = await import("../db/index");
const colsOf = (text: string) => {
  const ret = text.match(/returning (.*)$/is)?.[1] ?? text.match(/^select (.*?) from/is)?.[1] ?? "";
  return [...ret.matchAll(/"([a-z_]+)"(?:,|\s|$)/g)].map((m) => m[1]);
};
const camel = (c: string) => c.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
const arrayRow = (text: string) => colsOf(text).map((c) => (row as any)[camel(c)]);
/** Fake pg: records real UPDATE SQL + bound params; an UPDATE only hits if BOTH id and owner match the stored row. */
(pool as any).query = async (q: any, maybeParams?: any[]) => {
  const text: string = typeof q === "string" ? q : q.text;
  const params: unknown[] = maybeParams ?? (typeof q === "string" ? [] : q.values ?? []);
  rawQueries.push(text);
  if (/^update "custom_drinks"/i.test(text)) {
    const setPart = text.match(/set (.*) where/is)?.[1] ?? "";
    const setCols = [...setPart.matchAll(/"([a-z_]+)" = /g)].map((m) => m[1]);
    const n = setCols.length;
    const value: Record<string, unknown> = {};
    setCols.forEach((c, i) => (value[camel(c)] = params[i]));
    const where = text.match(/where (.*?)( returning|$)/is)?.[1] ?? "";
    sets.push({ value, sql: where, params: params.slice(n) });
    const hit = params.slice(n).includes(row.id) && params.slice(n).includes(row.userId);
    if (hit) for (const [k, v] of Object.entries(value)) (row as any)[k] = typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v;
    return { rows: hit ? [arrayRow(text)] : [], rowCount: hit ? 1 : 0, fields: [] };
  }
  if (/^select .* from "custom_drinks"/is.test(text)) return { rows: [arrayRow(text)], rowCount: 1, fields: [] };
  if (/^insert/i.test(text)) return { rows: [["x"]], rowCount: 1, fields: [] };
  if (/^update/i.test(text)) { sets.push({ value: { raw: text }, sql: text, params }); return { rows: [], rowCount: 1, fields: [] }; }
  return { rows: [], rowCount: 0, fields: [] };
};

const { default: drinksRouter } = await import("./drinks");
const app = express();
app.use(express.json());
app.use("/api/drinks", drinksRouter);
const server = app.listen(0);
test.after(() => server.close());
const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/custom-drinks/${DRINK}`;
const patch = (body: unknown, headers: Record<string, string> = tok(OWNER)) =>
  fetch(base(), { method: "PATCH", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
test.beforeEach(() => { row = fresh(); sets = []; });

test("anonymous PATCH -> 401, nothing written", async () => {
  const r = await patch({ name: "x" }, {});
  assert.equal(r.status, 401);
  assert.equal(sets.length, 0);
});

test("cross-user PATCH -> 404 (indistinguishable from nonexistent, CS-CL-08), no mutation", async () => {
  const r = await patch({ name: "hijack" }, tok(ATTACKER));
  assert.equal(r.status, 404);
  // No pre-read: authorization is the owner-scoped UPDATE itself, which matches no row for a non-owner.
  assert.ok(sets.every((s) => s.params.includes(ATTACKER) && !s.params.includes(OWNER)));
  assert.equal(row.name, "Green");
});

test("owner edits every editable field; UPDATE scoped by id AND owner", async () => {
  const body = {
    name: "N", category: "protein", drinkType: "t",
    ingredients: [{ name: "a", category: "c", calories: 1, protein: 1, carbs: 1, fiber: 1, icon: "i" }],
    calories: 200, protein: 10, carbs: "11.5", fiber: 3, fat: 4, description: "D", imageUrl: "u",
    fitnessGoal: "g", difficulty: "easy", prepTime: 9, rating: 4, isPublic: true,
  };
  const r = await patch(body);
  assert.equal(r.status, 200);
  assert.equal(sets.length, 1);
  assert.deepEqual(sets[0].params.sort(), [DRINK, OWNER].sort());
  assert.match(sets[0].sql, /"id" = \$\d+/);
  assert.match(sets[0].sql, /"user_id" = \$\d+/);
  assert.equal(row.name, "N");
  assert.equal(row.isPublic, true);
  assert.equal(row.protein, "10");
  assert.equal(row.userId, OWNER);
  assert.equal(row.likesCount, 7);
  const keys = Object.keys(sets[0].value).filter((k) => sets[0].value[k] !== undefined).sort();
  assert.deepEqual(keys, [...Object.keys(body), "updatedAt"].sort());
  assert.equal(((await r.json()) as any).drink.userId, OWNER);
});

const forbidden: Record<string, unknown> = {
  userId: VICTIM, id: "other", likesCount: 999, savesCount: 999, sharesCount: 999,
  createdAt: "2000-01-01T00:00:00Z", updatedAt: "2000-01-01T00:00:00Z",
  user_id: VICTIM, likes_count: 1, moderationStatus: "approved", user: { id: VICTIM }, unknownField: 1,
};
for (const [k, v] of Object.entries(forbidden)) {
  test(`forbidden field ${k} alone and mixed -> 400, row unchanged`, async () => {
    for (const body of [{ [k]: v }, { name: "Legit", [k]: v }]) {
      const r = await patch(body);
      assert.equal(r.status, 400);
    }
    assert.equal(sets.length, 0);
    assert.deepEqual(row, fresh());
  });
}

test("nested forbidden key inside ingredients -> 400", async () => {
  const r = await patch({ ingredients: [{ name: "a", category: "c", calories: 1, protein: 1, carbs: 1, fiber: 1, icon: "i", userId: VICTIM }] });
  assert.equal(r.status, 400);
  assert.equal(sets.length, 0);
});

test("empty and non-object bodies -> 400", async () => {
  for (const b of [{}, [], null, "x"]) assert.equal((await patch(b)).status, 400);
  assert.equal(sets.length, 0);
});

test("stale ownership check: owned UPDATE matching zero rows -> 404, not success", async () => {
  // row reassigned between the route's lookup and UPDATE: lookup double still says OWNER, UPDATE sees otherwise
  const { storage } = await import("../storage");
  const orig = storage.getCustomDrink;
  (storage as any).getCustomDrink = async () => ({ ...row, userId: OWNER });
  row.userId = VICTIM;
  try {
    const r = await patch({ name: "x" });
    assert.equal(r.status, 404);
    assert.equal(row.name, "Green");
  } finally { (storage as any).getCustomDrink = orig; }
});

test("storage ignores non-allowlisted keys even if a caller passes them", async () => {
  const { storage } = await import("../storage");
  await storage.updateOwnedCustomDrink(DRINK, OWNER, { name: "ok", userId: VICTIM, likesCount: 1 } as any);
  assert.deepEqual(Object.keys(sets[0].value).sort(), ["name", "updatedAt"]);
  assert.equal(row.userId, OWNER);
});

test("legitimate like/save still use server-side atomic increments", async () => {
  const { storage } = await import("../storage");
  // CS-CL-06: engagement is a short transaction (lock+visibility, write, counter); answer each statement minimally.
  const log: string[] = [];
  const answer = async (q: any) => {
    const text: string = typeof q === "string" ? q : q.text;
    log.push(text);
    if (/^select id from custom_drinks/i.test(text.trim())) return { rows: [{ id: DRINK }], rowCount: 1, fields: [] };
    if (/^insert into "drink_(likes|saves)"/i.test(text.trim())) return { rows: [{ id: "e1", user_id: ATTACKER, drink_id: DRINK, created_at: new Date() }], rowCount: 1, fields: [] };
    return { rows: [], rowCount: 1, fields: [] };
  };
  const origQuery = (pool as any).query;
  const origConnect = (pool as any).connect;
  (pool as any).query = answer;
  (pool as any).connect = async () => ({ query: answer, release() {} });
  try {
    await storage.likeDrink(ATTACKER, DRINK);
    await storage.saveDrink(ATTACKER, DRINK);
  } finally {
    (pool as any).query = origQuery;
    (pool as any).connect = origConnect;
  }
  const raw = log.join("\n");
  assert.match(raw, /"likes_count" = COALESCE\("likes_count", 0\) \+ 1/);
  assert.match(raw, /"saves_count" = COALESCE\("saves_count", 0\) \+ 1/);
});

/* ---- ingredient-shape compatibility: what the real creators send ---- */
const smoothieRow = { id: 1727000000000, name: "Banana", category: "fruits", calories: 89, protein: 1.1, carbs: 22.8, fiber: 2.6, icon: "🍌", boost: "potassium" };
const caffeinatedRow = { id: 1727000000001, name: "Espresso", category: "base", calories: 3, caffeine: 64, carbs: 0, sugar: 0, icon: "☕", boost: "focus" };
const shapes: Record<string, unknown[]> = {
  "smoothies (catalog row with client id)": [smoothieRow],
  "smoothies (premade row)": [{ name: "Kale", category: "ingredient", calories: 0, protein: 0, carbs: 0, fiber: 0, icon: "🥤" }],
  "caffeinated (caffeine/sugar/id, no protein/fiber)": [caffeinatedRow],
  "caffeinated (premade row)": [{ name: "Matcha", category: "ingredient", calories: 0, caffeine: 0, carbs: 0, sugar: 0, icon: "☕" }],
  "string id and name only": [{ id: "row-1", name: "Gin" }],
  "empty list": [],
};
for (const [label, ingredients] of Object.entries(shapes)) {
  test(`PATCH accepts ingredient shape: ${label}`, async () => {
    const r = await patch({ ingredients });
    assert.equal(r.status, 200);
    assert.equal(sets.length, 1);
    assert.match(sets[0].sql, /"user_id" = \$\d+/);
    assert.deepEqual(sets[0].params.sort(), [DRINK, OWNER].sort());
    assert.deepEqual(JSON.parse(String(sets[0].value.ingredients)), ingredients);
    assert.equal(row.userId, OWNER);
    // and creation accepts the same rows
    const created = insertCustomDrinkSchema.safeParse({
      userId: OWNER, name: "n", category: "c", ingredients, calories: 1, protein: "1", carbs: "1", fiber: "1", fat: "1",
    });
    assert.equal(created.success, true);
  });
}

test("nested ingredient id is row metadata; top-level id stays forbidden", async () => {
  assert.equal((await patch({ ingredients: [caffeinatedRow] })).status, 200);
  assert.equal(row.id, DRINK);
  sets = [];
  assert.equal((await patch({ id: "x", ingredients: [caffeinatedRow] })).status, 400);
  assert.equal(sets.length, 0);
});

for (const bad of [{ userId: VICTIM }, { likesCount: 5 }, { nested: { a: 1 } }, { caffeine: "lots" }, {}]) {
  test(`unsupported ingredient content rejected: ${JSON.stringify(bad)}`, async () => {
    const r = await patch({ ingredients: [{ ...caffeinatedRow, ...bad }] });
    if (Object.keys(bad).length === 0) return assert.equal(r.status, 200);
    assert.equal(r.status, 400);
    assert.equal(sets.length, 0);
    assert.deepEqual(row, fresh());
  });
}
