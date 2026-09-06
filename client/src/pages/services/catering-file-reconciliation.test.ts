import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_FILE_PRESENCE_MAXIMUM, cateringBookingFilePresenceKey, cateringBookingFilePresencePrefix, cateringBookingFilePresenceSchema, cateringFilePresencePath } from "@shared/catering-booking-files";
import { effectiveCateringEditable, observedCateringEditable } from "@shared/catering-booking-operations";
import { EMPTY_CATERING_REMOVED_RECORDS, cateringPreservedHistory, cateringPreservedTailIds, cateringReconciledRemovals, cateringRemovedIds, emptyCateringLoadedHistory, recordCateringRemovedRecords, type CateringLoadedHistory, type CateringRemovedRecords } from "./catering-booking-loaded-history";
import { EMPTY_CATERING_FILE_LEDGER, cateringMutationOrigin, expectCateringFileAddition, expectCateringFileRemoval, observeCateringFileSnapshot, settleCateringRemovedFiles, type CateringFileLedger } from "./catering-booking-mutation-origin";

/**
 * A preserved file that was actually deleted must stop being shown.
 *
 * Polling refreshes a window over the newest end of the collection, and history loaded below it is preserved
 * because absence from a shifted page proves nothing. That is right for a file displaced by newer uploads and
 * wrong for one its uploader has since removed: nothing newer will ever mention it again, so it renders forever,
 * offering a download that answers 404, until the participant paginates back down to it by hand.
 *
 * The window cannot answer this, so the client asks the one question it needs: of the ids I am already holding,
 * which may I still see? The answer is a subset of what was sent, so it can disclose nothing new -- a
 * provider-private id is absent exactly as a removed one is and exactly as one that never existed is.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");
const presenceRoute = route.slice(route.indexOf(`r.get("/bookings/:id/files/active"`), route.indexOf("/**\n * Uploads one booking file."));

type File = { id: string; createdAt: string; visibility: "shared" | "provider" };
type Page = { items: readonly File[]; nextCursor: string | null };
const file = (ordinal: number, visibility: File["visibility"] = "shared"): File =>
  ({ id: `f${String(ordinal).padStart(2, "0")}`, createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, ordinal)).toISOString(), visibility });
const collection = (highest: number, lowest = 1) => Array.from({ length: highest - lowest + 1 }, (_, index) => file(highest - index));
const ids = (items: readonly File[]) => items.map((item) => item.id);
/** Exactly the server's own filter: this actor's visibilities, and never a tombstoned row. */
const visibleTo = (role: "provider" | "customer") => (item: File) => role === "provider" || item.visibility === "shared";

function serve(all: readonly File[], role: "provider" | "customer", cursor: string | null, limit: number): Page {
  const listable = all.filter(visibleTo(role));
  const start = cursor === null ? 0 : listable.findIndex((item) => item.id === cursor) + 1;
  const read = listable.slice(start, start + limit + 1);
  const items = read.slice(0, limit);
  return { items, nextCursor: read.length > limit && items.length > 0 ? items[items.length - 1].id : null };
}
/** The presence endpoint: the requested ids echoed, and the subset still visible to this actor. */
function presence(all: readonly File[], role: "provider" | "customer", requested: readonly string[]) {
  const active = new Set(all.filter(visibleTo(role)).map((item) => item.id));
  return { requested: [...requested], active: requested.filter((id) => active.has(id)) };
}

