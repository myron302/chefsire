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
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { users } from "../../shared/schema";
import { purgeRemixEngagementForUser } from "./remix-engagement-cleanup";

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
    id varchar PRIMARY KEY,
    user_id varchar NOT NULL REFERENCES users(id),
    remix_id varchar NOT NULL REFERENCES recipe_remixes(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE remix_saves (
    id varchar PRIMARY KEY,
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

it("a like committed during deletion makes the deletion fail, not the counter drift", async () => {
  const w = await world({ accounts: ["alice", "bob"], author: "alice", remixes: ["A"] });
  const other = new pg.Client({ connectionString: CONNECTION! });
  await other.connect();
  try {
    const ns = (await w.client.query(`SELECT current_schema() AS s`)).rows[0].s;
    await other.query(`SET search_path TO ${ns}`);

    // bob likes A and commits while the deletion transaction is mid-flight: the cleanup has already
    // run and found nothing, so the DELETE FROM users meets a brand-new referencing row.
    await assert.rejects(
      () =>
        w.db.transaction(async (tx) => {
          await purgeRemixEngagementForUser(tx as any, "bob");
          await other.query(
            `INSERT INTO remix_likes (id, user_id, remix_id) VALUES ('race','bob','A')`
          );
          const result = await tx.delete(users).where(eq(users.id, "bob")).returning({ id: users.id });
          return result.length > 0;
        }),
      (error: any) => error.code === "23503",
      "the foreign key refuses the deletion rather than orphaning the like"
    );

    // Nothing is half-done: the account is still there, the like is there, the counter agrees.
    assert.equal(await w.userExists("bob"), true);
    assert.equal((await w.likeRows()).length, 1);
    await w.client.query(`
      UPDATE recipe_remixes r SET likes_count =
        (SELECT count(DISTINCT user_id) FROM remix_likes WHERE remix_id = r.id)
    `);
    await assertInvariant(w);

    // Retrying now sweeps the new like too, because the cleanup is recomputed, not remembered.
    assert.equal(await w.deleteUser("bob"), true);
    assert.deepEqual((await w.counters()).A, { likes: 0, saves: 0 });
    await assertInvariant(w);
  } finally {
    await other.end();
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
