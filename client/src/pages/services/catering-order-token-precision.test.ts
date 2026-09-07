import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringPreservedHistory, cateringRecordIsOlder, emptyCateringLoadedHistory, recordCateringRemovedRecords, cateringRemovedIds, EMPTY_CATERING_REMOVED_RECORDS, type CateringLoadedHistory, type CateringRemovedRecords } from "./catering-booking-loaded-history";
import { EMPTY_CATERING_FILE_LEDGER, cateringMutationOrigin, expectCateringFileAddition, observeCateringFileSnapshot } from "./catering-booking-mutation-origin";

/**
 * Ordering must come from the database, not from what survived the trip to the browser.
 *
 * `created_at` is `timestamptz`: Postgres keeps it to MICROSECONDS and orders by it. node-postgres parses it into a
 * JavaScript `Date`, which holds MILLISECONDS, and `toISOString()` writes down what is left. Two records a
 * thousandth of a millisecond apart therefore arrive bearing the same instant, the reconciliation comparison fell
 * through to their ids, and ids say nothing about the microseconds that were dropped. An older already-loaded
 * record could be judged newer than the refreshed boundary and thrown out of the preserved tail.
 *
 * Every fixture below is built so the id order CONTRADICTS the true microsecond order -- the newest record has the
 * lexically smallest id -- so anything still comparing ids gets the answer exactly backwards.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const messagesRoute = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-communication.ts"), "utf8");
const filesRoute = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");
const workspaceRoute = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-workspace.ts"), "utf8");
const tokenService = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "services", "catering-booking-order-token.ts"), "utf8");
const history = fs.readFileSync(path.join(here, "catering-booking-loaded-history.ts"), "utf8");

type Row = { id: string; createdAt: string; orderToken: string };
/**
 * One row as the API now serves it: a millisecond `createdAt` for display, and the authoritative ordering the
 * server computed in SQL. `micros` is the full six-digit fraction Postgres actually holds.
 */
const at = (micros: string, id: string): Row => ({
  id,
  createdAt: `2026-09-01T10:00:00.${micros.slice(0, 3)}Z`,
  orderToken: `2026-09-01T10:00:00.${micros}|${id}`,
});
/**
 * The conversation from the finding, newest first. Five of the six share a displayed millisecond, and the ids run
 * the opposite way to the microseconds on purpose.
 */
const CONVERSATION: Row[] = [
  at("124100", "a-newest"),
  at("123900", "b"),
  at("123700", "c"),
  at("123500", "d"),
  at("123300", "e"),
  at("123100", "f-oldest"),
];
const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

/** One keyset list request, with the routes' own `limit + 1` lookahead. */
function serve(all: readonly Row[], cursor: string | null, limit: number) {
  const start = cursor === null ? 0 : all.findIndex((row) => row.id === cursor) + 1;
  const read = all.slice(start, start + limit + 1);
  const items = read.slice(0, limit);
  return { items, nextCursor: read.length > limit && items.length > 0 ? items[items.length - 1].id : null };
}
function view(limit: number, identity = "user-1:booking-a") {
  let pages: { items: readonly Row[]; nextCursor: string | null }[] = [];
  let held: CateringLoadedHistory<Row> = emptyCateringLoadedHistory();
  let removed: CateringRemovedRecords = EMPTY_CATERING_REMOVED_RECORDS;
  const settle = () => {
    const gone = cateringRemovedIds(removed, identity);
    if (pages.length === 0) { held = cateringPreservedHistory(held, identity, null, false, gone); return; }
    const seen = new Set<string>();
    const combined: Row[] = [];
    for (const page of pages) for (const row of page.items) { if (seen.has(row.id)) continue; seen.add(row.id); combined.push(row); }
    held = cateringPreservedHistory(held, identity, combined, pages[pages.length - 1].nextCursor === null, gone);
  };
  return {
    get items() { return held.items; },
    get nextCursor() { return pages.length === 0 ? null : pages[pages.length - 1].nextCursor; },
    load(all: readonly Row[]) { pages = [serve(all, null, limit)]; settle(); },
    poll(all: readonly Row[]) {
      const count = pages.length;
      const refreshed: typeof pages = [];
      let cursor: string | null = null;
      for (let page = 0; page < count; page += 1) {
        const served = serve(all, cursor, limit);
        refreshed.push(served);
        if (served.nextCursor === null) break;
        cursor = served.nextCursor;
      }
      pages = refreshed;
      settle();
    },
    loadMore(all: readonly Row[]) {
      const last = pages[pages.length - 1];
      if (!last || last.nextCursor === null) return;
      pages = [...pages, serve(all, last.nextCursor, limit)];
      settle();
    },
    forget(rowId: string) { removed = recordCateringRemovedRecords(removed, identity, [rowId]); settle(); },
  };
}

test("1. an older loaded message survives a head refresh even though its displayed instant ties", () => {
  const v = view(3);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  assert.deepEqual(ids(v.items), ids(CONVERSATION));
  // A new message arrives and shifts every page boundary down by one.
  const grown = [at("125000", "z-new"), ...CONVERSATION];
  v.poll(grown);
  assert.deepEqual(ids(v.items), ids(grown), "the displaced tail is preserved");
  assert.equal(ids(v.items).includes("f-oldest"), true);
});