function view(limit: number, role: "provider" | "customer" = "customer", identity = "user-1:booking-a") {
  let pages: Page[] = [];
  let history: CateringLoadedHistory<File> = emptyCateringLoadedHistory();
  let removed: CateringRemovedRecords = EMPTY_CATERING_REMOVED_RECORDS;
  let ledger: CateringFileLedger = EMPTY_CATERING_FILE_LEDGER;
  let activityRefreshes = 0;
  let asked: string[][] = [];
  const origin = () => ({ userId: "user-1", bookingId: identity.split(":")[1], identity });
  let refreshed: readonly File[] | null = null;
  const settle = () => {
    if (pages.length === 0) { refreshed = null; } else {
      const seen = new Set<string>();
      const combined: File[] = [];
      for (const page of pages) for (const item of page.items) { if (seen.has(item.id)) continue; seen.add(item.id); combined.push(item); }
      refreshed = combined;
    }
    history = cateringPreservedHistory(history, identity, refreshed, pages.length > 0 && pages[pages.length - 1].nextCursor === null, cateringRemovedIds(removed, identity));
  };
  return {
    get items() { return history.items; },
    get preserved() { return cateringPreservedTailIds(history, refreshed); },
    get activityRefreshes() { return activityRefreshes; },
    get asked() { return asked; },
    get ledger() { return ledger; },
    load(all: readonly File[]) { pages = [serve(all, role, null, limit)]; settle(); },
    poll(all: readonly File[]) {
      const held = pages.length;
      const next: Page[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < held; page += 1) {
        const served = serve(all, role, cursor, limit);
        next.push(served);
        if (served.nextCursor === null) break;
        cursor = served.nextCursor;
      }
      pages = next;
      settle();
      // The newest page still drives Activity attribution exactly as before.
      const observed = observeCateringFileSnapshot(ledger, identity, pages.length === 0 ? null : ids([...pages[0].items]));
      ledger = observed.next;
      if (observed.refreshActivity) activityRefreshes += 1;
    },
    loadMore(all: readonly File[]) {
      const last = pages[pages.length - 1];
      if (!last || last.nextCursor === null) return;
      pages = [...pages, serve(all, role, last.nextCursor, limit)];
      settle();
    },
    /** One reconciliation round, exactly as the component's query and effect run it. */
    reconcile(all: readonly File[], answer = presence(all, role, cateringPreservedTailIds(history, refreshed))) {
      const requested = cateringPreservedTailIds(history, refreshed);
      if (requested.length === 0) { asked.push([]); return; }
      asked.push([...answer.requested]);
      const gone = cateringReconciledRemovals(answer.requested, answer.active);
      if (gone.length === 0) { settle(); return; }
      removed = recordCateringRemovedRecords(removed, identity, gone);
      const settled = settleCateringRemovedFiles(ledger, identity, gone);
      ledger = settled.next;
      if (settled.refreshActivity) activityRefreshes += 1;
      settle();
    },
    deleteLocally(fileId: string) {
      ledger = expectCateringFileRemoval(ledger, origin() as never, fileId);
      removed = recordCateringRemovedRecords(removed, identity, [fileId]);
      settle();
    },
    uploadLocally(fileId: string) { ledger = expectCateringFileAddition(ledger, origin() as never, fileId); },
    moveTo(other: string) { identity = other; pages = []; refreshed = null; settle(); },
  };
}

test("1. a displaced file that was remotely deleted disappears without any manual pagination", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  assert.deepEqual(ids(v.items), ids(all));
  // Newer uploads push f01 below the refreshed window; it survives only in preserved history.
  const grown = [file(13), file(12), file(11), ...all];
  v.poll(grown);
  assert.equal(ids(v.items).includes("f01"), true);
  assert.deepEqual(v.preserved, ["f03", "f02", "f01"]);
  // Its uploader then removes it. Nothing the newest pages return can ever mention it again.
  const afterDelete = grown.filter((item) => item.id !== "f01");
  v.poll(afterDelete);
  assert.equal(ids(v.items).includes("f01"), true, "page absence alone still proves nothing");
  v.reconcile(afterDelete);
  assert.equal(ids(v.items).includes("f01"), false, "the presence check settles it, with no Load more needed");
});

test("2. a displaced file that was NOT deleted stays visible", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(13), file(12), file(11), ...all];
  v.poll(grown);
  v.reconcile(grown);
  assert.deepEqual(ids(v.items), ids(grown), "everything is still there, and everything is still shown");
  assert.equal(ids(v.items).includes("f01"), true);
});

test("3. a file this client deletes goes at once and is never resurrected", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(11), ...all];
  v.poll(grown);
  v.deleteLocally("f01");
  assert.equal(ids(v.items).includes("f01"), false, "immediately, without waiting for a refetch");
  // Every later refresh, in any order, and a reconciliation answer that still names it.
  v.poll(grown);
  v.reconcile(grown, { requested: ["f01"], active: ["f01"] });
  assert.equal(ids(v.items).includes("f01"), false, "a stale answer cannot bring back what this client removed");
  assert.equal(v.activityRefreshes, 0, "and its own removal announces nothing");
});

