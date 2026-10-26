/** Real PostgreSQL route regression tests. Application DATABASE_URL is never used. */
import "../test-support/auth-test-env";
import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
process.env.DATABASE_URL ||= "postgresql://unused:unused@localhost/unused_test";
const { db } = await import("../db");
const { default: router } = await import("./wedding-registry-links");
const migration = readFileSync(new URL("../drizzle/20261025_wedding_intro_trials.sql", import.meta.url), "utf8");
const pgTest = process.env.TEST_DATABASE_URL ? test : test.skip;
const link = (id: number) => ({ id, name: `Registry ${id}`, url: `https://example.test/${id}`, icon: "🎁" });
let sequence = 0;
function route(method: string, path: string) { return router.stack.find((l: any) => l.route?.path === path && l.route.methods[method])!.route; }

async function fixture(t: any) {
  const clients = [new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }), new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })];
  const schema = `registry_test_${process.pid}_${sequence++}`;
  await Promise.all(clients.map((c) => c.connect()));
  t.after(async () => {
    try { await clients[0].query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await Promise.all(clients.map((c) => c.end())); }
  });
  await clients[0].query(`CREATE SCHEMA "${schema}"`);
  for (const c of clients) await c.query(`SET search_path TO "${schema}"`);
  await clients[0].query(`CREATE TABLE users(id varchar PRIMARY KEY, username text); INSERT INTO users VALUES ('free', 'free'), ('expired', 'expired'), ('premium', 'premium'), ('other', 'other');`);
  await clients[0].query(migration);
  await clients[0].query(`INSERT INTO wedding_intro_trials(user_id, tier) VALUES ('premium', 'premium'); INSERT INTO wedding_intro_trials(user_id, tier, activated_at, expires_at) VALUES ('expired', 'elite', statement_timestamp() - interval '337 hours', statement_timestamp() - interval '1 hour');
    CREATE TABLE wedding_registry_links(user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, registry_links jsonb NOT NULL DEFAULT '[]', updated_at timestamp NOT NULL DEFAULT NOW());
    CREATE INDEX wedding_registry_links_user_idx ON wedding_registry_links(user_id);`);
  for (const id of ["free", "expired", "premium", "other"]) await clients[0].query("INSERT INTO wedding_registry_links(user_id,registry_links) VALUES ($1,$2)", [id, JSON.stringify([link(1), link(2), link(3)])]);
  let turn = 0;
  const execute = (statement: any) => { const q = new PgDialect().sqlToQuery(statement); return clients[turn++ % 2].query(q.sql, q.params); };
  t.mock.method(db, "execute", execute);
  const read = async (id: string) => (await clients[0].query("SELECT registry_links FROM wedding_registry_links WHERE user_id=$1", [id])).rows[0]?.registry_links;
  async function call(method: string, path: string, owner: string | undefined, params: any = {}, body: any = {}) {
    let status = 200, payload: any;
    const req = { user: owner ? { id: owner } : undefined, params, body };
    const res = { status(n: number) { status = n; return this; }, json(value: any) { payload = value; return this; } };
    const stack = route(method, path).stack;
    if (method === "post") {
      let allowed = false;
      await stack[1].handle(req, res, () => { allowed = true; });
      if (!allowed) return { status, payload };
    }
    await stack.at(-1).handle(req, res);
    return { status, payload };
  }
  return { clients, read, call, execute };
}

pgTest("Free and expired accounts can delete only their own saved registry links", async (t) => {
  const f = await fixture(t);
  for (const owner of ["free", "expired"]) {
    const r = await f.call("delete", "/registry-links/:id", owner, { id: "1" }, { userId: "other", registryLinks: [] });
    assert.equal(r.status, 200); assert.deepEqual(r.payload.registryLinks, [link(2), link(3)]);
    assert.deepEqual(await f.read("other"), [link(1), link(2), link(3)]);
  }
});

pgTest("Free and expired accounts cannot add, replace or modify premium registry content", async (t) => {
  const f = await fixture(t);
  for (const owner of ["free", "expired"]) {
    const before = await f.read(owner);
    for (const registryLinks of [[link(99)], [{ ...link(1), url: "https://changed.test" }], []]) {
      const r = await f.call("post", "/registry-links", owner, {}, { registryLinks, userId: "premium" });
      assert.equal(r.status, 403); assert.deepEqual(await f.read(owner), before);
    }
  }
  const allowed = await f.call("post", "/registry-links", "premium", {}, { registryLinks: [link(99)], userId: "other" });
  assert.equal(allowed.status, 200); assert.deepEqual(await f.read("premium"), [link(99)]);
  assert.deepEqual(await f.read("other"), [link(1), link(2), link(3)]);
});

pgTest("concurrent real PostgreSQL deletions do not lose updates; final empty list survives private and public reads", async (t) => {
  const f = await fixture(t);
  const results = await Promise.all([f.call("delete", "/registry-links/:id", "free", { id: "1" }), f.call("delete", "/registry-links/:id", "free", { id: "2" })]);
  assert.deepEqual(results.map((r) => r.status), [200, 200]);
  assert.deepEqual(await f.read("free"), [link(3)]);
  const last = await f.call("delete", "/registry-links/:id", "free", { id: "3" });
  assert.deepEqual(last.payload.registryLinks, []);
  assert.deepEqual((await f.call("get", "/registry-links", "free")).payload.registryLinks, []);
  assert.deepEqual((await f.call("get", "/public-registry/:slug", undefined, { slug: "free" })).payload.registryLinks, []);
  const repeated = await f.call("delete", "/registry-links/:id", "free", { id: "3" });
  assert.deepEqual(repeated.payload.registryLinks, []);
});

pgTest("invalid and anonymous deletion requests cannot change records; absent registries return 404", async (t) => {
  const f = await fixture(t), before = await f.read("free");
  assert.equal((await f.call("delete", "/registry-links/:id", undefined, { id: "1" })).status, 401);
  for (const id of ["bad", "1.5", "9007199254740992"]) assert.equal((await f.call("delete", "/registry-links/:id", "free", { id })).status, 400);
  assert.equal((await f.call("delete", "/registry-links/:id", "missing", { id: "1" })).status, 404);
  assert.deepEqual(await f.read("free"), before);
});

pgTest("failed database writes preserve registry data and a subsequent retry succeeds", async (t) => {
  const f = await fixture(t), before = await f.read("free");
  // A real, deterministic SQL statement error, not a simulated successful write.
  const failure = t.mock.method(db, "execute", (statement: any) => {
    const q = new PgDialect().sqlToQuery(statement);
    return q.sql.trimStart().startsWith("UPDATE") ? f.clients[0].query("SELECT 1/0") : f.execute(statement);
  });
  const r = await f.call("delete", "/registry-links/:id", "free", { id: "1" });
  assert.equal(r.status, 500); assert.equal(r.payload.ok, false); assert.deepEqual(await f.read("free"), before);
  failure.mock.restore();
  assert.equal((await f.call("delete", "/registry-links/:id", "free", { id: "1" })).status, 200);
  assert.deepEqual(await f.read("free"), [link(2), link(3)]);
});
