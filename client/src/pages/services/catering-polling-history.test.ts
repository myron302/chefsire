import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringFileSnapshot } from "@shared/catering-booking-files";
import { effectiveCateringEditable, observedCateringEditable } from "@shared/catering-booking-operations";
import { cateringPreservedHistory, cateringRecordIsOlder, emptyCateringLoadedHistory, forgetCateringHistoryRecord, type CateringLoadedHistory } from "./catering-booking-loaded-history";
import { EMPTY_CATERING_FILE_LEDGER, cateringFileDelta, cateringMutationOrigin, expectCateringFileAddition, expectCateringFileRemoval, observeCateringFileSnapshot } from "./catering-booking-mutation-origin";

/**
 * Background freshness must not cost a participant the history they deliberately loaded.
 *
 * An infinite query refetches every page it holds and derives each page's cursor from the page before it IN THAT
 * SAME REFETCH. The page size is fixed, so one new record at the head shifts every boundary down by one and the
 * last refetched page comes back one record short at its tail. Two full pages of five, one new message, and
 * `[m10..m6] [m5..m1]` becomes `[m11..m7] [m6..m2]`: m1 has left the rendering. Nothing deleted it. The
 * participant simply watches it disappear on a fifteen-second timer and presses "Load older" again, forever.
 *
 * These tests drive the real merge helper through a faithful model of that refetch -- the same keyset the routes
 * use, the same `limit + 1` lookahead, cursors derived exactly as the query derives them -- so the failure they
 * pin is the reported one rather than a property of the fix.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const comms = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingCommunication.tsx"), "utf8");
const filesComponent = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");

type Record = { id: string; createdAt: string };
type Page = { items: readonly Record[]; nextCursor: string | null };
/** `r03` sorts after `r02`, and its instant does too, so newest-first is unambiguous. */
const record = (ordinal: number, prefix = "r"): Record => ({ id: `${prefix}${String(ordinal).padStart(2, "0")}`, createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, ordinal)).toISOString() });
/** A collection newest first, exactly as every list route serves it. */
const collection = (highest: number, lowest = 1, prefix = "r") => Array.from({ length: highest - lowest + 1 }, (_, index) => record(highest - index, prefix));
const ids = (items: readonly Record[]) => items.map((item) => item.id);

/** One list request: the keyset boundary, and the `limit + 1` lookahead the routes read. */
function serve(all: readonly Record[], cursor: string | null, limit: number): Page {
  const start = cursor === null ? 0 : all.findIndex((item) => item.id === cursor) + 1;
  const read = all.slice(start, start + limit + 1);
  const items = read.slice(0, limit);
  return { items, nextCursor: read.length > limit && items.length > 0 ? items[items.length - 1].id : null };
}

