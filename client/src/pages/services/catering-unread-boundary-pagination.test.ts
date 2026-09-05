import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_CATERING_THREAD_VISIBILITY, cateringCoverageFrontier, cateringMessagePageKey, cateringUnreadIntervalIsLoaded, cateringUnreadStart, cateringViewGeneration, mayRecordCateringViewedBoundary, nextCateringMessageCursor, recordCateringMessageCoverage, recordCateringSentinelVisibility, recordCateringViewportVisibility, type CateringThreadVisibility, type CateringUnreadStart } from "./catering-booking-communication-state";

/**
 * Already-read history must not stand between a participant and their one new message.
 *
 * The rule used to be that ANY unfetched older page blocked the read boundary. In a mature conversation that is
 * almost always true, and it is almost always irrelevant. Five hundred messages, read through 499, message 500
 * arrives: the endpoint answers `unreadStartId: m500`, the first page loads m471..m500, and four hundred and
 * seventy older messages exist -- all of them already read. The flat gate refused, so marking the single new
 * message read required hand-loading hundreds of messages the participant had read days ago.
 *
 * The only history that matters is the authoritative unread interval, `[unreadStart .. latest]`. Pages older than
 * `unreadStart` are by construction pages this actor has already read, because `unreadStart` IS the earliest unread
 * message according to their own persisted marker. What the old gate genuinely protected against -- an unread
 * message hiding in a page nobody fetched -- is the `unresolved` answer, which is still refused outright.
 *
 * None of this loosens the traversal proof: the contiguous per-message coverage requirement is untouched, and
 * everything it already refused to infer from -- pagination state, page loads, scroll position, the bottom
 * sentinel alone -- it still refuses to infer from.
 */
const mine = (id: string) => ({ id, mine: true });
const theirs = (id: string) => ({ id, mine: false });
const gen = (latestId: string | null, pageKey: string, start: CateringUnreadStart) => cateringViewGeneration(latestId, pageKey, start);
const seeBottom = (state: CateringThreadVisibility, g: ReturnType<typeof gen>) =>
  recordCateringViewportVisibility(recordCateringSentinelVisibility(state, g, true), g, true);
const see = (state: CateringThreadVisibility, g: ReturnType<typeof gen>, ...ids: string[]) => recordCateringMessageCoverage(state, g, ids);
/** A genuine uninterrupted traversal from `fromId` to the end of the loaded list. */
const traverse = (state: CateringThreadVisibility, g: ReturnType<typeof gen>, loaded: readonly { id: string }[], fromId: string) => {
  const all = loaded.map((message) => message.id);
  return see(state, g, ...all.slice(all.indexOf(fromId)));
};
/** `m001`..`m500`, so an id sorts the way the conversation reads. */
const label = (ordinal: number) => `m${String(ordinal).padStart(3, "0")}`;
/** One loaded window of a long conversation, oldest first, as the component renders it. */
const window = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => theirs(label(from + index)));
const pageKey = (pages: number, count: number, hasOlder: boolean) => cateringMessagePageKey(Array.from({ length: pages }, () => ({ messages: new Array(Math.ceil(count / pages)).fill(0) })), hasOlder);

test("1. a mature conversation with one new message is readable without loading its history", () => {
  // 500 messages, read through 499. The first page holds m471..m500 and 470 older messages remain unfetched.
  const loaded = window(471, 500);
  const start = cateringUnreadStart(loaded, 1, false, "m500");
  assert.deepEqual(start, { kind: "message", id: "m500", authoritative: true });
  const g = gen("m500", pageKey(1, 30, true), start);
  const viewed = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m500"), g);
  // The whole unread interval is one message, and it has been seen. The 470 already-read messages behind the
  // cursor are irrelevant and no longer block.
  assert.equal(cateringUnreadIntervalIsLoaded(start, true), true);
  assert.equal(mayRecordCateringViewedBoundary(viewed, g, true, start, loaded), true);
});

