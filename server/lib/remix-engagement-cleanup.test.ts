/**
 * Account deletion vs. remix engagement, against a real PostgreSQL server.
 *
 * The previous head made `remix_likes.user_id` / `remix_saves.user_id` reference `users(id)` with NO
 * ACTION, to stop an account deletion from silently dropping engagement rows while the denormalized
 * counters they back stayed high. That was the right invariant and the wrong stopping point: nothing
 * removed those rows first, so `DELETE /api/users/:id` -> `storage.deleteUser()` hit a foreign-key
 * violation and any account that had ever liked or saved a remix could no longer be deleted.
 *
 * Both invariants have to hold at once:
 *
 *   - a legitimate account deletion is never blocked merely because the account liked or saved;
 *   - after it, likes_count and saves_count still equal the number of surviving relationships.
 *
 * These tests drive the REAL production helper (`purgeRemixEngagementForUser`, the same function
 * `storage.deleteUser` calls) over a real server, inside the same transaction shape, so what is
 * proven here is the shipped code and the database's actual foreign-key and locking behaviour --
 * not a re-implementation of either.
 *
 * Skips cleanly when no PostgreSQL is reachable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { users } from "../../shared/schema";
import { applyRemixEngagement, purgeRemixEngagementForUser } from "./remix-engagement-cleanup";

const here = path.dirname(fileURLToPath(import.meta.url));

const CANDIDATES = [
  process.env.TEST_DATABASE_URL,
  process.env.PGURL,
  process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined,
  `postgres://${process.env.USER || "root"}@localhost/postgres?host=/var/run/postgresql`,
  "postgres://postgres:postgres@localhost:5432/postgres",
  "postgres://localhost:5432/postgres",
].filter((value): value is string => Boolean(value));

async function firstReachable() {
  for (const candidate of CANDIDATES) {
    const client = new pg.Client({ connectionString: candidate });
    try {
      await client.connect();
      await client.end();
      return candidate;
    } catch {
      // next shape
    }
  }
  return null;
}

const CONNECTION = await firstReachable();
const it = CONNECTION ? test : test.skip;
if (!CONNECTION) {
  console.log("# no reachable PostgreSQL -- account-deletion tests skipped");
}

/**
 * The real shape, foreign keys included: NO ACTION from engagement to `users` (the guard this
 * cleanup satisfies) and CASCADE from engagement to `recipe_remixes` (correct -- the counter lives on
 * the remix row and goes with it).
 */
const SCHEMA = `
  CREATE TABLE users (id varchar PRIMARY KEY);
  CREATE TABLE posts (id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id));
  CREATE TABLE recipes (id varchar PRIMARY KEY, post_id varchar REFERENCES posts(id));
  CREATE TABLE recipe_remixes (
    id varchar PRIMARY KEY,
    original_recipe_id varchar NOT NULL REFERENCES recipes(id),
    remixed_recipe_id varchar NOT NULL REFERENCES recipes(id),
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remix_type text DEFAULT 'variation',
    changes jsonb DEFAULT '{}'::jsonb,
    likes_count integer DEFAULT 0,
    saves_count integer DEFAULT 0,
    remix_count integer DEFAULT 0,
    is_public boolean DEFAULT true,
    created_at timestamp DEFAULT now()
  );
  CREATE TABLE remix_likes (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL REFERENCES users(id),
    remix_id varchar NOT NULL REFERENCES recipe_remixes(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE remix_saves (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL REFERENCES users(id),
    remix_id varchar NOT NULL REFERENCES recipe_remixes(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX remix_likes_user_remix_idx ON remix_likes (user_id, remix_id);
  CREATE UNIQUE INDEX remix_saves_user_remix_idx ON remix_saves (user_id, remix_id);
`;

type World = {
  client: pg.Client;
  db: ReturnType<typeof drizzle>;
  /** The exact sequence storage.deleteUser runs, over the real helper. */
  deleteUser: (userId: string) => Promise<boolean>;
  counters: () => Promise<Record<string, { likes: number; saves: number }>>;
  likeRows: () => Promise<Array<{ id: string; user_id: string; remix_id: string }>>;
  saveRows: () => Promise<Array<{ id: string; user_id: string; remix_id: string }>>;
  userExists: (id: string) => Promise<boolean>;
  done: () => Promise<void>;
};

let scratch = 0;

/**
 * A world with `accounts`, and one remix per entry in `remixes` (all authored by `author`), plus the
 * engagement described. Counters are seeded to the true relationship counts, as the migration
 * leaves them.
 */
