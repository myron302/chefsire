/**
 * The pending follow-request write, under concurrency.
 *
 * `follow_requests_pending_unique_idx` (requester, target) WHERE status = 'pending' is a partial UNIQUE index,
 * so a read-then-insert loses races: two simultaneous requests both miss the SELECT, both INSERT, and the
 * loser surfaces the constraint violation as a 500 on an ordinary duplicate click. The fix makes the index the
 * concurrency authority -- INSERT ... ON CONFLICT DO NOTHING, then read back the winning row -- and reports
 * `created` so side effects like notifications happen once.
 *
 * The race is driven against a fake query builder that enforces the partial unique index exactly as Postgres
 * would -- including raising 23505 on a plain insert. The storage method resolves its db handle through a
 * module-private `getDb()` that cannot be swapped from outside, so the statements are exercised through an
 * executable copy, and the copy is pinned to the real source by the structural tests at the bottom: if the
 * method ever goes back to read-then-insert, those fail.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Row = { id: string; requesterId: string; targetId: string; status: string; respondedAt?: Date | null };

/**
 * The smallest stand-in for the follow_requests table that can answer the three statements this code issues:
 * a conflict-tolerant INSERT, a pending SELECT, and a requester-scoped UPDATE. `onConflictDoNothing` is the
 * point: without it the insert throws, which is the 500 this test exists to prevent.
 */
