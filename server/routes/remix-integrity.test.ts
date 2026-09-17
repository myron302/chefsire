/**
 * P2-03 -- remix attribution, relationship uniqueness and engagement-counter integrity, driven as
 * real HTTP requests against the real router.
 *
 * Four defects, all reachable before this repair:
 *
 *   1. `POST /api/remixes` proved nothing about `remixedRecipeId`. It checked only that both ids
 *      resolved to SOME recipe, so knowing two ids was enough to publish a row claiming any recipe
 *      on the platform as your own remix output.
 *
 *   2. The counter update read
 *          UPDATE recipe_remixes SET remix_count = remix_count + 1 WHERE original_recipe_id = $1
 *      `remix_count` is documented as "how many times this remix was remixed", which is a property
 *      of the recipe a row PRODUCED -- so the rows to move are those with
 *      remixed_recipe_id = originalRecipeId. The predicate above names a different set entirely:
 *      every SIBLING remix sharing the source recipe, none of which was remixed, and never the
 *      parent that was.
 *
 *   3. `POST /:id/like` and `POST /:id/save` had no `requireAuth` and stored nothing per user, so
 *      they counted REQUESTS. An anonymous caller could raise either counter without limit and no
 *      like could ever be undone.
 *
 *   4. Nothing stopped the same lineage being inserted twice, so a replayed create produced a second
 *      row, a second counter bump and a second "your recipe was remixed" notification.
 *
 * Ownership is the part worth stating plainly, because the schema hides it: `recipes` has NO
 * `user_id`. A recipe's author is `recipes.post_id -> posts.user_id`, and `post_id` is nullable, so
 * some recipes have no provable owner at all. The old handler read `originalRecipe.userId` -- a
 * property that row does not have -- so remix notifications never fired either.
 *
 * There is no Postgres here. `db` is a double that really stores rows, really enforces the unique
 * indexes this repair adds, really rolls back a failed transaction, and evaluates the counter
 * arithmetic from the SQL the route actually builds (throwing on any expression it was not taught,
 * so it can never silently no-op an update it does not understand). Auth is real: tokens are signed
 * with the repository's own `signAuthToken`, so a request asserting identity any other way -- a body
 * field, a query parameter, an `x-user-id` header -- is treated as the account its token names.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  notifications,
  posts,
  recipeRemixes,
  recipes,
  remixLikes,
  remixSaves,
  users,
} from "../../shared/schema";
import { signAuthToken } from "../lib/jwt-config";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://remix-integrity-tests/none";

const { db } = await import("../db");

const AUTHOR = "author-user-id";
const OTHER = "other-user-id";
const STRANGER = "stranger-user-id";

// Lineage under test: SOURCE (owned by OTHER) is remixed into OUTPUT (owned by AUTHOR).
const SOURCE = "source-recipe-id";
const OUTPUT = "output-recipe-id";
const FOREIGN = "foreign-recipe-id"; // owned by OTHER -- AUTHOR must not be able to claim it
const ORPHAN = "orphan-recipe-id"; // exists, but post_id is null: no provable owner
const GRANDCHILD = "grandchild-recipe-id"; // owned by AUTHOR, used to remix OUTPUT one level further

// Pre-existing remix rows.
const PARENT_REMIX = "parent-remix-id"; // SOURCE -> OUTPUT, the row whose output gets remixed
const SIBLING_REMIX = "sibling-remix-id"; // SOURCE -> something else: shares the SOURCE, must not move
const UNRELATED_REMIX = "unrelated-remix-id"; // nothing to do with any of it

const CREATED_AT = new Date("2024-01-01T00:00:00.000Z");

// ------------------------------------------------------------------------------------------------
// The database double
// ------------------------------------------------------------------------------------------------

type Store = { table: unknown; rows: any[] };

let stores: Store[] = [];
/** Unique violations the double raised, so a test can assert the index did the refusing. */
let uniqueViolations = 0;
/** Set by a test to make one operation fail, for the atomicity cases. */
let failNextUpdate: string | null = null;

const dialect = new PgDialect();

/** The unique indexes the migration creates, as the double enforces them. */
const UNIQUE_KEYS = new Map<unknown, string[]>([
  [recipeRemixes, ["originalRecipeId", "remixedRecipeId", "userId"]],
  [remixLikes, ["userId", "remixId"]],
  [remixSaves, ["userId", "remixId"]],
]);

function snake(name: string) {
  return name.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
}
function camel(name: string) {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** The bound values inside a drizzle `where`, in the order the clause binds them. */
function paramsOf(node: any, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const entry of node) paramsOf(entry, out);
    return out;
  }
  if (node.constructor?.name === "Param" && "value" in node) {
    out.push(node.value);
    return out;
  }
  if (Array.isArray(node.queryChunks)) for (const chunk of node.queryChunks) paramsOf(chunk, out);
  return out;
}

function storeFor(table: unknown) {
  return stores.find((entry) => entry.table === table);
}

/** Rows a `where` selects. Equality conjunctions over one table is the whole grammar in play. */
function rowsMatching(table: unknown, clause: any) {
  const rows = storeFor(table)?.rows ?? [];
  if (!clause) return rows;
  const { sql } = dialect.sqlToQuery(clause);
  const bound = paramsOf(clause);
  const columns = [...sql.matchAll(/"([a-z_]+)"\."([a-z_]+)"/g)].map((match) => match[2]);
  return rows.filter((row) =>
    columns.every((column, index) => {
      if (index >= bound.length) return true;
      return row[camel(column)] === bound[index];
    })
  );
}

