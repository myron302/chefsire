import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CateringBookingActivityView } from "@shared/catering-booking-operations";
import { cateringPreservedHistory, cateringRecordIsOlder, emptyCateringLoadedHistory, type CateringLoadedHistory } from "./catering-booking-loaded-history";
import { combineCateringActivityPages, nextCateringActivityPage } from "./catering-booking-workspace-state";

/**
 * Activity a participant has paged into must survive the refresh a file mutation triggers.
 *
 * The workspace endpoint paginates activity by OFFSET. A single new event at the head shifts every following page
 * boundary down by one, and the infinite query refetches the same offset positions, so the last page comes back one
 * row short at its tail. Two full pages of five, one counterpart upload, and `[a10..a6] [a5..a1]` refetches as
 * `[a11..a7] [a6..a2]`: a1 is gone from the panel. Nothing removed it -- activity is append-only truthful history --
 * and `combineCateringActivityPages` only deduplicates what the pages returned, so it cannot bring it back.
 *
 * The refetched pages are an authoritative window over the newest end of the feed, so history below that window is
 * preserved and merged by stable event id, exactly as the message and file lists already do. Because activity rows
 * are never edited or removed, nothing preserved can go stale, which is what makes preservation unconditionally
 * safe here.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceComponent = fs.readFileSync(path.join(here, "catering-booking-workspace.tsx"), "utf8");
const workspaceRoute = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-workspace.ts"), "utf8");
const filesComponent = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");

type Event = CateringBookingActivityView & { visibility: "shared" | "provider" };
type Page = { activity: CateringBookingActivityView[]; activityPagination: { page: number; limit: number; total: number; totalPages: number } };
const event = (ordinal: number, visibility: Event["visibility"] = "shared", eventType = "shared_file_uploaded"): Event =>
  ({ id: `a${String(ordinal).padStart(2, "0")}`, eventType: eventType as never, metadata: {}, createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, ordinal)).toISOString(), visibility });
/** A feed newest first, exactly as the route orders it: desc(created_at), desc(id). */
const feed = (highest: number, lowest = 1) => Array.from({ length: highest - lowest + 1 }, (_, index) => event(highest - index));
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
const visibleTo = (role: "provider" | "customer") => (item: Event) => role === "provider" || item.visibility === "shared";

