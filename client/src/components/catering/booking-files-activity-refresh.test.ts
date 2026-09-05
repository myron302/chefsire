import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringFileBoundary, cateringFileSnapshot } from "@shared/catering-booking-files";
import { EMPTY_CATERING_FILE_LEDGER, cateringMutationOrigin, expectCateringFileAddition, expectCateringFileRemoval, observeCateringFileSnapshot, type CateringFileLedger } from "@/pages/services/catering-booking-mutation-origin";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "@shared/catering-booking-activity-events";

/**
 * Files and Activity must not describe the same booking differently.
 *
 * The file list polls; the parent workspace summary that renders Activity does not. So a counterpart's shared
 * upload or removal refreshed the file list -- while the server had also written a `shared_file_uploaded` /
 * `shared_file_removed` activity row that the Activity panel beside it kept not showing, until a focus change or an
 * unrelated mutation happened to intervene.
 *
 * The fix compares the newest page across polls and subtracts the EXACT deltas this actor's own successful
 * mutations are expected to produce, so a counterpart's change landing in the same response as a local one is still
 * announced. There is no React Query or DOM harness in this suite, so the ledger is exercised behaviourally through
 * the very helpers the component calls, and the effect that consumes it is asserted structurally.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "BookingFiles.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");
const boundaryEffect = source.slice(source.indexOf("// A poll that finds the newest page genuinely different"), source.indexOf("// The first time this section's own endpoint reports"));

const pageOf = (...ids: string[]) => ({ files: ids.map((id) => ({ id })), nextCursor: null, editable: true });

const ORIGIN = cateringMutationOrigin("user-1", "booking-a");
/** The component's bookkeeping: the per-booking snapshot ledger plus its pending expected local deltas. */
function section(origin = ORIGIN) {
  let ledger: CateringFileLedger = EMPTY_CATERING_FILE_LEDGER;
  const invalidations: string[] = [];
  return {
    invalidations,
    get ledger() { return ledger; },
    /** A local upload that SUCCEEDED: it refreshes the workspace itself and expects exactly this id to appear. */
    localUpload(fileId: string) { ledger = expectCateringFileAddition(ledger, origin, fileId); invalidations.push("local-mutation"); },
    /** A local delete that SUCCEEDED: it expects exactly this id to disappear. */
    localDelete(fileId: string) { ledger = expectCateringFileRemoval(ledger, origin, fileId); invalidations.push("local-mutation"); },
    /** A local mutation that FAILED: it may still refetch, but it changed nothing, so it expects nothing. */
    localFailure() { invalidations.push("local-mutation"); },
    /** Mirrors the boundary effect, for one settled response. */
    poll(pages: ReturnType<typeof pageOf>[] | undefined) {
      const observed = observeCateringFileSnapshot(ledger, origin.identity, cateringFileSnapshot(pages));
      ledger = observed.next;
      if (observed.refreshActivity) invalidations.push("workspace");
    },
  };
}
const workspaceRefreshes = (s: ReturnType<typeof section>) => s.invalidations.filter((entry) => entry === "workspace").length;

