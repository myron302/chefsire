/**
 * Phase 3C (review follow-up #3): recipe autocomplete must evaluate recipe visibility for the SESSION viewer.
 *
 * Real HTTP, real search router, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise). Only TheMealDB / TheCocktailDB
 * (outbound network) are stubbed, so the external-recipe path is exercised without leaving the machine.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";
import { testAuthHeader } from "../test-support/auth-test-env";

const PRIVATE_TITLE = "Zqx secret club stew";
const PRIVATE_INGREDIENT = "SECRET-INGREDIENT";
const PUBLIC_TITLE = "Zqx open stew";
const EXTERNAL_TITLE = "Zqx external stew";

if (!PG_URL) {
  test("autocomplete recipe privacy (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, posts, recipes, clubs, club_memberships CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.posts, "posts")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
  `);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (url.includes("themealdb.com")) {
      return new Response(JSON.stringify({ meals: [{ idMeal: "52772", strMeal: EXTERNAL_TITLE, strMealThumb: "https://img.example/x.jpg", strCategory: "Beef", strArea: "British", strInstructions: "cook" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("thecocktaildb.com")) return new Response(JSON.stringify({ drinks: null }), { status: 200, headers: { "content-type": "application/json" } });
    return realFetch(input, init);
  }) as typeof fetch;

  const { default: searchRouter } = await import("./search");
  const app = express();
  app.use(express.json());
  app.use("/api/search", searchRouter);
  const server = app.listen(0);
  test.after(async () => { globalThis.fetch = realFetch; server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  let club = "";
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
  const ac = (as: string, extra = "") => call("GET", `/api/search/autocomplete?q=Zqx${extra}`, as);
  const titles = (r: { json: any }) => (r.json.recipes as Array<{ title: string }>).map((x) => x.title).sort();

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, posts, recipes, clubs, club_memberships CASCADE`);
    for (const name of ["owner", "member", "outsider"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    club = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, 'secret club', false) RETURNING id`, [ids.owner])).rows[0].id;
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [club, ids.owner, ids.member]);
    const post = (await local.query(`INSERT INTO posts (user_id, caption, image_url) VALUES ($1, 'p', 'i.jpg') RETURNING id`, [ids.owner])).rows[0].id;
    await local.query(`INSERT INTO recipes (post_id, title, ingredients, instructions) VALUES ($1, $2, '["flour"]'::jsonb, '["fry"]'::jsonb)`, [post, PUBLIC_TITLE]);
    await local.query(`INSERT INTO recipes (title, ingredients, instructions, origin_club_id) VALUES ($1, $2::jsonb, '["secret step"]'::jsonb, $3)`, [PRIVATE_TITLE, JSON.stringify([PRIVATE_INGREDIENT]), club]);
  });

  test("anonymous visitors and signed-in non-members never see private-club recipes", async () => {
    for (const who of ["anon", "outsider"]) {
      const r = await ac(who);
      assert.equal(r.status, 200, who);
      assert.ok(!titles(r).includes(PRIVATE_TITLE), `${who} found the private recipe`);
      assert.ok(!r.text.includes(PRIVATE_INGREDIENT) && !r.text.includes("secret step") && !r.text.includes("secret club"), `${who}: response leaked restricted details`);
    }
  });

  test("club members and the owner find their private-club recipes", async () => {
    for (const who of ["member", "owner"]) {
      const r = await ac(who);
      assert.ok(titles(r).includes(PRIVATE_TITLE), `${who} could not find it`);
    }
  });

  test("public local and external recipes stay searchable for everyone", async () => {
    for (const who of ["anon", "outsider", "member"]) {
      const t = titles(await ac(who));
      assert.ok(t.includes(PUBLIC_TITLE), `${who}: public`);
      assert.ok(t.includes(EXTERNAL_TITLE), `${who}: external`);
    }
    const onlyExternal = await ac("anon", "&source=external");
    assert.deepEqual(titles(onlyExternal), [EXTERNAL_TITLE]);
  });

  test("results carry only the autocomplete fields, whatever the viewer", async () => {
    const r = await ac("member");
    for (const item of r.json.recipes) {
      const allowed = new Set(["cookTime", "id", "imageUrl", "source", "title", "type"]);
      assert.deepEqual(Object.keys(item).filter((key) => !allowed.has(key)), [], "unexpected recipe fields in autocomplete");
    }
  });

  test("the viewer comes from the verified session, never from a query parameter or header", async () => {
    const spoof = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/search/autocomplete?q=Zqx&userId=${ids.member}&viewerId=${ids.member}`, { headers: { "x-user-id": ids.member } });
    const body = await spoof.json();
    assert.ok(!(body.recipes as any[]).some((x) => x.title === PRIVATE_TITLE));
    // An invalid token is just anonymous.
    const bad = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/search/autocomplete?q=Zqx`, { headers: { authorization: "Bearer not-a-token" } });
    assert.ok(!((await bad.json()).recipes as any[]).some((x) => x.title === PRIVATE_TITLE));
    // And a real member token does see it (sanity for the spoof checks above).
    const real = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/search/autocomplete?q=Zqx`, { headers: testAuthHeader(ids.member) });
    assert.ok(((await real.json()).recipes as any[]).some((x) => x.title === PRIVATE_TITLE));
  });

  test("the unused storage-level local search applies the same visibility rule", async () => {
    const { storage } = await import("../storage");
    const find = async (viewerId?: string) => (await storage.searchLocalRecipes({ q: "Zqx", viewerId, pageSize: 50 })).map((r: any) => r.title).sort();
    assert.deepEqual(await find(), [PUBLIC_TITLE]);
    assert.deepEqual(await find(ids.outsider), [PUBLIC_TITLE]);
    assert.deepEqual(await find(ids.member), [PRIVATE_TITLE, PUBLIC_TITLE].sort());
  });
}
