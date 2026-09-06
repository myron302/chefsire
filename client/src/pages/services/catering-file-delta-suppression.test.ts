import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringFileSnapshot } from "@shared/catering-booking-files";
import { EMPTY_CATERING_FILE_LEDGER, cateringFileDelta, cateringFilePending, cateringMutationOrigin, expectCateringFileAddition, expectCateringFileRemoval, observeCateringFileSnapshot, type CateringFileLedger, type CateringMutationOrigin } from "./catering-booking-mutation-origin";

/**
 * A counterpart's file change must not disappear into the same response as one of this actor's own.
 *
 * The file list polls; the workspace that renders Activity does not, so a counterpart's shared upload or removal is
 * announced by comparing the newest authoritative page across polls. This actor's OWN mutations already refresh
 * that workspace, so they were absorbed -- by a single boolean per booking, which says only "some local mutation
 * happened before this page changed" and therefore swallows the WHOLE transition.
 *
 * Upload f3; before the refetch returns the counterpart shares f4; the next page is [f4, f3, f1, f2]. The list
 * shows f4 and the boolean absorbs everything, including f4. No further page change is coming, so Activity stays
 * stale for as long as the participant sits there. The same holds for a local removal that coalesces with anything.
 *
 * The fix is to record what each successful local mutation should DO -- add this id, remove that id -- and subtract
 * exactly that from the delta the next authoritative page actually shows. Anything left over belongs to somebody
 * else. Everything is per booking, and everything is computed from ids the server already serialized to THIS actor.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");
const shared = fs.readFileSync(path.join(here, "..", "..", "..", "..", "shared", "catering-booking-files.ts"), "utf8");

const A = cateringMutationOrigin("user-1", "booking-a");
const B = cateringMutationOrigin("user-1", "booking-b");
const pageOf = (...ids: string[]) => ({ files: ids.map((id) => ({ id })), nextCursor: null, editable: true });

/** The component's file bookkeeping, over the very helpers it calls. */
function section(origin: CateringMutationOrigin = A) {
  let ledger: CateringFileLedger = EMPTY_CATERING_FILE_LEDGER;
  let refreshes = 0;
  return {
    get refreshes() { return refreshes; },
    get ledger() { return ledger; },
    pending: () => cateringFilePending(ledger, origin.identity),
    uploaded(fileId: string) { ledger = expectCateringFileAddition(ledger, origin, fileId); },
    deleted(fileId: string) { ledger = expectCateringFileRemoval(ledger, origin, fileId); },
    failed() { /* a failed mutation changed nothing, so it expects nothing */ },
    /** One authoritative response landing, as the boundary effect sees it. */
    poll(...pages: ReturnType<typeof pageOf>[]) {
      const observed = observeCateringFileSnapshot(ledger, origin.identity, cateringFileSnapshot(pages));
      ledger = observed.next;
      if (observed.refreshActivity) refreshes += 1;
    },
  };
}

test("1. the first authoritative page is a baseline, not activity", () => {
  const s = section();
  s.poll(pageOf("f3", "f2", "f1"));
  assert.equal(s.refreshes, 0);
  // And a repeat of it stays quiet.
  s.poll(pageOf("f3", "f2", "f1"));
  assert.equal(s.refreshes, 0);
});

test("2. a pure local upload is absorbed", () => {
  const s = section();
  s.poll(pageOf("f1"));
  s.uploaded("f2");
  s.poll(pageOf("f2", "f1"));
  assert.equal(s.refreshes, 0);
  assert.equal(s.pending().additions.size, 0, "the expectation is consumed once it is observed");
});

test("3. a local upload coalesced with a counterpart's upload refreshes Activity", () => {
  const s = section();
  s.poll(pageOf("f1"));
  s.uploaded("f2");
  // The counterpart shares f3 before this actor's refetch returns, so both arrive in one response.
  s.poll(pageOf("f3", "f2", "f1"));
  assert.equal(s.refreshes, 1, "f3 is nobody's local mutation and must be announced");
  assert.equal(s.pending().additions.size, 0, "the local expectation is still consumed");
});

test("4. a pure local delete is absorbed", () => {
  const s = section();
  s.poll(pageOf("f2", "f1"));
  s.deleted("f2");
  s.poll(pageOf("f1"));
  assert.equal(s.refreshes, 0);
  assert.equal(s.pending().removals.size, 0);
});

test("5. a local delete coalesced with a counterpart's delete refreshes Activity", () => {
  const s = section();
  s.poll(pageOf("f2", "f1"));
  s.deleted("f2");
  // An empty page is still a page: the list is empty, not unloaded.
  s.poll(pageOf());
  assert.equal(s.refreshes, 1, "f1 disappeared too, and that was not this actor");
});

test("6. a local delete coalesced with a counterpart's upload refreshes Activity", () => {
  const s = section();
  s.poll(pageOf("f2", "f1"));
  s.deleted("f2");
  s.poll(pageOf("f3", "f1"));
  assert.equal(s.refreshes, 1);
});