test("2. the same conversation with the new message NOT seen stays unread", () => {
  const loaded = window(471, 500);
  const start = cateringUnreadStart(loaded, 1, false, "m500");
  const g = gen("m500", pageKey(1, 30, true), start);
  // The bottom sentinel is on screen but the message itself was never covered: the interval is not traversed.
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, g), g, true, start, loaded), false);
  // Covering some other loaded message is not covering the unread one either.
  const elsewhere = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m480", "m481"), g);
  assert.equal(mayRecordCateringViewedBoundary(elsewhere, g, true, start, loaded), false);
});

test("3. an unread start that is not loaded still blocks, whatever is on screen", () => {
  const loaded = window(471, 500);
  // The endpoint says the earliest unread message is m450, which this window does not contain.
  const start = cateringUnreadStart(loaded, 51, false, "m450");
  assert.deepEqual(start, { kind: "unresolved", authoritative: true });
  assert.equal(cateringUnreadIntervalIsLoaded(start, true), false);
  assert.equal(cateringUnreadIntervalIsLoaded(start, false), false, "exhausting pagination is not loading the start");
  const g = gen("m500", pageKey(1, 30, true), start);
  const fully = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m471"), g);
  assert.equal(mayRecordCateringViewedBoundary(fully, g, true, start, loaded), false);
});

test("4. once an older page brings the unread start in, the pages before it stop mattering", () => {
  // The older page lands: m441..m500 are loaded, m450 is now present, and 440 older messages still are not.
  const loaded = window(441, 500);
  const start = cateringUnreadStart(loaded, 51, false, "m450");
  assert.deepEqual(start, { kind: "message", id: "m450", authoritative: true });
  const g = gen("m500", pageKey(2, 60, true), start);
  // Only m450..m500 has to be traversed. m441..m449 are older than the unread start and are not required.
  const required = loaded.slice(loaded.findIndex((message) => message.id === "m450"));
  const viewed = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, required, "m450"), g);
  assert.equal(cateringCoverageFrontier(loaded, "m450", viewed.covered), "m500");
  assert.equal(mayRecordCateringViewedBoundary(viewed, g, true, start, loaded), true);
});

test("5. an unread start on the oldest loaded row is enough, with history still behind it", () => {
  const loaded = window(471, 500);
  const start = cateringUnreadStart(loaded, 30, false, "m471");
  const g = gen("m500", pageKey(1, 30, true), start);
  const viewed = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m471"), g);
  assert.equal(mayRecordCateringViewedBoundary(viewed, g, true, start, loaded), true);
});

test("6. an unread start in the middle requires only what follows it", () => {
  const loaded = [theirs("m1"), mine("m2"), theirs("m3"), theirs("m4"), theirs("m5")];
  const start = cateringUnreadStart(loaded, 3, false, "m3");
  const g = gen("m5", pageKey(1, 5, true), start);
  // m1 and m2 are never covered. They are older than the unread start, so they are not part of the question.
  const viewed = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m3", "m4", "m5"), g);
  assert.equal(cateringCoverageFrontier(loaded, "m3", viewed.covered), "m5");
  assert.equal(mayRecordCateringViewedBoundary(viewed, g, true, start, loaded), true);
});

test("7. a scrollbar jump from the unread start straight to the newest message marks nothing", () => {
  const loaded = window(450, 500);
  const start = cateringUnreadStart(loaded, 51, false, "m450");
  const g = gen("m500", pageKey(2, 51, true), start);
  // Both endpoints genuinely observed; every message between them never entered the viewport.
  const jumped = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m450", "m500"), g);
  assert.equal(cateringCoverageFrontier(loaded, "m450", jumped.covered), "m450", "the frontier stops at the gap");
  assert.equal(mayRecordCateringViewedBoundary(jumped, g, true, start, loaded), false);
  // Covering all but one message in the middle is still one unseen message.
  const nearly = seeBottom(see(jumped, g, ...loaded.slice(1, -2).map((message) => message.id)), g);
  assert.equal(mayRecordCateringViewedBoundary(nearly, g, true, start, loaded), false);
});