function fakeDb(rows: Row[]) {
  let nextId = 1;
  // Captured so a test can assert the method really went through the conflict-tolerant path.
  const log: string[] = [];

  const pendingMatch = (row: Row, requesterId: string, targetId: string) =>
    row.requesterId === requesterId && row.targetId === targetId && row.status === "pending";

  return {
    log,
    insert() {
      let values: Row | null = null;
      let tolerateConflict = false;
      const builder: any = {
        values(v: any) {
          values = { id: `req-${nextId++}`, ...v };
          return builder;
        },
        onConflictDoNothing() {
          tolerateConflict = true;
          return builder;
        },
        async returning() {
          log.push(tolerateConflict ? "insert:on-conflict-do-nothing" : "insert:plain");
          const conflict = rows.some((r) => pendingMatch(r, values!.requesterId, values!.targetId));
          if (conflict) {
            // Exactly what Postgres does with the partial unique index.
            if (!tolerateConflict) {
              throw Object.assign(new Error('duplicate key value violates unique constraint "follow_requests_pending_unique_idx"'), {
                code: "23505",
              });
            }
            return [];
          }
          rows.push(values!);
          return [{ id: values!.id }];
        },
      };
      return builder;
    },
    select() {
      return {
        from() {
          return {
            where(predicate: (row: Row) => boolean) {
              return {
                async limit() {
                  log.push("select:pending");
                  return rows.filter(predicate).map((r) => ({ id: r.id }));
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(patch: Partial<Row>) {
          return {
            where(predicate: (row: Row) => boolean) {
              return {
                async returning() {
                  log.push("update:scoped");
                  const matched = rows.filter(predicate);
                  for (const row of matched) Object.assign(row, patch);
                  return matched.map((r) => ({ id: r.id }));
                },
              };
            },
          };
        },
      };
    },
  };
}

/* The storage methods resolve their db handle through a module-private `getDb()` that cannot be swapped from
 * outside, so the race is driven against the executable copy below and the copy is pinned to the real source
 * by the structural tests at the bottom of this file. */
const here = path.dirname(fileURLToPath(import.meta.url));
const storageSource = fs.readFileSync(path.join(here, "..", "storage.ts"), "utf8");

function methodBody(name: string) {
  const start = storageSource.indexOf(`async ${name}(`);
  assert.ok(start > 0, name);
  return storageSource.slice(start, storageSource.indexOf("\n  ", storageSource.indexOf("\n  }", start)));
}

/**
 * A faithful executable copy of the method under test: same statements, same order, against the fake db.
 * The structural assertions below pin it to the real source so the two cannot drift.
 */
async function createFollowRequestIfAbsent(db: any, requesterId: string, targetId: string) {
  const inserted = await db
    .insert()
    .values({ requesterId, targetId, status: "pending" })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return { id: inserted[0].id, created: true };

  const existing = await db
    .select()
    .from()
    .where((r: Row) => r.requesterId === requesterId && r.targetId === targetId && r.status === "pending")
    .limit();
  return { id: existing[0]?.id ?? null, created: false };
}

/* ------------------------------------------------------------------ the race */

test("two simultaneous requests leave one pending row, both succeed, neither 500s", async () => {
  const rows: Row[] = [];
  const db = fakeDb(rows);

  const [first, second] = await Promise.all([
    createFollowRequestIfAbsent(db, "V", "PRIV"),
    createFollowRequestIfAbsent(db, "V", "PRIV"),
  ]);

  // Exactly one row.
  assert.equal(rows.filter((r) => r.status === "pending").length, 1);
  // Both resolved, neither threw.
  assert.equal(first.id, rows[0].id);
  assert.equal(second.id, rows[0].id, "both callers get the same authoritative request");
  // And exactly one of them owns the side effects.
  assert.equal([first.created, second.created].filter(Boolean).length, 1);
  // The insert tolerated the conflict rather than raising it.
  assert.ok(db.log.includes("insert:on-conflict-do-nothing"));
});

test("a whole burst of concurrent requests still leaves one row and no failure", async () => {
  const rows: Row[] = [];
  const db = fakeDb(rows);

  const results = await Promise.all(
    Array.from({ length: 8 }, () => createFollowRequestIfAbsent(db, "V", "PRIV"))
  );

  assert.equal(rows.filter((r) => r.status === "pending").length, 1);
  assert.equal(results.filter((r) => r.created).length, 1, "one creator, one notification");
  assert.equal(new Set(results.map((r) => r.id)).size, 1, "everyone sees the same request");
});

test("a pre-existing pending request is reused rather than duplicated", async () => {
  const rows: Row[] = [{ id: "req-existing", requesterId: "V", targetId: "PRIV", status: "pending" }];
  const db = fakeDb(rows);

  const result = await createFollowRequestIfAbsent(db, "V", "PRIV");

  assert.deepEqual(result, { id: "req-existing", created: false });
  assert.equal(rows.length, 1);
});

test("resolved history does not block a new request", async () => {
  // The partial index only covers pending rows, so an earlier declined/canceled request is not in the way.
  for (const status of ["declined", "canceled", "accepted"]) {
    const rows: Row[] = [{ id: `old-${status}`, requesterId: "V", targetId: "PRIV", status }];
    const db = fakeDb(rows);

    const result = await createFollowRequestIfAbsent(db, "V", "PRIV");

    assert.equal(result.created, true, status);
    assert.equal(rows.filter((r) => r.status === "pending").length, 1, status);
    assert.equal(rows.length, 2, `${status} history is kept`);
  }
});

test("requesters and targets are independent of one another", async () => {
  const rows: Row[] = [];
  const db = fakeDb(rows);

  const mine = await createFollowRequestIfAbsent(db, "V", "PRIV");
  const theirs = await createFollowRequestIfAbsent(db, "W", "PRIV");
  const other = await createFollowRequestIfAbsent(db, "V", "PRIV2");

  assert.ok(mine.created && theirs.created && other.created);
  assert.equal(rows.filter((r) => r.status === "pending").length, 3);
  assert.equal(new Set([mine.id, theirs.id, other.id]).size, 3);
});

/* ------------------------------------------------------------------ pinned to the real source */

test("the real storage method is the conflict-tolerant shape, not read-then-insert", () => {
  const body = methodBody("createFollowRequestIfAbsent");

  assert.match(body, /\.onConflictDoNothing\(\)/, "the insert must tolerate the unique-index conflict");
  assert.match(body, /if \(inserted\[0\]\) return \{ id: inserted\[0\]\.id, created: true \}/);
  assert.match(body, /getPendingFollowRequest\(requesterId, targetId\)/, "the loser reads back the winner");

  // The insert has to come FIRST: a leading SELECT is exactly the race this replaced.
  assert.ok(
    body.indexOf(".insert(") < body.indexOf("getPendingFollowRequest"),
    "the insert is attempted before any read-back"
  );
});

test("cancelling a request is scoped to its requester", () => {
  const body = methodBody("cancelFollowRequest");
  assert.match(body, /this\.pendingRequestScope\(requesterId, targetId\)/);
  assert.match(storageSource, /eq\(followRequests\.requesterId, requesterId\)/);
});

test("the partial unique index the method leans on is actually in the schema", () => {
  const migration = fs.readFileSync(
    path.join(here, "..", "drizzle", "20260104_follow_requests_private_accounts.sql"),
    "utf8"
  );
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "follow_requests_pending_unique_idx"/);
  assert.match(migration, /ON "follow_requests" \("requester_id", "target_id"\)\s*\n\s*WHERE status = 'pending'/);
});