async function world(spec: {
  accounts: string[];
  author: string;
  remixes: string[];
  likes?: Array<[string, string]>; // [remixId, userId]
  saves?: Array<[string, string]>;
}): Promise<World> {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `acctdel_${process.pid}_${scratch++}`;
  await client.query(`CREATE SCHEMA ${ns}`);
  await client.query(`SET search_path TO ${ns}`);
  // A protocol regression must surface as a failing test, never as a suite that hangs.
  await client.query(`SET lock_timeout = '10s'`);
  await client.query(SCHEMA);

  for (const account of spec.accounts) {
    await client.query(`INSERT INTO users (id) VALUES ($1)`, [account]);
  }
  await client.query(`INSERT INTO posts (id, user_id) VALUES ('p_src', $1)`, [spec.author]);
  await client.query(`INSERT INTO recipes (id, post_id) VALUES ('src', 'p_src')`);
  for (const remix of spec.remixes) {
    await client.query(`INSERT INTO posts (id, user_id) VALUES ($1, $2)`, [`p_${remix}`, spec.author]);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ($1, $2)`, [`out_${remix}`, `p_${remix}`]);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id)
       VALUES ($1, 'src', $2, $3)`,
      [remix, `out_${remix}`, spec.author]
    );
  }
  let n = 0;
  for (const [remix, user] of spec.likes ?? []) {
    await client.query(`INSERT INTO remix_likes (id, user_id, remix_id) VALUES ($1,$2,$3)`,
      [`l${n++}`, user, remix]);
  }
  for (const [remix, user] of spec.saves ?? []) {
    await client.query(`INSERT INTO remix_saves (id, user_id, remix_id) VALUES ($1,$2,$3)`,
      [`s${n++}`, user, remix]);
  }
  // Seed counters to the truth, as the migration's reconstruction leaves them.
  await client.query(`
    UPDATE recipe_remixes r
       SET likes_count = (SELECT count(DISTINCT user_id) FROM remix_likes WHERE remix_id = r.id),
           saves_count = (SELECT count(DISTINCT user_id) FROM remix_saves WHERE remix_id = r.id)
  `);

  const db = drizzle(client);

  return {
    client,
    db,
    // storage.deleteUser's boundary, verbatim: the real helper, then the account, one transaction.
    deleteUser: (userId: string) =>
      db.transaction(async (tx) => {
        await purgeRemixEngagementForUser(tx as any, userId);
        const result = await tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
        return result.length > 0;
      }),
    counters: async () => {
      const rows = await client.query(
        `SELECT id, likes_count, saves_count FROM recipe_remixes ORDER BY id`
      );
      return Object.fromEntries(
        rows.rows.map((r) => [r.id, { likes: r.likes_count, saves: r.saves_count }])
      );
    },
    likeRows: async () => (await client.query(`SELECT id, user_id, remix_id FROM remix_likes ORDER BY id`)).rows,
    saveRows: async () => (await client.query(`SELECT id, user_id, remix_id FROM remix_saves ORDER BY id`)).rows,
    userExists: async (id: string) =>
      (await client.query(`SELECT 1 FROM users WHERE id = $1`, [id])).rowCount === 1,
    done: async () => {
      await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
      await client.end();
    },
  };
}

/** Counters must equal the surviving relationship rows, for every remix, always. */
async function assertInvariant(w: World) {
  const check = await w.client.query(`
    SELECT r.id
      FROM recipe_remixes r
     WHERE r.likes_count <> (SELECT count(DISTINCT user_id) FROM remix_likes WHERE remix_id = r.id)
        OR r.saves_count <> (SELECT count(DISTINCT user_id) FROM remix_saves WHERE remix_id = r.id)
  `);
  assert.deepEqual(check.rows.map((r) => r.id), [], "every counter must equal its relationship count");
}

// ================================================================================================
// The account lifecycle invariant: deletion is never blocked by engagement
// ================================================================================================

