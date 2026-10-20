/**
 * Phase 3C (review follow-up #5): challenges that belong to a private club.
 *
 * Real HTTP, real clubs router, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise). Uses the same club read rule as
 * private-club content and club-created recipes (lib/club-visibility). Mutations re-verify membership every time.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

const SECRET = "SECRET-CHALLENGE";

if (!PG_URL) {
  test("club challenges (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, recipes, clubs, club_memberships, club_posts, challenges, challenge_progress, user_badges CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    ${ddl(schema.clubPosts, "club_posts")};
    ${ddl(schema.challenges, "challenges")};
    ${ddl(schema.challengeProgress, "challenge_progress")};
    ${ddl(schema.userBadges, "user_badges")};
  `);
  const { default: clubsRouter } = await import("./clubs");
  const app = express();
  app.use(express.json());
  app.use("/api/clubs", clubsRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const ch: Record<string, string> = {};
  let privateClub = "";
  let publicClub = "";
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
  const progressRows = async (challengeId: string) => Number((await local.query(`SELECT count(*) FROM challenge_progress WHERE challenge_id = $1`, [challengeId])).rows[0].count);

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, recipes, clubs, club_memberships, club_posts, challenges, challenge_progress, user_badges CASCADE`);
    for (const name of ["owner", "member", "outsider", "pubowner", "removed"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    privateClub = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, 'secret club', false) RETURNING id`, [ids.owner])).rows[0].id;
    publicClub = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, 'open club', true) RETURNING id`, [ids.pubowner])).rows[0].id;
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member'), ($4, $5, 'owner')`, [privateClub, ids.owner, ids.member, publicClub, ids.pubowner]);
    const mk = async (key: string, clubId: string | null, name: string) => {
      ch[key] = (await local.query(
        `INSERT INTO challenges (club_id, name, description, goal, requirements, rewards, start_date, end_date) VALUES ($1, $2, $3, 'cook', '[{"target":2}]'::jsonb, '[{"type":"badge","value":"b"}]'::jsonb, now() - interval '1 day', now() + interval '10 days') RETURNING id`,
        [clubId, name, `${name}-description`],
      )).rows[0].id;
    };
    await mk("private", privateClub, `${SECRET}-private`);
    await mk("public", publicClub, "open-club-challenge");
    await mk("global", null, "global-challenge");
    await local.query(`INSERT INTO challenge_progress (challenge_id, user_id) VALUES ($1, $2)`, [ch.private, ids.member]);
  });

  const list = (as: string) => call("GET", "/api/clubs/challenges", as);
  const names = (r: { json: any }) => (r.json.challenges as any[]).map((c) => c.challenge.name).sort();

  test("listing: guests and unrelated users see only global and public-club challenges; members and owners also see the private one", async () => {
    for (const who of ["anon", "outsider", "pubowner"]) {
      const r = await list(who);
      assert.equal(r.status, 200, who);
      assert.deepEqual(names(r), ["global-challenge", "open-club-challenge"], who);
      assert.ok(!r.text.includes(SECRET) && !r.text.includes("private-description"), `${who} saw private challenge data`);
    }
    for (const who of ["member", "owner"]) {
      assert.ok(names(await list(who)).includes(`${SECRET}-private`), who);
    }
    // status filter and pagination-style filtering never reintroduce hidden rows
    assert.deepEqual(names(await call("GET", "/api/clubs/challenges?status=active", "outsider")), ["global-challenge", "open-club-challenge"]);
  });

  test("detail: a hidden challenge is exactly as absent as a missing one (no description, counts, requirements or rewards)", async () => {
    const missing = await call("GET", "/api/clubs/challenges/does-not-exist", "anon");
    for (const who of ["anon", "outsider"]) {
      const r = await call("GET", `/api/clubs/challenges/${ch.private}`, who);
      assert.equal(r.status, 404, who);
      assert.deepEqual(r.json, missing.json);
      for (const needle of [SECRET, "private-description", "requirements", "rewards", "participantCount"]) assert.ok(!r.text.includes(needle), `${who}: ${needle}`);
    }
    for (const who of ["member", "owner"]) {
      const r = await call("GET", `/api/clubs/challenges/${ch.private}`, who);
      assert.equal(r.status, 200, who);
      assert.equal(r.json.challenge.name, `${SECRET}-private`);
      assert.equal(Number(r.json.stats.participantCount), 1);
    }
  });

  test("public-club and global challenges keep their public detail behaviour", async () => {
    for (const key of ["public", "global"]) {
      assert.equal((await call("GET", `/api/clubs/challenges/${ch[key]}`, "anon")).status, 200, key);
    }
  });

  test("join: outsiders cannot join a private-club challenge (no progress row); members can't be added twice; public ones stay open", async () => {
    const denied = await call("POST", `/api/clubs/challenges/${ch.private}/join`, "outsider");
    assert.equal(denied.status, 404);
    assert.deepEqual(denied.json, { message: "Challenge not found" });
    assert.equal(await progressRows(ch.private), 1);
    assert.equal((await call("POST", `/api/clubs/challenges/${ch.private}/join`, "owner")).status, 200);
    assert.equal((await call("POST", `/api/clubs/challenges/${ch.private}/join`, "member")).status, 400, "already participating");
    assert.equal((await call("POST", `/api/clubs/challenges/${ch.public}/join`, "outsider")).status, 200);
    assert.equal((await call("POST", `/api/clubs/challenges/${ch.global}/join`, "outsider")).status, 200);
  });

  test("progress: re-verified on every call; a removed member can no longer advance a private challenge", async () => {
    const ok = await call("POST", `/api/clubs/challenges/${ch.private}/progress`, "member", { step: "s1" });
    assert.equal(ok.status, 200, ok.text);
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [privateClub, ids.member]);
    const before = (await local.query(`SELECT current_progress FROM challenge_progress WHERE challenge_id = $1 AND user_id = $2`, [ch.private, ids.member])).rows[0].current_progress;
    const denied = await call("POST", `/api/clubs/challenges/${ch.private}/progress`, "member", { step: "s2" });
    assert.equal(denied.status, 404);
    assert.deepEqual(denied.json, { message: "Challenge not found" });
    assert.equal((await local.query(`SELECT current_progress FROM challenge_progress WHERE challenge_id = $1 AND user_id = $2`, [ch.private, ids.member])).rows[0].current_progress, before);
    // ...and loses read access to the detail as well.
    assert.equal((await call("GET", `/api/clubs/challenges/${ch.private}`, "member")).status, 404);
    assert.ok(!names(await list("member")).includes(`${SECRET}-private`));
  });

  test("anonymous callers still cannot mutate", async () => {
    assert.equal((await call("POST", `/api/clubs/challenges/${ch.public}/join`, "anon")).status, 401);
    assert.equal((await call("POST", `/api/clubs/challenges/${ch.public}/progress`, "anon", { step: "x" })).status, 401);
  });
}
