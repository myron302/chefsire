/**
 * 20260917_remix_integrity.sql, executed against a real PostgreSQL server.
 *
 * The earlier version of this migration collapsed duplicate lineage rows with a pairwise self-join:
 *
 *     AND (
 *       keeper.created_at < victim.created_at
 *       OR (keeper.created_at IS NOT DISTINCT FROM victim.created_at AND keeper.id < victim.id)
 *     )
 *
 * `recipe_remixes.created_at` is NULLABLE (`timestamp("created_at").defaultNow()`, no `.notNull()`).
 * When one duplicate has a NULL `created_at` and the other a real timestamp, `<` yields NULL in BOTH
 * directions and `IS NOT DISTINCT FROM` is false, so NEITHER row is deleted. The duplicate survives,
 * `CREATE UNIQUE INDEX` then fails with SQLSTATE 23505, and because the runner's `DUPLICATE_CODES`
 * treats 23505 as "already applied" it records the migration as done and skips what remains -- so the
 * lineage index is absent and the route's `ON CONFLICT (original_recipe_id, remixed_recipe_id,
 * user_id)` fails at runtime with 42P10. That is a partial order masquerading as a total one, and no
 * amount of reading the SQL makes it obvious; only running it does.
 *
 * So these tests run the real file, statement for statement, through the SAME splitting the runner
 * uses, against a real server. They cover every NULL combination, the authored-metadata policy, and
 * the thing the whole repair rests on: that the unique index can actually be built afterwards.
 *
 * The suite SKIPS (it does not fail) when no PostgreSQL is reachable, so it is safe in environments
 * without one. Point it at a server with TEST_DATABASE_URL, or leave it to find a local socket.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = fs.readFileSync(path.join(here, "20260917_remix_integrity.sql"), "utf8");

/** Exactly how server/scripts/run-migrations.ts turns a file into statements. */
function statementsOf(sql: string) {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(/;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * An explicit TEST_DATABASE_URL wins; otherwise try the usual local shapes. A developer machine, a
 * CI service container and a Unix-socket install all reach a server without configuration, and an
 * environment with none skips instead of failing.
 */
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
      // try the next shape
    }
  }
  return null;
}

const CONNECTION = await firstReachable();
const it = CONNECTION ? test : test.skip;
if (!CONNECTION) {
  console.log("# no reachable PostgreSQL -- migration execution tests skipped");
}

/**
 * The columns `recipe_remixes` really declares, nullability included -- `created_at`, `is_public`,
 * `remix_type` and `changes` are all nullable, and that is the entire point of this file.
 */
const SCHEMA = `
  CREATE TABLE users (id varchar PRIMARY KEY);
  CREATE TABLE posts (
    id varchar PRIMARY KEY,
    user_id varchar NOT NULL REFERENCES users(id)
  );
  CREATE TABLE recipes (
    id varchar PRIMARY KEY,
    post_id varchar REFERENCES posts(id)
  );
  CREATE TABLE recipe_remixes (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
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
`;


type Row = {
  id: string;
  original?: string;
  remixed?: string;
  user?: string;
  createdAt: string | null;
  isPublic?: boolean | null;
  remixType?: string | null;
  changes?: unknown;
  /**
   * Who authors the OUTPUT recipe, through its post. Defaults to the row's own `user`, which makes
   * the row legitimate. Naming someone else is what forges it -- exactly the shape the old endpoint
   * allowed, since it never checked.
   */
  outputOwner?: string;
  /** Give the output recipe no post at all, so no account can be shown to author it. */
  outputUnowned?: boolean;
};

type Engagement = { remix: string; user: string };

let scratch = 0;



/**
 * Build a fresh schema, seed it, run the real migration through the runner's own splitting, and hand
 * back what survived. Each case gets its own schema so nothing leaks between tests.
 */