test("2. id order cannot influence the answer, because it is the reverse of the truth here", () => {
  const [newest, , , , , oldest] = CONVERSATION;
  // The true order: `f-oldest` is older than `d`. Their displayed instants are identical.
  assert.equal(oldest.createdAt, CONVERSATION[3].createdAt, "the display value really does tie");
  assert.equal(cateringRecordIsOlder(oldest, CONVERSATION[3]), true);
  // And the id comparison the old code fell back to says the opposite.
  assert.equal(oldest.id < CONVERSATION[3].id, false, "ids point the wrong way, deliberately");
  assert.equal(cateringRecordIsOlder(newest, oldest), false);
  // Nothing in the comparison reads a display timestamp any more.
  const fn = history.slice(history.indexOf("export function cateringRecordIsOlder"), history.indexOf("\n}", history.indexOf("export function cateringRecordIsOlder")));
  assert.equal(fn.includes("createdAt"), false, "the display value must not be compared");
  assert.equal(fn.includes(".id <"), false, "and neither may the id, on its own");
  assert.equal(fn.includes("orderToken"), true);
});

test("3. many same-millisecond messages spanning the refreshed boundary keep the server's exact order", () => {
  const v = view(2);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  v.loadMore(CONVERSATION);
  v.poll([at("125000", "z-new"), ...CONVERSATION]);
  const seen = ids(v.items);
  assert.deepEqual(seen, ["z-new", ...ids(CONVERSATION)], "exact server order, none dropped, none duplicated");
  assert.equal(new Set(seen).size, seen.length);
  for (let index = 1; index < v.items.length; index += 1) {
    assert.equal(cateringRecordIsOlder(v.items[index], v.items[index - 1]), true);
  }
});

test("4. the same holds for files", () => {
  const v = view(3);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  v.poll([at("125000", "z-new"), at("124500", "y-new"), ...CONVERSATION]);
  assert.equal(ids(v.items).includes("f-oldest"), true);
  assert.equal(ids(v.items).includes("e"), true);
  assert.deepEqual(ids(v.items).slice(0, 2), ["z-new", "y-new"]);
});

test("5. and for activity", () => {
  const v = view(2);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  v.loadMore(CONVERSATION);
  v.poll([at("124900", "z-new"), ...CONVERSATION]);
  assert.deepEqual(ids(v.items), ["z-new", ...ids(CONVERSATION)]);
});

test("6. several new head records still preserve the whole loaded tail", () => {
  const v = view(3);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  const grown = [at("126000", "w-new"), at("125500", "x-new"), at("125000", "z-new"), ...CONVERSATION];
  v.poll(grown);
  assert.deepEqual(ids(v.items), ids(grown));
});

test("7. the next cursor still asks for records older than the true oldest loaded one", () => {
  const deeper = [...CONVERSATION, at("122900", "g"), at("122700", "h")];
  const v = view(3);
  v.load(deeper);
  v.loadMore(deeper);
  const grown = [at("125000", "z-new"), ...deeper];
  v.poll(grown);
  // The window covers z-new..d; e and f-oldest are preserved below it, and g and h are still unfetched.
  assert.equal(ids(v.items).includes("f-oldest"), true);
  const cursor = v.nextCursor!;
  const older = serve(grown, cursor, 3).items;
  const oldestLoaded = v.items[v.items.length - 1];
  // Everything the next request returns is genuinely older than something already held, and nothing is skipped.
  assert.equal(older.every((row) => cateringRecordIsOlder(row, v.items[0])), true);
  assert.equal(ids(older).includes("g"), true, "no active record between the boundary and g is skipped");
  v.loadMore(grown);
  assert.deepEqual(ids(v.items), ids(grown), "and the merge is still complete and duplicate-free");
  assert.equal(cateringRecordIsOlder(v.items[v.items.length - 1], oldestLoaded), true);
});

test("8. repeated polls do not progressively shrink the loaded history", () => {
  const v = view(3);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  let grown = [...CONVERSATION];
  for (let round = 0; round < 6; round += 1) {
    grown = [at(`12${6 + round}000`, `new-${round}`), ...grown];
    v.poll(grown);
    assert.equal(ids(v.items).includes("f-oldest"), true, `round ${round}`);
    assert.equal(v.items.length, grown.length, `round ${round}: nothing lost, nothing duplicated`);
  }
});

test("9. polls interleaved with load more create no gap, duplicate or loop", () => {
  const deeper = [...CONVERSATION, at("122900", "g"), at("122700", "h"), at("122500", "i")];
  const v = view(2);
  v.load(deeper);
  v.loadMore(deeper);
  const grown = [at("125000", "z-new"), ...deeper];
  v.poll(grown);
  v.loadMore(grown);
  v.poll(grown);
  v.loadMore(grown);
  v.loadMore(grown);
  assert.deepEqual(ids(v.items), ids(grown));
  assert.equal(new Set(ids(v.items)).size, v.items.length);
});