test("4. a counterpart's removal of a preserved file reconciles and refreshes Activity once", () => {
  // Deep enough that older history remains behind the loaded pages, so the window never becomes complete and the
  // removal really can only be established by the presence check.
  const all = collection(20);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(21), ...all];
  v.poll(grown);
  assert.deepEqual(v.preserved, ["f11"]);
  const before = v.activityRefreshes;
  const afterDelete = grown.filter((item) => item.id !== "f11");
  v.poll(afterDelete);
  assert.equal(ids(v.items).includes("f11"), true, "the newest pages cannot settle it");
  v.reconcile(afterDelete);
  assert.equal(ids(v.items).includes("f11"), false);
  assert.equal(v.activityRefreshes, before + 1, "a counterpart's shared removal is meaningful");
  // And it is announced exactly once: the id has left preserved history, so it is never asked about again.
  v.reconcile(afterDelete);
  v.poll(afterDelete);
  assert.equal(v.activityRefreshes, before + 1);
});

test("5. a local upload and a remote preserved-file deletion do not suppress each other", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll([file(11), ...all]);
  const before = v.activityRefreshes;
  // This client uploads f12 while the counterpart removes the long-displaced f01.
  v.uploadLocally("f12");
  const next = [file(12), file(11), ...all.filter((item) => item.id !== "f01")];
  v.poll(next);
  assert.equal(v.activityRefreshes, before, "the local upload is consumed by exact id");
  v.reconcile(next);
  assert.equal(ids(v.items).includes("f01"), false);
  assert.equal(v.activityRefreshes, before + 1, "and the remote removal is still announced");
});

test("6. only the file that was actually removed is removed", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(13), file(12), file(11), ...all];
  v.poll(grown);
  assert.deepEqual(v.preserved, ["f03", "f02", "f01"]);
  const afterDelete = grown.filter((item) => item.id !== "f02");
  v.poll(afterDelete);
  v.reconcile(afterDelete);
  assert.equal(ids(v.items).includes("f02"), false);
  assert.equal(ids(v.items).includes("f03"), true);
  assert.equal(ids(v.items).includes("f01"), true);
});

test("7. several removals between reconciliations all settle, exactly once each", () => {
  const all = collection(20);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(23), file(22), file(21), ...all];
  v.poll(grown);
  assert.deepEqual(v.preserved, ["f13", "f12", "f11"]);
  const before = v.activityRefreshes;
  const afterDeletes = grown.filter((item) => !["f11", "f12", "f13"].includes(item.id));
  v.poll(afterDeletes);
  v.reconcile(afterDeletes);
  for (const gone of ["f11", "f12", "f13"]) assert.equal(ids(v.items).includes(gone), false, gone);
  assert.equal(v.activityRefreshes, before + 1, "one refresh for the batch, not one per file");
  v.reconcile(afterDeletes);
  assert.equal(v.activityRefreshes, before + 1);
});

test("8. a customer learns nothing about a provider-private file, existing or removed", () => {
  // The customer's own pages never contained it, so it is never preserved and never asked about.
  const all = [...collection(10), file(11, "provider")];
  const customer = view(5, "customer");
  customer.load(all);
  customer.loadMore(all);
  assert.equal(ids(customer.items).includes("f11"), false);
  customer.poll(all);
  customer.reconcile(all);
  assert.equal(customer.asked.flat().includes("f11"), false, "a customer cannot even ask about it");
  // And were it asked about, the answer would omit it exactly as it omits a removed or nonexistent id.
  assert.deepEqual(presence(all, "customer", ["f11"]), { requested: ["f11"], active: [] });
  assert.deepEqual(presence(all, "customer", ["f99"]), { requested: ["f99"], active: [] });
  assert.deepEqual(presence(all.filter((item) => item.id !== "f01"), "customer", ["f01"]), { requested: ["f01"], active: [] });
  // The server applies the list's own visibility filter and reads ids only.
  assert.equal(presenceRoute.includes("visibilityFilter(role)"), true);
  assert.equal(presenceRoute.includes("isNull(cateringBookingFiles.deletedAt)"), true);
  assert.equal(presenceRoute.includes("eq(cateringBookingFiles.bookingId, id)"), true);
  assert.equal(presenceRoute.includes("inArray(cateringBookingFiles.id, asked.ids)"), true);
  assert.equal(presenceRoute.includes("requireAuth"), true);
  assert.equal(presenceRoute.includes("await ownedCateringBooking(id, userId)"), true);
  for (const leak of ["storageKey", "originalFilename", "byteSize", "uploadedBy", "count("]) {
    assert.equal(presenceRoute.includes(leak), false, leak);
  }
  assert.equal(presenceRoute.includes("select({ id: cateringBookingFiles.id })"), true, "ids and nothing else");
});