async function applyMigration(
  rows: Row[],
  engagement: { likes?: Engagement[]; saves?: Engagement[] } = {}
) {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_${process.pid}_${scratch++}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);

    const accounts = new Set<string>();
    for (const row of rows) {
      accounts.add(row.user ?? "u1");
      if (row.outputOwner) accounts.add(row.outputOwner);
    }
    for (const entry of [...(engagement.likes ?? []), ...(engagement.saves ?? [])]) {
      accounts.add(entry.user);
    }
    for (const account of accounts) {
      await client.query(`INSERT INTO users (id) VALUES ($1)`, [account]);
    }

    /**
     * Build the ownership chain the invariant actually reads: recipes.post_id -> posts.user_id.
     *
     * A recipe can have only one author, so the FIRST row naming an output recipe fixes who owns it
     * (its `outputOwner` if given, otherwise its own `user`). Any later row claiming the same output
     * under a different account is therefore forged -- which is precisely the situation the old
     * endpoint permitted and this migration has to remediate.
     */
    const recipeOwner = new Map<string, string | null>();
    for (const row of rows) {
      const output = row.remixed ?? "out";
      if (!recipeOwner.has(output)) {
        recipeOwner.set(output, row.outputUnowned ? null : row.outputOwner ?? row.user ?? "u1");
      }
      const source = row.original ?? "src";
      if (!recipeOwner.has(source)) recipeOwner.set(source, row.user ?? "u1");
    }
    for (const [recipe, owner] of recipeOwner) {
      if (owner === null) {
        // No post at all: a recipe nobody can be shown to author (club recipes are inserted so).
        await client.query(`INSERT INTO recipes (id, post_id) VALUES ($1, NULL)`, [recipe]);
        continue;
      }
      const postId = `post_${recipe}`;
      await client.query(`INSERT INTO posts (id, user_id) VALUES ($1, $2)`, [postId, owner]);
      await client.query(`INSERT INTO recipes (id, post_id) VALUES ($1, $2)`, [recipe, postId]);
    }

    for (const row of rows) {
      await client.query(
        `INSERT INTO recipe_remixes
           (id, original_recipe_id, remixed_recipe_id, user_id, remix_type, changes, is_public, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          row.id,
          row.original ?? "src",
          row.remixed ?? "out",
          row.user ?? "u1",
          row.remixType ?? "variation",
          JSON.stringify(row.changes ?? {}),
          row.isPublic === undefined ? true : row.isPublic,
          row.createdAt,
        ]
      );
    }

    // Engagement rows need the tables, which the migration itself creates. Seed after a first pass
    // of the table-creating statements so a test can describe likes and saves declaratively.
    if (engagement.likes?.length || engagement.saves?.length) {
      for (const statement of statementsOf(MIGRATION).slice(0, 6)) await client.query(statement);
      let n = 0;
      for (const like of engagement.likes ?? []) {
        await client.query(
          `INSERT INTO remix_likes (id, user_id, remix_id) VALUES ($1,$2,$3)`,
          [`like_${n++}`, like.user, like.remix]
        );
      }
      for (const save of engagement.saves ?? []) {
        await client.query(
          `INSERT INTO remix_saves (id, user_id, remix_id) VALUES ($1,$2,$3)`,
          [`save_${n++}`, save.user, save.remix]
        );
      }
    }

    // The real file, the runner's real splitting, one statement at a time.
    const errors: Array<{ statement: string; code: string }> = [];
    for (const statement of statementsOf(MIGRATION)) {
      try {
        await client.query(statement);
      } catch (error: any) {
        errors.push({ statement: statement.split("\n")[0], code: error.code });
      }
    }

    const survivors = await client.query(
      `SELECT id, original_recipe_id, remixed_recipe_id, user_id, remix_type, changes,
              is_public, created_at, remix_count, likes_count, saves_count
         FROM recipe_remixes ORDER BY id`
    );
    const index = await client.query(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = $1 AND indexname = 'recipe_remix_lineage_idx'`,
      [ns]
    );
    const groups = await client.query(
      `SELECT count(*)::int AS n FROM (
         SELECT 1 FROM recipe_remixes
          GROUP BY original_recipe_id, remixed_recipe_id, user_id
         HAVING count(*) > 1) d`
    );

    // Tolerant on purpose: a migration that never creates the archive must fail these tests on
    // BEHAVIOUR (a forged row still sitting in the live table), not because a query errored.
    const quarantined = await client
      .query(
        `SELECT id, user_id, original_recipe_id, remixed_recipe_id, remix_type, changes, is_public,
                invalid_reason
           FROM recipe_remixes_invalid_lineage ORDER BY id`
      )
      .catch(() => ({ rows: [] as any[] }));
    // Every surviving row must satisfy the ownership invariant, checked independently of the
    // migration's own predicate rather than by trusting it.
    const violating = await client.query(
      `SELECT rr.id FROM recipe_remixes rr
        WHERE rr.original_recipe_id = rr.remixed_recipe_id
           OR NOT EXISTS (
                SELECT 1 FROM recipes r JOIN posts p ON p.id = r.post_id
                 WHERE r.id = rr.remixed_recipe_id AND p.user_id = rr.user_id)`
    );
    const likes = await client.query(
      `SELECT id, user_id, remix_id FROM remix_likes ORDER BY id`
    ).catch(() => ({ rows: [] as any[] }));
    const saves = await client.query(
      `SELECT id, user_id, remix_id FROM remix_saves ORDER BY id`
    ).catch(() => ({ rows: [] as any[] }));

    return {
      rows: survivors.rows,
      ids: survivors.rows.map((r) => r.id),
      indexExists: index.rowCount === 1,
      duplicateGroups: groups.rows[0].n as number,
      quarantined: quarantined.rows,
      quarantinedIds: quarantined.rows.map((r) => r.id),
      violating: violating.rows.map((r) => r.id),
      likeRows: likes.rows,
      saveRows: saves.rows,
      errors,
    };
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
}

/** Every scenario must end the same way, whatever the ordering inputs were. */
function assertCollapsed(result: Awaited<ReturnType<typeof applyMigration>>) {
  assert.deepEqual(result.errors, [], "the migration ran without a single statement failing");
  assert.equal(result.duplicateGroups, 0, "no lineage key may retain more than one row");
  assert.ok(result.indexExists, "recipe_remix_lineage_idx must exist after the migration");
  assert.deepEqual(
    result.violating,
    [],
    "every surviving row must satisfy the ownership invariant, checked independently"
  );
}

