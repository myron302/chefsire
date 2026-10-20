/**
 * Phase 3C (review follow-up #7): Cook Together sessions and recipe duets are recipe-linked, so they honour CURRENT recipe visibility.
 *
 * Real HTTP, real routers, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise). The session/duet tables come from the
 * project's own migration (server/drizzle/0002_phase2_social_explosion.sql), not hand-written approximations.
 * Leaving a session and deleting your own duet are cleanup, not recipe access, and stay available.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

const SECRET_TITLE = "SECRET-CLUB-DISH";
const SECRET_STEP = "SECRET-STEP";
const PUBLIC_TITLE = "Open Pancakes";

if (!PG_URL) {
  test("cook-together / duet privacy (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  const migration = readFileSync(new URL("../drizzle/0002_phase2_social_explosion.sql", import.meta.url), "utf8");
  const phase2Tables = migration.slice(migration.indexOf('CREATE TABLE IF NOT EXISTS "recipe_duets"'), migration.indexOf("-- SEASONAL EVENTS"));
  await local.query(`
    DROP TABLE IF EXISTS users, recipes, clubs, club_memberships, follows, likes, notifications, recipe_duets, cook_together_sessions, cook_together_participants CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.recipes, "recipes")};
    ALTER TABLE recipes ADD COLUMN prep_time integer, ADD COLUMN description text;
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    -- The duet routes read/write these two tables in a shape the Drizzle schema does not declare (generic likes, followed_id); build what they expect.
    CREATE TABLE follows (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), follower_id varchar NOT NULL, followed_id varchar NOT NULL);
    CREATE TABLE likes (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, target_type text NOT NULL, target_id varchar NOT NULL, created_at timestamp DEFAULT now());
    ${ddl(schema.notifications, "notifications")};
    ${phase2Tables}
  `);
  const { default: cookRouter } = await import("./cook-together");
  const { default: duetsRouter } = await import("./duets");
  const app = express();
  app.use(express.json());
  app.use("/api/cook-together", cookRouter);
  app.use("/api/duets", duetsRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const recipe: Record<string, string> = {};
  const session: Record<string, string> = {};
  const duet: Record<string, string> = {};
  let club = "";
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
  const participants = async (sessionId: string) => Number((await local.query(`SELECT count(*) FROM cook_together_participants WHERE session_id = $1`, [sessionId])).rows[0].count);
  const status = async (sessionId: string) => (await local.query(`SELECT status FROM cook_together_sessions WHERE id = $1`, [sessionId])).rows[0].status;
  const likeState = async (duetId: string) => ({
    count: (await local.query(`SELECT likes_count FROM recipe_duets WHERE id = $1`, [duetId])).rows[0].likes_count,
    rows: Number((await local.query(`SELECT count(*) FROM likes WHERE target_type = 'duet' AND target_id = $1`, [duetId])).rows[0].count),
    notifications: Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count),
  });
  const leaks = (text: string) => [SECRET_TITLE, SECRET_STEP].filter((needle) => text.includes(needle));

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, recipes, clubs, club_memberships, follows, likes, notifications, recipe_duets, cook_together_sessions, cook_together_participants CASCADE`);
    for (const name of ["owner", "member", "outsider", "fan"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    club = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, 'secret club', false) RETURNING id`, [ids.owner])).rows[0].id;
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [club, ids.owner, ids.member]);
    recipe.private = (await local.query(`INSERT INTO recipes (title, ingredients, instructions, origin_club_id) VALUES ($1, '["x"]'::jsonb, $2::jsonb, $3) RETURNING id`, [SECRET_TITLE, JSON.stringify([SECRET_STEP]), club])).rows[0].id;
    recipe.public = (await local.query(`INSERT INTO recipes (title, ingredients, instructions) VALUES ($1, '["x"]'::jsonb, '["y"]'::jsonb) RETURNING id`, [PUBLIC_TITLE])).rows[0].id;
    for (const key of ["private", "public"]) {
      session[key] = (await local.query(
        `INSERT INTO cook_together_sessions (recipe_id, host_user_id, title, status, max_participants, is_public, room_code) VALUES ($1, $2, $3, 'scheduled', 2, true, $4) RETURNING id`,
        [recipe[key], ids.owner, `${key} session`, key === "private" ? "PRIVROOM" : "PUBROOM1"],
      )).rows[0].id;
      duet[key] = (await local.query(
        `INSERT INTO recipe_duets (original_recipe_id, original_user_id, duet_user_id, caption) VALUES ($1, $2, $3, $4) RETURNING id`,
        [recipe[key], ids.owner, ids.owner, `${key} duet`],
      )).rows[0].id;
    }
  });

  const join = (as: string, key: string) => call("POST", `/api/cook-together/${session[key]}/join`, as);

  // ------------------------------------------------------------------ Cook Together
  test("join: anonymous and outsiders get a non-disclosing 404 and change nothing", async () => {
    const missing = await call("POST", "/api/cook-together/no-such-session/join", "outsider");
    for (const who of ["anon", "outsider"]) {
      const r = await join(who, "private");
      if (who === "anon") { assert.equal(r.status, 401); continue; }
      assert.equal(r.status, 404, who);
      assert.deepEqual(r.json, missing.json);
      assert.deepEqual(leaks(r.text), []);
    }
    assert.equal(await participants(session.private), 0, "no participant slot was consumed");
    assert.equal(await status(session.private), "scheduled", "the session was not started");
  });

  test("join: club members and the owner can join; public-recipe sessions work for everyone", async () => {
    assert.equal((await join("member", "private")).status, 200);
    assert.equal(await status(session.private), "active");
    assert.equal((await join("owner", "private")).status, 200);
    assert.equal(await participants(session.private), 2);
    assert.equal((await join("outsider", "public")).status, 200);
    assert.equal(await status(session.public), "active");
  });

  test("join: a removed member loses the ability to join, and a full private session is not distinguishable from a hidden one", async () => {
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    const r = await join("member", "private");
    assert.equal(r.status, 404);
    assert.equal(await participants(session.private), 0);
    // Capacity/status messages are only reachable by someone who may see the session.
    await local.query(`UPDATE cook_together_sessions SET status = 'completed' WHERE id = $1`, [session.private]);
    assert.equal((await join("outsider", "private")).status, 404);
    assert.equal((await join("owner", "private")).status, 400);
  });

  test("reads: detail, active and scheduled lists, and history never expose a restricted recipe", async () => {
    await local.query(`UPDATE cook_together_sessions SET status = 'active', started_at = now() WHERE id = $1`, [session.private]);
    await local.query(`UPDATE cook_together_sessions SET scheduled_for = now() + interval '1 day' WHERE id = $1`, [session.public]);
    for (const who of ["anon", "outsider"]) {
      const detail = await call("GET", `/api/cook-together/${session.private}`, who);
      assert.equal(detail.status, 404, who);
      for (const path of ["/api/cook-together/active", "/api/cook-together/scheduled"]) {
        const r = await call("GET", path, who);
        assert.equal(r.status, 200, `${who} ${path}`);
        assert.deepEqual(leaks(r.text), [], `${who} ${path}`);
      }
    }
    assert.ok((await call("GET", "/api/cook-together/scheduled", "outsider")).text.includes(PUBLIC_TITLE));
    const memberDetail = await call("GET", `/api/cook-together/${session.private}`, "member");
    assert.equal(memberDetail.status, 200);
    assert.ok(memberDetail.text.includes(SECRET_TITLE));
    assert.ok((await call("GET", "/api/cook-together/active", "member")).text.includes(SECRET_TITLE));
    // History: a former member who joined earlier no longer gets the restricted recipe back.
    await join("member", "private");
    assert.ok((await call("GET", "/api/cook-together/user/me/history", "member")).text.includes(SECRET_TITLE));
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    assert.deepEqual(leaks((await call("GET", "/api/cook-together/user/me/history", "member")).text), []);
  });

  test("cleanup actions stay available: a removed member can still leave a session", async () => {
    await join("member", "private");
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    assert.equal((await call("POST", `/api/cook-together/${session.private}/leave`, "member")).status, 200);
    assert.equal((await local.query(`SELECT left_at FROM cook_together_participants WHERE session_id = $1`, [session.private])).rows[0].left_at !== null, true);
  });

  // ------------------------------------------------------------------ Duets
  const like = (as: string, key: string) => call("POST", `/api/duets/${duet[key]}/like`, as);

  test("like and unlike: outsiders get a plain 404 and no counter, row or notification changes", async () => {
    const before = await likeState(duet.private);
    const missing = await call("POST", "/api/duets/no-such-duet/like", "outsider");
    assert.equal(missing.status, 404);
    const r = await like("outsider", "private");
    assert.equal(r.status, 404);
    assert.deepEqual(r.json, missing.json);
    assert.deepEqual(leaks(r.text), []);
    assert.deepEqual(await likeState(duet.private), before);
    // Unlike path: an outsider who somehow holds a like row cannot toggle it either.
    await local.query(`INSERT INTO likes (user_id, target_type, target_id) VALUES ($1, 'duet', $2)`, [ids.outsider, duet.private]);
    await local.query(`UPDATE recipe_duets SET likes_count = 1 WHERE id = $1`, [duet.private]);
    const stuck = await likeState(duet.private);
    assert.equal((await like("outsider", "private")).status, 404);
    assert.deepEqual(await likeState(duet.private), stuck);
    assert.equal((await call("POST", `/api/duets/${duet.private}/like`, "anon")).status, 401);
  });

  test("like and unlike: authorized members and owners keep normal behaviour, including the creator notification", async () => {
    const liked = await like("member", "private");
    assert.equal(liked.status, 200);
    assert.equal(liked.json.liked, true);
    let s = await likeState(duet.private);
    assert.deepEqual({ count: s.count, rows: s.rows, notifications: s.notifications }, { count: 1, rows: 1, notifications: 1 });
    const unliked = await like("member", "private");
    assert.equal(unliked.json.liked, false);
    s = await likeState(duet.private);
    assert.deepEqual({ count: s.count, rows: s.rows }, { count: 0, rows: 0 });
    // The creator liking their own duet creates no notification.
    await like("owner", "private");
    assert.equal((await likeState(duet.private)).notifications, 1);
  });

  test("like and unlike: a revoked member cannot interact with the restricted duet any more", async () => {
    await like("member", "private");
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    const held = await likeState(duet.private);
    assert.equal((await like("member", "private")).status, 404, "cannot unlike");
    assert.deepEqual(await likeState(duet.private), held);
  });

  test("public-recipe duets: anyone can like and unlike", async () => {
    assert.equal((await like("outsider", "public")).json.liked, true);
    assert.equal((await like("outsider", "public")).json.liked, false);
    assert.equal((await likeState(duet.public)).count, 0);
  });

  test("duet reads: lists by recipe, user, feed and trending hide restricted recipes from people who cannot read them", async () => {
    await local.query(`INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2)`, [ids.fan, ids.owner]);
    for (const who of ["anon", "outsider", "fan"]) {
      const byRecipe = await call("GET", `/api/duets/recipe/${recipe.private}`, who);
      assert.equal(byRecipe.status, 200);
      assert.deepEqual(byRecipe.json.duets, [], who);
      for (const path of [`/api/duets/user/${ids.owner}`, "/api/duets/trending", ...(who === "fan" ? ["/api/duets/feed"] : [])]) {
        const r = await call("GET", path, who);
        assert.equal(r.status, 200, `${who} ${path}`);
        assert.deepEqual(leaks(r.text), [], `${who} ${path}`);
        assert.ok(r.text.includes(PUBLIC_TITLE), `${who} ${path}: public duets stay`);
      }
    }
    assert.equal((await call("GET", `/api/duets/recipe/${recipe.private}`, "member")).json.duets.length, 1);
    assert.ok((await call("GET", `/api/duets/user/${ids.owner}`, "member")).text.includes(SECRET_TITLE));
  });

  test("deleting your own duet is cleanup and does not need recipe access", async () => {
    await local.query(`UPDATE recipe_duets SET duet_user_id = $1 WHERE id = $2`, [ids.member, duet.private]);
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    assert.equal((await call("DELETE", `/api/duets/${duet.private}`, "member")).status, 200);
  });
}