test("10. a remote file removal still removes the right file under tied displayed instants", () => {
  const v = view(3);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  // `d` is removed. It sits inside the refreshed window, so its absence is authoritative.
  const without = CONVERSATION.filter((row) => row.id !== "d");
  v.poll(without);
  assert.equal(ids(v.items).includes("d"), false);
  assert.equal(ids(v.items).includes("f-oldest"), true, "and the tail below the window is untouched");
});

test("11. a file this client deleted is not resurrected by the preserved tail", () => {
  const v = view(3);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  v.poll([at("125000", "z-new"), ...CONVERSATION]);
  assert.equal(ids(v.items).includes("f-oldest"), true);
  v.forget("f-oldest");
  assert.equal(ids(v.items).includes("f-oldest"), false);
  v.poll([at("125000", "z-new"), ...CONVERSATION]);
  assert.equal(ids(v.items).includes("f-oldest"), false, "a stale page cannot bring it back");
});

test("12. activity local-vs-remote attribution is unaffected by the ordering change", () => {
  // The delta reads the newest PAGE's ids and never a timestamp, so tied instants change nothing about it.
  const A = cateringMutationOrigin("user-1", "booking-a");
  let ledger = observeCateringFileSnapshot(EMPTY_CATERING_FILE_LEDGER, A.identity, ["d", "e", "f-oldest"]).next;
  ledger = expectCateringFileAddition(ledger, A, "c");
  assert.equal(observeCateringFileSnapshot(ledger, A.identity, ["c", "d", "e"]).refreshActivity, false, "this actor's own");
  let remote = observeCateringFileSnapshot(EMPTY_CATERING_FILE_LEDGER, A.identity, ["d", "e", "f-oldest"]).next;
  assert.equal(observeCateringFileSnapshot(remote, A.identity, ["b", "d", "e"]).refreshActivity, true, "a counterpart's");
});

test("13. stable ids still deduplicate a record served twice", () => {
  const v = view(4);
  v.load(CONVERSATION);
  v.loadMore(CONVERSATION);
  v.poll(CONVERSATION);
  assert.equal(new Set(ids(v.items)).size, v.items.length);
  assert.deepEqual(ids(v.items), ids(CONVERSATION));
});

test("14. a genuine full-precision tie falls to the id, exactly as the database does", () => {
  const same = "2026-09-01T10:00:00.123456";
  const lower = { id: "aaa", createdAt: "2026-09-01T10:00:00.123Z", orderToken: `${same}|aaa` };
  const higher = { id: "bbb", createdAt: "2026-09-01T10:00:00.123Z", orderToken: `${same}|bbb` };
  assert.equal(cateringRecordIsOlder(lower, higher), true, "ORDER BY created_at DESC, id DESC");
  assert.equal(cateringRecordIsOlder(higher, lower), false);
  assert.equal(cateringRecordIsOlder(lower, lower), false, "a record is not older than itself");
  // A record with no token at all cannot be placed, so it is preserved rather than judged.
  assert.equal(cateringRecordIsOlder({ orderToken: undefined }, higher), true);
  assert.equal(cateringRecordIsOlder(higher, { orderToken: undefined }), true);
});

test("15. the token is produced in SQL by all three list queries, from one definition", () => {
  // Built before the driver rounds anything: full `timestamptz` precision as fixed-width UTC text, then the id --
  // the same pair every one of these queries orders by.
  assert.equal(tokenService.includes(`to_char(${"${createdAt}"} AT TIME ZONE 'UTC', ${"${CATERING_ORDER_TOKEN_FORMAT}"}) || ${"${CATERING_ORDER_TOKEN_SEPARATOR}"} || ${"${id}"}`), true);
  assert.equal(tokenService.includes(`export const CATERING_ORDER_TOKEN_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.US';`), true);
  const tokenCode = tokenService.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.equal(tokenCode.includes("Date"), false, "nothing here goes through a JavaScript Date");
  assert.equal(tokenCode.includes("toISOString"), false);
  assert.equal(messagesRoute.includes("orderToken: cateringOrderToken(dmMessages.createdAt, dmMessages.id)"), true);
  assert.equal(filesRoute.includes("orderToken: cateringOrderToken(cateringBookingFiles.createdAt, cateringBookingFiles.id)"), true);
  assert.equal(workspaceRoute.includes("orderToken: cateringOrderToken(cateringBookingActivity.createdAt, cateringBookingActivity.id)"), true);
  // And each query's ORDER BY really is the pair the token encodes.
  assert.equal(messagesRoute.includes("desc(dmMessages.createdAt), desc(dmMessages.id)"), true);
  assert.equal(filesRoute.includes("desc(cateringBookingFiles.createdAt), desc(cateringBookingFiles.id)"), true);
  assert.equal(workspaceRoute.includes("desc(cateringBookingActivity.createdAt), desc(cateringBookingActivity.id)"), true);
  // The token carries nothing but those two values.
  for (const leak of ["storage_key", "storageKey", "body", "visibility", "actor"]) {
    assert.equal(tokenService.includes(leak), false, leak);
  }
});
