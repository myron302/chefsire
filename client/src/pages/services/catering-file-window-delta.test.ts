import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringFileSnapshot } from "@shared/catering-booking-files";
import { EMPTY_CATERING_FILE_LEDGER, cateringFileDelta, cateringFilePending, cateringMutationOrigin, expectCateringFileAddition, expectCateringFileRemoval, observeCateringFileSnapshot, type CateringFileLedger, type CateringMutationOrigin } from "./catering-booking-mutation-origin";

/**
 * The newest file page is a WINDOW, and a window moves without anybody touching a file.
 *
 * Comparing two of these pages as plain sets says two untrue things. A counterpart's upload arrives at the head and
 * pushes the oldest id off the tail -- that id was not deleted, it is one page further down -- and a deletion
 * inside the page frees a slot into which the next file down is revealed -- that id was not uploaded, it has
 * existed all along.
 *
 * Discounting both edges unconditionally makes them cancel, and that is the bug this fixes: a counterpart deleting
 * the oldest file the page carries produced `-f1, +f0`, both were written off as churn, and a real shared-file
 * deletion was never announced while the list beside Activity showed it plainly.
 *
 * Each edge effect is now budgeted by the thing that can cause it: a reveal needs a departure to fill for, a
 * push-off needs an arrival to push it. Whatever the budgets do not absorb is real, and only then are this actor's
 * own exact expected deltas subtracted from it.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");

const A = cateringMutationOrigin("user-1", "booking-a");
const B = cateringMutationOrigin("user-1", "booking-b");
const pageOf = (...ids: string[]) => ({ files: ids.map((id) => ({ id })), nextCursor: null, editable: true });
/** A full newest page with older history behind it, newest first. */
const FULL = ["f5", "f4", "f3", "f2", "f1"];

function section(origin: CateringMutationOrigin = A) {
  let ledger: CateringFileLedger = EMPTY_CATERING_FILE_LEDGER;
  let refreshes = 0;
  return {
    get refreshes() { return refreshes; },
    get ledger() { return ledger; },
    pending: () => cateringFilePending(ledger, origin.identity),
    uploaded(fileId: string) { ledger = expectCateringFileAddition(ledger, origin, fileId); },
    deleted(fileId: string) { ledger = expectCateringFileRemoval(ledger, origin, fileId); },
    poll(...pages: ReturnType<typeof pageOf>[]) {
      const observed = observeCateringFileSnapshot(ledger, origin.identity, cateringFileSnapshot(pages));
      ledger = observed.next;
      if (observed.refreshActivity) refreshes += 1;
    },
  };
}

test("1. a counterpart deleting the page's oldest file refreshes Activity", () => {
  // The reported failure: f1 is deleted and f0 rises into the window behind it. Discounting both as churn hid a
  // real shared-file deletion the server had already written an activity row for.
  const s = section();
  s.poll(pageOf(...FULL));
  s.poll(pageOf("f5", "f4", "f3", "f2", "f0"));
  assert.equal(s.refreshes, 1);
  assert.deepEqual(cateringFileDelta(FULL, ["f5", "f4", "f3", "f2", "f0"]), { added: [], removed: ["f1"] });
});

test("2. the same transition explained by this actor's own delete refreshes nothing", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.deleted("f1");
  s.poll(pageOf("f5", "f4", "f3", "f2", "f0"));
  assert.equal(s.refreshes, 0, "the disappearance is exactly the expected local removal");
  assert.equal(s.pending().removals.size, 0, "and the expectation is consumed");
  // The file that rose into the window is not reported as an upload either.
  assert.equal(s.pending().additions.size, 0);
});

test("3. a counterpart uploading at the head refreshes, and fabricates no deletion", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.poll(pageOf("f6", "f5", "f4", "f3", "f2"));
  assert.equal(s.refreshes, 1);
  const delta = cateringFileDelta(FULL, ["f6", "f5", "f4", "f3", "f2"]);
  assert.deepEqual(delta.added, ["f6"]);
  assert.deepEqual(delta.removed, [], "f1 fell off the window; it was not deleted");
});

test("4. the same head upload made locally refreshes nothing, and still fabricates no deletion", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.uploaded("f6");
  s.poll(pageOf("f6", "f5", "f4", "f3", "f2"));
  assert.equal(s.refreshes, 0);
  assert.equal(s.ledger.pending.size, 0);
});