test("9. a provider reconciles its own private history without any of it reaching a customer", () => {
  const all = [...collection(10), file(11, "provider"), file(12, "provider")];
  const provider = view(5, "provider");
  provider.load(all);
  provider.loadMore(all);
  provider.loadMore(all);
  assert.equal(ids(provider.items).includes("f11"), true);
  const afterDelete = all.filter((item) => item.id !== "f11");
  provider.poll([file(13), ...afterDelete]);
  provider.reconcile([file(13), ...afterDelete]);
  assert.equal(ids(provider.items).includes("f11"), false, "the provider's own private removal reconciles");
  // The customer's view of the same booking never held it and never will.
  const customer = view(5, "customer");
  customer.load(afterDelete);
  assert.equal(customer.items.every((item) => item.visibility === "shared"), true);
});

test("10. removals do not leak across bookings", () => {
  const bookingA = collection(10);
  const v = view(5);
  v.load(bookingA);
  v.loadMore(bookingA);
  v.poll([file(11), ...bookingA]);
  v.reconcile([file(11), ...bookingA.filter((item) => item.id !== "f01")]);
  assert.equal(ids(v.items).includes("f01"), false);
  // The same ids on another booking are untouched by that booking's removals.
  v.moveTo("user-1:booking-b");
  v.load(bookingA);
  v.loadMore(bookingA);
  assert.equal(ids(v.items).includes("f01"), true, "booking A's removal must not prune booking B");
  const held = recordCateringRemovedRecords(EMPTY_CATERING_REMOVED_RECORDS, "user-1:booking-a", ["f01"]);
  assert.equal(cateringRemovedIds(held, "user-1:booking-a").has("f01"), true);
  assert.equal(cateringRemovedIds(held, "user-1:booking-b").has("f01"), false);
});

test("11. a refresh landing after an authoritative removal cannot resurrect it", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(11), ...all];
  v.poll(grown);
  const afterDelete = grown.filter((item) => item.id !== "f01");
  v.reconcile(afterDelete);
  assert.equal(ids(v.items).includes("f01"), false);
  // A stale response still carrying it, then a stale reconciliation answer still calling it active.
  v.poll(grown);
  v.reconcile(grown, { requested: ["f01"], active: ["f01"] });
  assert.equal(ids(v.items).includes("f01"), false, "a removal is permanent");
});

test("12. loading older alongside reconciliation leaves no duplicate, gap or resurrection", () => {
  const all = collection(14);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const afterDelete = all.filter((item) => item.id !== "f01");
  v.poll(afterDelete);
  v.reconcile(afterDelete);
  v.loadMore(afterDelete);
  v.loadMore(afterDelete);
  assert.deepEqual(ids(v.items), ids(afterDelete).slice(0, v.items.length));
  assert.equal(new Set(ids(v.items)).size, v.items.length, "no duplicate");
  assert.equal(ids(v.items).includes("f01"), false, "no resurrection through pagination");
});