test("8. the same range traversed message by message is eligible", () => {
  const loaded = window(450, 500);
  const start = cateringUnreadStart(loaded, 51, false, "m450");
  const g = gen("m500", pageKey(2, 51, true), start);
  const traversed = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m450"), g);
  assert.equal(mayRecordCateringViewedBoundary(traversed, g, true, start, loaded), true);
});

test("9. a newer message arriving extends the target and needs its own coverage", () => {
  const loaded = window(498, 500);
  const start = cateringUnreadStart(loaded, 3, false, "m498");
  const g1 = gen("m500", pageKey(1, 3, true), start);
  const traversed = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g1, loaded, "m498"), g1);
  assert.equal(mayRecordCateringViewedBoundary(traversed, g1, true, start, loaded), true);
  // m501 arrives. The unread start is unchanged, so the coverage already collected still stands...
  const grown = [...loaded, theirs("m501")];
  const g2 = gen("m501", pageKey(1, 4, true), start);
  const afterArrival = seeBottom(traversed, g2);
  assert.equal(cateringCoverageFrontier(grown, "m498", afterArrival.covered), "m500", "the old frontier survives");
  // ...but it reaches only the previous newest message, so the new one is not readable until it is seen.
  assert.equal(mayRecordCateringViewedBoundary(afterArrival, g2, true, start, grown), false);
  const seenNew = seeBottom(see(afterArrival, g2, "m501"), g2);
  assert.equal(mayRecordCateringViewedBoundary(seenNew, g2, true, start, grown), true);
});

test("10. a capped backlog is readable without loading the already-read pages before its start", () => {
  // 400 unread, so the workspace count is capped at the ceiling and reports "99+". The endpoint's own start is
  // never capped, and here it happens to sit inside the loaded window.
  const loaded = window(471, 500);
  const start = cateringUnreadStart(loaded, 99, true, "m471");
  assert.deepEqual(start, { kind: "message", id: "m471", authoritative: true });
  const g = gen("m500", pageKey(1, 30, true), start);
  const traversed = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m471"), g);
  assert.equal(mayRecordCateringViewedBoundary(traversed, g, true, start, loaded), true);
  // The capped count itself is never used to locate the range: with the endpoint's answer absent it refuses.
  assert.deepEqual(cateringUnreadStart(loaded, 99, true), { kind: "unresolved", authoritative: false });
});

test("11. truthful pagination is unchanged: a page with no cursor offers no older page", () => {
  assert.equal(nextCateringMessageCursor({ nextCursor: "m471" }), "m471");
  assert.equal(nextCateringMessageCursor({ nextCursor: null }), undefined, "an exactly-full final page ends here");
  assert.equal(nextCateringMessageCursor(undefined), undefined);
  // And exhausting pagination is still a change of rendering, so the bottom must be observed again for it.
  const loaded = window(471, 500);
  const start = cateringUnreadStart(loaded, 1, false, "m500");
  const more = gen("m500", pageKey(1, 30, true), start);
  const end = gen("m500", pageKey(1, 30, false), start);
  assert.notEqual(more.pageKey, end.pageKey);
  const viewed = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, more, "m500"), more);
  assert.equal(mayRecordCateringViewedBoundary(viewed, more, true, start, loaded), true);
  assert.equal(mayRecordCateringViewedBoundary(viewed, end, false, start, loaded), false, "a new rendering needs the bottom re-observed");
});

test("12. a poll returning the same messages fabricates no coverage", () => {
  const loaded = window(498, 500);
  const start = cateringUnreadStart(loaded, 3, false, "m498");
  const g = gen("m500", pageKey(1, 3, true), start);
  const partial = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m498"), g);
  assert.equal(mayRecordCateringViewedBoundary(partial, g, true, start, loaded), false);
  // The poll replaces the page objects with identical ids. Coverage is keyed by id, so it neither grows nor churns.
  const repolled = see(partial, g, "m498");
  assert.equal(repolled, partial, "an observation that adds nothing returns the same object");
  assert.equal(mayRecordCateringViewedBoundary(repolled, g, true, start, loaded), false);
  // Nor does a refetch that leaves the rendering identical unlock anything on its own.
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(repolled, g), g, true, start, loaded), false);
});
