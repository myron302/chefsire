/**
 * Phase 3C (review follow-up): recipe visibility must come from explicit provenance, not from "a club post references it".
 *
 * Real HTTP, real routers, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise).
 * Model: `recipes.origin_club_id` = the club a recipe was CREATED for. Ordinary recipes (NULL) are never restricted, however many club
 * posts share them. A club-created recipe is private exactly while its club is private.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("recipe visibility (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, posts, recipes, recipe_saves, clubs, club_memberships, club_posts CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.posts, "posts")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.recipeSaves, "recipe_saves")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    ${ddl(schema.clubPosts, "club_posts")};
  `);
  const { default: clubsRouter } = await import("./clubs");
  const { default: recipesRouter } = await import("./recipes");
  const { RecipeService } = await import("../services/recipe.service");
  const { db } = await import("../db/index");
  const app = express();
  app.use(express.json());
  app.use("/api/clubs", clubsRouter);
  app.use("/api/recipes", recipesRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const club: Record<string, string> = {};
  const recipe: Record<string, string> = {};
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
  const MARK = "RCPVIS";
  const search = async (viewer?: string) => (await RecipeService.searchLocalRecipes(db, { q: MARK, viewerId: viewer ? ids[viewer] : null, pageSize: 100 })).map((r: any) => r.title).sort();
  const origin = async (id: string) => (await local.query(`SELECT origin_club_id FROM recipes WHERE id = $1`, [id])).rows[0].origin_club_id;

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, posts, recipes, recipe_saves, clubs, club_memberships, club_posts CASCADE`);
    for (const name of ["owner", "member", "outsider", "author", "pubowner"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    for (const [key, creator, isPublic] of [["private", "owner", false], ["private2", "owner", false], ["public", "pubowner", true]] as const) {
      club[key] = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, $2, $3) RETURNING id`, [ids[creator], key, isPublic])).rows[0].id;
      await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner')`, [club[key], ids[creator]]);
    }
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'member'), ($3, $2, 'member')`, [club.private, ids.member, club.private2]);
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'member')`, [club.private, ids.author]);
    // An ordinary public recipe published as a normal post by `author`.
    const post = (await local.query(`INSERT INTO posts (user_id, caption, image_url) VALUES ($1, 'p', 'i.jpg') RETURNING id`, [ids.author])).rows[0].id;
    recipe.public = (await local.query(`INSERT INTO recipes (post_id, title, ingredients, instructions) VALUES ($1, $2, '["a"]'::jsonb, '["b"]'::jsonb) RETURNING id`, [post, `${MARK}-public`])).rows[0].id;
  });

  const shareExisting = (as: string, clubKey: string, recipeId: string) => call("POST", `/api/clubs/${club[clubKey]}/posts`, as, { content: "look", recipeId });
  const createClubRecipe = async (as: string, clubKey: string, title: string) => {
    const r = await call("POST", `/api/clubs/${club[clubKey]}/posts`, as, { postType: "recipe", content: "new", recipe: { title, ingredients: ["i"], instructions: ["s"] } });
    assert.equal(r.status, 200, r.text);
    return r.json.post.recipeId as string;
  };

  test("a public recipe shared into a private club stays publicly searchable and keeps no club provenance", async () => {
    const r = await shareExisting("member", "private", recipe.public);
    assert.equal(r.status, 200, r.text);
    assert.equal(await origin(recipe.public), null);
    for (const viewer of [undefined, "outsider", "member"]) assert.deepEqual(await search(viewer), [`${MARK}-public`], String(viewer));
  });

  test("a member cannot hide another user's recipe by referencing its id (any number of clubs)", async () => {
    await shareExisting("member", "private", recipe.public);
    await shareExisting("member", "private2", recipe.public);
    await shareExisting("owner", "private", recipe.public);
    assert.deepEqual(await search(), [`${MARK}-public`]);
  });

  test("a recipe created for a private club is private: hidden from search, saves and club reads for outsiders", async () => {
    recipe.priv = await createClubRecipe("member", "private", `${MARK}-private`);
    assert.equal(await origin(recipe.priv), club.private);
    assert.deepEqual(await search(), [`${MARK}-public`]);
    assert.deepEqual(await search("outsider"), [`${MARK}-public`]);
    assert.deepEqual(await search("member"), [`${MARK}-private`, `${MARK}-public`]);
    assert.deepEqual(await search("owner"), [`${MARK}-private`, `${MARK}-public`]);
    // Direct id access: outsiders cannot save (and thereby read back) it; members can.
    assert.equal((await call("POST", `/api/recipes/${recipe.priv}/save`, "outsider")).status, 404);
    assert.equal((await call("GET", "/api/recipes/users/me/saved-recipes", "outsider")).text.includes("private"), false);
    assert.equal((await call("POST", `/api/recipes/${recipe.priv}/save`, "member")).status, 201);
    assert.ok((await call("GET", "/api/recipes/users/me/saved-recipes", "member")).text.includes(`${MARK}-private`));
    // Club reads stay members-only.
    assert.equal((await call("GET", `/api/clubs/${club.private}/posts`, "outsider")).status, 403);
    assert.equal((await call("GET", `/api/clubs/${club.private}/posts`, "member")).json.posts[0].recipe.title, `${MARK}-private`);
  });

  test("a member who later leaves the club loses a recipe they saved from it", async () => {
    recipe.priv = await createClubRecipe("member", "private", `${MARK}-private`);
    await call("POST", `/api/recipes/${recipe.priv}/save`, "member");
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club.private, ids.member]);
    assert.ok(!(await call("GET", "/api/recipes/users/me/saved-recipes", "member")).text.includes(`${MARK}-private`));
  });

  test("recipes created for a public club stay public", async () => {
    recipe.pub = await createClubRecipe("pubowner", "public", `${MARK}-pubclub`);
    assert.equal(await origin(recipe.pub), club.public);
    assert.deepEqual(await search(), [`${MARK}-pubclub`, `${MARK}-public`]);
    assert.equal((await call("POST", `/api/recipes/${recipe.pub}/save`, "outsider")).status, 201);
  });

  test("referenced recipe ids are validated: unknown, unreadable, and other-club-private recipes cannot be shared", async () => {
    recipe.priv = await createClubRecipe("member", "private", `${MARK}-private`);
    assert.equal((await shareExisting("member", "private", "no-such-recipe")).status, 404);
    // `outsider` is not a member of the club: no write access at all.
    assert.equal((await shareExisting("outsider", "private", recipe.priv)).status, 403);
    // `member` belongs to both private clubs but the recipe is private to the first: it cannot be pushed into the second.
    const cross = await shareExisting("member", "private2", recipe.priv);
    assert.equal(cross.status, 403);
    assert.equal(await origin(recipe.priv), club.private);
    // Same-club resharing and publicly-visible recipes still work.
    assert.equal((await shareExisting("member", "private", recipe.priv)).status, 200);
    assert.equal((await shareExisting("pubowner", "public", recipe.public)).status, 200);
    // A recipe private to club A, referenced from a public club where the poster is a member, is refused too.
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'member')`, [club.public, ids.member]);
    assert.equal((await shareExisting("member", "public", recipe.priv)).status, 403);
  });

  test("a recipe private to another club never renders inside a club post that references it", async () => {
    recipe.priv = await createClubRecipe("member", "private", `${MARK}-private`);
    // Legacy-style row: a post in club 2 that already references club 1's private recipe.
    await local.query(`INSERT INTO club_posts (club_id, user_id, content, recipe_id) VALUES ($1, $2, 'x', $3)`, [club.private2, ids.owner, recipe.priv]);
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club.private, ids.owner]);
    await local.query(`UPDATE clubs SET creator_id = $2 WHERE id = $1`, [club.private, ids.member]);
    const r = await call("GET", `/api/clubs/${club.private2}/posts`, "owner");
    assert.equal(r.status, 200);
    assert.equal(r.json.posts[0].recipe, null);
  });

  test("deleting club posts changes no recipe's visibility", async () => {
    recipe.priv = await createClubRecipe("member", "private", `${MARK}-private`);
    await shareExisting("member", "private", recipe.public);
    await local.query(`DELETE FROM club_posts WHERE club_id = $1`, [club.private]);
    assert.equal(await origin(recipe.priv), club.private);
    assert.deepEqual(await search("outsider"), [`${MARK}-public`]);
    assert.deepEqual(await search("member"), [`${MARK}-private`, `${MARK}-public`]);
  });

  test("legacy backfill: ambiguous provenance resolves toward private; ordinary and unreferenced recipes are untouched", async () => {
    const sql = readFileSync(new URL("../migrations/20261019_recipe_origin_club.sql", import.meta.url), "utf8");
    const { findDestructiveOperations } = await import("../scripts/migration-safety");
    assert.deepEqual(findDestructiveOperations(sql), [], "the migration must pass the Phase 3B destructive-SQL guard");

    const mk = async (title: string, cols = "") => (await local.query(`INSERT INTO recipes (title, ingredients, instructions${cols ? ", " + cols.split("=")[0] : ""}) VALUES ($1, '["a"]'::jsonb, '["b"]'::jsonb${cols ? ", " + cols.split("=")[1] : ""}) RETURNING id`, [title])).rows[0].id;
    const ref = (clubKey: string, recipeId: string, at: string | null) => local.query(`INSERT INTO club_posts (club_id, user_id, content, recipe_id, created_at) VALUES ($1, $2, 'x', $3, $4)`, [club[clubKey], ids.owner, recipeId, at]);
    const L: Record<string, string> = {};
    L.onlyPrivate = await mk("L1"); await ref("private", L.onlyPrivate, "2024-01-01T00:00:00Z");
    L.privateThenPublic = await mk("L2"); await ref("private", L.privateThenPublic, "2024-01-01T00:00:00Z"); await ref("public", L.privateThenPublic, "2024-02-01T00:00:00Z");
    L.publicThenPrivate = await mk("L3"); await ref("public", L.publicThenPrivate, "2024-01-01T00:00:00Z"); await ref("private", L.publicThenPrivate, "2024-02-01T00:00:00Z");
    L.tied = await mk("L4"); await ref("public", L.tied, "2024-01-01T00:00:00Z"); await ref("private", L.tied, "2024-01-01T00:00:00Z");
    L.noTimestamps = await mk("L5"); await ref("public", L.noTimestamps, null); await ref("private", L.noTimestamps, null);
    L.external = await mk("L6", "external_source='themealdb'"); await ref("private", L.external, "2024-01-01T00:00:00Z");
    L.orphan = await mk("L7");
    await local.query(`UPDATE recipes SET post_id = $1 WHERE id = $2`, [(await local.query(`SELECT id FROM posts LIMIT 1`)).rows[0].id, recipe.public]);
    await ref("private", recipe.public, "2024-01-01T00:00:00Z"); // post-linked public recipe shared into a private club

    await local.query(`ALTER TABLE recipes DROP COLUMN origin_club_id`);
    await local.query(sql);
    await local.query(sql); // idempotent
    assert.equal(await origin(L.onlyPrivate), club.private);
    assert.equal(await origin(L.privateThenPublic), club.private);
    assert.equal(await origin(L.publicThenPrivate), club.public, "earliest referencing club created it");
    assert.equal(await origin(L.tied), club.private, "tie → private");
    assert.equal(await origin(L.noTimestamps), club.private, "no timestamps → private");
    assert.equal(await origin(L.external), null);
    assert.equal(await origin(L.orphan), null);
    assert.equal(await origin(recipe.public), null);
    const titlesVisibleToPublic = (await RecipeService.searchLocalRecipes(db, { viewerId: null, pageSize: 100 })).map((r: any) => r.title).sort();
    assert.deepEqual(titlesVisibleToPublic, ["L3", "L6", "L7", `${MARK}-public`]);
  });

  test("every recipe read surface applies the shared visibility rule", () => {
    const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
    for (const f of ["./recipes.ts", "./suggestions.ts", "./duets.ts", "./cook-together.ts", "./remixes.ts", "./meal-planner-week.ts", "./clubs.ts", "../storage.ts", "../services/recipe.service.ts"]) {
      assert.match(read(f), /recipe-visibility/, `${f} must use lib/recipe-visibility`);
    }
    assert.doesNotMatch(read("../services/recipe.service.ts"), /FROM club_posts/, "visibility must not be inferred from club-post references");
  });
}