test("7. two local uploads landing together are both absorbed", () => {
  const s = section();
  s.poll(pageOf("f1"));
  s.uploaded("f2");
  s.uploaded("f3");
  s.poll(pageOf("f3", "f2", "f1"));
  assert.equal(s.refreshes, 0);
  assert.equal(s.pending().additions.size, 0);
});

test("8. two local uploads plus a counterpart's still refreshes Activity", () => {
  const s = section();
  s.poll(pageOf("f1"));
  s.uploaded("f2");
  s.uploaded("f3");
  s.poll(pageOf("f4", "f3", "f2", "f1"));
  assert.equal(s.refreshes, 1, "one unexplained addition is enough");
});

test("9. a response carrying only one of two pending uploads consumes only that one", () => {
  const s = section();
  s.poll(pageOf("f1"));
  s.uploaded("f2");
  s.uploaded("f3");
  s.poll(pageOf("f2", "f1"));
  assert.equal(s.refreshes, 0);
  assert.deepEqual([...s.pending().additions], ["f3"], "the unobserved expectation must survive");
});

test("10. the later response carrying the remaining upload is absorbed and clears the ledger", () => {
  const s = section();
  s.poll(pageOf("f1"));
  s.uploaded("f2");
  s.uploaded("f3");
  s.poll(pageOf("f2", "f1"));
  s.poll(pageOf("f3", "f2", "f1"));
  assert.equal(s.refreshes, 0);
  assert.equal(s.ledger.pending.size, 0);
});

test("11. a failed upload expects nothing, so the next counterpart change is announced", () => {
  const s = section();
  s.poll(pageOf("f1"));
  s.failed();
  s.poll(pageOf("f2", "f1"));
  assert.equal(s.refreshes, 1);
});

test("12. a failed delete expects nothing either", () => {
  const s = section();
  s.poll(pageOf("f2", "f1"));
  s.failed();
  s.poll(pageOf("f1"));
  assert.equal(s.refreshes, 1);
});

test("13. an idempotent duplicate whose file the page already carries expects nothing", () => {
  const s = section();
  s.poll(pageOf("f2", "f1"));
  // The retry is answered from the upload ledger and hands back f2, which is already on the page.
  s.uploaded("f2");
  assert.equal(s.pending().additions.size, 0, "no delta is coming, so nothing may be armed to absorb one");
  s.poll(pageOf("f3", "f2", "f1"));
  assert.equal(s.refreshes, 1, "a counterpart's next change is still announced");
});

test("14. a change on one booking is neither explained nor suppressed by the other's expectation", () => {
  let ledger = EMPTY_CATERING_FILE_LEDGER;
  ledger = observeCateringFileSnapshot(ledger, A.identity, ["a1"]).next;
  ledger = observeCateringFileSnapshot(ledger, B.identity, ["b1"]).next;
  ledger = expectCateringFileAddition(ledger, A, "a2");
  const onB = observeCateringFileSnapshot(ledger, B.identity, ["b2", "b1"]);
  assert.equal(onB.refreshActivity, true, "B's change is B's");
  assert.deepEqual([...cateringFilePending(onB.next, A.identity).additions], ["a2"], "A's expectation is untouched");
});

test("15. navigating away and back keeps each booking's expectation with its own booking", () => {
  let ledger = EMPTY_CATERING_FILE_LEDGER;
  ledger = observeCateringFileSnapshot(ledger, A.identity, ["a1"]).next;
  ledger = expectCateringFileAddition(ledger, A, "a2");
  // Away to B: its own baseline, its own change.
  ledger = observeCateringFileSnapshot(ledger, B.identity, ["b1"]).next;
  const onB = observeCateringFileSnapshot(ledger, B.identity, ["b2", "b1"]);
  assert.equal(onB.refreshActivity, true);
  ledger = onB.next;
  // Back to A: the expectation is still there and still absorbs exactly its own addition.
  const backOnA = observeCateringFileSnapshot(ledger, A.identity, ["a2", "a1"]);
  assert.equal(backOnA.refreshActivity, false);
  assert.equal(cateringFilePending(backOnA.next, A.identity).additions.size, 0);
});

test("16. a counterpart change coalesced with a local one before the FIRST refetch is still announced", () => {
  const s = section();
  s.poll(pageOf("f1", "f2"));
  s.uploaded("f3");
  // Exactly the reported case: [f4, f3, f1, f2] arrives as one response.
  s.poll(pageOf("f4", "f3", "f1", "f2"));
  assert.equal(s.refreshes, 1, "Activity must not be left stale by a coalesced counterpart upload");
});

test("17. a customer can neither see nor infer a provider-private change", () => {
  // The server filters by role before serializing, so a customer's pages carry shared files only: a
  // provider-private upload or removal cannot appear in, lengthen or shorten what the customer computes.
  const s = section();
  s.poll(pageOf("shared-2", "shared-1"));
  s.poll(pageOf("shared-2", "shared-1"));
  assert.equal(s.refreshes, 0);
  assert.equal(route.includes("visibilityFilter(role)"), true);
  assert.equal(route.includes(`eq(cateringBookingFiles.visibility, "shared")`), true);
  // And only ids already serialized to this actor are read -- no visibility, size, uploader or storage key.
  const snapshotFn = shared.slice(shared.indexOf("export function cateringFileSnapshot"));
  const body = snapshotFn.slice(0, snapshotFn.indexOf("\n}"));
  assert.equal(body.includes("files.map((file) => file.id)"), true);
  for (const leak of ["storageKey", "visibility", "byteSize", "uploadedBy", "originalFilename"]) {
    assert.equal(body.includes(leak), false, leak);
  }
});