test("13. partial, full and single-record histories all behave", () => {
  // A window that reaches the beginning preserves nothing, so there is nothing to reconcile.
  const short = collection(7);
  const full = view(5);
  full.load(short);
  full.loadMore(short);
  assert.deepEqual(full.preserved, []);
  full.reconcile(short);
  assert.deepEqual(full.asked, [[]], "no request is made when nothing is preserved");
  // One record, displaced by a newer one, then removed.
  const one = view(1);
  one.load([file(1)]);
  assert.deepEqual(ids(one.items), ["f01"]);
  one.poll([file(2), file(1)]);
  assert.deepEqual(one.preserved, ["f01"]);
  one.reconcile([file(2)]);
  assert.deepEqual(ids(one.items), ["f02"]);
});

test("14. a terminal booking still reconciles a removal while staying read-only", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(11), ...all];
  v.poll(grown);
  v.reconcile(grown.filter((item) => item.id !== "f01"));
  assert.equal(ids(v.items).includes("f01"), false, "read-only means no new mutations, not stale metadata forever");
  // The recurring poll still stops on the endpoint's own answer, from the one shared policy.
  assert.equal(observedCateringEditable([{ editable: false }]), false);
  assert.equal(effectiveCateringEditable(true, observedCateringEditable([{ editable: false }])), false);
  assert.equal(component.includes("refetchInterval: () => cateringWorkspacePollInterval(canMutate),"), true);
  assert.equal(component.includes("refetchOnWindowFocus: true,"), true);
});