/** The client, holding pages exactly as the infinite query does and merging exactly as the components do. */
function view(limit: number, identity = "user-1:booking-a") {
  let pages: Page[] = [];
  let history: CateringLoadedHistory<Record> = emptyCateringLoadedHistory();
  const settle = () => {
    if (pages.length === 0) { history = cateringPreservedHistory(history, identity, null, false); return; }
    const seen = new Set<string>();
    const combined: Record[] = [];
    for (const page of pages) for (const item of page.items) { if (seen.has(item.id)) continue; seen.add(item.id); combined.push(item); }
    history = cateringPreservedHistory(history, identity, combined, pages[pages.length - 1].nextCursor === null);
  };
  return {
    get items() { return history.items; },
    get pages() { return pages; },
    get hasOlder() { return pages.length > 0 && pages[pages.length - 1].nextCursor !== null; },
    load(all: readonly Record[]) { pages = [serve(all, null, limit)]; settle(); },
    /** A poll: every loaded page refetched, each cursor re-derived from the page before it in this same pass. */
    poll(all: readonly Record[]) {
      const held = pages.length;
      const refreshed: Page[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < held; page += 1) {
        const served = serve(all, cursor, limit);
        refreshed.push(served);
        if (served.nextCursor === null) break;
        cursor = served.nextCursor;
      }
      pages = refreshed;
      settle();
    },
    /** "Load older": one more page from the last cursor, without refetching the pages already held. */
    loadMore(all: readonly Record[]) {
      const last = pages[pages.length - 1];
      if (!last || last.nextCursor === null) return;
      pages = [...pages, serve(all, last.nextCursor, limit)];
      settle();
    },
    forget(recordId: string) { history = forgetCateringHistoryRecord(history, identity, recordId); },
    moveTo(other: string) { identity = other; pages = []; settle(); },
  };
}
/** The rendering has every id once, newest first, with no gap against the authoritative collection. */
function assertContinuous(items: readonly Record[], label: string) {
  assert.equal(new Set(ids(items)).size, items.length, `${label}: no record may be rendered twice`);
  for (let index = 1; index < items.length; index += 1) {
    assert.equal(cateringRecordIsOlder(items[index], items[index - 1]), true, `${label}: newest-first order`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------------------------------------------
test("1. one loaded page plus a new message keeps everything already on screen", () => {
  const all = collection(6);
  const v = view(5);
  v.load(all);
  assert.deepEqual(ids(v.items), ["r06", "r05", "r04", "r03", "r02"]);
  v.poll([record(7), ...all]);
  assert.deepEqual(ids(v.items), ["r07", "r06", "r05", "r04", "r03", "r02"], "the displaced record is preserved");
  assertContinuous(v.items, "one page");
});

test("2. two full loaded pages plus one new message keeps the oldest loaded message visible", () => {
  // The reported case, exactly: [m10..m6] [m5..m1], m11 arrives, and m1 must not vanish.
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  assert.deepEqual(ids(v.items), ids(all));
  const grown = [record(11), ...all];
  v.poll(grown);
  // What the refetch itself returns, before any merge: every boundary has shifted down by one and the last page
  // ends at r02. This is the bug, and it is asserted here so the test above cannot pass vacuously.
  assert.deepEqual(v.pages.map((page) => ids([...page.items])), [["r11", "r10", "r09", "r08", "r07"], ["r06", "r05", "r04", "r03", "r02"]]);
  assert.equal(v.pages.flatMap((page) => ids([...page.items])).includes("r01"), false, "the refetch really does drop it");
  assert.deepEqual(ids(v.items), ["r11", "r10", "r09", "r08", "r07", "r06", "r05", "r04", "r03", "r02", "r01"]);
  assertContinuous(v.items, "two pages");
});

test("3. several new messages appear exactly once and the whole old tail remains", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll([record(13), record(12), record(11), ...all]);
  assert.deepEqual(ids(v.items), ["r13", "r12", "r11", "r10", "r09", "r08", "r07", "r06", "r05", "r04", "r03", "r02", "r01"]);
  assertContinuous(v.items, "three new");
});

test("4. loading older after a preserved merge continues correctly, with no duplicate and no gap", () => {
  const all = collection(10);
  const grown = [record(11), ...all];
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll(grown);
  // The cursor is the last refreshed page's own, so the next request overlaps the preserved tail rather than
  // skipping it. Deduplication by id is what makes that overlap invisible, and the window then covers the tail.
  assert.equal(v.hasOlder, true);
  v.loadMore(grown);
  assert.deepEqual(ids(v.items), ids(grown), "every record, once, in order");
  assertContinuous(v.items, "after load older");
  assert.equal(v.hasOlder, false, "the beginning of the conversation ends pagination");
});

test("5. an unchanged poll leaves the rendering stable", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const before = ids(v.items);
  for (let poll = 0; poll < 5; poll += 1) v.poll(all);
  assert.deepEqual(ids(v.items), before);
});

test("6. a poll and a manual load older interleave deterministically", () => {
  const all = collection(12);
  const grown = [record(13), ...all];
  const pollFirst = view(5);
  pollFirst.load(all);
  pollFirst.loadMore(all);
  pollFirst.poll(grown);
  pollFirst.loadMore(grown);
  const loadFirst = view(5);
  loadFirst.load(all);
  loadFirst.loadMore(all);
  loadFirst.loadMore(all);
  loadFirst.poll(grown);
  // Both orders end holding every record they have reached, once, newest first.
  assertContinuous(pollFirst.items, "poll then load");
  assertContinuous(loadFirst.items, "load then poll");
  assert.deepEqual(ids(pollFirst.items), ids(grown).slice(0, pollFirst.items.length));
  assert.deepEqual(ids(loadFirst.items), ids(grown).slice(0, loadFirst.items.length));
  assert.equal(loadFirst.items.length >= 13, true, "nothing loaded is lost by the poll that follows it");
});

test("7. switching booking discards the other booking's history entirely", () => {
  const bookingA = collection(10, 1, "a");
  const bookingB = collection(3, 1, "b");
  const v = view(5);
  v.load(bookingA);
  v.loadMore(bookingA);
  v.moveTo("user-1:booking-b");
  assert.deepEqual(ids(v.items), []);
  v.load(bookingB);
  assert.deepEqual(ids(v.items), ["b03", "b02", "b01"], "no record of the previous booking may appear");
});

test("8. a booking going terminal keeps its loaded history and stays read-only", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll([record(11), ...all]);
  assert.equal(v.items.length, 11, "history survives the transition");
  // The authoritative answer is still read from the endpoint's own pages, and false from either source wins.
  const terminal = [{ editable: false }, { editable: false }];
  assert.equal(observedCateringEditable(terminal), false);
  assert.equal(effectiveCateringEditable(true, observedCateringEditable(terminal)), false);
  assert.equal(comms.includes("cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages)))"), true);
  assert.equal(filesComponent.includes("cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages)))"), true);
});