test("18. loading an older page is not activity", () => {
  const s = section();
  s.poll(pageOf("f5", "f4"));
  s.poll(pageOf("f5", "f4"), pageOf("f3", "f2"), pageOf("f1"));
  assert.equal(s.refreshes, 0, "history is not an upload");
  // Only the newest page is read, so older pages cannot fabricate a delta.
  assert.deepEqual(cateringFileSnapshot([pageOf("f5", "f4"), pageOf("f3")]), ["f5", "f4"]);
  assert.equal(component.includes("cateringFileSnapshot(query.data?.pages)"), true);
});

test("19. an unchanged authoritative page allocates nothing and announces nothing", () => {
  const s = section();
  s.poll(pageOf("f2", "f1"));
  const before = s.ledger;
  for (let poll = 0; poll < 5; poll += 1) s.poll(pageOf("f2", "f1"));
  assert.equal(s.refreshes, 0);
  assert.equal(s.ledger, before, "an unchanged page must not churn the ledger");
});

test("20. a counterpart adding and removing in one transition refreshes Activity", () => {
  const s = section();
  s.poll(pageOf("f2", "f1"));
  s.poll(pageOf("f3", "f1"));
  assert.equal(s.refreshes, 1);
});

test("21. the page edge moving is nobody's activity, and a short page's oldest row is still a real removal", () => {
  // A full page: deleting inside it frees a slot and the next file down is revealed at the tail. The arrival is
  // budgeted by the departure that made room for it, so it is not an upload.
  const shifted = cateringFileDelta(["f5", "f4", "f3", "f2", "f1"], ["f5", "f4", "f2", "f1", "f0"]);
  assert.deepEqual(shifted, { added: [], removed: ["f3"] });
  // Likewise an upload arrives at the head and pushes the oldest off the end; that departure is not a deletion.
  const pushed = cateringFileDelta(["f5", "f4", "f3", "f2", "f1"], ["f6", "f5", "f4", "f3", "f2"]);
  assert.deepEqual(pushed, { added: ["f6"], removed: [] });
  // But a page that is not full cannot shift, so its oldest row genuinely disappearing is a removal.
  assert.deepEqual(cateringFileDelta(["f2", "f1"], ["f2"]), { added: [], removed: ["f1"] });
  assert.deepEqual(cateringFileDelta(["f1"], ["f2", "f1"]), { added: ["f2"], removed: [] });
  // With no file in common the direction cannot be established, and the budgets read it as the window having moved
  // wholesale. Either reading refreshes Activity, which is what matters.
  assert.deepEqual(cateringFileDelta(["f2", "f1"], ["f4", "f3"]), { added: [], removed: ["f2", "f1"] });
  // So a local delete on a full page is still absorbed, and a coalesced counterpart upload still is not.
  const s = section();
  s.poll(pageOf("f5", "f4", "f3", "f2", "f1"));
  s.deleted("f3");
  s.poll(pageOf("f5", "f4", "f2", "f1", "f0"));
  assert.equal(s.refreshes, 0);
  s.deleted("f2");
  s.poll(pageOf("f6", "f5", "f4", "f1", "f0"));
  assert.equal(s.refreshes, 1);
});

test("22. an expectation armed while the booking was off screen is reconciled against its next baseline", () => {
  // The upload completes for A while B is on screen, so A has no snapshot yet when the expectation is armed.
  let ledger = expectCateringFileAddition(EMPTY_CATERING_FILE_LEDGER, A, "a2");
  assert.deepEqual([...cateringFilePending(ledger, A.identity).additions], ["a2"]);
  // Returning to A, its first page already carries the file: explained, consumed, and not announced.
  const baseline = observeCateringFileSnapshot(ledger, A.identity, ["a2", "a1"]);
  assert.equal(baseline.refreshActivity, false, "a baseline never announces pre-existing history");
  assert.equal(cateringFilePending(baseline.next, A.identity).additions.size, 0);
  // If it does not carry it yet, the expectation survives for the response that does.
  const stale = observeCateringFileSnapshot(ledger, A.identity, ["a1"]);
  assert.deepEqual([...cateringFilePending(stale.next, A.identity).additions], ["a2"]);
  assert.equal(observeCateringFileSnapshot(stale.next, A.identity, ["a2", "a1"]).refreshActivity, false);
  // A pending removal is the mirror image: gone from the baseline means done.
  const removal = observeCateringFileSnapshot(expectCateringFileRemoval(EMPTY_CATERING_FILE_LEDGER, B, "b9"), B.identity, ["b1"]);
  assert.equal(cateringFilePending(removal.next, B.identity).removals.size, 0);
});
