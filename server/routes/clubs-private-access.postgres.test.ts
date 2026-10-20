/**
 * Phase 3C: private-club authorization.
 *
 * Real HTTP, real routers, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise).
 * Invariant: a club with is_public != true exposes its details, posts and recipes only to its creator and to rows in
 * club_memberships. Guests, non-members and pending applicants get a 403 with no club data. Public clubs are unchanged.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

const POST_SECRET = "SECRET-PRIVATE-POST";
const RECIPE_SECRET = "SECRET-PRIVATE-RECIPE";
const CLUB_SECRET = "SECRET-PRIVATE-CLUB-NAME";

if (!PG_URL) {
  test("private clubs (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, recipes, clubs, club_memberships, club_join_requests, club_posts CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    ${ddl(schema.clubJoinRequests, "club_join_requests")};
    ${ddl(schema.clubPosts, "club_posts")};
  `);
  const { default: clubsRouter } = await import("./clubs");
  const app = express();
  app.use(express.json());
  app.use("/api/clubs", clubsRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const club: Record<string, string> = {};
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, recipes, clubs, club_memberships, club_join_requests, club_posts CASCADE`);
    for (const name of ["owner", "admin", "moderator", "member", "applicant", "outsider", "pubowner"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    const mkClub = async (key: string, creator: string, isPublic: boolean | null, name: string) => {
      club[key] = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, $2, $3) RETURNING id`, [ids[creator], name, isPublic])).rows[0].id;
      const recipe = (await local.query(`INSERT INTO recipes (title, ingredients, instructions, origin_club_id) VALUES ($1, '["x"]'::jsonb, '["y"]'::jsonb, $2) RETURNING id`, [`${key}-${RECIPE_SECRET}`, club[key]])).rows[0].id;
      await local.query(`INSERT INTO club_posts (club_id, user_id, content, recipe_id) VALUES ($1, $2, $3, $4)`, [club[key], ids[creator], `${key}-${POST_SECRET}`, recipe]);
    };
    await mkClub("private", "owner", false, CLUB_SECRET);
    await mkClub("legacyNull", "owner", null, `${CLUB_SECRET}-null`);
    await mkClub("public", "pubowner", true, "open-club");
    for (const key of ["private", "legacyNull", "public"]) {
      const creator = key === "public" ? "pubowner" : "owner";
      await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner')`, [club[key], ids[creator]]);
    }
    for (const [who, role] of [["admin", "admin"], ["moderator", "moderator"], ["member", "member"]] as const) {
      await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, $3)`, [club.private, ids[who], role]);
    }
    await local.query(`INSERT INTO club_join_requests (club_id, user_id, status) VALUES ($1, $2, 'pending')`, [club.private, ids.applicant]);
  });

  const details = (key: string, as: string) => call("GET", `/api/clubs/${club[key]}`, as);
  const posts = (key: string, as: string) => call("GET", `/api/clubs/${club[key]}/posts`, as);

  test("guests, non-members and pending applicants get nothing from a private club", async () => {
    for (const key of ["private", "legacyNull"]) {
      for (const who of ["anon", "outsider", "applicant", "pubowner"]) {
        for (const r of [await details(key, who), await posts(key, who)]) {
          assert.equal(r.status, 403, `${who} ${key}`);
          assert.equal(r.json.code, "CLUB_PRIVATE");
          assert.ok(!r.text.includes(POST_SECRET) && !r.text.includes(RECIPE_SECRET) && !r.text.includes(CLUB_SECRET), `${who} saw ${key} data`);
        }
      }
    }
  });

  test("owner, admin, moderator and member read a private club normally", async () => {
    const roles: Array<[string, boolean, boolean]> = [["owner", true, true], ["admin", true, true], ["moderator", true, true], ["member", true, false]];
    for (const [who, isMember, isAdmin] of roles) {
      const d = await details("private", who);
      assert.equal(d.status, 200, who);
      assert.equal(d.json.club.name, CLUB_SECRET);
      assert.deepEqual({ isMember: d.json.stats.isMember, isAdmin: d.json.stats.isAdmin }, { isMember, isAdmin }, who);
      const p = await posts("private", who);
      assert.equal(p.status, 200, who);
      assert.equal(p.json.posts.length, 1);
      assert.equal(p.json.posts[0].caption, `private-${POST_SECRET}`);
      assert.equal(p.json.posts[0].recipe.title, `private-${RECIPE_SECRET}`);
    }
  });

  test("the creator keeps access even if their membership row is missing", async () => {
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club.private, ids.owner]);
    assert.equal((await details("private", "owner")).status, 200);
    assert.equal((await posts("private", "owner")).status, 200);
  });

  test("public clubs remain readable by guests and discoverable", async () => {
    const d = await details("public", "anon");
    assert.equal(d.status, 200);
    assert.equal(d.json.stats.isMember, false);
    const p = await posts("public", "anon");
    assert.equal(p.status, 200);
    assert.equal(p.json.posts.length, 1);
    const browse = await call("GET", "/api/clubs", "anon");
    assert.deepEqual(browse.json.clubs.map((c: any) => c.club.name), ["open-club"]);
    assert.ok(!browse.text.includes(CLUB_SECRET));
  });

  test("private-club recipes do not surface in the public recipe search", async () => {
    const { RecipeService } = await import("../services/recipe.service");
    const { db } = await import("../db/index");
    const titles = async (q: string) => (await RecipeService.searchLocalRecipes(db, { q })).map((r: any) => r.title);
    assert.deepEqual(await titles(RECIPE_SECRET), ["public-" + RECIPE_SECRET]);
  });

  test("a missing club is a 404 for everyone", async () => {
    assert.equal((await call("GET", "/api/clubs/nope", "anon")).status, 404);
    assert.equal((await call("GET", "/api/clubs/nope/posts", "outsider")).status, 404);
  });

  test("direct requests cannot write to or edit a private club's posts as a non-member", async () => {
    const postId = (await local.query(`SELECT id FROM club_posts WHERE club_id = $1`, [club.private])).rows[0].id;
    const create = await call("POST", `/api/clubs/${club.private}/posts`, "outsider", { content: "hi" });
    assert.equal(create.status, 403);
    // A former member who authored a post can no longer edit it once out of the club.
    await local.query(`INSERT INTO club_posts (id, club_id, user_id, content) VALUES ('ex-post', $1, $2, 'mine')`, [club.private, ids.outsider]);
    const edit = await call("PATCH", `/api/clubs/${club.private}/posts/ex-post`, "outsider", { content: "changed" });
    assert.equal(edit.status, 403);
    assert.equal((await local.query(`SELECT content FROM club_posts WHERE id = 'ex-post'`)).rows[0].content, "mine");
    // Members still edit their own posts; joining a private club directly stays refused.
    const own = await call("PATCH", `/api/clubs/${club.private}/posts/${postId}`, "owner", { content: "edited" });
    assert.equal(own.status, 200);
    assert.equal((await call("POST", `/api/clubs/${club.private}/join`, "outsider")).status, 403);
  });
}