test("9. records sharing an instant are ordered and judged by the id tie-break", () => {
  const instant = "2026-09-01T12:00:00.000Z";
  const tied = ["r05", "r04", "r03", "r02", "r01"].map((id) => ({ id, createdAt: instant }));
  assert.equal(cateringRecordIsOlder({ id: "r01", createdAt: instant }, { id: "r02", createdAt: instant }), true);
  assert.equal(cateringRecordIsOlder({ id: "r03", createdAt: instant }, { id: "r02", createdAt: instant }), false);
  const v = view(3);
  v.load(tied);
  v.loadMore(tied);
  assert.deepEqual(ids(v.items), ids(tied));
  // A tied record the refreshed window still covers, and no longer returns, is a deletion and is not preserved.
  const withoutR02 = tied.filter((item) => item.id !== "r02");
  v.poll(withoutR02);
  assert.equal(ids(v.items).includes("r02"), false);
  assertContinuous(v.items, "tied instants");
});

// ---------------------------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------------------------
test("10. one loaded file page plus a remote upload keeps everything already on screen", () => {
  const all = collection(6, 1, "f");
  const v = view(5);
  v.load(all);
  v.poll([record(7, "f"), ...all]);
  assert.deepEqual(ids(v.items), ["f07", "f06", "f05", "f04", "f03", "f02"]);
});

test("11. two full loaded file pages plus a remote upload keeps the oldest loaded file visible", () => {
  const all = collection(10, 1, "f");
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll([record(11, "f"), ...all]);
  assert.deepEqual(ids(v.items), ids([record(11, "f"), ...all]));
  assertContinuous(v.items, "two file pages");
});

test("12. several remote uploads appear once each and the old tail remains", () => {
  const all = collection(10, 1, "f");
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll([record(13, "f"), record(12, "f"), record(11, "f"), ...all]);
  assert.equal(v.items.length, 13);
  assertContinuous(v.items, "three uploads");
});