/**
 * Evaluate a counter expression the route built, against the row it targets.
 *
 * Only the two forms this repair emits are understood -- `col + 1` and `GREATEST(col - 1, 0)`. Any
 * other expression THROWS rather than being ignored, so the double can never quietly turn a counter
 * update it does not recognise into a no-op and let a test pass for the wrong reason.
 */
function evaluateCounter(expression: any, row: any): number {
  const { sql: text } = dialect.sqlToQuery(expression);
  const column = text.match(/"[a-z_]+"\."([a-z_]+)"/);
  if (!column) throw new Error(`test double cannot evaluate SQL: ${text}`);
  const current = Number(row[camel(column[1])] ?? 0);
  if (/^GREATEST\(\s*"[a-z_]+"\."[a-z_]+"\s*-\s*1\s*,\s*0\s*\)$/.test(text.trim())) {
    return Math.max(current - 1, 0);
  }
  if (/^"[a-z_]+"\."[a-z_]+"\s*\+\s*1$/.test(text.trim())) return current + 1;
  throw new Error(`test double cannot evaluate SQL: ${text}`);
}

function isSqlExpression(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as any).queryChunks);
}

function violatesUnique(table: unknown, candidate: any, ignore?: any) {
  const key = UNIQUE_KEYS.get(table);
  if (!key) return false;
  return (storeFor(table)?.rows ?? []).some(
    (row) => row !== ignore && key.every((field) => row[field] === candidate[field])
  );
}

class UniqueViolation extends Error {
  code = "23505";
  constructor(table: string) {
    super(`duplicate key value violates unique constraint on ${table}`);
  }
}

function makeRunner() {
  const runner: any = {};

  /**
   * Raw `db.execute(sql\`...\`)` really runs.
   *
   * The pre-repair counter update was raw SQL, so a double that no-oped `execute` would let the
   * "siblings must not move" tests pass against the vulnerable code for the wrong reason -- they
   * would be asserting that the double did nothing, not that the route targeted the right rows.
   * The one statement shape that path emits is interpreted here; anything else throws.
   */
  runner.execute = (statement: any) => {
    const run = () => {
      if (!statement) return { rows: [] };
      const { sql: text, params } = dialect.sqlToQuery(statement);
      const match = text
        .replace(/\s+/g, " ")
        .trim()
        .match(
          /^UPDATE recipe_remixes SET (remix_count|likes_count|saves_count) = \1 \+ 1 WHERE ([a-z_]+) = \$1$/i
        );
      if (!match) throw new Error(`test double cannot execute raw SQL: ${text}`);
      const [, counter, predicate] = match;
      for (const row of rowsOf(recipeRemixes)) {
        if (row[camel(predicate)] === params[0]) {
          row[camel(counter)] = Number(row[camel(counter)] ?? 0) + 1;
        }
      }
      return { rows: [] };
    };
    return Promise.resolve().then(run);
  };

  runner.select = () => {
    let table: unknown;
    let whereClause: any = null;
    const chain: any = {
      from(t: unknown) { table = t; return chain; },
      innerJoin() { return chain; },
      leftJoin() { return chain; },
      where(clause: unknown) { whereClause = clause; return chain; },
      limit() { return chain; },
      offset() { return chain; },
      orderBy() { return chain; },
      groupBy() { return chain; },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => rowsMatching(table, whereClause).map((row) => ({ ...row })))
          .then(resolve, reject);
      },
    };
    return chain;
  };

  runner.insert = (table: unknown) => ({
    values(value: any) {
      let conflictTarget: unknown[] | null = null;
      const build = () => {
        const row = {
          id: `${snake(String((table as any)[Symbol.for("drizzle:Name")] ?? "row"))}-${
            (storeFor(table)?.rows.length ?? 0) + 1
          }`,
          createdAt: new Date(),
          likesCount: 0,
          savesCount: 0,
          remixCount: 0,
          ...value,
        };
        if (violatesUnique(table, row)) {
          uniqueViolations += 1;
          // `onConflictDoNothing` is the ONLY thing that turns this into an empty result. Without it
          // the database raises, which is what makes the index -- not a preceding SELECT -- the real
          // protection against a concurrent duplicate.
          if (!conflictTarget) throw new UniqueViolation(String(table));
          return [];
        }
        storeFor(table)?.rows.push(row);
        return [{ ...row }];
      };
      const result: any = {
        onConflictDoUpdate() { return result; },
        onConflictDoNothing(config?: any) {
          conflictTarget = config?.target ?? [];
          return result;
        },
        returning() { return result; },
        then: (resolve: any, reject: any) =>
          Promise.resolve().then(build).then(resolve, reject),
      };
      return result;
    },
  });

  runner.update = (table: unknown) => ({
    set(value: Record<string, unknown>) {
      return {
        where(clause: unknown) {
          const run = () => {
            if (failNextUpdate) {
              const label = failNextUpdate;
              failNextUpdate = null;
              throw new Error(label);
            }
            const matched = rowsMatching(table, clause);
            for (const row of matched) {
              for (const [key, entry] of Object.entries(value)) {
                if (entry === undefined) continue; // drizzle's mapUpdateSet drops these
                row[key] = isSqlExpression(entry) ? evaluateCounter(entry, row) : entry;
              }
            }
            return matched.map((row) => ({ ...row }));
          };
          const result: any = {
            returning() { return result; },
            then: (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject),
          };
          return result;
        },
      };
    },
  });

  runner.delete = (table: unknown) => ({
    where(clause: unknown) {
      const run = () => {
        const matched = rowsMatching(table, clause);
        const store = storeFor(table);
        if (store) store.rows = store.rows.filter((row) => !matched.includes(row));
        return matched.map((row) => ({ ...row }));
      };
      const result: any = {
        returning() { return result; },
        then: (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject),
      };
      return result;
    },
  });

  return runner;
}

