import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_EXECUTION_CREATE_TYPES, type CateringExecutionCreateType } from "@shared/catering-booking-execution";

/**
 * Create idempotency, as two questions the route has to get right together.
 *
 * FIRST: a retry of a request that already succeeded is not a create, so it must not be judged by the rules that
 * govern creating. Two identical attempts can overlap on the last free slot of a collection -- the first fills it
 * and commits, the second then reaches the locked section and finds the collection full. Evaluating the limit
 * before the token refused that second attempt with 409, even though it is the retry of the request that made the
 * very row now occupying the slot, and the only right answer is that row.
 *
 * SECOND: the created row cannot BE the idempotency record, because rows are deletable. Create an item with token
 * T, lose the response, watch it arrive by polling, delete it deliberately, and let the original request retry: a
 * lookup over live rows finds nothing, T reads as unused, and the deleted item is resurrected -- with a second
 * activity row and a second notification behind it. Consumption is recorded in a ledger nothing deletes instead.
 *
 * There is no database harness in this suite, as elsewhere in the catering phases, so the route's ordering and its
 * transaction boundary are modelled here and pinned structurally in the idempotency suite next door. Both the
 * ordering and the record of consumption are modelled in BOTH arrangements -- the current one and the one that had
 * the bug -- so every case is asserted to be handled AND asserted to have been mishandled before.
 */

type Ordering = "token-first" | "limit-first";
/** Where consumption is recorded: the durable ledger, or the created row itself. */
type Record_ = "ledger" | "row";

type Row = { id: string; collection: CateringExecutionCreateType; token: string | null };
type LedgerEntry = { key: string; resourceId: string };
type Store = {
  ordering: Ordering;
  record: Record_;
  limit: number;
  rows: Row[];
  ledger: LedgerEntry[];
  activity: string[];
  notifications: string[];
  minted: number;
};
type Attempt = {
  collection: CateringExecutionCreateType;
  token?: string | null;
  booking?: string;
  creator?: string;
  /** A failure after the insert but before commit, so the whole transaction rolls back. */
  fails?: boolean;
};
type Outcome =
  | { kind: "created"; id: string }
  | { kind: "duplicate"; id: string }
  | { kind: "consumed" }
  | { kind: "limit" }
  | { kind: "rolled_back" };

function open(limit: number, ordering: Ordering = "token-first", record: Record_ = "ledger"): Store {
  return { ordering, record, limit, rows: [], ledger: [], activity: [], notifications: [], minted: 0 };
}
const ledgerKey = (booking: string, creator: string, collection: string, token: string) => [booking, creator, collection, token].join("|");

/**
 * One create attempt, executed as the route executes it.
 *
 * The collection lock is what makes this sequential: a second attempt cannot enter until the first has committed
 * or rolled back, which is exactly what calling this twice models. Everything a create writes -- the row, the
 * ledger entry, the activity, the notification -- is staged and applied together, so a rollback leaves none of it.
 */
function create(store: Store, attempt: Attempt): Outcome {
  const { collection, token = null, booking = "booking-1", creator = "provider-1", fails = false } = attempt;
  const resolveToken = (): Outcome | null => {
    if (!token) return null;
    if (store.record === "row") {
      // The arrangement that had the bug: the token is looked up on the LIVE rows, so deleting one frees it.
      const row = store.rows.find((entry) => entry.collection === collection && entry.token === token);
      return row ? { kind: "duplicate", id: row.id } : null;
    }
    const entry = store.ledger.find((value) => value.key === ledgerKey(booking, creator, collection, token));
    if (!entry) return null;
    // Spent. Either the record is still there, or it was deliberately removed -- and nothing is created either way.
    return store.rows.some((row) => row.id === entry.resourceId) ? { kind: "duplicate", id: entry.resourceId } : { kind: "consumed" };
  };
  const resolveLimit = (): Outcome | null =>
    store.rows.filter((row) => row.collection === collection).length >= store.limit ? { kind: "limit" } : null;

  for (const step of store.ordering === "token-first" ? [resolveToken, resolveLimit] : [resolveLimit, resolveToken]) {
    const refusal = step();
    if (refusal) return refusal;
  }
  // Inside the transaction from here.
  const id = `${collection}-${store.minted + 1}`;
  const staged = {
    row: { id, collection, token } as Row,
    ledger: token ? { key: ledgerKey(booking, creator, collection, token), resourceId: id } : null,
    activity: `${collection}_added:${id}`,
    notification: collection === "timeline" ? `timeline:${id}` : null,
  };
  if (fails) return { kind: "rolled_back" };
  store.minted += 1;
  store.rows.push(staged.row);
  if (staged.ledger) store.ledger.push(staged.ledger);
  store.activity.push(staged.activity);
  if (staged.notification) store.notifications.push(staged.notification);
  return { kind: "created", id };
}
function remove(store: Store, id: string) {
  store.rows = store.rows.filter((row) => row.id !== id);
}
/** Fills a collection to one below its limit, without tokens, so only the attempts under test carry one. */
function fillToOneBelowLimit(store: Store, collection: CateringExecutionCreateType) {
  while (store.rows.filter((row) => row.collection === collection).length < store.limit - 1) create(store, { collection });
}

