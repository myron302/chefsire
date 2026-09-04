import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_WORKSPACE_POLL_MS } from "@shared/catering-booking-operations";

/**
 * Freshness of the booking file list while the workspace stays open.
 *
 * Files have no live channel at all, and a counterpart's upload or removal invalidates only THEIR actor-scoped
 * cache -- never this one, which is exactly what actor-scoped keys are for. So a customer with the workspace open
 * saw neither a newly shared file nor one that had been withdrawn: `refetchOnWindowFocus` fires only on a focus
 * TRANSITION, and a focused tab never has one. Following a `#files` notification into the section merely changes
 * the hash, so it landed on the same stale list.
 *
 * There is no DOM or React Query harness in this suite, so the query options are asserted structurally against the
 * component source, and the authorization invariants against the route that serves it -- as everywhere in Phase 2I.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "BookingFiles.tsx"), "utf8");
const comms = fs.readFileSync(path.join(here, "BookingCommunication.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");
const queryOptions = source.slice(source.indexOf("const query = useInfiniteQuery({"), source.indexOf("queryFn: async ({ pageParam })"));
/** Source with comments removed, so prose can never satisfy or fail a "must not contain" assertion. */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");

test("the file list actively refreshes on a timer while the tab stays open", () => {
  assert.equal(queryOptions.includes("refetchInterval: CATERING_WORKSPACE_POLL_MS"), true);
  assert.equal(queryOptions.includes("refetchOnWindowFocus: true"), true);
  // A hidden tab has no reader to serve, so background polling stays off; the focus transition covers the return.
  assert.equal(queryOptions.includes("refetchIntervalInBackground: false"), true);
  assert.equal(CATERING_WORKSPACE_POLL_MS, 15_000);
});

test("both live workspace sections share ONE cadence rather than duplicating the policy", () => {
  // The constant lives on the workspace contract both sections belong to, and both import it from there, so the
  // two cadences cannot drift into two different policies.
  for (const [label, text] of [["files", source], ["communication", comms]] as const) {
    assert.equal(text.includes('CATERING_WORKSPACE_POLL_MS, cateringBookingWorkspaceKey } from "@shared/catering-booking-operations"'), true, label);
    assert.equal(text.includes("refetchInterval: CATERING_WORKSPACE_POLL_MS"), true, label);
    // No second literal cadence anywhere.
    assert.equal(/refetchInterval:\s*\d/.test(text), false, label);
  }
});

test("polling implies no mutation and marks nothing", () => {
  const code = stripComments(queryOptions);
  for (const forbidden of ["mutate", "setDraft", "invalidate", "delete", "POST", "DELETE"]) {
    assert.equal(code.includes(forbidden), false, forbidden);
  }
  // The query is a plain credentialed GET against the booking-scoped list route.
  assert.equal(source.includes("`/api/catering/bookings/${bookingId}/files${search}`, { credentials: \"include\" }"), true);
  // Mutations remain exactly the two explicit ones, each driven by a control.
  assert.equal((source.match(/useMutation\(/g) ?? []).length, 2);
});

test("polling cannot widen what the server discloses: the route decides per actor", () => {
  // The list route resolves the actor's role from the persisted booking and filters by it. Asking again more often
  // asks the same authorized question; it can neither reveal a provider-private row to a customer nor its count.
  assert.equal(route.includes("cateringWorkspaceRole(booking, userId)"), true);
  assert.equal(route.includes("ownedCateringBooking(id, userId)"), true);
  assert.equal(route.includes("visibilityFilter(role)"), true);
  // Tombstoned rows stay hidden from the list whatever the cadence.
  assert.equal(route.includes("isNull(cateringBookingFiles.deletedAt)"), true);
  // The component sends no visibility or role of its own on the list request -- there is nothing to forge.
  assert.equal(stripComments(queryOptions).includes("visibility"), false);
  assert.equal(source.includes("`/api/catering/bookings/${bookingId}/files${search}`"), true);
});

test("download and delete still reauthorize per request, unaffected by list freshness", () => {
  // A fresher list is still only a list. Every download re-resolves the booking, the actor and the file's
  // visibility, and delete remains uploader-only.
  const download = route.slice(route.indexOf('r.get("/bookings/:id/files/:fileId/download"'), route.indexOf('r.delete("/bookings/:id/files/:fileId"'));
  assert.equal(download.includes("ownedCateringBooking(id, userId)"), true);
  assert.equal(download.includes("cateringWorkspaceRole(booking, userId)"), true);
  const remove = route.slice(route.indexOf('r.delete("/bookings/:id/files/:fileId"'));
  assert.equal(remove.includes("uploadedBy"), true);
});

test("pagination, history and ordering survive the refresh", () => {
  // Cursor pages, deduplicated by id when combined, so a refreshed page cannot duplicate a row.
  assert.equal(source.includes("getNextPageParam: (lastPage) => nextCateringFileCursor(lastPage)"), true);
  assert.equal(source.includes("combineCateringFilePages(query.data?.pages ?? [])"), true);
  // No page cap: loaded history is never dropped to keep polling cheap.
  assert.equal(stripComments(queryOptions).includes("maxPages"), false);
  // Actor-scoped key, unchanged.
  assert.equal(source.includes("cateringBookingFilesKey("), true);
  // Older pages are fetched only from explicit controls -- the "load older" button and its retry -- never from an
  // effect, so a poll cannot advance pagination by itself.
  assert.equal((source.match(/query\.fetchNextPage\(\)/g) ?? []).length, 2);
  for (const match of source.matchAll(/query\.fetchNextPage\(\)/g)) {
    assert.equal(source.slice(0, match.index!).lastIndexOf("onClick=") > source.slice(0, match.index!).lastIndexOf("useEffect("), true, "fetchNextPage must be reached from a control");
  }
});

test("a refresh does not disturb the upload draft or its idempotency token", () => {
  const code = stripComments(queryOptions);
  assert.equal(code.includes("setDraft"), false);
  // The draft is only ever rewritten by selection, visibility choice, the attempt marker, and a matching success.
  assert.equal(source.includes("completeCateringFileUpload(draftRef.current, attempt, role, () => crypto.randomUUID())"), true);
  assert.equal(source.includes("setDraft(markCateringFileAttempted);"), true);
  assert.equal((source.match(/crypto\.randomUUID\(\)/g) ?? []).length, 3);
});

test("a terminal booking still lists and refreshes its files, and stays non-writable", () => {
  // Reading never closes, only writing does: the query and its timer are unconditional.
  assert.equal(stripComments(queryOptions).includes("enabled:"), false);
  assert.equal(source.includes("CATERING_FILES_READ_ONLY_BANNER"), true);
  assert.equal(source.includes("mayUploadCateringFile(draft, editable, upload.isPending)"), true);
  // And the server refuses the write regardless of what the client renders.
  assert.equal(route.includes("mayMutateCateringFiles(booking.status as never)"), true);
});

test("the #files fragment landing fix is untouched, and now lands on a list that refreshes", () => {
  // The section keeps the id the fragment names, and the workspace still resolves the fragment after async load.
  assert.equal(source.includes(`<Card id="files">`), true);
  const workspace = fs.readFileSync(path.join(here, "..", "..", "pages", "services", "catering-booking-workspace.tsx"), "utf8");
  assert.equal(workspace.includes("cateringWorkspaceSectionFromHash(window.location.hash)"), true);
  assert.equal(workspace.includes("landingRef.current = recordCateringSectionLanding(landingRef.current, section);"), true);
});
