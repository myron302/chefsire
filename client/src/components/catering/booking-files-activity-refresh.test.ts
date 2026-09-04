import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringFileBoundary } from "@shared/catering-booking-files";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "@shared/catering-booking-activity-events";

/**
 * Files and Activity must not describe the same booking differently.
 *
 * The file list polls; the parent workspace summary that renders Activity does not. So a counterpart's shared
 * upload or removal refreshed the file list -- while the server had also written a `shared_file_uploaded` /
 * `shared_file_removed` activity row that the Activity panel beside it kept not showing, until a focus change or an
 * unrelated mutation happened to intervene.
 *
 * The fix compares a fingerprint of the newest page across polls. There is no React Query or DOM harness in this
 * suite, so the fingerprint is exercised behaviourally and the effect that consumes it asserted structurally, with
 * a small model of the ref-held bookkeeping standing in for the component's own.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "BookingFiles.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");
const boundaryEffect = source.slice(source.indexOf("// A poll that finds the newest page genuinely different"), source.indexOf("// The first time this section's own endpoint reports"));

const pageOf = (...ids: string[]) => ({ files: ids.map((id) => ({ id })), nextCursor: null, editable: true });

/** The component's bookkeeping: a recorded fingerprint plus the "this actor just mutated" absorber. */
function section() {
  let recorded: string | null = null;
  let ownMutation = false;
  const invalidations: string[] = [];
  return {
    invalidations,
    /** A local mutation that SUCCEEDED: it refreshes the workspace itself and arms the absorber. */
    localSuccess() { ownMutation = true; invalidations.push("local-mutation"); },
    /** A local mutation that FAILED: it may still refetch, but it changed no boundary, so it arms nothing. */
    localFailure() { invalidations.push("local-mutation"); },
    /** Mirrors the boundary effect, for one settled response. */
    poll(pages: ReturnType<typeof pageOf>[] | undefined) {
      const boundary = cateringFileBoundary(pages);
      if (boundary === null || recorded === boundary) return;
      const baseline = recorded === null;
      const own = ownMutation;
      recorded = boundary;
      ownMutation = false;
      if (baseline || own) return;
      invalidations.push("workspace");
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
  assert.equal(boundaryEffect.includes("cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });"), true);
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
  const fn = helper.slice(helper.indexOf("export function cateringFileBoundary"));
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
  assert.equal(boundaryEffect.includes("if (fileBoundary === null || boundaryRef.current === fileBoundary) return;"), true);
  assert.equal(boundaryEffect.includes("}, [fileBoundary]);"), true);
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
  s.localSuccess();
  s.poll([pageOf("f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 0, "the local mutation's own refresh is not duplicated");
  assert.deepEqual(s.invalidations, ["local-mutation"]);
  // The absorber is spent, so a counterpart's next change is announced normally.
  s.poll([pageOf("f3", "f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
  // The existing mutation invalidations are unchanged.
  assert.equal(source.includes("cache.invalidateQueries({ queryKey: filesKey });"), true);
  assert.equal(source.includes("onSettled: () => invalidate(),"), true);
  assert.equal(source.includes("ownMutationRef.current = true;"), true);
});

test("12. the cache key is actor-scoped, and the bookkeeping resets with the booking", () => {
  assert.equal(boundaryEffect.includes("cateringBookingWorkspaceKey(userId, bookingId)"), true);
  assert.equal(source.includes("cache.clear()"), false);
  assert.equal(source.includes("cache.invalidateQueries()"), false);
  // Refs, so recording renders nothing, and both reset when the booking or role changes.
  assert.equal(source.includes("const boundaryRef = useRef<string | null>(null);"), true);
  assert.equal(source.includes("boundaryRef.current = null; ownMutationRef.current = false; }, [identity, role]);"), true);
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
  succeeded.localSuccess();
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
  // `invalidate()` no longer arms anything: it is called from failure paths too.
  const invalidateFn = source.slice(source.indexOf("const invalidate = () => {"), source.indexOf("const upload = useMutation"));
  assert.equal(invalidateFn.includes("ownMutationRef.current = true;"), false, "the shared invalidate must not arm suppression");
  // Upload arms only in onSuccess, and only when the server actually created a file.
  const upload = source.slice(source.indexOf("const upload = useMutation"), source.indexOf("const remove = useMutation"));
  assert.equal(upload.includes("if (!(_body as { duplicate?: boolean } | undefined)?.duplicate) ownMutationRef.current = true;"), true);
  const uploadError = upload.slice(upload.indexOf("onError:"));
  assert.equal(uploadError.includes("ownMutationRef"), false, "an upload error must not arm suppression");
  // Delete arms in onSuccess; onSettled only refetches.
  const remove = source.slice(source.indexOf("const remove = useMutation"));
  assert.equal(remove.includes("onSuccess: () => { ownMutationRef.current = true; },"), true);
  const settled = remove.slice(remove.indexOf("onSettled:"), remove.indexOf("onSettled:") + 60);
  assert.equal(settled.includes("ownMutationRef"), false, "onSettled runs after failure too and must not arm");
  // Exactly two arming sites, both on success.
  assert.equal((source.match(/ownMutationRef\.current = true/g) ?? []).length, 2);
});

test("an idempotent retry that created nothing does not arm suppression either", () => {
  // A duplicate response means the file already existed, so the next boundary change is not this request's doing.
  const s = section();
  s.poll([pageOf("f1")]);
  // Modelled as a failure-shaped arming decision: nothing armed.
  s.localFailure();
  s.poll([pageOf("f2", "f1")]);
  assert.equal(workspaceRefreshes(s), 1);
  // And the component reads the server's own answer rather than assuming creation.
  assert.equal(source.includes("duplicate?: boolean"), true);
});