/**
 * Transactions are serialised and really roll back.
 *
 * Serialising them models the isolation the route relies on and keeps the concurrency tests
 * deterministic -- and it does not weaken them, because the checks a concurrent caller could race
 * through (recipe existence, ownership, "does this remix exist") happen OUTSIDE the transaction.
 * Two simultaneous requests therefore both reach their insert having passed every pre-check, which
 * is exactly the situation a SELECT-then-INSERT repair would fail.
 */
let txChain: Promise<unknown> = Promise.resolve();

function installDatabaseDouble() {
  const anyDb = db as any;
  Object.assign(anyDb, makeRunner());

  anyDb.transaction = (fn: (tx: any) => Promise<any>) => {
    const run = async () => {
      const snapshot = stores.map((store) => ({
        table: store.table,
        rows: store.rows.map((row) => ({ ...row })),
      }));
      try {
        return await fn(anyDb);
      } catch (error) {
        stores = snapshot; // ROLLBACK
        throw error;
      }
    };
    const next = txChain.then(run, run);
    txChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}

installDatabaseDouble();

const remixesRouter = (await import("./remixes")).default;

const app = express();
app.use(express.json());
app.use("/api/remixes", remixesRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

const asUser = (id: string) => ({ Authorization: `Bearer ${signAuthToken({ id })}` });

/**
 * Reset the world.
 *
 * Recipes get their owner through a post, because that is the only ownership `recipes` has. ORPHAN
 * deliberately has no post, which is the real "recipe nobody can be shown to own" case.
 */
function given() {
  stores = [
    {
      table: users,
      rows: [AUTHOR, OTHER, STRANGER].map((id) => ({
        id,
        username: `user-${id}`,
        avatar: null,
        nutritionPremium: false,
        nutritionTrialEndsAt: null,
      })),
    },
    {
      table: posts,
      rows: [
        { id: "post-source", userId: OTHER },
        { id: "post-output", userId: AUTHOR },
        { id: "post-foreign", userId: OTHER },
        { id: "post-grandchild", userId: AUTHOR },
      ],
    },
    {
      table: recipes,
      rows: [
        { id: SOURCE, postId: "post-source", title: "Source" },
        { id: OUTPUT, postId: "post-output", title: "Output" },
        { id: FOREIGN, postId: "post-foreign", title: "Foreign" },
        { id: GRANDCHILD, postId: "post-grandchild", title: "Grandchild" },
        { id: ORPHAN, postId: null, title: "Orphan" },
      ],
    },
    {
      table: recipeRemixes,
      rows: [
        // The parent: its OUTPUT is the recipe a further remix would use as its source.
        {
          id: PARENT_REMIX, originalRecipeId: SOURCE, remixedRecipeId: OUTPUT, userId: AUTHOR,
          remixType: "variation", changes: {}, likesCount: 0, savesCount: 0, remixCount: 0,
          isPublic: true, createdAt: CREATED_AT,
        },
        // A sibling: same SOURCE, different output. The pre-repair predicate moved this one.
        {
          id: SIBLING_REMIX, originalRecipeId: SOURCE, remixedRecipeId: FOREIGN, userId: OTHER,
          remixType: "variation", changes: {}, likesCount: 0, savesCount: 0, remixCount: 0,
          isPublic: true, createdAt: CREATED_AT,
        },
        {
          id: UNRELATED_REMIX, originalRecipeId: FOREIGN, remixedRecipeId: GRANDCHILD, userId: STRANGER,
          remixType: "variation", changes: {}, likesCount: 0, savesCount: 0, remixCount: 0,
          isPublic: true, createdAt: CREATED_AT,
        },
      ],
    },
    { table: remixLikes, rows: [] },
    { table: remixSaves, rows: [] },
    { table: notifications, rows: [] },
  ];
  uniqueViolations = 0;
  failNextUpdate = null;
}

function rowsOf(table: unknown) {
  return storeFor(table)?.rows ?? [];
}
function stored(table: unknown, id: string) {
  return rowsOf(table).find((row) => row.id === id);
}
function remixCountOf(id: string) {
  return stored(recipeRemixes, id)?.remixCount;
}

async function send(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/** A legitimate create: AUTHOR says their own GRANDCHILD is a remix of OUTPUT. */
const legitimate = { originalRecipeId: OUTPUT, remixedRecipeId: GRANDCHILD };

// ================================================================================================
// A. Remix output attribution
// ================================================================================================

test("the authenticated author can create a remix of someone else's recipe", async () => {
  given();
  // AUTHOR owns OUTPUT; SOURCE belongs to OTHER. Remixing another account's recipe is the feature.
  const res = await send("POST", "/api/remixes", {
    originalRecipeId: SOURCE,
    remixedRecipeId: OUTPUT,
    remixType: "ingredient_swap",
  }, asUser(AUTHOR));

  // The lineage AUTHOR already holds is (SOURCE -> OUTPUT), so this one is a replay; use a fresh
  // pair to prove creation itself works.
  assert.equal(res.status, 200);

  given();
  const fresh = await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(fresh.status, 200);
  assert.equal(fresh.body.remix.userId, AUTHOR);
  assert.equal(fresh.body.remix.originalRecipeId, OUTPUT);
  assert.equal(fresh.body.remix.remixedRecipeId, GRANDCHILD);
  assert.equal(rowsOf(recipeRemixes).length, 4);
});

test("a caller cannot claim another account's recipe as their remix output", async () => {
  given();
  // FOREIGN belongs to OTHER. AUTHOR knows both ids and that is all the old handler required.
  const res = await send("POST", "/api/remixes", {
    originalRecipeId: SOURCE,
    remixedRecipeId: FOREIGN,
  }, asUser(AUTHOR));

  assert.equal(res.status, 403);
  assert.equal(rowsOf(recipeRemixes).length, 3, "no row was created");
  assert.ok(
    !rowsOf(recipeRemixes).some((row) => row.userId === AUTHOR && row.remixedRecipeId === FOREIGN)
  );
});

test("a recipe with no resolvable owner cannot be claimed by anyone", async () => {
  given();
  // ORPHAN has post_id = null, so no account can be shown to have authored it.
  for (const actor of [AUTHOR, OTHER, STRANGER]) {
    const res = await send("POST", "/api/remixes", {
      originalRecipeId: SOURCE,
      remixedRecipeId: ORPHAN,
    }, asUser(actor));
    assert.equal(res.status, 403, `${actor} must not be able to claim an unowned recipe`);
  }
  assert.equal(rowsOf(recipeRemixes).length, 3);
});

test("a nonexistent original recipe is rejected", async () => {
  given();
  const res = await send("POST", "/api/remixes", {
    originalRecipeId: "no-such-recipe",
    remixedRecipeId: GRANDCHILD,
  }, asUser(AUTHOR));
  assert.equal(res.status, 404);
  assert.equal(rowsOf(recipeRemixes).length, 3);
});

test("a nonexistent remixed recipe is rejected", async () => {
  given();
  const res = await send("POST", "/api/remixes", {
    originalRecipeId: SOURCE,
    remixedRecipeId: "no-such-recipe",
  }, asUser(AUTHOR));
  assert.equal(res.status, 404);
  assert.equal(rowsOf(recipeRemixes).length, 3);
});

test("a recipe cannot be both the original and the remix", async () => {
  given();
  const res = await send("POST", "/api/remixes", {
    originalRecipeId: OUTPUT,
    remixedRecipeId: OUTPUT,
  }, asUser(AUTHOR));
  assert.equal(res.status, 400);
  assert.match(res.body.error, /cannot be a remix of itself/i);
  assert.equal(rowsOf(recipeRemixes).length, 3);
  // And nothing counted itself.
  assert.equal(remixCountOf(PARENT_REMIX), 0);
});

test("self-remixing a recipe you also authored stays allowed", async () => {
  given();
  // AUTHOR owns both OUTPUT and GRANDCHILD. Nothing in the schema or the UI forbids this, so the
  // repair must not start forbidding it.
  const res = await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(res.status, 200);
  assert.equal(res.body.remix.userId, AUTHOR);
});

test("anonymous remix creation is rejected", async () => {
  given();
  const res = await send("POST", "/api/remixes", legitimate);
  assert.equal(res.status, 401);
  assert.equal(rowsOf(recipeRemixes).length, 3);
});

// ------------------------------------------------------------------------------------------------
// Forged actor identity
// ------------------------------------------------------------------------------------------------

test("a body userId cannot alter attribution", async () => {
  given();
  // The create schema is `.strict()`, so an unknown key is refused outright rather than stripped --
  // the caller never gets a 200 that hides what was ignored.
  const res = await send("POST", "/api/remixes", {
    ...legitimate,
    userId: OTHER,
  }, asUser(AUTHOR));
  assert.equal(res.status, 400);
  assert.equal(rowsOf(recipeRemixes).length, 3);
});

test("an x-user-id header cannot alter attribution", async () => {
  given();
  const res = await send("POST", "/api/remixes", legitimate, {
    ...asUser(AUTHOR),
    "x-user-id": OTHER,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.remix.userId, AUTHOR, "the token names the actor, the header does not");
});

test("a query userId cannot alter attribution", async () => {
  given();
  const res = await send(
    "POST",
    `/api/remixes?userId=${OTHER}`,
    legitimate,
    asUser(AUTHOR)
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.remix.userId, AUTHOR);
});

test("a forged actor cannot make someone else claim a recipe they do not own", async () => {
  given();
  // STRANGER owns nothing, and naming AUTHOR every way a request can does not change that.
  const res = await send(
    "POST",
    `/api/remixes?userId=${AUTHOR}`,
    { originalRecipeId: SOURCE, remixedRecipeId: OUTPUT },
    { ...asUser(STRANGER), "x-user-id": AUTHOR }
  );
  assert.equal(res.status, 403);
  assert.equal(rowsOf(recipeRemixes).length, 3);
});

// ================================================================================================
// B. Relationship uniqueness / replay
// ================================================================================================

test("a duplicate remix request does not create a second relationship", async () => {
  given();
  const first = await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(first.status, 200);
  assert.equal(rowsOf(recipeRemixes).length, 4);

  const replay = await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(replay.status, 200, "a replay is a no-op, not an error the client must handle");
  assert.equal(rowsOf(recipeRemixes).length, 4, "still one relationship");
  assert.equal(replay.body.remix.id, first.body.remix.id, "the same row comes back");
});

test("a replayed create does not increment counters again", async () => {
  given();
  await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  // GRANDCHILD is a remix of OUTPUT, and PARENT_REMIX is the row whose output IS OUTPUT.
  assert.equal(remixCountOf(PARENT_REMIX), 1);

  await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(remixCountOf(PARENT_REMIX), 1, "three requests, one remix, one count");
});

test("a replayed create does not generate a duplicate notification", async () => {
  given();
  // SOURCE belongs to OTHER, so a real create notifies OTHER exactly once.
  const body = { originalRecipeId: SOURCE, remixedRecipeId: GRANDCHILD };
  await send("POST", "/api/remixes", body, asUser(AUTHOR));
  const after = rowsOf(notifications).filter((row) => row.type === "remix").length;
  assert.equal(after, 1);

  await send("POST", "/api/remixes", body, asUser(AUTHOR));
  await send("POST", "/api/remixes", body, asUser(AUTHOR));
  assert.equal(
    rowsOf(notifications).filter((row) => row.type === "remix").length,
    1,
    "no new relationship, no new notification"
  );
});

test("the notification reaches the original recipe's author, not the remixer", async () => {
  given();
  await send("POST", "/api/remixes", {
    originalRecipeId: SOURCE,
    remixedRecipeId: GRANDCHILD,
  }, asUser(AUTHOR));
  const sent = rowsOf(notifications).filter((row) => row.type === "remix");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].userId, OTHER, "SOURCE belongs to OTHER");
});

test("remixing your own recipe does not notify you", async () => {
  given();
  // AUTHOR owns OUTPUT, the source of this remix. Self-notification suppression is preserved.
  await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(rowsOf(notifications).filter((row) => row.type === "remix").length, 0);
});

test("concurrent identical creates cannot bypass uniqueness", async () => {
  given();
  const [a, b, c] = await Promise.all([
    send("POST", "/api/remixes", legitimate, asUser(AUTHOR)),
    send("POST", "/api/remixes", legitimate, asUser(AUTHOR)),
    send("POST", "/api/remixes", legitimate, asUser(AUTHOR)),
  ]);

  assert.deepEqual([a.status, b.status, c.status], [200, 200, 200]);
  assert.equal(rowsOf(recipeRemixes).length, 4, "three simultaneous requests, one row");
  assert.equal(remixCountOf(PARENT_REMIX), 1, "and one counter movement");
  assert.equal(
    rowsOf(notifications).filter((row) => row.type === "remix").length,
    0,
    "self-remix: still no notification, and certainly not three"
  );
  assert.ok(uniqueViolations >= 1, "the database index is what refused the duplicates");
});

test("the unique index, not a preceding SELECT, is the final protection", async () => {
  given();
  // An insert that does NOT defer to onConflictDoNothing is refused by the index itself. This is
  // what makes the concurrency guarantee a database guarantee rather than an in-process one.
  await assert.rejects(
    () =>
      Promise.resolve(
        (db as any)
          .insert(recipeRemixes)
          .values({ originalRecipeId: SOURCE, remixedRecipeId: OUTPUT, userId: AUTHOR })
          .returning()
      ),
    (error: any) => error.code === "23505"
  );
  assert.equal(rowsOf(recipeRemixes).length, 3);
});

// ================================================================================================
// C. Counter integrity -- remixCount
// ================================================================================================

test("exactly the correct parent remix counter moves, once", async () => {
  given();
  await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  // PARENT_REMIX produced OUTPUT, and OUTPUT is what was just remixed.
  assert.equal(remixCountOf(PARENT_REMIX), 1);
});

test("sibling remixes sharing the original recipe do not move", async () => {
  given();
  // This is the scenario the old predicate got wrong. Remixing SOURCE means the rows sharing
  // original_recipe_id = SOURCE -- PARENT_REMIX and SIBLING_REMIX -- are exactly the set
  // `WHERE original_recipe_id = $1` selected, and neither of them was remixed by this request:
  // what was remixed is SOURCE itself, a recipe no remix row produced.
  const res = await send("POST", "/api/remixes", {
    originalRecipeId: SOURCE,
    remixedRecipeId: GRANDCHILD,
  }, asUser(AUTHOR));
  assert.equal(res.status, 200);
  assert.equal(remixCountOf(SIBLING_REMIX), 0, "a sibling is not a parent");
  assert.equal(remixCountOf(PARENT_REMIX), 0, "nor is the row that merely shares the source");
});

test("unrelated remixes do not move", async () => {
  given();
  // Under both scenarios: the one with siblings, and the one with a real parent.
  await send("POST", "/api/remixes", {
    originalRecipeId: SOURCE,
    remixedRecipeId: GRANDCHILD,
  }, asUser(AUTHOR));
  assert.equal(remixCountOf(UNRELATED_REMIX), 0);

  given();
  await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(remixCountOf(UNRELATED_REMIX), 0);
  assert.equal(remixCountOf(SIBLING_REMIX), 0);
});

test("remixing the source recipe moves no counter when nothing produced it", async () => {
  given();
  // SOURCE is the root of the tree -- no remix row has remixed_recipe_id = SOURCE -- so a remix OF
  // it increments nothing, which is correct and is the case the old predicate got most wrong: it
  // would have bumped both rows that merely share SOURCE as their origin.
  const res = await send("POST", "/api/remixes", {
    originalRecipeId: SOURCE,
    remixedRecipeId: GRANDCHILD,
  }, asUser(AUTHOR));
  assert.equal(res.status, 200);
  assert.equal(remixCountOf(PARENT_REMIX), 0);
  assert.equal(remixCountOf(SIBLING_REMIX), 0);
  assert.equal(remixCountOf(UNRELATED_REMIX), 0);
});

test("deleting a remix gives back the count it took", async () => {
  given();
  const created = await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(remixCountOf(PARENT_REMIX), 1);

  const gone = await send("DELETE", `/api/remixes/${created.body.remix.id}`, undefined, asUser(AUTHOR));
  assert.equal(gone.status, 200);
  assert.equal(remixCountOf(PARENT_REMIX), 0, "delete-and-recreate must not ratchet the counter");

  await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));
  assert.equal(remixCountOf(PARENT_REMIX), 1);
});