test("1 & 2. the first load records a baseline, and quiet polls with the same boundary do nothing", () => {
  const s = section();
  s.poll([pageOf("f3", "f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 0, "the initial load must not announce a change");
  for (let poll = 0; poll < 5; poll += 1) s.poll([pageOf("f3", "f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 0, "an unchanged fingerprint must never invalidate");
});

test("3 & 4. a counterpart's shared upload refreshes the workspace exactly once", () => {
  const s = section();
  s.poll([pageOf("f2", "f1")]);
  // The counterpart uploads a shared file; the next poll returns it at the head.
  s.poll([pageOf("f3", "f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
  // Every quiet poll after it is silent.
  for (let poll = 0; poll < 5; poll += 1) s.poll([pageOf("f3", "f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1, "the change must be announced once, not once per poll");
});

test("5. a counterpart's shared removal refreshes the workspace exactly once", () => {
  const s = section();
  s.poll([pageOf("f3", "f2", "f1")]);
  s.poll([pageOf("f3", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
  s.poll([pageOf("f3", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
  // Including a removal of the newest file, which changes the head rather than the middle.
  s.poll([pageOf("f1")]);
  assert.equal(workspaceRefreshes(s), 2);
});

test("6. the events the refresh exists to surface are the ones the server writes for these mutations", () => {
  for (const event of ["shared_file_uploaded", "shared_file_removed"]) {
    assert.equal((CATERING_BOOKING_ACTIVITY_EVENT_TYPES as readonly string[]).includes(event), true, event);
  }
  // The server writes them in the same transaction as the file row, so a refreshed workspace sees them.
  assert.equal(route.includes("cateringFileActivity(fields.visibility, \"uploaded\")"), true);
  assert.equal(route.includes("cateringFileActivity(row.visibility as CateringFileVisibility, \"removed\")"), true);
  // And the client refetches authoritative activity rather than inventing any.
  assert.equal(boundaryEffect.includes("for (const queryKey of cateringOriginWorkspaceInvalidations(origin)) cache.invalidateQueries({ queryKey });"), true);
  assert.equal(/setActivity|activity\s*=/.test(boundaryEffect), false, "activity must never be fabricated locally");
});

test("7. a provider-private change is not observable to a customer through the boundary", () => {
  // A customer's pages contain shared files only -- the server filters by role before serializing -- so a
  // provider-private upload or removal cannot appear in, lengthen, or shorten what the customer computes.
  const customerBefore = [pageOf("shared-2", "shared-1")];
  const customerAfter = [pageOf("shared-2", "shared-1")];
  const s = section();
  s.poll(customerBefore);
  s.poll(customerAfter);
  assert.equal(workspaceRefreshes(s), 0, "a private change must trigger nothing on the customer side");
  assert.equal(cateringFileBoundary(customerBefore), cateringFileBoundary(customerAfter));
  // The filter that guarantees it, and the fact that only ids already serialized to this actor are read.
  assert.equal(route.includes("visibilityFilter(role)"), true);
  assert.equal(route.includes('eq(cateringBookingFiles.visibility, "shared")'), true);
  const helper = fs.readFileSync(path.join(here, "..", "..", "..", "..", "shared", "catering-booking-files.ts"), "utf8");
  const fn = helper.slice(helper.indexOf("export function cateringFileSnapshot"));
  assert.equal(fn.slice(0, fn.indexOf("\n}")).includes("files.map((file) => file.id)"), true);
  for (const leak of ["storageKey", "visibility", "byteSize", "uploadedBy"]) {
    assert.equal(fn.slice(0, fn.indexOf("\n}")).includes(leak), false, leak);
  }
});

test("8. pagination is untouched: only the newest page is fingerprinted", () => {
  // Older loaded pages are not walked, so loading history neither announces a change nor is disturbed by one.
  const s = section();
  s.poll([pageOf("f5", "f4")]);
  s.poll([pageOf("f5", "f4"), pageOf("f3", "f2"), pageOf("f1")]);
  assert.equal(workspaceRefreshes(s), 0, "loading an older page must not look like a change");
  assert.equal(cateringFileBoundary([pageOf("f5", "f4"), pageOf("f3")]), cateringFileBoundary([pageOf("f5", "f4")]));
  // And the component still combines and paginates exactly as before.
  assert.equal(source.includes("combineCateringFilePages(query.data?.pages ?? [])"), true);
  assert.equal(source.includes("getNextPageParam: (lastPage) => nextCateringFileCursor(lastPage)"), true);
  assert.equal(boundaryEffect.includes("fetchNextPage"), false);
});

test("9 & 10. terminal transition still stops polling, and a boundary change with it invalidates once each", () => {
  // The two effects are independent and each latches: the terminal one fires once on the transition, the boundary
  // one once per genuine change. Neither re-runs the other, so a final poll that carries both cannot loop.
  assert.equal(source.includes("cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages)))"), true);
  assert.equal(source.includes("if (observedEditable !== false || terminalSeenRef.current) return;"), true);
  assert.equal(boundaryEffect.includes("const observed = observeCateringFileSnapshot(ledgerRef.current, identity, fileSnapshot);"), true);
  assert.equal(boundaryEffect.includes("}, [fileBoundary, identity]);"), true);
  // A last poll delivering a change is still announced exactly once even though polling then stops.
  const s = section();
  s.poll([pageOf("f1")]);
  s.poll([pageOf("f2", "f1")]);
  s.poll([pageOf("f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
});

test("11. this actor's own upload or removal is not announced twice", () => {
  const s = section();
  s.poll([pageOf("f1")]);
  // The local mutation refreshes the workspace itself, then its refetch changes the boundary.
  s.localUpload("f2");
  s.poll([pageOf("f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 0, "the local mutation's own refresh is not duplicated");
  assert.deepEqual(s.invalidations, ["local-mutation"]);
  // The expectation is consumed, so a counterpart's next change is announced normally.
  s.poll([pageOf("f3", "f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
  // The existing mutation invalidations are unchanged.
  assert.equal(source.includes("for (const queryKey of cateringOriginFileInvalidations(attemptOrigin)) cache.invalidateQueries({ queryKey });"), true);
  assert.equal(source.includes("invalidateOrigin(attempt.origin); },"), true);
  assert.equal(source.includes("ledgerRef.current = expectCateringFileAddition(ledgerRef.current, attempt.origin, uploaded.id);"), true);
});

test("12. the cache key is actor-scoped, and the bookkeeping resets with the booking", () => {
  assert.equal(boundaryEffect.includes("cateringOriginWorkspaceInvalidations(origin)"), true);
  assert.equal(source.includes("cache.clear()"), false);
  assert.equal(source.includes("cache.invalidateQueries()"), false);
  // One ref, so recording renders nothing. It is NOT reset when the booking changes, because both halves of it
  // are keyed by booking: each booking keeps its own baseline and its own arming, and a completion for one can
  // never consume the other's. The draft and the file input, which are what is on screen, still reset.
  assert.equal(source.includes("const ledgerRef = useRef<CateringFileLedger>(EMPTY_CATERING_FILE_LEDGER);"), true);
  assert.equal(source.includes(`setDraft(emptyCateringFileDraft(role)); if (inputRef.current) inputRef.current.value = ""; terminalSeenRef.current = false; }, [identity, role]);`), true);
  assert.equal(source.includes("ledgerRef.current = EMPTY_CATERING_FILE_LEDGER"), false, "the per-booking ledger must not be wiped on navigation");
  // An empty conversation of files still records a baseline rather than being treated as a change.
  assert.equal(cateringFileBoundary([pageOf()]), "");
  assert.equal(cateringFileBoundary(undefined), null);
  assert.equal(cateringFileBoundary([]), null);
});


/**
 * A failed mutation changes no file boundary, so arming the "this was mine" absorber after one left the flag
 * waiting -- and the next genuine counterpart change was swallowed by it. Files updated while Activity did not.
 */
test("2 & 3. a failed upload arms nothing, so the next counterpart change is still announced", () => {
  const s = section();
  s.poll([pageOf("f1")]);
  s.localFailure();
  // Nothing changed, so no boundary effect runs at all and no flag is left behind.
  s.poll([pageOf("f1")]);
  assert.equal(workspaceRefreshes(s), 0);
  // The counterpart then uploads a shared file. It must be announced.
  s.poll([pageOf("f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1, "a stale flag must not consume a counterpart's change");
});

test("4. a failed upload followed by quiet polls leaves no suppression state behind", () => {
  const s = section();
  s.poll([pageOf("f1")]);
  s.localFailure();
  for (let poll = 0; poll < 5; poll += 1) s.poll([pageOf("f1")]);
  assert.equal(workspaceRefreshes(s), 0, "quiet polls stay quiet");
  s.poll([pageOf("f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
});

test("5, 6 & 7. delete succeeds -> suppressed once; delete fails -> the next change still announced", () => {
  const succeeded = section();
  succeeded.poll([pageOf("f2", "f1")]);
  succeeded.localDelete("f2");
  succeeded.poll([pageOf("f1")]);
  assert.equal(workspaceRefreshes(succeeded), 0, "a successful local delete refreshes the workspace itself");
  const failed = section();
  failed.poll([pageOf("f2", "f1")]);
  failed.localFailure();
  failed.poll([pageOf("f2", "f1")]);
  // The counterpart removes a file afterwards.
  failed.poll([pageOf("f2")]);
  assert.equal(workspaceRefreshes(failed), 1);
});

test("8. the component arms suppression on success only, never from onError or onSettled", () => {
  // `invalidateOrigin` no longer arms anything: it is called from failure paths too.
  const invalidateFn = source.slice(source.indexOf("const invalidateOrigin = ("), source.indexOf("const upload = useMutation"));
  assert.equal(/expectCateringFile(Addition|Removal)/.test(invalidateFn), false, "the shared invalidate must not arm suppression");
  // Upload arms only in onSuccess, and only for the id the server itself answered with.
  const upload = source.slice(source.indexOf("const upload = useMutation"), source.indexOf("const remove = useMutation"));
  assert.equal(upload.includes(`if (typeof uploaded?.id === "string") ledgerRef.current = expectCateringFileAddition(ledgerRef.current, attempt.origin, uploaded.id);`), true);
  const uploadError = upload.slice(upload.indexOf("onError:"));
  assert.equal(/expectCateringFile(Addition|Removal)/.test(uploadError), false, "an upload error must not arm anything");
  // Delete arms in onSuccess, by the id the request named; onSettled only refetches.
  const remove = source.slice(source.indexOf("const remove = useMutation"));
  assert.equal(remove.includes("onSuccess: (_body, attempt) => { ledgerRef.current = expectCateringFileRemoval(ledgerRef.current, attempt.origin, attempt.fileId);"), true);
  const settled = remove.slice(remove.indexOf("onSettled:"));
  assert.equal(/expectCateringFile(Addition|Removal)/.test(settled), false, "onSettled runs after failure too and must not arm");
  // Exactly two arming sites, both on success, and each names its own booking and its own file.
  assert.equal((source.match(/expectCateringFileAddition\(ledgerRef\.current, attempt\.origin, uploaded\.id\)/g) ?? []).length, 1);
  assert.equal((source.match(/expectCateringFileRemoval\(ledgerRef\.current, attempt\.origin, attempt\.fileId\)/g) ?? []).length, 1);
});

test("an idempotent retry that created nothing expects nothing either", () => {
  // A duplicate response hands back a file the newest page already carries, so no delta is coming and arming would
  // leave an expectation sitting there to absorb a counterpart's change instead.
  const s = section();
  s.poll([pageOf("f1")]);
  s.localUpload("f1");
  assert.equal(s.ledger.pending.size, 0, "an id already on the page arms nothing");
  s.poll([pageOf("f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
  // The decision is made from the authoritative id the server answered with, not from a flag.
  assert.equal(source.includes("const uploaded = (_body as { file?: { id?: unknown } } | undefined)?.file;"), true);
});
