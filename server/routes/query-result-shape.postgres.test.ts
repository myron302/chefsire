/**
 * `db.execute(sql\`...\`)` hands back a QueryResult OBJECT (`{ command, rowCount, rows, fields }`), never an array, and that object has no
 * Symbol.iterator. Array-destructuring one therefore throws "is not iterable" before the handler can do anything -- a 500 on every request,
 * not a wrong answer on some of them. Three endpoints shipped with that mistake and nothing ran them.
 *
 * Real HTTP, the real routers, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise). These tests are about the SHAPE the driver
 * returns, so they pass through db.execute unmodified rather than asserting against a stand-in.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("db.execute result shape (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, user_drink_stats, quest_progress, posts, notifications, recipes, recipe_duets, clubs, club_memberships, follows, likes CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.userDrinkStats, "user_drink_stats")};
    ${ddl(schema.questProgress, "quest_progress")};
    ${ddl(schema.posts, "posts")};
    ${ddl(schema.notifications, "notifications")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    CREATE TABLE follows (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), follower_id varchar NOT NULL, followed_id varchar NOT NULL);
    CREATE TABLE likes (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, target_type text NOT NULL, target_id varchar NOT NULL, created_at timestamp DEFAULT now());
    CREATE TABLE recipe_duets (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), original_recipe_id varchar NOT NULL, original_user_id varchar NOT NULL,
      duet_user_id varchar NOT NULL, duet_video_url text, duet_image_url text, caption text, is_public boolean DEFAULT true,
      likes_count integer DEFAULT 0, views_count integer DEFAULT 0, created_at timestamp DEFAULT now());
  `);
  const { default: achievementsRouter } = await import("./achievements");
  const { default: duetsRouter } = await import("./duets");
  const app = express();
  app.use(express.json());
  app.use("/api/achievements", achievementsRouter);
  app.use("/api/duets", duetsRouter);
  const server = app.listen(0);
  const quiet = console.error;
  console.error = () => {};
  test.after(async () => { console.error = quiet; server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, user_drink_stats, quest_progress, posts, notifications, recipes, recipe_duets, clubs, club_memberships, follows, likes CASCADE`);
    for (const name of ["cook", "author"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.test`])).rows[0].id;
    }
  });

  test("GET /api/achievements answers with the real quest and post counts, which are read off a QueryResult", async () => {
    await local.query(`INSERT INTO user_drink_stats (user_id, total_points, current_streak, longest_streak, total_drinks_made) VALUES ($1, 150, 3, 9, 4)`, [ids.cook]);
    // Two completed quests and one still running: the endpoint must count the completed ones only.
    await local.query(`INSERT INTO quest_progress (user_id, quest_id, date, target_progress, status)
      VALUES ($1,'q1',now(),1,'completed'), ($1,'q2',now(),1,'completed'), ($1,'q3',now(),1,'in_progress')`, [ids.cook]);
    await local.query(`INSERT INTO posts (user_id, image_url) VALUES ($1,'/a.png'), ($1,'/b.png'), ($1,'/c.png')`, [ids.cook]);

    const res = await call("GET", "/api/achievements", "cook");
    assert.equal(res.status, 200, res.text);
    // The counts are exactly what proves the QueryResult was read, not destructured: a crash here is a 500, and a wrong
    // read would be 0. Both are distinguishable from the right answer.
    assert.equal(res.json.stats.questsCompleted, 2, "completed quests only");
    assert.equal(res.json.stats.postsCount, 3);
    assert.equal(res.json.stats.totalPoints, 150);
    const firstSteps = res.json.achievements.find((a: { id: string }) => a.id === "first_steps");
    assert.equal(firstSteps.unlocked, true, "150 XP clears the 100 XP achievement, so the stats really reached the criteria");
  });

  test("POST /api/achievements/check unlocks from those counts, and is idempotent on a second call", async () => {
    await local.query(`INSERT INTO user_drink_stats (user_id, total_points, current_streak, longest_streak, total_drinks_made) VALUES ($1, 150, 1, 1, 0)`, [ids.cook]);
    await local.query(`INSERT INTO quest_progress (user_id, quest_id, date, target_progress, status) VALUES ($1,'q1',now(),1,'completed')`, [ids.cook]);

    const first = await call("POST", "/api/achievements/check", "cook", {});
    assert.equal(first.status, 200, first.text);
    assert.ok(first.json.count > 0, "something unlocked, so the stats were built from the counts");
    const notified = Number((await local.query(`SELECT count(*) FROM notifications WHERE user_id = $1 AND type = 'achievement'`, [ids.cook])).rows[0].count);
    assert.equal(notified, first.json.count, "one notification per newly unlocked achievement");

    // The duplicate check also reads a QueryResult (`existing.rows.length`), so a second call proves that one too.
    const second = await call("POST", "/api/achievements/check", "cook", {});
    assert.equal(second.status, 200, second.text);
    assert.equal(second.json.count, 0, "nothing unlocks twice");
    assert.equal(Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count), notified, "and no second notification");
  });

  test("POST /api/duets/create notifies the original author, whose row comes off a QueryResult", async () => {
    const recipeId = (await local.query(
      `INSERT INTO recipes (title, ingredients, instructions) VALUES ('Open Pancakes', '["x"]'::jsonb, '["y"]'::jsonb) RETURNING id`,
    )).rows[0].id;

    // originalUserId differs from the caller, so the notification branch -- the one that reads the duetting user's row -- runs.
    const res = await call("POST", "/api/duets/create", "cook", {
      originalRecipeId: recipeId, originalUserId: ids.author, caption: "my take", isPublic: true,
    });
    assert.equal(res.status, 200, res.text);
    assert.ok(res.json.duet?.id, "the created duet is returned with its id");
    assert.equal(Number((await local.query(`SELECT count(*) FROM recipe_duets WHERE duet_user_id = $1`, [ids.cook])).rows[0].count), 1);
  });
}