test("5. a local delete coalesced with a counterpart's edge delete refreshes", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.deleted("f2");
  // Both f2 and f1 are gone; two older files rise into the window behind them.
  s.poll(pageOf("f5", "f4", "f3", "f0", "e9"));
  assert.equal(s.refreshes, 1, "f1 is unexplained");
  assert.equal(s.pending().removals.size, 0, "the local expectation was still consumed");
});

test("6. a local upload coalesced with a counterpart's delete inside the page refreshes", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.uploaded("f6");
  // The counterpart removes f3 while this actor's own upload is in flight; the window holds five either way.
  s.poll(pageOf("f6", "f5", "f4", "f2", "f1"));
  assert.equal(s.refreshes, 1, "the counterpart's removal must survive the coalescing");
  assert.equal(s.ledger.pending.size, 0);
});

test("6b. the one coincidence page 0 cannot resolve is documented rather than guessed", () => {
  // An upload plus the deletion of the page's own oldest file leave a page identical to the upload alone. There is
  // no evidence in page 0 to separate them, so the budget reads it as displacement -- which is what keeps a plain
  // local upload from being announced as somebody else's deletion. The next focus refetch picks the deletion up.
  assert.deepEqual(cateringFileDelta(FULL, ["f6", "f5", "f4", "f3", "f2"]), { added: ["f6"], removed: [] });
  const s = section();
  s.poll(pageOf(...FULL));
  s.uploaded("f6");
  s.poll(pageOf("f6", "f5", "f4", "f3", "f2"));
  assert.equal(s.refreshes, 0);
  // The limitation is stated where the algorithm lives, not left for a reader to discover.
  const helper = fs.readFileSync(path.join(here, "catering-booking-mutation-origin.ts"), "utf8");
  assert.equal(helper.includes("ONE CASE REMAINS UNDECIDABLE"), true);
});

test("7. a remote addition alongside pure displacement is exactly one meaningful addition", () => {
  const delta = cateringFileDelta(FULL, ["f7", "f6", "f5", "f4", "f3"]);
  assert.deepEqual(delta.added, ["f7", "f6"], "two arrivals, and two ids merely pushed out of the window");
  assert.deepEqual(delta.removed, []);
  const s = section();
  s.poll(pageOf(...FULL));
  s.uploaded("f6");
  s.poll(pageOf("f7", "f6", "f5", "f4", "f3"));
  assert.equal(s.refreshes, 1, "f7 is the counterpart's");
  assert.equal(s.ledger.pending.size, 0);
});

test("8. a remote removal alongside an older file entering the window is exactly one meaningful removal", () => {
  const delta = cateringFileDelta(FULL, ["f5", "f4", "f2", "f1", "f0"]);
  assert.deepEqual(delta.removed, ["f3"]);
  assert.deepEqual(delta.added, [], "f0 was revealed, not uploaded");
  const s = section();
  s.poll(pageOf(...FULL));
  s.poll(pageOf("f5", "f4", "f2", "f1", "f0"));
  assert.equal(s.refreshes, 1);
});

test("9. several counterpart changes in one response refresh once", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.poll(pageOf("f7", "f6", "f5", "f4", "f2"));
  assert.equal(s.refreshes, 1);
  const delta = cateringFileDelta(FULL, ["f7", "f6", "f5", "f4", "f2"]);
  assert.deepEqual(delta.added, ["f7", "f6"]);
  assert.deepEqual(delta.removed, ["f3"], "f1 was pushed out by the two arrivals; f3 genuinely went");
});

test("10. an unchanged page announces nothing and allocates nothing", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  const before = s.ledger;
  for (let poll = 0; poll < 5; poll += 1) s.poll(pageOf(...FULL));
  assert.equal(s.refreshes, 0);
  assert.equal(s.ledger, before);
});

test("11. loading an older page is not a mutation", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.poll(pageOf(...FULL), pageOf("f0", "e9"), pageOf("e8"));
  assert.equal(s.refreshes, 0);
  assert.deepEqual(cateringFileSnapshot([pageOf(...FULL), pageOf("f0")]), FULL);
});

