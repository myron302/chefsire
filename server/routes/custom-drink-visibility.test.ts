/**
 * CS-CL-05: custom-drink read visibility, as real HTTP against the real router + real storage.
 * Only pg is a double. It parses the rendered WHERE (SQL + bound params) and evaluates it against stored rows,
 * so a missing/incorrect SQL visibility predicate makes rows leak here (no JS-side filtering is involved).
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { signAuthToken } from "../lib/jwt-config";

process.env.DATABASE_URL ||= "postgres://u:p@custom-drink-visibility.invalid/none";

const A = "user-a";
const B = "user-b";
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id } as any)}` });
const mk = (id: string, userId: string, isPublic: boolean | null | undefined) => ({
  id, userId, name: id, category: "smoothies", drinkType: null, ingredients: [], calories: 1,
  protein: "1.00", carbs: "1.00", fiber: "1.00", fat: "1.00", description: `secret-${id}`, imageUrl: null,
  fitnessGoal: null, difficulty: null, prepTime: null, rating: 5, isPublic, likesCount: 0, savesCount: 0,
  sharesCount: 0, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
});
const rows = [
  mk("a-public", A, true), mk("a-private", A, false), mk("a-null", A, null),
  mk("b-public", B, true), mk("b-private", B, false),
];
const photos = [
  { id: "p-priv", drinkId: "a-private", userId: A, imageUrl: "https://x/priv.jpg", caption: null, createdAt: new Date("2024-01-01") },
  { id: "p-pub", drinkId: "a-public", userId: A, imageUrl: "https://x/pub.jpg", caption: null, createdAt: new Date("2024-01-01") },
];
const saves = [{ userId: B, drinkId: "a-private" }, { userId: B, drinkId: "a-public" }, { userId: B, drinkId: "a-null" }];
const userRows = [{ id: A }, { id: B }].map((u) => ({ ...u, username: u.id }));

const queries: Array<{ text: string; params: unknown[] }> = [];
const camel = (c: string) => c.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

/** Evaluate a rendered WHERE against a flattened row: `and`-joined `"col" = $n`, optionally with one `(… or …)` group. */
const evalWhere = (where: string, params: unknown[], row: Record<string, any>): boolean => {
  const atom = (a: string) => {
    const m = a.trim().replace(/^\(|\)$/g, "").match(/^(?:"[a-z_]+"\.)?"([a-z_]+)" = \$(\d+)$/i);
    assert.ok(m, `unparseable predicate: ${a}`);
    return row[camel(m![1])] === params[Number(m![2]) - 1];
  };
  const wrapped = (t: string) => { // true if one paren pair spans the whole string
    if (!t.startsWith("(") || !t.endsWith(")")) return false;
    let d = 0;
    for (let i = 0; i < t.length; i++) { if (t[i] === "(") d++; if (t[i] === ")") d--; if (d === 0 && i < t.length - 1) return false; }
    return true;
  };
  let body = where.trim();
  while (wrapped(body)) body = body.slice(1, -1).trim();
  // split top-level " and " (groups are parenthesised)
  const parts: string[] = []; let depth = 0, cur = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++; if (ch === ")") depth--;
    if (depth === 0 && body.startsWith(" and ", i)) { parts.push(cur); cur = ""; i += 4; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.every((p) => {
    const t = p.trim();
    if (wrapped(t)) return evalWhere(t.slice(1, -1), params, row);
    return / or /.test(t) ? t.split(" or ").some((x) => evalWhere(x, params, row)) : atom(t);
  });
};

const { pool } = await import("../db/index");
const colList = (text: string) =>
  [...(text.match(/^select (.*?) from/is)?.[1] ?? "").matchAll(/"([a-z_]+)"\."([a-z_]+)"|"([a-z_]+)"(?=,|\s|$)/g)]
    .map((m) => ({ table: m[1], col: m[2] ?? m[3] }));
(pool as any).query = async (q: any, maybeParams?: any[]) => {
  const text: string = typeof q === "string" ? q : q.text;
  const params: unknown[] = maybeParams ?? (typeof q === "string" ? [] : q.values ?? []);
  queries.push({ text, params });
  if (!/^select/i.test(text)) return { rows: [], rowCount: 0, fields: [] };
  const where = text.match(/ where (.*?)(?: order by| limit|$)/is)?.[1] ?? "";
  const from = text.match(/ from "([a-z_]+)"/i)![1];
  const cols = colList(text);
  const toArray = (flat: Record<string, any>[]) =>
    flat.map((f) => cols.map(({ table, col }) => f[`${table ?? from}.${camel(col)}`] ?? f[camel(col)]));
  let flat: Record<string, any>[] = [];
  if (from === "custom_drinks") {
    flat = rows.filter((r) => evalWhere(where, params, r))
      .map((r) => ({ ...r, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [`custom_drinks.${k}`, v])),
        ...Object.fromEntries(userRows.filter((u) => u.id === r.userId).flatMap((u) => Object.entries(u).map(([k, v]) => [`users.${k}`, v]))) }));
    if (/inner join "users"/i.test(text)) flat = flat.map((f) => ({ ...f, "users.id": f.userId, "users.username": f.userId }));
  } else if (from === "drink_photos") {
    const joined = /inner join "custom_drinks"/i.test(text);
    flat = photos.filter((p) => {
      const d = rows.find((r) => r.id === p.drinkId)!;
      const f = { ...p, ...Object.fromEntries(Object.entries(d).filter(([k]) => k !== "id" && k !== "userId" && k !== "imageUrl")), "custom_drinks.userId": d.userId, "custom_drinks.isPublic": d.isPublic };
      // bound-param equality on photo.drink_id + joined drink visibility
      return evalWhere(where.replace(/"custom_drinks"\."([a-z_]+)"/g, (_m, c) => `"${c === "user_id" ? "d_user_id" : "d_" + c}"`), params,
        { ...f, drinkId: p.drinkId, dDrinkId: p.drinkId, dUserId: d.userId, dIsPublic: d.isPublic, dId: d.id }) || (!joined && p.drinkId === params[0]);
    });
  } else if (from === "drink_saves") {
    flat = saves.filter((s) => params[0] === s.userId).flatMap((s) => {
      const d = rows.find((r) => r.id === s.drinkId)!;
      const row = { ...d, drinkId: s.drinkId };
      return evalWhere(where.replace(/"drink_saves"\."user_id" = \$1 and /, ""), params, row) ? [{ ...row, createdAt: new Date() }] : [];
    });
  }
  return { rows: toArray(flat), rowCount: flat.length, fields: [] };
};

