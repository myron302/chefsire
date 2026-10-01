/**
 * CS-CL-05: custom-drink read visibility as real HTTP against the real router and storage layer.
 * Only the database driver is a double: it evaluates the *rendered SQL predicate* (is_public / owner
 * conditions and bound params) against stored rows, so a route/storage that forgets to put the
 * visibility rule in the query returns the private rows and the test fails.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { signAuthToken } from "../lib/jwt-config";

process.env.DATABASE_URL ||= "postgres://u:p@custom-drink-tests.invalid/none";

const A = "user-a";
const B = "user-b";
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id } as any)}` });

const drink = (id: string, userId: string, isPublic: boolean | null) => ({
  id, userId, name: `name-${id}`, category: "smoothies", drinkType: "green", ingredients: [], calories: 100,
  protein: "1.00", carbs: "2.00", fiber: "3.00", fat: "4.00", description: `secret-desc-${id}`, imageUrl: null,
  fitnessGoal: null, difficulty: null, prepTime: 5, rating: 5, isPublic, likesCount: 0, savesCount: 0,
  sharesCount: 0, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
});
const users: Record<string, any> = Object.fromEntries([A, B].map((id) => [id, {
  id, username: id, email: `${id}@example.com`, password: `HASH-${id}`, displayName: id.toUpperCase(),
  avatar: null, royalTitle: null,
}]));
const drinks = [
  drink("A-public", A, true), drink("A-private", A, false), drink("A-null", A, null),
  drink("B-public", B, true), drink("B-private", B, false),
];
const photos = [
  { id: "p-pub", drinkId: "A-public", userId: A, imageUrl: "pub.png", caption: null, createdAt: new Date("2024-01-01") },
  { id: "p-priv", drinkId: "A-private", userId: A, imageUrl: "priv.png", caption: null, createdAt: new Date("2024-01-01") },
];
const saves = [
  { id: "s1", userId: B, drinkId: "A-private", createdAt: new Date("2024-01-02") },
  { id: "s2", userId: B, drinkId: "A-public", createdAt: new Date("2024-01-03") },
];
const camel = (c: string) => c.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
const sqlLog: string[] = [];

const { pool } = await import("../db/index");
(pool as any).query = async (q: any, maybeParams?: any[]) => {
  const text: string = typeof q === "string" ? q : q.text;
  const params: any[] = maybeParams ?? (typeof q === "string" ? [] : q.values ?? []);
  sqlLog.push(text);
  const from = text.match(/ from "([a-z_]+)"/i)?.[1];
  if (!/^select/i.test(text) || !from) return { rows: [], rowCount: 0, fields: [] };
  const where = text.match(/ where (.*?)(?: order by| limit|$)/is)?.[1] ?? "";
  const p = (re: RegExp) => { const m = where.match(re); return m ? params[Number(m[1]) - 1] : undefined; };
  // The visibility predicate as the SQL actually states it. Absent predicate => no restriction (a leak).
  const orm = where.match(/"custom_drinks"\."is_public" = \$(\d+) or "custom_drinks"\."user_id" = \$(\d+)/);
  const pubm = where.match(/"custom_drinks"\."is_public" = \$(\d+)/);
  const visible = (d: any) =>
    orm ? d.isPublic === params[Number(orm[1]) - 1] || d.userId === params[Number(orm[2]) - 1]
      : pubm ? d.isPublic === params[Number(pubm[1]) - 1] : true;
  const owner = p(/^\("custom_drinks"\."user_id" = \$(\d+)/);
  const idEq = p(/"custom_drinks"\."id" = \$(\d+)/);
  const drinkIdEq = p(/"drink_photos"\."drink_id" = \$(\d+)/);
  const saver = p(/^\("drink_saves"\."user_id" = \$(\d+)/);
  const selectList = text.slice(0, text.search(/ from "/i));
  const qualified = [...selectList.matchAll(/"([a-z_]+)"\."([a-z_]+)"/g)].map((m) => [m[1], m[2]]);
  // drizzle drops the table qualifier when there is no join
  const cols = qualified.length ? qualified : [...selectList.matchAll(/"([a-z_]+)"/g)].map((m) => [from, m[1]]);
  const rowsOut: any[] = [];
  const emit = (ctx: Record<string, any>) => rowsOut.push(cols.map(([t, c]) => ctx[t]?.[camel(c)]));
  if (from === "custom_drinks") {
    for (const d of drinks) {
      if (!visible(d)) continue;
      if (owner !== undefined && d.userId !== owner) continue;
      if (idEq !== undefined && d.id !== idEq) continue;
      emit({ custom_drinks: d, users: users[d.userId] });
    }
  } else if (from === "drink_photos") {
    for (const ph of photos) {
      const d = drinks.find((x) => x.id === ph.drinkId)!;
      if (visible(d) && (drinkIdEq === undefined || ph.drinkId === drinkIdEq)) emit({ drink_photos: ph, custom_drinks: d });
    }
  } else if (from === "drink_saves") {
    for (const s of saves) {
      const d = drinks.find((x) => x.id === s.drinkId)!;
      if (visible(d) && (saver === undefined || s.userId === saver)) emit({ drink_saves: s, custom_drinks: d, users: users[d.userId] });
    }
  }
  return { rows: rowsOut, rowCount: rowsOut.length, fields: [] };
};

const { default: drinksRouter } = await import("./drinks");
const app = express();
app.use(express.json());
app.use("/api/drinks", drinksRouter);
const server = app.listen(0);
test.after(() => server.close());
const url = (path: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/custom-drinks${path}`;
const get = async (path: string, headers: Record<string, string> = {}) => {
  const r = await fetch(url(path), { headers });
  const text = await r.text();
  return { status: r.status, text, body: JSON.parse(text) };
};
const ids = (b: any) => b.drinks.map((d: any) => d.id).sort();

test("user list: owner sees own public + private (and legacy NULL row)", async () => {
  const r = await get(`/user/${A}`, tok(A));
  assert.equal(r.status, 200);
  assert.deepEqual(ids(r.body), ["A-null", "A-private", "A-public"]);
});

test("user list: authenticated non-owner sees only explicit-public rows; path userId is not authorization", async () => {
  const r = await get(`/user/${A}`, tok(B));
  assert.equal(r.status, 200);
  assert.deepEqual(ids(r.body), ["A-public"]);
  assert.doesNotMatch(r.text, /A-private|A-null|secret-desc-A-private/);
  assert.match(sqlLog.at(-1)!, /"is_public" = \$\d+ or "custom_drinks"\."user_id" = \$\d+/);
});

test("user list: B's own list shows B-private; anonymous is rejected (route requires auth)", async () => {
  assert.deepEqual(ids((await get(`/user/${B}`, tok(B))).body), ["B-private", "B-public"]);
  assert.equal((await get(`/user/${A}`)).status, 401);
});

test("direct id: owner reads own private drink", async () => {
  const r = await get("/A-private", tok(A));
  assert.equal(r.status, 200);
  assert.equal(r.body.drink.id, "A-private");
});

test("direct id: non-owner and anonymous get the same 404 as a nonexistent id", async () => {
  const missing = await get("/does-not-exist", tok(B));
  for (const headers of [tok(B), {}]) {
    for (const id of ["A-private", "A-null"]) {
      const r = await get(`/${id}`, headers);
      assert.equal(r.status, 404);
      assert.deepEqual(r.body, missing.body);
      assert.doesNotMatch(r.text, /secret-desc|name-A/);
    }
  }
  assert.equal(missing.status, 404);
});

test("direct id: public drink readable by non-owner and anonymous; response never carries credentials", async () => {
  for (const headers of [tok(B), {}]) {
    const r = await get("/A-public", headers);
    assert.equal(r.status, 200);
    assert.equal(r.body.drink.id, "A-public");
    assert.doesNotMatch(r.text, /HASH-|@example\.com|"password"|"email"/);
    assert.equal(r.body.drink.user.username, A);
  }
});

test("direct id: invalid/forged token is treated as anonymous, never as owner", async () => {
  const r = await get("/A-private", { authorization: "Bearer not-a-token" });
  assert.equal(r.status, 404);
});

test("photos: private drink's photos are not returned to non-owner/anonymous; owner and public ok", async () => {
  assert.deepEqual((await get("/A-private/photos", tok(B))).body.photos, []);
  assert.deepEqual((await get("/A-private/photos")).body.photos, []);
  assert.deepEqual((await get("/A-private/photos", tok(A))).body.photos.map((p: any) => p.id), ["p-priv"]);
  assert.deepEqual((await get("/A-public/photos")).body.photos.map((p: any) => p.id), ["p-pub"]);
  assert.deepEqual((await get("/nope/photos", tok(B))).body, (await get("/A-private/photos", tok(B))).body);
});

test("direct id response embeds only visible photos", async () => {
  const r = await get("/A-public", tok(B));
  assert.deepEqual(r.body.drink.photos.map((p: any) => p.id), ["p-pub"]);
});

test("saved list: another user's private drink saved by B is hidden from B (no longer visible) and from others", async () => {
  const asB = await get(`/saved/${B}`, tok(B));
  assert.deepEqual(ids(asB.body), ["A-public"]);
  assert.doesNotMatch(asB.text, /A-private|HASH-|@example\.com/);
  const asA = await get(`/saved/${B}`, tok(A));
  assert.deepEqual(ids(asA.body), ["A-private", "A-public"]); // A owns A-private
});

test("/public: reaches the public handler (not /:id) and returns only explicit-public rows", async () => {
  for (const headers of [{}, tok(B), tok(A)]) {
    const r = await get("/public", headers);
    assert.equal(r.status, 200);
    assert.deepEqual(ids(r.body), ["A-public", "B-public"]);
    assert.doesNotMatch(r.text, /private|A-null|HASH-|@example\.com/);
  }
  assert.match(sqlLog.at(-1)!, /order by "custom_drinks"\."likes_count" desc/);
});

test("creation: insert schema preserves isPublic true/false and does not default it to public", async () => {
  const { insertCustomDrinkSchema } = await import("../../shared/schema");
  const base = { userId: A, name: "n", category: "smoothies", calories: 1 } as any;
  assert.equal(insertCustomDrinkSchema.parse({ ...base, isPublic: true }).isPublic, true);
  assert.equal(insertCustomDrinkSchema.parse({ ...base, isPublic: false }).isPublic, false);
  // omitted -> left to the column default (false); the route never injects a public value
  assert.notEqual(insertCustomDrinkSchema.parse(base).isPublic, true);
});