/** Seed the ownership chain for tests that drive the client directly instead of via applyMigration. */
async function seedOwnership(client: pg.Client, owner: string, recipeIds: string[]) {
  await client.query(`INSERT INTO users (id) VALUES ($1)`, [owner]);
  for (const recipe of recipeIds) {
    await client.query(`INSERT INTO posts (id, user_id) VALUES ($1, $2)`, [`post_${recipe}`, owner]);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ($1, $2)`, [recipe, `post_${recipe}`]);
  }
}

const T1 = "2024-01-01T00:00:00.000Z";
const T2 = "2024-06-01T00:00:00.000Z";
const T3 = "2024-12-01T00:00:00.000Z";

// ================================================================================================
// Codex P1 -- NULL ordering. All six required combinations.
// ================================================================================================

it("1. both timestamps non-null and different: the newest survives", async () => {
  const result = await applyMigration([
    { id: "older", createdAt: T1 },
    { id: "newer", createdAt: T2 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["newer"]);
});

it("2. equal non-null timestamps: the smaller id breaks the tie", async () => {
  const result = await applyMigration([
    { id: "bbb", createdAt: T1 },
    { id: "aaa", createdAt: T1 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["aaa"]);
});

it("3. NULL first, timestamp second: the datable row survives", async () => {
  // This is the case the pairwise predicate could not order at all.
  const result = await applyMigration([
    { id: "aaa_null", createdAt: null },
    { id: "zzz_dated", createdAt: T1 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["zzz_dated"]);
});

it("4. timestamp first, NULL second: the datable row survives, either way round", async () => {
  // Same pair with the id order reversed, so a fix that only worked in one direction is caught.
  const result = await applyMigration([
    { id: "aaa_dated", createdAt: T1 },
    { id: "zzz_null", createdAt: null },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["aaa_dated"]);
});

it("5. both timestamps NULL: the smaller id breaks the tie", async () => {
  const result = await applyMigration([
    { id: "bbb", createdAt: null },
    { id: "aaa", createdAt: null },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["aaa"]);
});

it("6. three or more duplicates mixing NULL and non-NULL", async () => {
  const result = await applyMigration([
    { id: "n1", createdAt: null },
    { id: "d1", createdAt: T1 },
    { id: "n2", createdAt: null },
    { id: "d3", createdAt: T3 },
    { id: "d2", createdAt: T2 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["d3"], "the newest datable row, NULLs never preferred");
});

it("an all-NULL group of five still collapses to exactly one", async () => {
  const result = await applyMigration([
    { id: "e", createdAt: null },
    { id: "c", createdAt: null },
    { id: "a", createdAt: null },
    { id: "d", createdAt: null },
    { id: "b", createdAt: null },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["a"]);
});

it("several distinct lineage groups collapse independently", async () => {
  const result = await applyMigration([
    { id: "g1_null", original: "s1", remixed: "o1", user: "u1", createdAt: null },
    { id: "g1_dated", original: "s1", remixed: "o1", user: "u1", createdAt: T1 },
    { id: "g2_old", original: "s2", remixed: "o2", user: "u1", createdAt: T1 },
    { id: "g2_new", original: "s2", remixed: "o2", user: "u1", createdAt: T2 },
    // A different author with their OWN output recipe: a distinct lineage key and a legitimate row.
    // (Two accounts cannot both author o1 -- that case is forged, and is covered on its own below.)
    { id: "g3_other_user", original: "s1", remixed: "o9", user: "u2", createdAt: null },
    { id: "g4_unique", original: "s3", remixed: "o3", user: "u1", createdAt: null },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids.sort(), ["g1_dated", "g2_new", "g3_other_user", "g4_unique"]);
});

it("rows with distinct lineage are never touched", async () => {
  const result = await applyMigration([
    { id: "a", original: "s1", remixed: "o1", user: "u1", createdAt: null },
    { id: "b", original: "s1", remixed: "o2", user: "u1", createdAt: null },
    { id: "c", original: "s2", remixed: "o1", user: "u1", createdAt: null },
    { id: "d", original: "s1", remixed: "o9", user: "u2", createdAt: null },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["a", "b", "c", "d"], "nothing was a duplicate, nothing was deleted");
});

// ================================================================================================
// Codex P1 -- the negative control: the predicate this replaced really does fail here
// ================================================================================================

it("negative control: the old pairwise predicate leaves the NULL/timestamp duplicate behind", async () => {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_ctl_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await seedOwnership(client, "u1", ["src", "out"]);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('a','src','out','u1',NULL), ('b','src','out','u1',$1)`,
      [T1]
    );

    await client.query(`
      DELETE FROM recipe_remixes victim
      USING recipe_remixes keeper
      WHERE victim.original_recipe_id = keeper.original_recipe_id
        AND victim.remixed_recipe_id = keeper.remixed_recipe_id
        AND victim.user_id = keeper.user_id
        AND victim.id <> keeper.id
        AND (
          keeper.created_at < victim.created_at
          OR (keeper.created_at IS NOT DISTINCT FROM victim.created_at AND keeper.id < victim.id)
        )
    `);

    const left = await client.query(`SELECT count(*)::int AS n FROM recipe_remixes`);
    assert.equal(left.rows[0].n, 2, "the partial order deletes neither row");

    // And that is what makes the index build fail -- with the exact code the runner mistakes for
    // "already applied".
    await assert.rejects(
      () =>
        client.query(
          `CREATE UNIQUE INDEX ctl_idx ON recipe_remixes (original_recipe_id, remixed_recipe_id, user_id)`
        ),
      (error: any) => error.code === "23505"
    );
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

// ================================================================================================
// Codex P2 -- authored metadata is not silently discarded
// ================================================================================================

it("the surviving row carries the newest duplicate's remix_type and changes", async () => {
  const result = await applyMigration([
    {
      id: "older",
      createdAt: T1,
      remixType: "variation",
      changes: { notes: "first attempt" },
    },
    {
      id: "newer",
      createdAt: T2,
      remixType: "ingredient_swap",
      changes: { notes: "swapped the butter for oil", addedIngredients: ["olive oil"] },
    },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["newer"]);
  assert.equal(result.rows[0].remix_type, "ingredient_swap", "newer authored state is kept");
  assert.deepEqual(result.rows[0].changes, {
    notes: "swapped the butter for oil",
    addedIngredients: ["olive oil"],
  });
});

it("a NULL created_at never lets a stale row's metadata win", async () => {
  const result = await applyMigration([
    { id: "aaa_null", createdAt: null, remixType: "variation", changes: { notes: "stale" } },
    { id: "zzz_dated", createdAt: T1, remixType: "dietary_conversion", changes: { notes: "current" } },
  ]);
  assertCollapsed(result);
  assert.equal(result.rows[0].id, "zzz_dated");
  assert.equal(result.rows[0].remix_type, "dietary_conversion");
  assert.deepEqual(result.rows[0].changes, { notes: "current" });
});

it("a hidden duplicate keeps the remix hidden, even when the newest row is public", async () => {
  // The asymmetric case: collapsing must never re-publish something the author had hidden.
  const result = await applyMigration([
    { id: "older_hidden", createdAt: T1, isPublic: false },
    { id: "newer_public", createdAt: T2, isPublic: true },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["newer_public"]);
  assert.equal(result.rows[0].is_public, false, "visibility is never widened by the collapse");
});

it("a NULL is_public duplicate also holds the survivor closed", async () => {
  // The read paths filter `is_public = true`, so NULL is already not listed; the fold carries that.
  const result = await applyMigration([
    { id: "older_null", createdAt: T1, isPublic: null },
    { id: "newer_public", createdAt: T2, isPublic: true },
  ]);
  assertCollapsed(result);
  assert.equal(result.rows[0].id, "newer_public");
  assert.equal(result.rows[0].is_public, false);
});

it("an all-public duplicate group stays public", async () => {
  const result = await applyMigration([
    { id: "older", createdAt: T1, isPublic: true },
    { id: "newer", createdAt: T2, isPublic: true },
  ]);
  assertCollapsed(result);
  assert.equal(result.rows[0].is_public, true, "the fold only ever narrows, and only when it must");
});

it("a lone row is never rewritten by the is_public fold", async () => {
  // `peer.id <> target.id` is what keeps a non-duplicate row's NULL from being turned into false.
  const result = await applyMigration([
    { id: "solo", original: "s1", remixed: "o1", user: "u1", createdAt: T1, isPublic: null },
    { id: "other", original: "s2", remixed: "o2", user: "u1", createdAt: T1, isPublic: true },
  ]);
  assertCollapsed(result);
  assert.equal(result.rows.find((r) => r.id === "solo")!.is_public, null, "left exactly as it was");
  assert.equal(result.rows.find((r) => r.id === "other")!.is_public, true);
});

it("visibility folds across a 3-row group with mixed metadata", async () => {
  const result = await applyMigration([
    { id: "a", createdAt: T1, isPublic: true, remixType: "variation" },
    { id: "b", createdAt: T2, isPublic: false, remixType: "portion_adjustment" },
    { id: "c", createdAt: T3, isPublic: true, remixType: "ingredient_swap" },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["c"], "newest wins for authored content");
  assert.equal(result.rows[0].remix_type, "ingredient_swap");
  assert.equal(result.rows[0].is_public, false, "but any hidden member closes the survivor");
});

// ================================================================================================
// The migration as a whole
// ================================================================================================

it("the unique index can be created, and the ON CONFLICT the route uses then works", async () => {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_conflict_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await seedOwnership(client, "u1", ["src", "out", "other-out"]);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('a','src','out','u1',NULL), ('b','src','out','u1',$1), ('c','src','out','u1',NULL)`,
      [T1]
    );

    for (const statement of statementsOf(MIGRATION)) await client.query(statement);

    // Exactly the inference the route's `onConflictDoNothing({ target: [...] })` compiles to. Before
    // the repair this raised 42P10, because no matching index existed.
    const conflicted = await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id)
       VALUES ('d','src','out','u1')
       ON CONFLICT (original_recipe_id, remixed_recipe_id, user_id) DO NOTHING
       RETURNING id`
    );
    assert.equal(conflicted.rowCount, 0, "a replayed lineage insert is absorbed, not duplicated");

    const fresh = await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id)
       VALUES ('e','src','other-out','u1')
       ON CONFLICT (original_recipe_id, remixed_recipe_id, user_id) DO NOTHING
       RETURNING id`
    );
    assert.equal(fresh.rowCount, 1, "a genuinely new lineage still inserts");
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

it("the route's generated ON CONFLICT names exactly the columns the index is built on", async () => {
  // The route and the migration have to agree on the arbiter columns, in the same order. If either
  // side is edited alone, drizzle's inference stops matching the index and every create raises
  // 42P10 at runtime -- a failure no unit test with a database double can see.
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { recipeRemixes } = await import("../../shared/schema");

  const query = drizzle({} as any)
    .insert(recipeRemixes)
    .values({ originalRecipeId: "a", remixedRecipeId: "b", userId: "c" })
    .onConflictDoNothing({
      target: [
        recipeRemixes.originalRecipeId,
        recipeRemixes.remixedRecipeId,
        recipeRemixes.userId,
      ],
    });
  const generated = new PgDialect().sqlToQuery((query as any).getSQL()).sql;
  const arbiter = generated
    .match(/on conflict \(([^)]+)\)/i)![1]
    .split(",")
    .map((column) => column.trim().replace(/"/g, ""));

  assert.deepEqual(arbiter, ["original_recipe_id", "remixed_recipe_id", "user_id"]);

  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_arbiter_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    for (const statement of statementsOf(MIGRATION)) await client.query(statement);

    const definition = await client.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = 'recipe_remix_lineage_idx'`,
      [ns]
    );
    const indexed = definition.rows[0].indexdef
      .match(/\(([^)]+)\)\s*$/)![1]
      .split(",")
      .map((column: string) => column.trim());

    assert.deepEqual(indexed, arbiter, "index columns and ON CONFLICT arbiter must match exactly");
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

it("remix_count is rebuilt by output recipe, and a remix with no engagement rows reads zero", async () => {
  const result = await applyMigration([
    // parent: produced 'out'. Two children remix 'out', so its remix_count must land on 2.
    { id: "parent", original: "src", remixed: "out", user: "u1", createdAt: T1 },
    { id: "child1", original: "out", remixed: "c1", user: "u1", createdAt: T1 },
    { id: "child2", original: "out", remixed: "c2", user: "u1", createdAt: T2 },
    // sibling: shares 'src' with parent but produced nothing that was remixed -> 0.
    { id: "sibling", original: "src", remixed: "sib", user: "u2", createdAt: T1 },
  ]);
  assertCollapsed(result);
  const by = Object.fromEntries(result.rows.map((r) => [r.id, r]));
  assert.equal(by.parent.remix_count, 2, "counted by output recipe, not by shared source");
  assert.equal(by.sibling.remix_count, 0, "a sibling is not a parent");
  assert.equal(by.child1.remix_count, 0);
  for (const row of result.rows) {
    assert.equal(row.likes_count, 0);
    assert.equal(row.saves_count, 0);
  }
});

it("the whole migration is re-runnable", async () => {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_rerun_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await seedOwnership(client, "u1", ["src", "out"]);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('a','src','out','u1',NULL), ('b','src','out','u1',$1)`,
      [T1]
    );

    for (let pass = 1; pass <= 3; pass += 1) {
      for (const statement of statementsOf(MIGRATION)) {
        await client.query(statement); // must not throw on any pass
      }
    }
    const left = await client.query(`SELECT count(*)::int AS n FROM recipe_remixes`);
    assert.equal(left.rows[0].n, 1);
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

// ================================================================================================
// Greptile P1 -- historically forged lineage must not survive the migration
//
// The repaired route stops NEW forged attribution, but every row the old endpoint accepted is still
// in the table. Before this correction the migration removed only duplicate lineage tuples and never
// asked whether a row's user_id authors the output recipe -- so a forged claim stayed visible, stayed
// attributed to the forger, and was counted into the rebuilt remix_count.
//
// Ownership is derived from persisted data only: recipes.post_id -> posts.id -> posts.user_id.
// `recipes` has no author column and the schema has no collaborator model, so this is the whole of it.
// ================================================================================================

it("valid lineage survives: the author of the output recipe keeps their remix", async () => {
  const result = await applyMigration([
    { id: "legit", original: "src", remixed: "out", user: "alice", createdAt: T1 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["legit"]);
  assert.deepEqual(result.quarantinedIds, [], "nothing legitimate was quarantined");
});

it("forged lineage is remediated: the forger is not left attributed to another's recipe", async () => {
  // Alice authors `out`. Mallory claims it as HER remix output -- the exact shape the old endpoint
  // permitted, since it only checked that both ids resolved to some recipe.
  const result = await applyMigration([
    { id: "forged", original: "src", remixed: "out", user: "mallory", outputOwner: "alice", createdAt: T1 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, [], "the forged row is gone from the live table");
  assert.deepEqual(result.quarantinedIds, ["forged"]);
  assert.equal(result.quarantined[0].user_id, "mallory");
  assert.equal(result.quarantined[0].invalid_reason, "user_is_not_the_author_of_the_output_recipe");
});

it("an output recipe nobody can be shown to author cannot be claimed", async () => {
  // post_id IS NULL -- the join yields nothing, so no account satisfies the invariant. The route
  // refuses such a claim rather than assuming it, and the data has to agree.
  const result = await applyMigration([
    { id: "unowned", original: "src", remixed: "orphan", user: "bob", outputUnowned: true, createdAt: T1 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, []);
  assert.equal(result.quarantined[0].invalid_reason, "output_recipe_has_no_resolvable_owner");
});

it("a recipe recorded as a remix of itself is removed", async () => {
  const result = await applyMigration([
    { id: "selfloop", original: "src", remixed: "src", user: "alice", createdAt: T1 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, []);
  assert.equal(result.quarantined[0].invalid_reason, "self_lineage");
});

it("forged + legitimate collision resolves to one correct canonical relationship", async () => {
  // Both rows name the same original and output. Alice authors `out`, so hers is legitimate and
  // Mallory's is forged. They are different lineage KEYS (different user_id), so the unique index
  // alone would happily keep both -- only the ownership check removes the right one.
  const result = await applyMigration([
    { id: "legit", original: "src", remixed: "out", user: "alice", createdAt: T1 },
    { id: "forged", original: "src", remixed: "out", user: "mallory", outputOwner: "alice", createdAt: T2 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["legit"], "the author's row is the one that survives");
  assert.deepEqual(result.quarantinedIds, ["forged"]);
  assert.equal(result.rows[0].user_id, "alice");
});

it("several accounts forging the same output are all remediated, deterministically", async () => {
  const result = await applyMigration([
    { id: "f1", original: "src", remixed: "out", user: "mallory", outputOwner: "alice", createdAt: T1 },
    { id: "f2", original: "src", remixed: "out", user: "trudy", createdAt: T2 },
    { id: "f3", original: "src", remixed: "out", user: "eve", createdAt: null },
    { id: "legit", original: "src", remixed: "out", user: "alice", createdAt: T3 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["legit"]);
  assert.deepEqual(result.quarantinedIds, ["f1", "f2", "f3"]);
  for (const row of result.quarantined) {
    assert.equal(row.invalid_reason, "user_is_not_the_author_of_the_output_recipe");
  }
});

it("forged rows are archived in full, not silently dropped", async () => {
  const result = await applyMigration([
    {
      id: "forged",
      original: "src",
      remixed: "out",
      user: "mallory",
      outputOwner: "alice",
      createdAt: T1,
      remixType: "ingredient_swap",
      changes: { notes: "mallory's text" },
      isPublic: false,
    },
  ]);
  assertCollapsed(result);
  const archived = result.quarantined[0];
  assert.equal(archived.remix_type, "ingredient_swap");
  assert.deepEqual(archived.changes, { notes: "mallory's text" });
  assert.equal(archived.is_public, false);
  assert.equal(archived.original_recipe_id, "src");
  assert.equal(archived.remixed_recipe_id, "out");
});

it("forged lineage contributes nothing to the rebuilt remix_count", async () => {
  // `parent` produced `out`. One VALID child remixes `out`, and two FORGED rows also claim to. Only
  // the valid one may be counted -- this is the assertion that failed before the correction, where
  // the forged rows survived and were counted like any other.
  const result = await applyMigration([
    { id: "parent", original: "src", remixed: "out", user: "alice", createdAt: T1 },
    { id: "valid_child", original: "out", remixed: "kid", user: "alice", createdAt: T2 },
    { id: "forged_child_a", original: "out", remixed: "kid2", user: "mallory", outputOwner: "alice", createdAt: T2 },
    { id: "forged_child_b", original: "out", remixed: "kid3", user: "trudy", outputOwner: "alice", createdAt: T3 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids.sort(), ["parent", "valid_child"]);
  const parent = result.rows.find((r) => r.id === "parent")!;
  assert.equal(parent.remix_count, 1, "one valid child, not three");
});

it("a forged duplicate does not displace the author's authored metadata", async () => {
  // The forged row is NEWER, so plain newest-wins canonicalisation would have taken its metadata.
  // Ownership remediation runs first, so the forged row is gone before canonicalisation even looks.
  const result = await applyMigration([
    {
      id: "legit", original: "src", remixed: "out", user: "alice", createdAt: T1,
      remixType: "variation", changes: { notes: "alice's own" }, isPublic: true,
    },
    {
      id: "forged", original: "src", remixed: "out", user: "mallory", outputOwner: "alice",
      createdAt: T3, remixType: "ingredient_swap", changes: { notes: "mallory's" }, isPublic: false,
    },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["legit"]);
  assert.equal(result.rows[0].remix_type, "variation");
  assert.deepEqual(result.rows[0].changes, { notes: "alice's own" });
  assert.equal(result.rows[0].is_public, true, "a forged row's hidden flag does not close the author's remix");
});

it("ownership remediation runs before de-duplication, so no re-attribution collision exists", async () => {
  // Alice has TWO duplicate legitimate rows and Mallory has a forged one on the same lineage. Had
  // the migration corrected attribution instead of removing it, Mallory's row would have become a
  // third copy of Alice's key. Removal first means there is no collision to resolve.
  const result = await applyMigration([
    { id: "alice_old", original: "src", remixed: "out", user: "alice", createdAt: T1 },
    { id: "alice_new", original: "src", remixed: "out", user: "alice", createdAt: T2 },
    { id: "forged", original: "src", remixed: "out", user: "mallory", outputOwner: "alice", createdAt: T3 },
  ]);
  assertCollapsed(result);
  assert.deepEqual(result.ids, ["alice_new"], "newest of Alice's own duplicates");
  assert.deepEqual(result.quarantinedIds, ["forged"]);
});

it("remediation is re-runnable and does not re-quarantine or resurrect", async () => {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_rerun_forged_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await client.query(`INSERT INTO users (id) VALUES ('alice'), ('mallory')`);
    await client.query(`INSERT INTO posts (id, user_id) VALUES ('p_src','alice'), ('p_out','alice')`);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ('src','p_src'), ('out','p_out')`);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('legit','src','out','alice',$1), ('forged','src','out','mallory',$2)`,
      [T1, T2]
    );

    for (let pass = 1; pass <= 3; pass += 1) {
      for (const statement of statementsOf(MIGRATION)) await client.query(statement);
    }

    const live = await client.query(`SELECT id FROM recipe_remixes ORDER BY id`);
    const held = await client.query(`SELECT id FROM recipe_remixes_invalid_lineage ORDER BY id`);
    assert.deepEqual(live.rows.map((r) => r.id), ["legit"]);
    assert.deepEqual(held.rows.map((r) => r.id), ["forged"], "archived once, not once per run");
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

// ================================================================================================
// Codex / Greptile P2 -- reruns must reconstruct engagement counters, not zero them
// ================================================================================================

it("counters are reconstructed from relationships, and stay correct across reruns", async () => {
  // A: 3 likes / 2 saves, B: 1 / 0, C: 0 / 1, D: 0 / 0 -- with every stored counter deliberately
  // wrong beforehand, so a no-op reconstruction could not pass this.
  const rows: Row[] = [
    { id: "A", original: "src", remixed: "oA", user: "alice", createdAt: T1 },
    { id: "B", original: "src", remixed: "oB", user: "alice", createdAt: T1 },
    { id: "C", original: "src", remixed: "oC", user: "alice", createdAt: T1 },
    { id: "D", original: "src", remixed: "oD", user: "alice", createdAt: T1 },
  ];
  const likes: Engagement[] = [
    { remix: "A", user: "alice" }, { remix: "A", user: "bob" }, { remix: "A", user: "carol" },
    { remix: "B", user: "alice" },
  ];
  const saves: Engagement[] = [
    { remix: "A", user: "alice" }, { remix: "A", user: "bob" },
    { remix: "C", user: "carol" },
  ];

  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_counters_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await client.query(`INSERT INTO users (id) VALUES ('alice'),('bob'),('carol')`);
    await client.query(`INSERT INTO posts (id, user_id) VALUES ('p_src','alice')`);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ('src','p_src')`);
    for (const row of rows) {
      await client.query(`INSERT INTO posts (id, user_id) VALUES ($1,'alice')`, [`p_${row.remixed}`]);
      await client.query(`INSERT INTO recipes (id, post_id) VALUES ($1,$2)`, [row.remixed, `p_${row.remixed}`]);
      await client.query(
        `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [row.id, row.original, row.remixed, row.user, row.createdAt]
      );
    }

    // First pass creates the relationship tables; then seed the relationships.
    for (const statement of statementsOf(MIGRATION)) await client.query(statement);
    let n = 0;
    for (const like of likes) {
      await client.query(`INSERT INTO remix_likes (id,user_id,remix_id) VALUES ($1,$2,$3)`,
        [`l${n++}`, like.user, like.remix]);
    }
    for (const save of saves) {
      await client.query(`INSERT INTO remix_saves (id,user_id,remix_id) VALUES ($1,$2,$3)`,
        [`s${n++}`, save.user, save.remix]);
    }

    // 1. Deliberately wrong stored counters.
    await client.query(`UPDATE recipe_remixes SET likes_count = 999, saves_count = -7`);

    const expected: Record<string, [number, number]> = { A: [3, 2], B: [1, 0], C: [0, 1], D: [0, 0] };

    for (let pass = 1; pass <= 3; pass += 1) {
      // 2 & 4. Apply the reconstruction, then apply it again.
      for (const statement of statementsOf(MIGRATION)) await client.query(statement);

      // 3 & 5. Every counter equals its relationship source of truth, on every pass.
      const state = await client.query(
        `SELECT id, likes_count, saves_count,
                (SELECT count(*)::int FROM remix_likes l WHERE l.remix_id = r.id) AS real_likes,
                (SELECT count(*)::int FROM remix_saves s WHERE s.remix_id = r.id) AS real_saves
           FROM recipe_remixes r ORDER BY id`
      );
      for (const row of state.rows) {
        const [likeCount, saveCount] = expected[row.id];
        assert.equal(row.likes_count, likeCount, `pass ${pass}: ${row.id} likes_count`);
        assert.equal(row.saves_count, saveCount, `pass ${pass}: ${row.id} saves_count`);
        // 8 & 9. Zero-relationship rows are zero, and no remix carries another's aggregate.
        assert.equal(row.likes_count, row.real_likes, `pass ${pass}: ${row.id} matches relationships`);
        assert.equal(row.saves_count, row.real_saves, `pass ${pass}: ${row.id} matches relationships`);
      }

      // 6 & 7. Reconstruction reads relationships, it never destroys them.
      const liveLikes = await client.query(`SELECT id FROM remix_likes ORDER BY id`);
      const liveSaves = await client.query(`SELECT id FROM remix_saves ORDER BY id`);
      assert.equal(liveLikes.rowCount, likes.length, `pass ${pass}: like rows preserved`);
      assert.equal(liveSaves.rowCount, saves.length, `pass ${pass}: save rows preserved`);
    }
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

it("a like is one row per user per remix, and the database enforces it", async () => {
  // This is what makes count(DISTINCT user_id) and count(*) agree. If the constraint were missing,
  // duplicate relationship rows could inflate a counter -- so the constraint is asserted, not assumed.
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_uniq_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await client.query(`INSERT INTO users (id) VALUES ('alice')`);
    await client.query(`INSERT INTO posts (id, user_id) VALUES ('p','alice')`);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ('src','p'), ('out','p')`);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('r','src','out','alice',$1)`, [T1]
    );
    for (const statement of statementsOf(MIGRATION)) await client.query(statement);

    await client.query(`INSERT INTO remix_likes (id,user_id,remix_id) VALUES ('l1','alice','r')`);
    await assert.rejects(
      () => client.query(`INSERT INTO remix_likes (id,user_id,remix_id) VALUES ('l2','alice','r')`),
      (error: any) => error.code === "23505",
      "a second like by the same account on the same remix is refused by the database"
    );
    await client.query(`INSERT INTO remix_saves (id,user_id,remix_id) VALUES ('s1','alice','r')`);
    await assert.rejects(
      () => client.query(`INSERT INTO remix_saves (id,user_id,remix_id) VALUES ('s2','alice','r')`),
      (error: any) => error.code === "23505"
    );
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

it("engagement rows of a removed forged remix go with it, and counters reflect that", async () => {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_cascade_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await client.query(`INSERT INTO users (id) VALUES ('alice'),('mallory'),('bob')`);
    await client.query(`INSERT INTO posts (id, user_id) VALUES ('p_src','alice'),('p_out','alice')`);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ('src','p_src'),('out','p_out')`);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('forged','src','out','mallory',$1)`, [T1]
    );
    // Create the tables, attach a like to the forged remix, then run the migration for real.
    for (const statement of statementsOf(MIGRATION).slice(0, 6)) await client.query(statement);
    await client.query(`INSERT INTO remix_likes (id,user_id,remix_id) VALUES ('l1','bob','forged')`);

    for (const statement of statementsOf(MIGRATION)) await client.query(statement);

    const live = await client.query(`SELECT id FROM recipe_remixes`);
    const orphanLikes = await client.query(`SELECT id FROM remix_likes`);
    assert.equal(live.rowCount, 0, "the forged remix is gone");
    assert.equal(orphanLikes.rowCount, 0, "and its engagement rows went with it, not orphaned");
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

it("an account deletion cannot silently drop a like and leave the counter above it", async () => {
  // The invariant this whole migration establishes is likes_count == number of like relationships.
  // ON DELETE CASCADE on remix_likes.user_id would break it on a reachable path
  // (DELETE /api/users/:id), because nothing in the codebase decrements a counter when an account
  // goes. The constraint is what holds the line, so it is asserted rather than assumed.
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_userfk_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await client.query(`INSERT INTO users (id) VALUES ('alice'),('bob')`);
    await client.query(`INSERT INTO posts (id, user_id) VALUES ('p','alice')`);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ('src','p'),('out','p')`);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('r','src','out','alice',$1)`, [T1]
    );
    for (const statement of statementsOf(MIGRATION)) await client.query(statement);
    await client.query(`INSERT INTO remix_likes (id,user_id,remix_id) VALUES ('l1','bob','r')`);
    await client.query(`INSERT INTO remix_saves (id,user_id,remix_id) VALUES ('s1','bob','r')`);
    await client.query(`UPDATE recipe_remixes SET likes_count = 1, saves_count = 1 WHERE id = 'r'`);

    // Deleting the liker is REFUSED while the like exists, rather than cascading behind the counter.
    await assert.rejects(
      () => client.query(`DELETE FROM users WHERE id = 'bob'`),
      (error: any) => error.code === "23503",
      "a like row must block the account deletion rather than vanish under the counter"
    );

    const state = await client.query(
      `SELECT likes_count, saves_count,
              (SELECT count(*)::int FROM remix_likes WHERE remix_id = 'r') AS real_likes,
              (SELECT count(*)::int FROM remix_saves WHERE remix_id = 'r') AS real_saves
         FROM recipe_remixes WHERE id = 'r'`
    );
    assert.equal(state.rows[0].likes_count, state.rows[0].real_likes, "invariant intact");
    assert.equal(state.rows[0].saves_count, state.rows[0].real_saves, "invariant intact");
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});

it("deleting a remix still takes its engagement rows with it", async () => {
  // The other half of the FK decision: CASCADE on remix_id is correct, because the counter lives on
  // the remix row and goes with it, so there is nothing left to drift.
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_remixfk_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);
    await client.query(`INSERT INTO users (id) VALUES ('alice'),('bob')`);
    await client.query(`INSERT INTO posts (id, user_id) VALUES ('p','alice')`);
    await client.query(`INSERT INTO recipes (id, post_id) VALUES ('src','p'),('out','p')`);
    await client.query(
      `INSERT INTO recipe_remixes (id, original_recipe_id, remixed_recipe_id, user_id, created_at)
       VALUES ('r','src','out','alice',$1)`, [T1]
    );
    for (const statement of statementsOf(MIGRATION)) await client.query(statement);
    await client.query(`INSERT INTO remix_likes (id,user_id,remix_id) VALUES ('l1','bob','r')`);
    await client.query(`INSERT INTO remix_saves (id,user_id,remix_id) VALUES ('s1','bob','r')`);

    await client.query(`DELETE FROM recipe_remixes WHERE id = 'r'`);
    const likes = await client.query(`SELECT id FROM remix_likes`);
    const saves = await client.query(`SELECT id FROM remix_saves`);
    assert.equal(likes.rowCount, 0, "no orphaned like survives its remix");
    assert.equal(saves.rowCount, 0, "no orphaned save survives its remix");
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`).catch(() => {});
    await client.end();
  }
});