test("a failed counter update rolls the relationship back with it", async () => {
  given();
  failNextUpdate = "counter update exploded";
  const res = await send("POST", "/api/remixes", legitimate, asUser(AUTHOR));

  assert.equal(res.status, 500, "an uncertain write is reported, not dressed up as success");
  assert.equal(rowsOf(recipeRemixes).length, 3, "the inserted row was rolled back");
  assert.equal(remixCountOf(PARENT_REMIX), 0);
  assert.equal(
    rowsOf(notifications).filter((row) => row.type === "remix").length,
    0,
    "and nothing announced a remix that does not exist"
  );
});

// ================================================================================================
// D. Like integrity
// ================================================================================================

test("an anonymous like is rejected", async () => {
  given();
  const res = await send("POST", `/api/remixes/${PARENT_REMIX}/like`);
  assert.equal(res.status, 401);
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 0);
  assert.equal(rowsOf(remixLikes).length, 0);
});

test("an authenticated like succeeds and is persisted per user", async () => {
  given();
  const res = await send("POST", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
  assert.equal(res.status, 200);
  assert.equal(res.body.liked, true);
  assert.equal(res.body.likesCount, 1);
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 1);
  assert.equal(rowsOf(remixLikes).length, 1);
  assert.equal(rowsOf(remixLikes)[0].userId, OTHER);
  assert.equal(rowsOf(remixLikes)[0].remixId, PARENT_REMIX);
});