/* ================================================================================================================ *
 * P2 -- the token wins over the limit
 * ================================================================================================================ */

test("P2: an overlapping same-token retry at the limit resolves to the record, not to 409", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(3);
    fillToOneBelowLimit(store, collection);
    // A creates the final allowed row and commits. B is its retry and only now reaches the locked section.
    const a = create(store, { collection, token: "T" });
    assert.equal(a.kind, "created", collection);
    const activityAfterA = [...store.activity];
    const notificationsAfterA = [...store.notifications];
    const b = create(store, { collection, token: "T" });
    assert.deepEqual(b, { kind: "duplicate", id: (a as { id: string }).id }, `${collection}: B is answered with A's record`);
    // No second row, no second activity, no second notification.
    assert.equal(store.rows.filter((row) => row.collection === collection).length, store.limit, collection);
    assert.deepEqual(store.activity, activityAfterA, collection);
    assert.deepEqual(store.notifications, notificationsAfterA, collection);
  }
});

test("P2: judging the limit first genuinely refused that retry -- this is the bug, not a hypothetical", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(3, "limit-first");
    fillToOneBelowLimit(store, collection);
    assert.equal(create(store, { collection, token: "T" }).kind, "created");
    assert.deepEqual(create(store, { collection, token: "T" }), { kind: "limit" }, `${collection}: the retry was refused`);
  }
});

test("P2: an UNUSED token at a full collection still gets the ordinary limit refusal", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(2);
    create(store, { collection });
    create(store, { collection });
    assert.deepEqual(create(store, { collection, token: "fresh" }), { kind: "limit" }, collection);
    // A different token from the one that was spent is equally a new create, and equally refused.
    const spent = open(2);
    create(spent, { collection, token: "T" });
    create(spent, { collection });
    assert.deepEqual(create(spent, { collection, token: "other" }), { kind: "limit" }, `${collection}: different token`);
  }
});

test("P2: below the limit, a same-token retry behaves exactly as it always did", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5);
    const first = create(store, { collection, token: "T" });
    assert.equal(first.kind, "created");
    for (let retry = 0; retry < 3; retry += 1) {
      assert.deepEqual(create(store, { collection, token: "T" }), { kind: "duplicate", id: (first as { id: string }).id }, collection);
    }
    assert.equal(store.rows.length, 1, collection);
    assert.equal(store.activity.length, 1, collection);
  }
});

/* ================================================================================================================ *
 * P2 -- a consumed token survives the record it created
 * ================================================================================================================ */

test("P2: a retry after the record was deliberately deleted creates nothing", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5);
    const created = create(store, { collection, token: "T" }) as { kind: "created"; id: string };
    assert.equal(created.kind, "created");
    remove(store, created.id);
    const activityAfterDelete = [...store.activity];
    const notificationsAfterDelete = [...store.notifications];
    // The original request finally retries. The token is spent and its record is gone: a deterministic outcome
    // that is neither a create nor a fabricated record.
    assert.deepEqual(create(store, { collection, token: "T" }), { kind: "consumed" }, collection);
    assert.equal(store.rows.filter((row) => row.collection === collection).length, 0, `${collection}: nothing resurrected`);
    assert.deepEqual(store.activity, activityAfterDelete, `${collection}: no second activity`);
    assert.deepEqual(store.notifications, notificationsAfterDelete, `${collection}: no second notification`);
    // And it stays that way however many times it is retried.
    for (let retry = 0; retry < 3; retry += 1) assert.deepEqual(create(store, { collection, token: "T" }), { kind: "consumed" }, collection);
    assert.equal(store.rows.length, 0, collection);
  }
});

test("P2: recording consumption on the ROW genuinely resurrected it -- this is the bug", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5, "token-first", "row");
    const created = create(store, { collection, token: "T" }) as { kind: "created"; id: string };
    remove(store, created.id);
    const retry = create(store, { collection, token: "T" });
    assert.equal(retry.kind, "created", `${collection}: the deleted record came back`);
    assert.notEqual((retry as { id: string }).id, created.id);
    assert.equal(store.activity.length, 2, `${collection}: and wrote a second activity row`);
    if (collection === "timeline") assert.equal(store.notifications.length, 2, "and fired a second notification");
  }
});

