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
  CREATE TABLE recipe_remixes (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    original_recipe_id varchar NOT NULL,
    remixed_recipe_id varchar NOT NULL,
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
};

let scratch = 0;

/**
 * Build a fresh schema, seed it, run the real migration through the runner's own splitting, and hand
 * back what survived. Each case gets its own schema so nothing leaks between tests.
 */
async function applyMigration(rows: Row[]) {
  const client = new pg.Client({ connectionString: CONNECTION! });
  await client.connect();
  const ns = `remix_mig_${process.pid}_${scratch++}`;
  try {
    await client.query(`CREATE SCHEMA ${ns}`);
    await client.query(`SET search_path TO ${ns}`);
    await client.query(SCHEMA);

    const owners = [...new Set(rows.map((r) => r.user ?? "u1"))];
    for (const owner of owners) {
      await client.query(`INSERT INTO users (id) VALUES ($1)`, [owner]);
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

    return {
      rows: survivors.rows,
      ids: survivors.rows.map((r) => r.id),
      indexExists: index.rowCount === 1,
      duplicateGroups: groups.rows[0].n as number,
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
    // Same recipes, different author: a DIFFERENT lineage key, so it is not a duplicate.
    { id: "g3_other_user", original: "s1", remixed: "o1", user: "u2", createdAt: null },
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
    { id: "d", original: "s1", remixed: "o1", user: "u2", createdAt: null },
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
    await client.query(`INSERT INTO users (id) VALUES ('u1')`);
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
    await client.query(`INSERT INTO users (id) VALUES ('u1')`);
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

it("counters are rebuilt from relationships and engagement tallies are zeroed", async () => {
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
    await client.query(`INSERT INTO users (id) VALUES ('u1')`);
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