it("an account with no remix engagement still deletes", async () => {
  const w = await world({ accounts: ["alice", "bob"], author: "alice", remixes: ["A"] });
  try {
    assert.equal(await w.deleteUser("bob"), true);
    assert.equal(await w.userExists("bob"), false);
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("an account that liked a remix deletes, and the counter follows", async () => {
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A", "B"],
    likes: [["A", "bob"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 1, saves: 0 });

    assert.equal(await w.deleteUser("bob"), true, "deletion is NOT blocked by the like");
    assert.equal(await w.userExists("bob"), false);

    assert.deepEqual(await w.likeRows(), [], "the account's like is gone");
    const after = await w.counters();
    assert.deepEqual(after.A, { likes: 0, saves: 0 });
    assert.deepEqual(after.B, { likes: 0, saves: 0 }, "an unrelated remix is untouched");
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("an account that saved a remix deletes, and the counter follows", async () => {
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A", "B"],
    saves: [["A", "bob"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 1 });

    assert.equal(await w.deleteUser("bob"), true);
    assert.deepEqual(await w.saveRows(), []);
    const after = await w.counters();
    assert.deepEqual(after.A, { likes: 0, saves: 0 });
    assert.deepEqual(after.B, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("liking AND saving the same remix adjusts each counter exactly once", async () => {
  // The overlap case. Recomputing rather than decrementing is what makes this need no special case:
  // there is no arithmetic that could be applied twice for a remix in both affected sets.
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A"],
    likes: [["A", "bob"]], saves: [["A", "bob"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 1, saves: 1 });

    assert.equal(await w.deleteUser("bob"), true);
    assert.deepEqual(await w.likeRows(), []);
    assert.deepEqual(await w.saveRows(), []);
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("many remixes, with a surviving account's engagement left exactly intact", async () => {
  // The review's worked example: A liked by the deleting user AND a surviving user (2 -> 1),
  // B saved by the deleting user only (1 -> 0).
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A", "B", "C", "D"],
    likes: [["A", "bob"], ["A", "carol"], ["C", "bob"], ["D", "carol"]],
    saves: [["B", "bob"], ["C", "bob"], ["C", "carol"]],
  });
  try {
    const before = await w.counters();
    assert.deepEqual(before.A, { likes: 2, saves: 0 });
    assert.deepEqual(before.B, { likes: 0, saves: 1 });
    assert.deepEqual(before.C, { likes: 1, saves: 2 });
    assert.deepEqual(before.D, { likes: 1, saves: 0 });

    assert.equal(await w.deleteUser("bob"), true);

    const after = await w.counters();
    assert.deepEqual(after.A, { likes: 1, saves: 0 }, "carol's like survives");
    assert.deepEqual(after.B, { likes: 0, saves: 0 }, "bob's only save is gone");
    assert.deepEqual(after.C, { likes: 0, saves: 1 }, "bob's like and save gone, carol's save stays");
    assert.deepEqual(after.D, { likes: 1, saves: 0 }, "never touched bob, unchanged");

    // Cross-user safety: only bob's rows went.
    assert.deepEqual((await w.likeRows()).map((r) => r.user_id).sort(), ["carol", "carol"]);
    assert.deepEqual((await w.saveRows()).map((r) => r.user_id), ["carol"]);
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("deleting one account never removes another's engagement", async () => {
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A"],
    likes: [["A", "bob"], ["A", "carol"]], saves: [["A", "bob"], ["A", "carol"]],
  });
  try {
    await w.deleteUser("bob");
    assert.deepEqual((await w.likeRows()).map((r) => r.user_id), ["carol"]);
    assert.deepEqual((await w.saveRows()).map((r) => r.user_id), ["carol"]);
    assert.deepEqual((await w.counters()).A, { likes: 1, saves: 1 });
    assert.equal(await w.userExists("carol"), true);
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("a remix the deleted account authored goes with it, engagement and all", async () => {
  // `recipe_remixes.user_id` is ON DELETE CASCADE, and `remix_*.remix_id` cascades from there, so an
  // authored remix and its engagement both leave with the account and no counter outlives its row.
  // Posts stay owned by alice, because `posts.user_id` is one of the 62 plain user references that
  // independently block account deletion -- see the scope note below.
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A"],
    likes: [["A", "alice"]],
  });
  try {
    await w.client.query(`UPDATE recipe_remixes SET user_id = 'bob' WHERE id = 'A'`);

    assert.equal(await w.deleteUser("bob"), true);
    const remixes = await w.client.query(`SELECT id FROM recipe_remixes`);
    assert.equal(remixes.rowCount, 0, "authored remix cascades from the account");
    assert.deepEqual(await w.likeRows(), [], "and its engagement rows cascade with it");
  } finally {
    await w.done();
  }
});

it("remix engagement is no longer among the things that block a deletion", async () => {
  // The precise deliverable. Account deletion in this repository is ALSO blocked by 62 other plain
  // `references(() => users.id)` declarations -- `posts` among them -- which predate this PR and are
  // out of scope here. What this correction owes is that `remix_likes` and `remix_saves`, which this
  // PR introduced, are not added to that list. So the check is scoped to exactly that: with the
  // remix engagement present and nothing else referencing the account, the deletion succeeds.
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A", "B"],
    likes: [["A", "bob"], ["B", "bob"]], saves: [["A", "bob"], ["B", "bob"]],
  });
  try {
    const blockers = await w.client.query(
      `SELECT count(*)::int AS n FROM remix_likes WHERE user_id = 'bob'`
    );
    assert.equal(blockers.rows[0].n, 2, "the account really does have engagement to clear");

    assert.equal(await w.deleteUser("bob"), true, "and it deletes anyway");
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

// ================================================================================================
// Failure atomicity
// ================================================================================================

it("a failure anywhere in the transaction leaves account, rows and counters consistent", async () => {
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A"],
    likes: [["A", "bob"]], saves: [["A", "bob"]],
  });
  try {
    const before = await w.counters();

    // Cleanup and counter repair succeed, then the account deletion fails. If these were independent
    // writes, the like row would already be gone and the counter already lowered.
    await assert.rejects(() =>
      w.db.transaction(async (tx) => {
        await purgeRemixEngagementForUser(tx as any, "bob");
        throw new Error("account deletion exploded");
      })
    );

    assert.equal(await w.userExists("bob"), true, "the account survives");
    assert.equal((await w.likeRows()).length, 1, "the like row is back");
    assert.equal((await w.saveRows()).length, 1, "the save row is back");
    assert.deepEqual(await w.counters(), before, "and the counters never moved");
    await assertInvariant(w);

    // And the retry succeeds, so the rollback left nothing wedged.
    assert.equal(await w.deleteUser("bob"), true);
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

// ================================================================================================
// Foreign-key policy: the guard is real, and the cleanup is what satisfies it
// ================================================================================================

it("deleting an account WITHOUT the cleanup is still refused by the foreign key", async () => {
  // This is the guard the NO ACTION policy buys: a future deletion path that forgets the cleanup
  // fails loudly with 23503 instead of silently leaving likes_count above its rows.
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A"],
    likes: [["A", "bob"]],
  });
  try {
    await assert.rejects(
      () => w.client.query(`DELETE FROM users WHERE id = 'bob'`),
      (error: any) => error.code === "23503",
      "a bare account delete must not be allowed to bypass counter maintenance"
    );
    await assertInvariant(w);
    // The supported path still works.
    assert.equal(await w.deleteUser("bob"), true);
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

// ================================================================================================
// Concurrency -- what PostgreSQL actually does, rather than an application lock
// ================================================================================================

it("the deleting account cannot slip new engagement past its own deletion", async () => {
  // This is the P1. Previously the purge discovered the account's engagement and only THEN locked
  // the remixes it found, so the same account could commit a like on a remix outside that set. The
  // cleanup never saw it, and `DELETE FROM users` then tripped the NO ACTION foreign key: 23503, and
  // a legitimate account deletion failed for a reason its owner could do nothing about.
  //
  // Now the purge takes the account's own `users` row FOR UPDATE before it discovers anything, and
  // the engagement path takes that row FOR KEY SHARE before it takes any remix row. The two modes
  // conflict, so the engagement cannot commit inside the deletion's window -- it waits, and once the
  // account is gone its insert is refused. The deletion itself succeeds.
  const w = await world({ accounts: ["alice", "bob"], author: "alice", remixes: ["A", "B"] });
  const other = await companion(w);
  const observer = await companion(w);
  try {
    const otherPid = (await other.query(`SELECT pg_backend_pid() AS p`)).rows[0].p;

    await w.client.query("BEGIN");
    const db = drizzle(w.client);
    // The purge runs to completion; it holds users[bob] FOR UPDATE from its very first statement.
    await purgeRemixEngagementForUser(db as any, "bob");

    // bob now tries to like B -- a remix the purge never discovered, because there was nothing to
    // discover. Started in the background: it must BLOCK, not commit.
    const racing = (async () => {
      await other.query("BEGIN");
      const outcome = await applyRemixEngagement(drizzle(other) as any, {
        remixId: "B", userId: "bob", kind: "like", action: "add",
      });
      await other.query("COMMIT");
      return outcome;
    })();

    const blocked = await (async () => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const waiting = await observer.query(
          `SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`,
          [otherPid]
        );
        if (waiting.rowCount === 1) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return false;
    })();
    assert.ok(blocked, "the engagement must wait on the account lock, not commit alongside it");

    // The deletion completes -- no spurious 23503.
    await w.client.query(`DELETE FROM users WHERE id = 'bob'`);
    await w.client.query("COMMIT");

    // The engagement that was waiting now finds no account to act for. It resolves cleanly as
    // `actor-missing` -- which the route turns into a 401 -- rather than exploding on the foreign
    // key, because the actor lock it takes first IS the check.
    const outcome = await racing;
    assert.deepEqual(outcome, { status: "actor-missing" });
    await other.query("ROLLBACK").catch(() => {});

    assert.equal(await w.userExists("bob"), false, "the account really was deleted");
    assert.deepEqual(await w.likeRows(), [], "and no engagement survived it");
    await assertInvariant(w);
  } finally {
    await w.client.query("ROLLBACK").catch(() => {});
    await other.end().catch(() => {});
    await observer.end().catch(() => {});
    await w.done();
  }
});

it("engagement cannot be committed for an account that is already deleted", async () => {
  const w = await world({ accounts: ["alice", "bob"], author: "alice", remixes: ["A"] });
  try {
    assert.equal(await w.deleteUser("bob"), true);
    await assert.rejects(
      () => w.client.query(`INSERT INTO remix_likes (id, user_id, remix_id) VALUES ('after','bob','A')`),
      (error: any) => error.code === "23503",
      "the users foreign key is what forecloses this, with no application lock"
    );
    await assert.rejects(
      () => w.client.query(`INSERT INTO remix_saves (id, user_id, remix_id) VALUES ('after','bob','A')`),
      (error: any) => error.code === "23503"
    );
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("a concurrent unlike during deletion cannot leave the counter disagreeing", async () => {
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A"],
    likes: [["A", "bob"], ["A", "alice"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 2, saves: 0 });
    // alice unlikes inside the window; the deletion's recomputation runs afterwards, so the
    // committed counter reflects whatever actually survives rather than a remembered delta.
    await w.db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.id, "___absent___")); // touch nothing, hold the tx open
      await w.client.query(`DELETE FROM remix_likes WHERE user_id = 'alice' AND remix_id = 'A'`);
      await purgeRemixEngagementForUser(tx as any, "bob");
      await tx.delete(users).where(eq(users.id, "bob")).returning({ id: users.id });
    });
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

// ================================================================================================
// The boundary itself: storage.deleteUser must keep using this helper, inside a transaction
// ================================================================================================

test("storage.deleteUser wraps the cleanup and the account delete in ONE transaction", async () => {
  // The tests above drive the helper directly, which proves the cleanup and the database behaviour
  // but not the wiring. This pins the wiring: a refactor that moved the account delete outside the
  // transaction, or dropped the cleanup call, would reintroduce exactly the defect this correction
  // fixed and would not otherwise be caught.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, "..", "storage.ts"), "utf8");

  const body = source.slice(
    source.indexOf("async deleteUser(userId: string): Promise<boolean> {"),
    source.indexOf("// ---------- Email Verification ----------")
  );
  assert.ok(body.length > 0, "deleteUser not found in storage.ts");

  const transactionAt = body.indexOf("db.transaction(");
  const cleanupAt = body.indexOf("purgeRemixEngagementForUser(");
  const deleteAt = body.indexOf("tx.delete(users)");

  assert.ok(transactionAt !== -1, "deleteUser must open a transaction");
  assert.ok(cleanupAt > transactionAt, "the cleanup must run inside the transaction");
  assert.ok(deleteAt > cleanupAt, "the account must be deleted after its engagement is cleared");
  assert.doesNotMatch(
    body,
    /await db\.delete\(users\)/,
    "the account must never be deleted outside the transaction"
  );
});

// ================================================================================================
// The READ COMMITTED recomputation race, forced deterministically
//
// Account deletion recomputes a counter from `remix_likes`. Under READ COMMITTED every statement
// takes its own snapshot when it begins, and the manual is explicit that an updating command "can
// see the effects of concurrent updating commands on the same rows it is trying to update, but it
// does not see effects of those commands on other rows in the database." The subquery reads OTHER
// rows. So if the recomputing UPDATE were the first statement to touch the remix, it would snapshot,
// block on a concurrent liker's row lock, and on resuming recompute from its own stale snapshot --
// writing a count that omits the like that just committed.
//
// Reproduced at the previous head: one surviving relationship, counter 0.
//
// The fix is to take the remix row lock BEFORE the snapshot-dependent read. The lock waits for the
// competing transaction, and every statement after it gets a fresh snapshot that includes what that
// transaction committed.
//
// These tests force the dangerous interleaving rather than hoping for it: the competing transaction
// grabs the remix row and holds it uncommitted, the deletion is started in the background, and the
// competitor commits only once `pg_stat_activity` shows the deletion genuinely parked on a lock.
// ================================================================================================

/** A second connection, in the same scratch schema, with a lock timeout so nothing can hang. */
async function companion(w: World) {
  const ns = (await w.client.query(`SELECT current_schema() AS s`)).rows[0].s;
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  await client.query(`SET search_path TO ${ns}`);
  await client.query(`SET lock_timeout = '10s'`);
  return client;
}

/** Resolves once this backend is actually waiting on a lock, so the interleaving is not a guess. */
async function untilBlocked(observer: pg.Client, pid: number) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const waiting = await observer.query(
      `SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`,
      [pid]
    );
    if (waiting.rowCount === 1) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

/**
 * Run the race: `mutate` is the competing engagement, performed through the REAL
 * `applyRemixEngagement`; the deletion is the REAL `purgeRemixEngagementForUser` plus the account
 * delete, exactly as storage.deleteUser sequences them.
 */
async function race(
  w: World,
  deletingUser: string,
  competitor: { user: string; kind: "like" | "save"; action: "add" | "remove"; remix: string }
) {
  const other = await companion(w);
  const observer = await companion(w);
  try {
    const otherDb = drizzle(other);
    const pid = (await w.client.query(`SELECT pg_backend_pid() AS p`)).rows[0].p;

    // The competitor opens its transaction, takes the remix row, mutates -- and waits.
    await other.query("BEGIN");
    await applyRemixEngagement(otherDb as any, {
      remixId: competitor.remix,
      userId: competitor.user,
      kind: competitor.kind,
      action: competitor.action,
    });

    // The deletion runs in the background; it will park on the competitor's row lock.
    const deletion = (async () => {
      await w.client.query("BEGIN");
      try {
        const db = drizzle(w.client);
        await purgeRemixEngagementForUser(db as any, deletingUser);
        await w.client.query(`DELETE FROM users WHERE id = $1`, [deletingUser]);
        await w.client.query("COMMIT");
      } catch (error) {
        await w.client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    })();

    const parked = await untilBlocked(observer, pid);
    await other.query("COMMIT");
    const outcome = await Promise.allSettled([deletion]);

    return {
      parked,
      failed: outcome[0].status === "rejected",
      error: outcome[0].status === "rejected" ? String((outcome[0] as any).reason?.code ?? "") : "",
    };
  } finally {
    await other.query("ROLLBACK").catch(() => {});
    await other.end().catch(() => {});
    await observer.end().catch(() => {});
  }
}

it("A. deleting an account while another user LIKES an affected remix", async () => {
  // A likes R (counter 1). B likes R during the deletion. The forbidden outcomes are
  // relationships=1/counter=0 and relationships=1/counter=2.
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A"],
    likes: [["A", "bob"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 1, saves: 0 });

    const outcome = await race(w, "bob", { user: "carol", kind: "like", action: "add", remix: "A" });
    assert.ok(outcome.parked, "the deletion must really have waited on the lock");

    assert.equal(await w.userExists("bob"), false, "the account is gone");
    assert.deepEqual((await w.likeRows()).map((r) => r.user_id), ["carol"], "only carol's like remains");
    assert.deepEqual((await w.counters()).A, { likes: 1, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("B. deleting an account while another user UNLIKES an affected remix", async () => {
  // A and B both like R (counter 2). B unlikes during A's deletion. Both must end up gone.
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A"],
    likes: [["A", "bob"], ["A", "carol"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 2, saves: 0 });

    const outcome = await race(w, "bob", { user: "carol", kind: "like", action: "remove", remix: "A" });
    assert.ok(outcome.parked);

    assert.equal(await w.userExists("bob"), false);
    assert.deepEqual(await w.likeRows(), [], "both likes gone");
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("C. deleting an account while another user SAVES an affected remix", async () => {
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A"],
    saves: [["A", "bob"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 1 });

    const outcome = await race(w, "bob", { user: "carol", kind: "save", action: "add", remix: "A" });
    assert.ok(outcome.parked);

    assert.equal(await w.userExists("bob"), false);
    assert.deepEqual((await w.saveRows()).map((r) => r.user_id), ["carol"]);
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 1 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("D. deleting an account while another user UNSAVES an affected remix", async () => {
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A"],
    saves: [["A", "bob"], ["A", "carol"]],
  });
  try {
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 2 });

    const outcome = await race(w, "bob", { user: "carol", kind: "save", action: "remove", remix: "A" });
    assert.ok(outcome.parked);

    assert.equal(await w.userExists("bob"), false);
    assert.deepEqual(await w.saveRows(), []);
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("E. the same race across MULTIPLE affected remixes", async () => {
  // The deleted account engaged with A and B; the competitor mutates only B. Both counters must
  // still equal their relationship tables, and the multi-row lock must be taken in id order.
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A", "B"],
    likes: [["A", "bob"], ["B", "bob"], ["B", "carol"]],
    saves: [["A", "bob"]],
  });
  try {
    const before = await w.counters();
    assert.deepEqual(before.A, { likes: 1, saves: 1 });
    assert.deepEqual(before.B, { likes: 2, saves: 0 });

    const outcome = await race(w, "bob", { user: "carol", kind: "like", action: "remove", remix: "B" });
    assert.ok(outcome.parked);

    assert.equal(await w.userExists("bob"), false);
    const after = await w.counters();
    assert.deepEqual(after.A, { likes: 0, saves: 0 });
    assert.deepEqual(after.B, { likes: 0, saves: 0 });
    assert.deepEqual(await w.likeRows(), []);
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("F. two account deletions over overlapping remixes neither deadlock nor drift", async () => {
  // Both accounts engaged with the SAME two remixes. Ascending-by-id locking is what makes this
  // safe: without a fixed order the two deletions could take R1/R2 in opposite orders and deadlock.
  // PostgreSQL may legitimately serialize one behind the other, so the assertion is on the final
  // invariant rather than on completion order.
  const w = await world({
    accounts: ["alice", "bob", "carol", "dave"], author: "alice", remixes: ["A", "B"],
    likes: [["A", "bob"], ["B", "bob"], ["A", "carol"], ["B", "carol"], ["A", "dave"]],
    saves: [["A", "bob"], ["B", "carol"]],
  });
  try {
    const second = await companion(w);
    try {
      const run = async (client: pg.Client, userId: string) => {
        await client.query("BEGIN");
        try {
          await purgeRemixEngagementForUser(drizzle(client) as any, userId);
          await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
          await client.query("COMMIT");
          return "committed";
        } catch (error: any) {
          await client.query("ROLLBACK").catch(() => {});
          return error.code === "40P01" ? "deadlock" : `failed:${error.code}`;
        }
      };

      const outcomes = await Promise.all([run(w.client, "bob"), run(second, "carol")]);
      assert.ok(
        !outcomes.includes("deadlock"),
        `ascending lock order must prevent deadlock, got ${outcomes.join(" / ")}`
      );
      assert.deepEqual(outcomes, ["committed", "committed"]);

      assert.equal(await w.userExists("bob"), false);
      assert.equal(await w.userExists("carol"), false);
      // Only dave's like on A survives.
      assert.deepEqual((await w.likeRows()).map((r) => r.user_id), ["dave"]);
      assert.deepEqual(await w.saveRows(), []);
      assert.deepEqual((await w.counters()).A, { likes: 1, saves: 0 });
      assert.deepEqual((await w.counters()).B, { likes: 0, saves: 0 });
      await assertInvariant(w);
    } finally {
      await second.query("ROLLBACK").catch(() => {});
      await second.end().catch(() => {});
    }
  } finally {
    await w.done();
  }
});

it("the engagement path takes the remix row lock before touching the relationship", async () => {
  // Both sides must serialize on the SAME resource, so this asserts the ordering in the shared
  // helper's source rather than trusting the two to stay in step.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, "remix-engagement-cleanup.ts"), "utf8");

  for (const fn of ["purgeRemixEngagementForUser", "applyRemixEngagement"]) {
    const start = source.indexOf(`export async function ${fn}`);
    assert.notEqual(start, -1, `${fn} missing`);
    const body = source.slice(start, source.indexOf("\n}", start));
    const lockAt = body.indexOf('.for("update")');
    assert.notEqual(lockAt, -1, `${fn} must take a row lock`);

    for (const mutation of ["tx.delete(", "tx.insert(", "tx.update("]) {
      const at = body.indexOf(mutation);
      if (at !== -1) {
        assert.ok(at > lockAt, `${fn}: ${mutation} must come after the lock, not before`);
      }
    }
  }

  // And the ordered multi-row lock is what makes concurrent deletions safe.
  assert.match(source, /\.orderBy\(asc\(recipeRemixes\.id\)\)\s*\n\s*\.for\("update"\)/);
});

// ================================================================================================
// The discovery-before-lock race: the DELETING account creating engagement on a remix the deletion
// has not discovered.
//
// This is the interleaving that made a legitimate account deletion fail with 23503 at the previous
// head. Both directions are forced: the deletion parked mid-flight (so its discovery has already
// happened), and the account's own engagement arriving afterwards.
// ================================================================================================

/**
 * Park the deletion after its discovery by holding one of the remixes it will lock, then let the
 * deleted account try to engage with a DIFFERENT remix, and see whether the deletion survives.
 */
async function deletionVsOwnNewEngagement(kind: "like" | "save") {
  // `held` is in the discovered set; `fresh` is not. The account engages with `fresh` while the
  // deletion is parked on `held`.
  const w = await world({
    accounts: ["alice", "bob"], author: "alice", remixes: ["A", "B"],
    likes: kind === "like" ? [["A", "bob"]] : undefined,
    saves: kind === "save" ? [["A", "bob"]] : undefined,
  });
  const blocker = await companion(w);
  const racer = await companion(w);
  const observer = await companion(w);
  try {
    const deletionPid = (await w.client.query(`SELECT pg_backend_pid() AS p`)).rows[0].p;
    const racerPid = (await racer.query(`SELECT pg_backend_pid() AS p`)).rows[0].p;

    const waitingOn = async (pid: number) => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const waiting = await observer.query(
          `SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`,
          [pid]
        );
        if (waiting.rowCount === 1) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return false;
    };

    // Hold remix A so the deletion parks on it -- AFTER it has discovered {A}.
    await blocker.query("BEGIN");
    await blocker.query(`SELECT id FROM recipe_remixes WHERE id = 'A' FOR UPDATE`);

    const deletion = (async () => {
      await w.client.query("BEGIN");
      try {
        await purgeRemixEngagementForUser(drizzle(w.client) as any, "bob");
        await w.client.query(`DELETE FROM users WHERE id = 'bob'`);
        await w.client.query("COMMIT");
        return "committed";
      } catch (error: any) {
        await w.client.query("ROLLBACK").catch(() => {});
        return `failed:${error.code}`;
      }
    })();

    assert.ok(await waitingOn(deletionPid), "the deletion must be parked past its discovery");

    // bob engages with B, which the deletion never discovered.
    const racing = (async () => {
      await racer.query("BEGIN");
      const outcome = await applyRemixEngagement(drizzle(racer) as any, {
        remixId: "B", userId: "bob", kind, action: "add",
      });
      await racer.query("COMMIT");
      return outcome;
    })();

    // It must WAIT on the account lock the deletion already holds, not commit beside it.
    assert.ok(
      await waitingOn(racerPid),
      "new engagement by the deleting account must block on its users row"
    );

    await blocker.query("COMMIT"); // release A; the deletion can finish

    const [deletionResult, racingResult] = await Promise.all([deletion, racing]);
    return { w, deletionResult, racingResult };
  } finally {
    await w.client.query("ROLLBACK").catch(() => {});
    await blocker.query("ROLLBACK").catch(() => {});
    await racer.query("ROLLBACK").catch(() => {});
    await blocker.end().catch(() => {});
    await racer.end().catch(() => {});
    await observer.end().catch(() => {});
  }
}

it("1. deleting an account while THAT account likes a previously undiscovered remix", async () => {
  const { w, deletionResult, racingResult } = await deletionVsOwnNewEngagement("like");
  try {
    assert.equal(deletionResult, "committed", "the deletion must not fail with a spurious 23503");
    assert.deepEqual(racingResult, { status: "actor-missing" }, "and the late like is refused");

    assert.equal(await w.userExists("bob"), false);
    assert.deepEqual(await w.likeRows(), [], "no engagement survives a deleted account");
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 0 });
    assert.deepEqual((await w.counters()).B, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("2. deleting an account while THAT account saves a previously undiscovered remix", async () => {
  const { w, deletionResult, racingResult } = await deletionVsOwnNewEngagement("save");
  try {
    assert.equal(deletionResult, "committed");
    assert.deepEqual(racingResult, { status: "actor-missing" });

    assert.equal(await w.userExists("bob"), false);
    assert.deepEqual(await w.saveRows(), []);
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 0 });
    assert.deepEqual((await w.counters()).B, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await w.done();
  }
});

it("remix deletion interleaved with engagement and account deletion does not deadlock", async () => {
  // The three multi-row paths meet here. Remix deletion locks recipe_remixes only; engagement and
  // account deletion both take `users` first and then recipe_remixes ascending. No path takes a
  // `users` row after a remix row, so there is no cycle -- asserted rather than argued.
  const w = await world({
    accounts: ["alice", "bob", "carol"], author: "alice", remixes: ["A", "B"],
    likes: [["A", "bob"], ["B", "carol"]],
  });
  const remixDeleter = await companion(w);
  const engager = await companion(w);
  try {
    const results = await Promise.all([
      (async () => {
        // Remix deletion of B, locking the affected set ascending exactly as the router does.
        await remixDeleter.query("BEGIN");
        try {
          await remixDeleter.query(
            `SELECT id FROM recipe_remixes WHERE id IN ('A','B') ORDER BY id FOR UPDATE`
          );
          await remixDeleter.query(`DELETE FROM recipe_remixes WHERE id = 'B'`);
          await remixDeleter.query("COMMIT");
          return "remix-deleted";
        } catch (error: any) {
          await remixDeleter.query("ROLLBACK").catch(() => {});
          return `remix-delete-failed:${error.code}`;
        }
      })(),
      (async () => {
        await engager.query("BEGIN");
        try {
          await applyRemixEngagement(drizzle(engager) as any, {
            remixId: "A", userId: "carol", kind: "like", action: "add",
          });
          await engager.query("COMMIT");
          return "engaged";
        } catch (error: any) {
          await engager.query("ROLLBACK").catch(() => {});
          return `engage-failed:${error.code}`;
        }
      })(),
      (async () => {
        await w.client.query("BEGIN");
        try {
          await purgeRemixEngagementForUser(drizzle(w.client) as any, "bob");
          await w.client.query(`DELETE FROM users WHERE id = 'bob'`);
          await w.client.query("COMMIT");
          return "account-deleted";
        } catch (error: any) {
          await w.client.query("ROLLBACK").catch(() => {});
          return `account-delete-failed:${error.code}`;
        }
      })(),
    ]);

    assert.ok(
      !results.some((r) => String(r).includes("40P01")),
      `no path may deadlock, got ${results.join(" / ")}`
    );
    assert.deepEqual(results, ["remix-deleted", "engaged", "account-deleted"]);
    await assertInvariant(w);
  } finally {
    await w.client.query("ROLLBACK").catch(() => {});
    await remixDeleter.query("ROLLBACK").catch(() => {});
    await engager.query("ROLLBACK").catch(() => {});
    await remixDeleter.end().catch(() => {});
    await engager.end().catch(() => {});
    await w.done();
  }
});

it("every path takes the actor's users row before any recipe_remixes row", () => {
  // The global order is `users`, then `recipe_remixes` ascending. It only holds if NOTHING acquires
  // a users row after a remix row, so both helpers are checked rather than trusted.
  const source = fs.readFileSync(path.join(here, "remix-engagement-cleanup.ts"), "utf8");

  for (const [fn, mode] of [
    ["purgeRemixEngagementForUser", '.for("update")'],
    ["applyRemixEngagement", '.for("key share")'],
  ] as const) {
    const start = source.indexOf(`export async function ${fn}`);
    const body = source.slice(start, source.indexOf("\n}", start));

    const userLockAt = body.indexOf(mode);
    const remixLockAt = body.indexOf('.from(recipeRemixes)');
    assert.notEqual(userLockAt, -1, `${fn} must lock the actor's users row (${mode})`);
    assert.notEqual(remixLockAt, -1, `${fn} must touch recipeRemixes`);
    assert.ok(
      userLockAt < remixLockAt,
      `${fn}: the users lock must come before any recipe_remixes access, or the order inverts`
    );

    // And in the purge, discovery must come after the users lock or the set can still grow.
    if (fn === "purgeRemixEngagementForUser") {
      assert.ok(
        userLockAt < body.indexOf(".from(remixLikes)"),
        "discovery must happen after the account is locked, not before"
      );
    }
  }
});