test("13. loading older files after a preserved merge continues correctly", () => {
  const all = collection(10, 1, "f");
  const grown = [record(11, "f"), ...all];
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll(grown);
  v.loadMore(grown);
  assert.deepEqual(ids(v.items), ids(grown));
  assert.equal(v.hasOlder, false);
});

test("14. a remotely removed shared file inside the refreshed window disappears", () => {
  const all = collection(10, 1, "f");
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  // The counterpart removes f08, which the refreshed window still covers: authoritative, so it goes.
  const without = all.filter((item) => item.id !== "f08");
  v.poll(without);
  assert.equal(ids(v.items).includes("f08"), false);
  assertContinuous(v.items, "remote removal");
});

test("15. a removal this client performed is not resurrected from preserved history", () => {
  const all = collection(10, 1, "f");
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  // f01 sits below the refreshed window once a new file arrives, so the list endpoint alone could not prove it
  // gone. The accepted DELETE is authoritative about it, so its record is dropped outright.
  v.forget("f01");
  v.poll([record(11, "f"), ...all.filter((item) => item.id !== "f01")]);
  assert.equal(ids(v.items).includes("f01"), false, "a file this client deleted must not come back");
  assertContinuous(v.items, "local removal");
  // And the component does exactly that, on the originating booking's identity.
  assert.equal(filesComponent.includes("historyRef.current = forgetCateringHistoryRecord(historyRef.current, attempt.origin.identity, attempt.fileId);"), true);
});

test("16. preserved history does not reach the Activity delta, so local attribution is unchanged", () => {
  // The delta reads the newest PAGE, never the merged rendering, so a preserved tail can neither explain nor
  // fabricate activity. That is what keeps the exact expected-local-delta model from the previous correction intact.
  assert.equal(filesComponent.includes("const fileSnapshot = cateringFileSnapshot(query.data?.pages);"), true);
  assert.equal(filesComponent.includes("observeCateringFileSnapshot(ledgerRef.current, identity, fileSnapshot)"), true);
  const pages = [{ files: [{ id: "f11" }, { id: "f10" }] }, { files: [{ id: "f09" }] }];
  assert.deepEqual(cateringFileSnapshot(pages), ["f11", "f10"], "only the newest page");
  // An expected local upload is still attributed to this actor and absorbed.
  const A = cateringMutationOrigin("user-1", "booking-a");
  let ledger = observeCateringFileSnapshot(EMPTY_CATERING_FILE_LEDGER, A.identity, ["f10", "f09"]).next;
  ledger = expectCateringFileAddition(ledger, A, "f11");
  const own = observeCateringFileSnapshot(ledger, A.identity, ["f11", "f10", "f09"]);
  assert.equal(own.refreshActivity, false);
});

test("17. a coalesced local and counterpart mutation still refreshes Activity", () => {
  const A = cateringMutationOrigin("user-1", "booking-a");
  let ledger = observeCateringFileSnapshot(EMPTY_CATERING_FILE_LEDGER, A.identity, ["f10", "f09"]).next;
  ledger = expectCateringFileAddition(ledger, A, "f11");
  const coalesced = observeCateringFileSnapshot(ledger, A.identity, ["f12", "f11", "f10", "f09"]);
  assert.equal(coalesced.refreshActivity, true, "f12 is the counterpart's and must not be swallowed");
  // And a counterpart removal at the page edge is still announced.
  let edge = observeCateringFileSnapshot(EMPTY_CATERING_FILE_LEDGER, A.identity, ["f05", "f04", "f03", "f02", "f01"]).next;
  assert.equal(observeCateringFileSnapshot(edge, A.identity, ["f05", "f04", "f03", "f02", "f00"]).refreshActivity, true);
  // The same transition explained by this client's own delete is not.
  edge = expectCateringFileRemoval(edge, A, "f01");
  assert.equal(observeCateringFileSnapshot(edge, A.identity, ["f05", "f04", "f03", "f02", "f00"]).refreshActivity, false);
});