test("15. an unchanged reconciliation announces nothing", () => {
  const all = collection(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.poll([file(11), ...all]);
  const before = v.activityRefreshes;
  for (let round = 0; round < 5; round += 1) v.reconcile([file(11), ...all]);
  assert.equal(v.activityRefreshes, before);
  assert.deepEqual(ids(v.items), ids([file(11), ...all]));
});

test("16. pagination after a reconciled removal continues correctly", () => {
  const all = collection(14);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const afterDelete = all.filter((item) => item.id !== "f02");
  v.poll(afterDelete);
  v.reconcile(afterDelete);
  assert.equal(ids(v.items).includes("f02"), false);
  v.loadMore(afterDelete);
  v.loadMore(afterDelete);
  assert.equal(ids(v.items).includes("f02"), false, "no removed file returns through Load more");
  assert.equal(new Set(ids(v.items)).size, v.items.length);
  assert.deepEqual(ids(v.items), ids(afterDelete).slice(0, v.items.length));
});

test("17. the request contract is bounded, validated and built from the ids the client holds", () => {
  assert.equal(cateringFilePresencePath("booking-1", ["a", "b"]), "/api/catering/bookings/booking-1/files/active?ids=a%2Cb");
  const uuids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  assert.deepEqual(cateringBookingFilePresenceSchema.parse({ ids: uuids.join(",") }).ids, uuids);
  assert.throws(() => cateringBookingFilePresenceSchema.parse({ ids: "" }));
  assert.throws(() => cateringBookingFilePresenceSchema.parse({ ids: "not-a-uuid" }));
  assert.throws(() => cateringBookingFilePresenceSchema.parse({ ids: uuids[0], extra: "1" } as never));
  assert.throws(() => cateringBookingFilePresenceSchema.parse({ ids: new Array(CATERING_FILE_PRESENCE_MAXIMUM + 1).fill(uuids[0]).join(",") }));
  // The client asks only about what the window cannot settle, and only while there is something to ask about.
  assert.equal(component.includes("const preservedIds = cateringPreservedTailIds(history, refreshedFiles);"), true);
  assert.equal(component.includes("enabled: preservedIds.length > 0,"), true);
  assert.equal(component.includes("cateringReconciledRemovals(answer.requested, answer.active)"), true);
});

test("18. the newest-page delta and preserved-history reconciliation stay separate mechanisms", () => {
  // The page delta still reads the newest PAGE, and reconciliation never touches it: page displacement fabricates
  // nothing, and a removal outside the page is attributed by the same exact-expectation rule.
  assert.equal(component.includes("const fileSnapshot = cateringFileSnapshot(query.data?.pages);"), true);
  assert.equal(component.includes("observeCateringFileSnapshot(ledgerRef.current, identity, fileSnapshot)"), true);
  assert.equal(component.includes("settleCateringRemovedFiles(ledgerRef.current, identity, gone)"), true);
  const A = cateringMutationOrigin("user-1", "booking-a");
  // Unexplained outside-the-window removal: announced. This actor's own: not.
  const remote = settleCateringRemovedFiles(EMPTY_CATERING_FILE_LEDGER, A.identity, ["f01"]);
  assert.equal(remote.refreshActivity, true);
  const own = settleCateringRemovedFiles(expectCateringFileRemoval(EMPTY_CATERING_FILE_LEDGER, A, "f01"), A.identity, ["f01"]);
  assert.equal(own.refreshActivity, false);
  assert.equal(own.next.pending.size, 0, "and the expectation is consumed exactly once");
  assert.equal(settleCateringRemovedFiles(EMPTY_CATERING_FILE_LEDGER, A.identity, []).refreshActivity, false);
});

test("19. a booking closing runs one last reconciliation, so a removal made just before it is not stranded", () => {
  // The presence check polls on the same policy as the list, so closure stops it. A counterpart removal made in the
  // gap before its next poll would otherwise never be established: the file would sit on screen offering a download
  // that answers 404 until a focus transition or a reload.
  const all = collection(20);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const grown = [file(21), ...all];
  v.poll(grown);
  assert.deepEqual(v.preserved, ["f11"]);
  // The counterpart removes f11 and the booking is cancelled before the next presence poll would have run.
  const afterDelete = grown.filter((item) => item.id !== "f11");
  v.poll(afterDelete);
  assert.equal(ids(v.items).includes("f11"), true, "the newest pages still cannot settle it");
  // The transition invalidates the presence queries, which is the refresh that settles it.
  v.reconcile(afterDelete);
  assert.equal(ids(v.items).includes("f11"), false);
});

test("20. the transition invalidates every presence question for that booking, and only once", () => {
  // The full key appends the id set being asked about, so the prefix covers whichever question is in flight.
  const prefix = cateringBookingFilePresencePrefix("user-1", "booking-a");
  for (const fingerprint of ["f11", "f11,f10", ""]) {
    const full = cateringBookingFilePresenceKey("user-1", "booking-a", fingerprint);
    assert.deepEqual(full.slice(0, prefix.length), [...prefix], fingerprint);
  }
  // And it is another booking's business only.
  assert.notDeepEqual([...prefix], [...cateringBookingFilePresencePrefix("user-1", "booking-b")]);
  assert.notDeepEqual([...prefix], [...cateringBookingFilePresencePrefix("user-2", "booking-a")]);
  // The component fires it from the same latch that already refreshes the workspace once per observed transition,
  // so a closed booking's later polls repeat neither.
  const terminal = component.slice(component.indexOf("if (observedEditable !== false || terminalSeenRef.current) return;"), component.indexOf("const submit = (event: FormEvent)"));
  assert.equal(terminal.includes("terminalSeenRef.current = true;"), true);
  assert.equal(terminal.includes("cache.invalidateQueries({ queryKey: cateringBookingFilePresencePrefix(userId, bookingId) });"), true);
  assert.equal(terminal.indexOf("terminalSeenRef.current = true;") < terminal.indexOf("cateringBookingFilePresencePrefix"), true, "latched before it fires");
  assert.equal((component.match(/cateringBookingFilePresencePrefix\(userId, bookingId\)/g) ?? []).length, 1, "one refresh at the transition, not one per poll");
});

test("21. that refresh reconciles without reopening the booking to mutation", () => {
  // Nothing about the transition re-enables a write: the controls still obey the authoritative editable answer.
  assert.equal(observedCateringEditable([{ editable: false }]), false);
  assert.equal(effectiveCateringEditable(true, observedCateringEditable([{ editable: false }])), false);
  assert.equal(component.includes("const canMutate = effectiveCateringEditable(editable, observedEditable);"), true);
  assert.equal(component.includes("disabled={!mayUploadCateringFile(draft, canMutate, uploading)}"), true);
  assert.equal(component.includes("editable={canMutate}"), true);
  // The presence request itself is a read: it names ids and asks which are still visible, nothing more.
  assert.equal(presenceRoute.includes("r.get("), true);
  assert.equal(/db\.(insert|update|delete)/.test(presenceRoute), false, "reconciliation writes nothing");
});