test("P2: a retry that arrives BEFORE the deletion still converges on the record", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5);
    const created = create(store, { collection, token: "T" }) as { kind: "created"; id: string };
    assert.deepEqual(create(store, { collection, token: "T" }), { kind: "duplicate", id: created.id }, collection);
    // And once it IS deleted, the same token stops resolving to a record rather than pointing at a missing one.
    remove(store, created.id);
    assert.deepEqual(create(store, { collection, token: "T" }), { kind: "consumed" }, collection);
  }
});

test("P2: an UNUSED token may create normally after a deletion, when the rules allow it", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(2);
    const first = create(store, { collection, token: "T" }) as { kind: "created"; id: string };
    create(store, { collection });
    remove(store, first.id);
    // A materially new attempt carries a fresh token, and the collection now has room, so it creates.
    const next = create(store, { collection, token: "U" });
    assert.equal(next.kind, "created", collection);
    assert.notEqual((next as { id: string }).id, first.id);
    // Deleting a record does NOT make the spent token reusable, though.
    assert.deepEqual(create(store, { collection, token: "T" }), { kind: "consumed" }, collection);
  }
});

/* ================================================================================================================ *
 * P2 -- atomicity, concurrency and scope
 * ================================================================================================================ */

test("P2: a rolled-back create leaves the token unconsumed and no record behind", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5);
    assert.deepEqual(create(store, { collection, token: "T", fails: true }), { kind: "rolled_back" }, collection);
    assert.deepEqual(store.rows, [], `${collection}: no row`);
    assert.deepEqual(store.ledger, [], `${collection}: and no consumed token`);
    assert.deepEqual(store.activity, [], `${collection}: and no activity`);
    // So the same token can still do what it was for.
    assert.equal(create(store, { collection, token: "T" }).kind, "created", collection);
    assert.equal(store.ledger.length, 1, collection);
  }
});

test("P2: a committed create can never leave its token unconsumed", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5);
    create(store, { collection, token: "T" });
    // Row and ledger entry are written together, so the two counts cannot disagree.
    assert.equal(store.rows.length, 1, collection);
    assert.equal(store.ledger.length, 1, collection);
    assert.equal(store.ledger[0].resourceId, store.rows[0].id, collection);
  }
});

test("P2: concurrent same-token attempts cannot produce two records", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5);
    // The collection lock serializes them, so the second reaches its decision only after the first has committed.
    const outcomes = [create(store, { collection, token: "T" }), create(store, { collection, token: "T" }), create(store, { collection, token: "T" })];
    assert.equal(outcomes.filter((outcome) => outcome.kind === "created").length, 1, collection);
    assert.equal(outcomes.filter((outcome) => outcome.kind === "duplicate").length, 2, collection);
    assert.equal(store.rows.length, 1, collection);
    assert.equal(store.ledger.length, 1, collection);
  }
});

test("P2: the ledger is scoped to booking, creator and resource type", () => {
  // One token, three collections: three independent creates, because the ledger namespaces the type.
  const store = open(5);
  const ids = CATERING_EXECUTION_CREATE_TYPES.map((collection) => create(store, { collection, token: "T" }));
  assert.equal(ids.every((outcome) => outcome.kind === "created"), true);
  assert.equal(new Set(ids.map((outcome) => (outcome as { id: string }).id)).size, CATERING_EXECUTION_CREATE_TYPES.length);
  // Another actor's identical token is their own, and resolves to nothing of this one's.
  const other = create(store, { collection: "timeline", token: "T", creator: "provider-2" });
  assert.equal(other.kind, "created", "a token is never a way to be handed somebody else's record");
  // And the same token replayed against another booking is likewise a new create.
  assert.equal(create(store, { collection: "timeline", token: "T", booking: "booking-2" }).kind, "created");
  // While the original scope still resolves to the original record.
  assert.deepEqual(create(store, { collection: "timeline", token: "T" }), { kind: "duplicate", id: (ids[0] as { id: string }).id });
});

test("P2: a create with no token at all is unaffected by any of this", () => {
  for (const collection of CATERING_EXECUTION_CREATE_TYPES) {
    const store = open(5);
    const first = create(store, { collection });
    const second = create(store, { collection });
    assert.equal(first.kind, "created", collection);
    assert.equal(second.kind, "created", collection);
    assert.equal(store.ledger.length, 0, `${collection}: nothing to record`);
    assert.equal(store.rows.length, 2, collection);
  }
});