test("repeating a like cannot inflate the count", async () => {
  given();
  for (let i = 0; i < 5; i += 1) {
    const res = await send(`POST`, `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
    assert.equal(res.status, 200);
    assert.equal(res.body.likesCount, 1, `request ${i + 1} must still read 1`);
  }
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 1);
  assert.equal(rowsOf(remixLikes).length, 1);
});

test("unliking reverses exactly one like", async () => {
  given();
  await send("POST", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
  const res = await send("DELETE", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
  assert.equal(res.status, 200);
  assert.equal(res.body.liked, false);
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 0);
  assert.equal(rowsOf(remixLikes).length, 0);
});

test("repeating an unlike is safe and cannot drive the count negative", async () => {
  given();
  await send("POST", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
  for (let i = 0; i < 4; i += 1) {
    const res = await send("DELETE", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
    assert.equal(res.status, 200);
    assert.equal(res.body.likesCount, 0);
  }
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 0);
});

test("two different accounts can each like once", async () => {
  given();
  await send("POST", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
  await send("POST", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(STRANGER));
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 2);
  assert.equal(rowsOf(remixLikes).length, 2);

  // And one account's unlike removes only its own.
  await send("DELETE", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 1);
  assert.equal(rowsOf(remixLikes).length, 1);
  assert.equal(rowsOf(remixLikes)[0].userId, STRANGER);
});

test("a forged actor cannot like on behalf of another account", async () => {
  given();
  await send(
    "POST",
    `/api/remixes/${PARENT_REMIX}/like?userId=${STRANGER}`,
    { userId: STRANGER },
    { ...asUser(OTHER), "x-user-id": STRANGER }
  );
  assert.equal(rowsOf(remixLikes).length, 1);
  assert.equal(rowsOf(remixLikes)[0].userId, OTHER, "the token decides, nothing else");

  // STRANGER's own unlike therefore removes nothing.
  const res = await send("DELETE", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(STRANGER));
  assert.equal(res.body.likesCount, 1);
  assert.equal(rowsOf(remixLikes).length, 1);
});

test("concurrent likes from one account cannot create duplicates", async () => {
  given();
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      send("POST", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER))
    )
  );
  for (const res of results) assert.equal(res.status, 200);
  assert.equal(rowsOf(remixLikes).length, 1, "four simultaneous requests, one like");
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 1);
  assert.ok(uniqueViolations >= 1, "the unique index is what refused them");
});

test("liking a remix that does not exist is a 404", async () => {
  given();
  const res = await send("POST", "/api/remixes/no-such-remix/like", undefined, asUser(OTHER));
  assert.equal(res.status, 404);
  assert.equal(rowsOf(remixLikes).length, 0);
});

// ================================================================================================
// E. Save integrity
// ================================================================================================

test("an anonymous save is rejected", async () => {
  given();
  const res = await send("POST", `/api/remixes/${PARENT_REMIX}/save`);
  assert.equal(res.status, 401);
  assert.equal(stored(recipeRemixes, PARENT_REMIX).savesCount, 0);
  assert.equal(rowsOf(remixSaves).length, 0);
});

test("an authenticated save succeeds and is persisted per user", async () => {
  given();
  const res = await send("POST", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER));
  assert.equal(res.status, 200);
  assert.equal(res.body.saved, true);
  assert.equal(res.body.savesCount, 1);
  assert.equal(rowsOf(remixSaves).length, 1);
  assert.equal(rowsOf(remixSaves)[0].userId, OTHER);
});

test("repeating a save cannot inflate the count", async () => {
  given();
  for (let i = 0; i < 5; i += 1) {
    const res = await send("POST", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER));
    assert.equal(res.body.savesCount, 1);
  }
  assert.equal(stored(recipeRemixes, PARENT_REMIX).savesCount, 1);
  assert.equal(rowsOf(remixSaves).length, 1);
});

test("unsaving works exactly once and repeats are safe", async () => {
  given();
  await send("POST", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER));
  const first = await send("DELETE", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER));
  assert.equal(first.status, 200);
  assert.equal(first.body.saved, false);
  assert.equal(stored(recipeRemixes, PARENT_REMIX).savesCount, 0);

  for (let i = 0; i < 3; i += 1) {
    const again = await send("DELETE", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER));
    assert.equal(again.status, 200);
    assert.equal(again.body.savesCount, 0);
  }
  assert.equal(rowsOf(remixSaves).length, 0);
});

test("two accounts can save independently", async () => {
  given();
  await send("POST", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER));
  await send("POST", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(STRANGER));
  assert.equal(stored(recipeRemixes, PARENT_REMIX).savesCount, 2);
  assert.equal(rowsOf(remixSaves).length, 2);
});

test("concurrent saves from one account cannot duplicate", async () => {
  given();
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      send("POST", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER))
    )
  );
  for (const res of results) assert.equal(res.status, 200);
  assert.equal(rowsOf(remixSaves).length, 1);
  assert.equal(stored(recipeRemixes, PARENT_REMIX).savesCount, 1);
});

test("a forged actor cannot save on behalf of another account", async () => {
  given();
  await send(
    "POST",
    `/api/remixes/${PARENT_REMIX}/save?userId=${STRANGER}`,
    { userId: STRANGER },
    { ...asUser(OTHER), "x-user-id": STRANGER }
  );
  assert.equal(rowsOf(remixSaves).length, 1);
  assert.equal(rowsOf(remixSaves)[0].userId, OTHER);
});

test("saving a remix that does not exist is a 404", async () => {
  given();
  const res = await send("POST", "/api/remixes/no-such-remix/save", undefined, asUser(OTHER));
  assert.equal(res.status, 404);
  assert.equal(rowsOf(remixSaves).length, 0);
});

test("likes and saves are independent of each other", async () => {
  given();
  await send("POST", `/api/remixes/${PARENT_REMIX}/like`, undefined, asUser(OTHER));
  assert.equal(stored(recipeRemixes, PARENT_REMIX).savesCount, 0);
  await send("POST", `/api/remixes/${PARENT_REMIX}/save`, undefined, asUser(OTHER));
  assert.equal(stored(recipeRemixes, PARENT_REMIX).likesCount, 1);
  assert.equal(stored(recipeRemixes, PARENT_REMIX).savesCount, 1);
});

// ================================================================================================
// PR #1289 must not regress
// ================================================================================================

test("the generic update still cannot mutate counters", async () => {
  given();
  for (const field of ["likesCount", "savesCount", "remixCount"]) {
    const res = await send(
      "PUT",
      `/api/remixes/${PARENT_REMIX}`,
      { [field]: 9999 },
      asUser(AUTHOR)
    );
    assert.equal(res.status, 400, `${field} must be refused`);
  }
  const row = stored(recipeRemixes, PARENT_REMIX);
  assert.equal(row.likesCount, 0);
  assert.equal(row.savesCount, 0);
  assert.equal(row.remixCount, 0);
});

test("the generic update still cannot change owner or lineage", async () => {
  given();
  for (const payload of [
    { userId: OTHER },
    { id: "some-other-id" },
    { originalRecipeId: FOREIGN },
    { remixedRecipeId: FOREIGN },
    { createdAt: new Date().toISOString() },
  ]) {
    const res = await send("PUT", `/api/remixes/${PARENT_REMIX}`, payload, asUser(AUTHOR));
    assert.equal(res.status, 400, `${Object.keys(payload)[0]} must be refused`);
  }
  const row = stored(recipeRemixes, PARENT_REMIX);
  assert.equal(row.userId, AUTHOR);
  assert.equal(row.originalRecipeId, SOURCE);
  assert.equal(row.remixedRecipeId, OUTPUT);
  assert.equal(row.createdAt, CREATED_AT);
});

test("a mixed legitimate + malicious payload still changes nothing", async () => {
  given();
  const res = await send(
    "PUT",
    `/api/remixes/${PARENT_REMIX}`,
    { remixType: "ingredient_swap", likesCount: 9999, userId: OTHER },
    asUser(AUTHOR)
  );
  assert.equal(res.status, 400);
  const row = stored(recipeRemixes, PARENT_REMIX);
  assert.equal(row.remixType, "variation", "the legitimate field did not land either");
  assert.equal(row.likesCount, 0);
  assert.equal(row.userId, AUTHOR);
});

test("a legitimate generic update still works", async () => {
  given();
  const res = await send(
    "PUT",
    `/api/remixes/${PARENT_REMIX}`,
    { remixType: "ingredient_swap", isPublic: false },
    asUser(AUTHOR)
  );
  assert.equal(res.status, 200);
  const row = stored(recipeRemixes, PARENT_REMIX);
  assert.equal(row.remixType, "ingredient_swap");
  assert.equal(row.isPublic, false);
});

// ================================================================================================
// The migration
// ================================================================================================

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(
  path.join(here, "..", "migrations", "20260917_remix_integrity.sql"),
  "utf8"
);

test("the migration creates the per-user engagement tables", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS remix_likes/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS remix_saves/);
  // Cascade, so engagement rows never outlive the remix they describe.
  assert.match(migration, /remix_id varchar NOT NULL REFERENCES recipe_remixes\(id\) ON DELETE CASCADE/);
});

test("the migration enforces uniqueness in the database", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS remix_likes_user_remix_idx ON remix_likes \(user_id, remix_id\)/
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS remix_saves_user_remix_idx ON remix_saves \(user_id, remix_id\)/
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS recipe_remix_lineage_idx\s*\n\s*ON recipe_remixes \(original_recipe_id, remixed_recipe_id, user_id\)/
  );
});

test("the migration de-duplicates before building the lineage index, deterministically", () => {
  // A unique index cannot be built over existing duplicates, so the DELETE has to come first.
  assert.ok(
    migration.indexOf("DELETE FROM recipe_remixes victim") <
      migration.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS recipe_remix_lineage_idx"),
    "de-duplication must precede the index"
  );
  // Only rows identical in all three lineage columns are candidates, and the survivor is chosen by
  // a total order rather than by physical row order.
  assert.match(migration, /victim\.original_recipe_id = keeper\.original_recipe_id/);
  assert.match(migration, /victim\.remixed_recipe_id = keeper\.remixed_recipe_id/);
  assert.match(migration, /victim\.user_id = keeper\.user_id/);
  assert.match(migration, /keeper\.created_at < victim\.created_at/);
  assert.match(migration, /keeper\.id < victim\.id/);
});

test("the migration rebuilds remix_count from relationships, by output recipe", () => {
  assert.match(
    migration,
    /WHERE child\.original_recipe_id = target\.remixed_recipe_id/,
    "the backfill must use the same mapping the route now uses"
  );
  assert.doesNotMatch(
    migration.replace(/^\s*--.*$/gm, ""),
    /SET remix_count = remix_count \+ 1/,
    "the broken sibling-wide increment must not survive anywhere"
  );
});

test("every statement in the migration is separately executable", () => {
  // The runner strips whole-line comments and splits on the terminator, so a stray terminator inside
  // a statement would cut it in half and a missing one would fuse two statements together.
  const statements = migration
    .replace(/^\s*--.*$/gm, "")
    .split(/;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  assert.equal(statements.length, 10);
  for (const statement of statements) {
    assert.match(statement, /^(CREATE|DELETE|UPDATE)\b/, `not a standalone statement: ${statement}`);
  }
});

// ================================================================================================
// The route source: the defects must not come back under another name
// ================================================================================================

const routeSource = fs.readFileSync(path.join(here, "remixes.ts"), "utf8");

test("the sibling-wide counter update is gone from the route", () => {
  const code = routeSource.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  assert.doesNotMatch(code, /WHERE original_recipe_id/i);
  assert.doesNotMatch(
    code,
    /eq\(recipeRemixes\.originalRecipeId, originalRecipeId\)\s*\)\s*;/,
    "the counter predicate must key on remixedRecipeId"
  );
});

test("every mutating remix endpoint requires authentication", () => {
  const mutations = [...routeSource.matchAll(/router\.(post|put|patch|delete)\(\s*"([^"]+)"\s*,\s*([A-Za-z]+)/g)];
  // POST /, PUT /:id, DELETE /:id, and the four like/save actions.
  assert.equal(mutations.length, 7, "the mutation surface changed -- re-check this list");
  for (const [, method, route, next] of mutations) {
    assert.equal(next, "requireAuth", `${method.toUpperCase()} ${route} is not behind requireAuth`);
  }
});