/** One workspace request: the same OFFSET slice and the same pagination envelope the route returns. */
function servePage(all: readonly Event[], role: "provider" | "customer", limit: number, page: number): Page {
  const listable = all.filter(visibleTo(role));
  const activity = listable.slice((page - 1) * limit, (page - 1) * limit + limit);
  const total = listable.length;
  return { activity, activityPagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

function view(limit: number, role: "provider" | "customer" = "provider", identity = "user-1:booking-a") {
  let pages: Page[] = [];
  let history: CateringLoadedHistory<CateringBookingActivityView> = emptyCateringLoadedHistory();
  const settle = () => {
    const last = pages[pages.length - 1];
    const complete = pages.length === 0 || nextCateringActivityPage(last.activityPagination) === undefined;
    history = cateringPreservedHistory(history, identity, pages.length === 0 ? null : combineCateringActivityPages(pages), complete);
  };
  return {
    get items() { return history.items; },
    get pages() { return pages; },
    get hasMore() { return pages.length > 0 && nextCateringActivityPage(pages[pages.length - 1].activityPagination) !== undefined; },
    load(all: readonly Event[]) { pages = [servePage(all, role, limit, 1)]; settle(); },
    /** The refresh a file mutation triggers: every held page refetched at its own offset. */
    refresh(all: readonly Event[]) { pages = pages.map((_, index) => servePage(all, role, limit, index + 1)); settle(); },
    loadMore(all: readonly Event[]) {
      const next = nextCateringActivityPage(pages[pages.length - 1].activityPagination);
      if (next === undefined) return;
      pages = [...pages, servePage(all, role, limit, next)];
      settle();
    },
    moveTo(other: string) { identity = other; pages = []; settle(); },
  };
}
function assertContinuous(items: readonly { id: string; createdAt: string }[], label: string) {
  assert.equal(new Set(ids(items)).size, items.length, `${label}: no event twice`);
  for (let index = 1; index < items.length; index += 1) {
    assert.equal(cateringRecordIsOlder(items[index], items[index - 1]), true, `${label}: newest-first`);
  }
}

test("1-4. two loaded pages, a new head event, and the oldest loaded event is still there", () => {
  const all = feed(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  assert.deepEqual(ids(v.items), ids(all));
  const grown = [event(11), ...all];
  v.refresh(grown);
  // What the offsets themselves return, before any merge: this is the reported loss, asserted so the next
  // expectation cannot pass vacuously.
  assert.deepEqual(v.pages.map((page) => ids(page.activity)), [["a11", "a10", "a09", "a08", "a07"], ["a06", "a05", "a04", "a03", "a02"]]);
  assert.equal(v.pages.flatMap((page) => ids(page.activity)).includes("a01"), false, "the refetch really does drop it");
  assert.deepEqual(ids(v.items), ["a11", "a10", "a09", "a08", "a07", "a06", "a05", "a04", "a03", "a02", "a01"]);
  assertContinuous(v.items, "two pages");
});

test("5. several new head events preserve the entire loaded tail", () => {
  const all = feed(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.refresh([event(13), event(12), event(11), ...all]);
  assert.deepEqual(ids(v.items), ["a13", "a12", "a11", "a10", "a09", "a08", "a07", "a06", "a05", "a04", "a03", "a02", "a01"]);
  assertContinuous(v.items, "three new");
});

test("6. events are deduplicated by stable id, however the offsets overlap", () => {
  const all = feed(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.refresh([event(11), ...all]);
  v.loadMore([event(11), ...all]);
  assert.equal(new Set(ids(v.items)).size, v.items.length);
  assert.deepEqual(ids(v.items), ids([event(11), ...all]));
});

test("7. loading more after a refresh has no duplicate and no gap", () => {
  const all = feed(14);
  const grown = [event(15), ...all];
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.refresh(grown);
  assert.equal(v.hasMore, true);
  v.loadMore(grown);
  assertContinuous(v.items, "after load more");
  assert.deepEqual(ids(v.items), ids(grown).slice(0, v.items.length));
});

test("8. a refresh and a manual load more interleave deterministically", () => {
  const all = feed(12);
  const grown = [event(13), ...all];
  const refreshFirst = view(5);
  refreshFirst.load(all);
  refreshFirst.loadMore(all);
  refreshFirst.refresh(grown);
  refreshFirst.loadMore(grown);
  const loadFirst = view(5);
  loadFirst.load(all);
  loadFirst.loadMore(all);
  loadFirst.loadMore(all);
  loadFirst.refresh(grown);
  for (const [label, v] of [["refresh then load", refreshFirst], ["load then refresh", loadFirst]] as const) {
    assertContinuous(v.items, label);
    assert.deepEqual(ids(v.items), ids(grown).slice(0, v.items.length), label);
  }
  assert.equal(loadFirst.items.length >= 13, true, "nothing loaded is lost by the refresh that follows it");
});

test("9. an unchanged refresh, repeated, changes nothing", () => {
  const all = feed(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const before = ids(v.items);
  for (let round = 0; round < 5; round += 1) v.refresh(all);
  assert.deepEqual(ids(v.items), before);
});

test("10. switching booking discards the other booking's activity", () => {
  const bookingA = feed(10);
  const v = view(5);
  v.load(bookingA);
  v.loadMore(bookingA);
  v.moveTo("user-1:booking-b");
  assert.deepEqual(ids(v.items), []);
  v.load([event(2), event(1)]);
  assert.deepEqual(ids(v.items), ["a02", "a01"]);
});

test("11. a terminal booking's activity stays readable and keeps its loaded history", () => {
  const all = feed(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.refresh([event(11), ...all]);
  assert.equal(v.items.length, 11, "history is not lost when the booking closes");
  // The workspace query is never disabled and nothing about activity is gated on editability.
  assert.equal(workspaceComponent.includes("enabled: Boolean(user)"), true);
  assert.equal(/activity[^\n]*editable/.test(workspaceComponent), false, "activity is history, not a mutation surface");
});

test("12. events sharing an instant order deterministically by id", () => {
  const instant = "2026-09-01T12:00:00.000Z";
  const tied = ["a05", "a04", "a03", "a02", "a01"].map((id) => ({ ...event(1), id, createdAt: instant }));
  assert.equal(cateringRecordIsOlder({ id: "a01", createdAt: instant }, { id: "a02", createdAt: instant }), true);
  const v = view(3);
  v.load(tied);
  v.loadMore(tied);
  assert.deepEqual(ids(v.items), ids(tied));
  v.refresh([{ ...event(1), id: "a06", createdAt: instant }, ...tied]);
  assert.deepEqual(ids(v.items), ["a06", "a05", "a04", "a03", "a02", "a01"]);
  assertContinuous(v.items, "tied instants");
  // Which is the route's own ordering, tie-break included.
  assert.equal(workspaceRoute.includes("desc(cateringBookingActivity.createdAt), desc(cateringBookingActivity.id)"), true);
});

test("13. a counterpart's shared-file removal event arrives and the tail survives it", () => {
  const all = feed(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  const removal = { ...event(11), eventType: "shared_file_removed" as never };
  v.refresh([removal, ...all]);
  assert.equal(ids(v.items)[0], "a11");
  assert.equal(v.items.length, 11);
  assert.equal(ids(v.items).includes("a01"), true);
});

test("14 & 15. file attribution decides WHETHER to refresh; preservation decides what survives one", () => {
  // The two concerns stay separate: the file section still refreshes the workspace only for changes it did not
  // make, and this preserves loaded history across whichever refreshes do happen.
  assert.equal(filesComponent.includes("observeCateringFileSnapshot(ledgerRef.current, identity, fileSnapshot)"), true);
  assert.equal(filesComponent.includes("settleCateringRemovedFiles(ledgerRef.current, identity, gone)"), true);
  assert.equal(filesComponent.includes("for (const queryKey of cateringOriginWorkspaceInvalidations(origin)) cache.invalidateQueries({ queryKey });"), true);
  // No activity row is invented anywhere on the client: the database feed stays authoritative.
  assert.equal(/setActivity|activity\.push|activity\s*=\s*\[/.test(filesComponent), false);
  assert.equal(workspaceComponent.includes("const activity = activityHistory.items;"), true);
  assert.equal(/setActivity|activity\.push/.test(workspaceComponent), false);
  // A refresh caused by this actor's own upload still preserves the tail, and adds only what the server returned.
  const all = feed(10);
  const v = view(5);
  v.load(all);
  v.loadMore(all);
  v.refresh([event(11), ...all]);
  assert.equal(v.items.length, 11);
});

test("16. a customer's activity contains no provider-private event, preserved or otherwise", () => {
  const all = [event(11, "provider"), ...feed(10)];
  const customer = view(5, "customer");
  customer.load(all);
  customer.loadMore(all);
  assert.equal(ids(customer.items).includes("a11"), false);
  customer.refresh([event(12, "provider"), ...all]);
  assert.equal(ids(customer.items).some((id) => ["a11", "a12"].includes(id)), false, "not through preservation either");
  assert.deepEqual(ids(customer.items), ids(feed(10)));
  // Preservation only ever holds rows this actor's own request returned, and the route filters before serializing.
  assert.equal(workspaceRoute.includes(`eq(cateringBookingActivity.visibility, "shared")`), true);
  assert.equal(workspaceRoute.includes("const activityVisibility = role === \"provider\" ? undefined :"), true);
  const helper = fs.readFileSync(path.join(here, "catering-booking-loaded-history.ts"), "utf8");
  for (const leak of ["visibility", "metadata", "eventType", "fetch("]) {
    assert.equal(helper.includes(leak), false, leak);
  }
});

test("17. one page, a partial final page, and a page that is exactly full", () => {
  // One page, nothing older: a new head event simply appears.
  const one = view(5);
  one.load(feed(3));
  assert.equal(one.hasMore, false);
  one.refresh([event(4), ...feed(3)]);
  assert.deepEqual(ids(one.items), ["a04", "a03", "a02", "a01"]);
  // A partial final page reaches the beginning, so nothing is preserved behind it.
  const partial = view(5);
  partial.load(feed(7));
  partial.loadMore(feed(7));
  assert.equal(partial.hasMore, false);
  assert.deepEqual(ids(partial.items), ids(feed(7)));
  // An exactly-full window with more behind it preserves normally.
  const full = view(5);
  full.load(feed(12));
  full.loadMore(feed(12));
  assert.equal(full.hasMore, true);
  full.refresh([event(13), ...feed(12)]);
  assert.equal(ids(full.items).includes("a03"), true);
});

test("18. an empty feed becoming non-empty behaves", () => {
  const v = view(5);
  v.load([]);
  assert.deepEqual(ids(v.items), []);
  assert.equal(v.hasMore, false);
  v.refresh([event(1)]);
  assert.deepEqual(ids(v.items), ["a01"]);
  v.refresh([event(2), event(1)]);
  assert.deepEqual(ids(v.items), ["a02", "a01"]);
});