test("12. only the expectations actually observed are consumed", () => {
  const s = section();
  s.poll(pageOf(...FULL));
  s.uploaded("f6");
  s.uploaded("f7");
  // The first response carries f6 only; f7 has not been served yet.
  s.poll(pageOf("f6", "f5", "f4", "f3", "f2"));
  assert.equal(s.refreshes, 0);
  assert.deepEqual([...s.pending().additions], ["f7"]);
  // The response that carries it absorbs it, and the ledger empties.
  s.poll(pageOf("f7", "f6", "f5", "f4", "f3"));
  assert.equal(s.refreshes, 0);
  assert.equal(s.ledger.pending.size, 0);
});

test("13. expectations stay with the booking that armed them", () => {
  let ledger = EMPTY_CATERING_FILE_LEDGER;
  ledger = observeCateringFileSnapshot(ledger, A.identity, FULL).next;
  ledger = observeCateringFileSnapshot(ledger, B.identity, ["b5", "b4", "b3", "b2", "b1"]).next;
  ledger = expectCateringFileRemoval(ledger, A, "f1");
  // B's own edge deletion is B's, and it is announced.
  const onB = observeCateringFileSnapshot(ledger, B.identity, ["b5", "b4", "b3", "b2", "b0"]);
  assert.equal(onB.refreshActivity, true);
  assert.deepEqual([...cateringFilePending(onB.next, A.identity).removals], ["f1"], "A's expectation is untouched");
  // And A's own transition is still absorbed when it arrives.
  assert.equal(observeCateringFileSnapshot(onB.next, A.identity, ["f5", "f4", "f3", "f2", "f0"]).refreshActivity, false);
});

test("14 & 15. nothing here can see or infer a provider-private file", () => {
  // The server filters by role before serializing, so a customer's pages carry shared files only: a
  // provider-private upload or removal changes nothing they compute, and its id never reaches this code.
  const s = section();
  s.poll(pageOf("shared-3", "shared-2", "shared-1"));
  s.poll(pageOf("shared-3", "shared-2", "shared-1"));
  assert.equal(s.refreshes, 0);
  assert.equal(route.includes("visibilityFilter(role)"), true);
  assert.equal(route.includes(`eq(cateringBookingFiles.visibility, "shared")`), true);
  // The delta reads ids and nothing else -- no count of hidden rows, no visibility, no uploader.
  const helper = fs.readFileSync(path.join(here, "catering-booking-mutation-origin.ts"), "utf8");
  const fn = helper.slice(helper.indexOf("export function cateringFileDelta"), helper.indexOf("const sameIds"));
  for (const leak of ["visibility", "storageKey", "uploadedBy", "byteSize", "role"]) {
    assert.equal(fn.includes(leak), false, leak);
  }
  assert.equal(component.includes("cateringFileSnapshot(query.data?.pages)"), true);
});

test("16. the symmetric edges: head, tail, one-element and empty pages", () => {
  // The newest file being deleted: the head changes and an older file is revealed at the tail.
  assert.deepEqual(cateringFileDelta(FULL, ["f4", "f3", "f2", "f1", "f0"]), { added: [], removed: ["f5"] });
  // A page that is not full grows by an upload, with nothing to push off.
  assert.deepEqual(cateringFileDelta(["f2", "f1"], ["f3", "f2", "f1"]), { added: ["f3"], removed: [] });
  // A page that is not full shrinks by a deletion, with nothing to reveal.
  assert.deepEqual(cateringFileDelta(["f2", "f1"], ["f2"]), { added: [], removed: ["f1"] });
  // An arrival at the tail with nothing missing is an upload, not a reveal.
  assert.deepEqual(cateringFileDelta(["f1"], ["f1", "f0"]), { added: ["f0"], removed: [] });
  // One-element pages, and a page emptying entirely.
  assert.deepEqual(cateringFileDelta(["f1"], []), { added: [], removed: ["f1"] });
  assert.deepEqual(cateringFileDelta([], ["f1"]), { added: ["f1"], removed: [] });
  assert.deepEqual(cateringFileDelta([], []), { added: [], removed: [] });
  // And every one of those, unexplained, refreshes.
  for (const [previous, next] of [[FULL, ["f4", "f3", "f2", "f1", "f0"]], [["f2", "f1"], ["f3", "f2", "f1"]], [["f2", "f1"], ["f2"]], [["f1"], []], [[], ["f1"]]] as const) {
    const s = section();
    s.poll(pageOf(...previous));
    s.poll(pageOf(...next));
    assert.equal(s.refreshes, 1, `${previous.join(",")} -> ${next.join(",")}`);
  }
});