test("18. page-window displacement alone fabricates neither an upload nor a delete", () => {
  assert.deepEqual(cateringFileDelta(["f05", "f04", "f03", "f02", "f01"], ["f06", "f05", "f04", "f03", "f02"]), { added: ["f06"], removed: [] });
  assert.deepEqual(cateringFileDelta(["f05", "f04", "f03", "f02", "f01"], ["f05", "f04", "f02", "f01", "f00"]), { added: [], removed: ["f03"] });
  // And loading an older page changes the newest page not at all.
  const A = cateringMutationOrigin("user-1", "booking-a");
  const ledger = observeCateringFileSnapshot(EMPTY_CATERING_FILE_LEDGER, A.identity, ["f05", "f04"]).next;
  assert.equal(observeCateringFileSnapshot(ledger, A.identity, ["f05", "f04"]).refreshActivity, false);
});

test("19. a customer's preserved history can only hold what the server already served them", () => {
  // Preservation never invents a record: every item it keeps came from a page this actor's own request returned,
  // and the server filters by role before serializing. A provider-private file is absent from both.
  assert.equal(route.includes("visibilityFilter(role)"), true);
  assert.equal(route.includes(`eq(cateringBookingFiles.visibility, "shared")`), true);
  const helper = fs.readFileSync(path.join(here, "catering-booking-loaded-history.ts"), "utf8");
  for (const leak of ["visibility", "storageKey", "uploadedBy", "byteSize", "role", "fetch("]) {
    assert.equal(helper.includes(leak), false, leak);
  }
  const shared = collection(6, 1, "shared-");
  const v = view(5, "customer-1:booking-a");
  v.load(shared);
  v.poll([record(7, "shared-"), ...shared]);
  assert.equal(v.items.every((item) => item.id.startsWith("shared-")), true);
});

test("20. switching booking discards the other booking's files entirely", () => {
  const bookingA = collection(10, 1, "a");
  const v = view(5);
  v.load(bookingA);
  v.loadMore(bookingA);
  v.moveTo("user-1:booking-b");
  assert.deepEqual(ids(v.items), []);
  const bookingB = collection(2, 1, "b");
  v.load(bookingB);
  assert.deepEqual(ids(v.items), ["b02", "b01"]);
});

test("21. an unchanged file poll changes nothing", () => {
  const all = collection(8, 1, "f");
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const before = ids(v.items);
  for (let poll = 0; poll < 4; poll += 1) v.poll(all);
  assert.deepEqual(ids(v.items), before);
});

test("22. a partial final page ends pagination and preserves nothing behind it", () => {
  const all = collection(7, 1, "f");
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  // The second page holds two files and reports no older cursor: the window now covers the whole collection.
  assert.equal(v.hasOlder, false);
  assert.deepEqual(ids(v.items), ids(all));
  // So a file the server stops returning disappears rather than being held as "outside the window".
  v.poll(all.filter((item) => item.id !== "f01"));
  assert.equal(ids(v.items).includes("f01"), false);
});

test("23. one-record and empty collections behave", () => {
  const one = collection(1, 1, "f");
  const v = view(5);
  v.load(one);
  assert.deepEqual(ids(v.items), ["f01"]);
  v.poll([]);
  assert.deepEqual(ids(v.items), [], "an empty first page is an empty collection, not a window to preserve behind");
  v.poll(one);
  assert.deepEqual(ids(v.items), ["f01"], "and it comes back when the server returns it");
  // Nothing loaded at all preserves what is on screen rather than blanking it.
  const held: CateringLoadedHistory<Record> = { identity: "user-1:booking-a", items: [record(1, "f")] };
  assert.equal(cateringPreservedHistory(held, "user-1:booking-a", null, false), held);
  assert.deepEqual(cateringPreservedHistory(held, "user-1:booking-b", null, false), { identity: "user-1:booking-b", items: [] });
});