const { default: drinksRouter } = await import("./drinks");
const app = express();
app.use(express.json());
app.use("/api/drinks", drinksRouter);
const server = app.listen(0);
test.after(() => server.close());
const url = (p: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/custom-drinks${p}`;
const get = (p: string, who?: string) => fetch(url(p), { headers: who ? tok(who) : {} });
const ids = async (r: Response) => ((await r.json()) as any).drinks.map((d: any) => d.id).sort();
test.beforeEach(() => { queries.length = 0; });

test("USER LIST: owner sees public + private (+ legacy NULL) of own", async () => {
  assert.deepEqual(await ids(await get(`/user/${A}`, A)), ["a-null", "a-private", "a-public"]);
});
test("USER LIST: authenticated non-owner sees only explicit-public rows (private + NULL excluded by SQL)", async () => {
  const r = await get(`/user/${A}`, B);
  assert.equal(r.status, 200);
  assert.deepEqual(await ids(r), ["a-public"]);
  const q = queries.find((x) => /from "custom_drinks"/i.test(x.text))!;
  assert.match(q.text, /"is_public" = \$\d+/);
  assert.ok(q.params.includes(true));
});
test("USER LIST: path userId is not authorization — B asking for B sees own private, B asking for A does not", async () => {
  assert.deepEqual(await ids(await get(`/user/${B}`, B)), ["b-private", "b-public"]);
  assert.ok(!(await ids(await get(`/user/${A}`, B))).includes("a-private"));
});
test("USER LIST: anonymous -> 401 (route requires auth, unchanged)", async () => {
  assert.equal((await get(`/user/${A}`)).status, 401);
});

test("DIRECT ID: owner reads own private; owner reads legacy NULL row", async () => {
  const r = await get("/a-private", A);
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as any).drink.id, "a-private");
  assert.equal((await get("/a-null", A)).status, 200);
});
test("DIRECT ID: non-owner and anonymous cannot read private or NULL; body leaks nothing", async () => {
  for (const who of [B, undefined]) {
    for (const id of ["a-private", "a-null"]) {
      const r = await get(`/${id}`, who);
      assert.equal(r.status, 404);
      const text = JSON.stringify(await r.json());
      assert.ok(!text.includes("secret-") && !text.includes(id));
    }
  }
});
test("DIRECT ID: public readable by non-owner and anonymous", async () => {
  assert.equal((await get("/a-public", B)).status, 200);
  assert.equal((await get("/a-public")).status, 200);
});
test("ENUMERATION: private-existing and nonexistent IDs return identical responses", async () => {
  for (const who of [B, undefined]) {
    const priv = await get("/a-private", who), none = await get("/does-not-exist", who);
    assert.equal(priv.status, none.status);
    assert.deepEqual(await priv.json(), await none.json());
  }
});
test("DIRECT ID: invalid bearer token behaves as anonymous (not owner)", async () => {
  const r = await fetch(url("/a-private"), { headers: { authorization: "Bearer garbage" } });
  assert.equal(r.status, 404);
});

test("PUBLIC LIST: reachable (not shadowed by /:id), explicit-public only, no private/NULL rows", async () => {
  for (const who of [undefined, A, B]) {
    const r = await get("/public", who);
    assert.equal(r.status, 200);
    assert.deepEqual(await ids(r), ["a-public", "b-public"]);
  }
  assert.ok(queries.some((q) => /"is_public" = \$\d+/.test(q.text) && q.params.includes(true)));
});

test("PHOTOS: private drink's photos hidden from non-owner/anonymous, visible to owner; public photos visible", async () => {
  const list = async (id: string, who?: string) => ((await (await get(`/${id}/photos`, who)).json()) as any).photos.map((p: any) => p.id);
  assert.deepEqual(await list("a-private", B), []);
  assert.deepEqual(await list("a-private"), []);
  assert.deepEqual(await list("a-private", A), ["p-priv"]);
  assert.deepEqual(await list("a-public", B), ["p-pub"]);
});

test("SAVED LIST: a saved private drink is not returned to its saver; the drink's owner still sees their own", async () => {
  assert.deepEqual(await ids(await get(`/saved/${B}`, B)), ["a-public"]);
  assert.deepEqual(await ids(await get(`/saved/${B}`, A)), ["a-null", "a-private", "a-public"]);
});

test("storage API: visibility-scoped reads encode the predicate in SQL for viewer/anonymous/owner", async () => {
  const { storage } = await import("../storage");
  await storage.getCustomDrinkForViewer("a-private", null);
  await storage.getCustomDrinkForViewer("a-private", B);
  await storage.getUserCustomDrinksForViewer(A, B);
  await storage.getUserCustomDrinksForViewer(A, A);
  const sel = queries.filter((q) => /from "custom_drinks"/i.test(q.text));
  assert.match(sel[0].text, /"is_public" = \$\d+/);
  assert.ok(!/"user_id" = \$\d+ or|or .*"user_id"/i.test(sel[0].text), "anonymous has no owner branch");
  assert.match(sel[1].text, /"is_public" = \$\d+ or "custom_drinks"\."user_id" = \$\d+/);
  assert.match(sel[2].text, /"is_public" = \$\d+/);
  assert.ok(!/ where .*"is_public"/is.test(sel[3].text), "owner listing has no public restriction");
});

test("CREATION: isPublic is preserved as sent and is not defaulted to public by the schema", async () => {
  const { insertCustomDrinkSchema } = await import("../../shared/schema");
  const base = { userId: A, name: "n", category: "c", ingredients: [], calories: 1, protein: "1", carbs: "1", fiber: "1", fat: "1" };
  assert.equal(insertCustomDrinkSchema.parse({ ...base, isPublic: true }).isPublic, true);
  assert.equal(insertCustomDrinkSchema.parse({ ...base, isPublic: false }).isPublic, false);
  assert.notEqual(insertCustomDrinkSchema.parse(base).isPublic, true); // DB default is false (column default unchanged)
});
