import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_FILE_PRESENCE_MAXIMUM, EMPTY_CATERING_FILE_PRESENCE, cateringBookingFilePresenceKey, cateringBookingFilePresencePrefix, cateringBookingFilePresenceSchema, cateringMergePresenceAnswer, cateringPresenceChunks, cateringPresenceQuestion, type CateringBookingFilePresenceView } from "@shared/catering-booking-files";
import { cateringReconciledRemovals } from "@/pages/services/catering-booking-loaded-history";

/**
 * Preserved-history reconciliation has to survive being bigger than one request.
 *
 * `cateringBookingFilePresenceSchema` refuses more than `CATERING_FILE_PRESENCE_MAXIMUM` ids, and the client asked
 * about every preserved id in a single request. Preserved history is bounded only by how much a participant has
 * loaded and how much has since been displaced by newer files, so a long-lived workspace crosses that line -- and
 * from then on every presence request answered 400. Reconciliation is the ONLY thing that shrinks the preserved
 * set, so the failure sustained itself: files the counterpart had removed stayed on screen indefinitely, offering
 * downloads that answer 404.
 *
 * The question is now canonicalized and split into chunks the server accepts, and the whole reconciliation is
 * all-or-nothing: presence is authoritative DELETION evidence, so a chunk that failed proves nothing about the ids
 * it asked about and none of the cycle is applied.
 *
 * There is no DOM or React harness in this suite, so the request sequence is driven through the same shared helpers
 * the component uses and the component's own wiring is asserted structurally.
 */
const component = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");
const MAX = CATERING_FILE_PRESENCE_MAXIMUM;
/** Ids that sort in the order they are generated, so expectations can be written positionally. */
const ids = (count: number, from = 0) => Array.from({ length: count }, (_, index) => `f${String(from + index).padStart(6, "0")}`);

/** The component's `queryFn`, transcribed: bounded requests, merged, and failing as a whole. */
type Answering = (asked: readonly string[]) => CateringBookingFilePresenceView | "failed";
function reconcile(preserved: readonly string[], answering: Answering): { view: CateringBookingFilePresenceView | "failed"; asked: string[][] } {
  const asked: string[][] = [];
  let reconciled = EMPTY_CATERING_FILE_PRESENCE;
  for (const chunk of cateringPresenceChunks(preserved)) {
    asked.push(chunk);
    const answer = answering(chunk);
    if (answer === "failed") return { view: "failed", asked };
    reconciled = cateringMergePresenceAnswer(reconciled, chunk, answer);
  }
  return { view: reconciled, asked };
}
/** A server holding exactly these files: it echoes what it was asked and names the ones still there. */
const holding = (present: readonly string[]): Answering => {
  const live = new Set(present);
  return (asked) => ({ requested: [...asked], active: asked.filter((id) => live.has(id)) });
};

test("1. exactly the maximum is one request, and the schema accepts it", () => {
  const preserved = ids(MAX);
  const chunks = cateringPresenceChunks(preserved);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].length, MAX);
  const uuids = new Array(MAX).fill("11111111-1111-4111-8111-111111111111");
  assert.equal(cateringBookingFilePresenceSchema.parse({ ids: uuids.join(",") }).ids.length, MAX);
});

test("2. one more than the maximum is two requests, and neither exceeds it", () => {
  const chunks = cateringPresenceChunks(ids(MAX + 1));
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [MAX, 1]);
  for (const chunk of chunks) assert.equal(chunk.length <= MAX, true);
  // The old single request is what the server refused outright.
  assert.throws(() => cateringBookingFilePresenceSchema.parse({ ids: new Array(MAX + 1).fill("11111111-1111-4111-8111-111111111111").join(",") }));
});

test("3. two maxima and a remainder are covered completely", () => {
  const preserved = ids(2 * MAX + 37);
  const chunks = cateringPresenceChunks(preserved);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [MAX, MAX, 37]);
  assert.equal(chunks.flat().length, preserved.length);
});

test("4. every preserved id appears in exactly one chunk", () => {
  const preserved = ids(MAX * 3 + 5);
  const seen = new Map<string, number>();
  for (const chunk of cateringPresenceChunks(preserved)) for (const id of chunk) seen.set(id, (seen.get(id) ?? 0) + 1);
  assert.equal(seen.size, preserved.length, "nothing above the limit is discarded");
  for (const id of preserved) assert.equal(seen.get(id), 1, id);
});

test("5. duplicates are canonicalized away before anything is requested", () => {
  const preserved = [...ids(10), ...ids(10), "f000003"];
  assert.deepEqual(cateringPresenceQuestion(preserved), ids(10));
  assert.deepEqual(cateringPresenceChunks(preserved), [ids(10)]);
});

test("6. the same logical set chunks identically however it is ordered", () => {
  const preserved = ids(MAX + 40);
  const shuffled = [...preserved].reverse();
  assert.deepEqual(cateringPresenceChunks(shuffled), cateringPresenceChunks(preserved));
  // Which is also why the query identity does not churn on a reordering that asks the same question.
  assert.equal(cateringPresenceQuestion(shuffled).join(","), cateringPresenceQuestion(preserved).join(","));
});

test("7. removals are reconciled across every chunk, not just the first", () => {
  const preserved = ids(MAX * 2 + 3);
  // One removal in each chunk, including the last.
  const gone = [preserved[0], preserved[MAX + 5], preserved[MAX * 2 + 2]];
  const outcome = reconcile(preserved, holding(preserved.filter((id) => !gone.includes(id))));
  assert.notEqual(outcome.view, "failed");
  const view = outcome.view as CateringBookingFilePresenceView;
  assert.equal(view.requested.length, preserved.length, "the whole preserved set was asked about");
  assert.deepEqual(cateringReconciledRemovals(view.requested, view.active).sort(), [...gone].sort());
});

test("8. a failed chunk is not evidence that its ids were deleted", () => {
  const preserved = ids(MAX + 10);
  const server = holding(preserved);
  const outcome = reconcile(preserved, (asked) => (asked.includes(preserved[MAX]) ? "failed" : server(asked)));
  assert.equal(outcome.view, "failed", "the reconciliation fails as a whole");
  // Nothing is applied, so nothing can be concluded gone -- and certainly not the ids the failed chunk asked about.
  assert.equal(outcome.asked.length, 2);
});

test("9. a successful chunk cannot make another chunk's ids disappear", () => {
  const preserved = ids(MAX + 10);
  // The first chunk answers, and every one of its files really is gone; the second chunk fails.
  const outcome = reconcile(preserved, (asked) => (asked.length === MAX ? { requested: [...asked], active: [] } : "failed"));
  assert.equal(outcome.view, "failed");
  // Had it merged what it had, ten still-present files would have been removed from history on no evidence at all.
  const partial = cateringMergePresenceAnswer(EMPTY_CATERING_FILE_PRESENCE, outcome.asked[0], { requested: [...outcome.asked[0]], active: [] });
  assert.equal(cateringReconciledRemovals(partial.requested, partial.active).includes(preserved[MAX]), false);
});

test("9b. an answer may only settle ids it was actually asked for and actually echoed", () => {
  const asked = ids(3);
  // An answer naming something else entirely settles nothing about it.
  const strayed = cateringMergePresenceAnswer(EMPTY_CATERING_FILE_PRESENCE, asked, { requested: [...asked, "f999999"], active: [] });
  assert.equal(strayed.requested.includes("f999999"), false);
  // An answer that simply omits an id from `requested` has not settled it, so it is never read as a deletion.
  const truncated = cateringMergePresenceAnswer(EMPTY_CATERING_FILE_PRESENCE, asked, { requested: [asked[0]], active: [] });
  assert.deepEqual(cateringReconciledRemovals(truncated.requested, truncated.active), [asked[0]]);
  assert.equal(truncated.requested.includes(asked[2]), false);
  // And `active` is kept to what the merged request covers, so a stray "still there" cannot mask a real removal.
  const noisy = cateringMergePresenceAnswer(EMPTY_CATERING_FILE_PRESENCE, asked, { requested: [...asked], active: [asked[1], "f999999"] });
  assert.deepEqual(cateringReconciledRemovals(noisy.requested, noisy.active), [asked[0], asked[2]]);
});

test("10. a chunked reconciliation belongs to one booking and one actor", () => {
  const fingerprint = cateringPresenceQuestion(ids(MAX + 1)).join(",");
  const mine = cateringBookingFilePresenceKey("user-1", "booking-a", fingerprint);
  assert.notDeepEqual([...mine], [...cateringBookingFilePresenceKey("user-1", "booking-b", fingerprint)]);
  assert.notDeepEqual([...mine], [...cateringBookingFilePresenceKey("user-2", "booking-a", fingerprint)]);
  // Two different preserved sets on the same booking are two different questions, never one cache entry.
  assert.notDeepEqual([...mine], [...cateringBookingFilePresenceKey("user-1", "booking-a", cateringPresenceQuestion(ids(MAX)).join(","))]);
  // And the prefix the terminal refresh invalidates still covers whichever question is in flight.
  const prefix = cateringBookingFilePresencePrefix("user-1", "booking-a");
  assert.deepEqual(mine.slice(0, prefix.length), [...prefix]);
});

test("11. the terminal final reconciliation covers an oversized set through the same chunks", () => {
  // The transition invalidates the presence PREFIX, so whatever question is current is refetched -- and that
  // question is now the chunked one, so nothing is stranded merely for being past the maximum.
  assert.equal(component.includes("cache.invalidateQueries({ queryKey: cateringBookingFilePresencePrefix(userId, bookingId) });"), true);
  const preserved = ids(MAX * 2 + 1);
  const gone = [preserved[MAX * 2]];
  const outcome = reconcile(preserved, holding(preserved.filter((id) => !gone.includes(id))));
  assert.deepEqual(cateringReconciledRemovals((outcome.view as CateringBookingFilePresenceView).requested, (outcome.view as CateringBookingFilePresenceView).active), gone);
});

test("12. an oversized preserved set no longer produces a permanent refusal", () => {
  const preserved = ids(MAX + 1);
  // Every request the client now makes is one the schema accepts, so the poll can answer and the set can shrink.
  for (const chunk of cateringPresenceChunks(preserved)) assert.equal(chunk.length <= MAX, true);
  const outcome = reconcile(preserved, holding(preserved.slice(0, MAX)));
  assert.deepEqual(cateringReconciledRemovals((outcome.view as CateringBookingFilePresenceView).requested, (outcome.view as CateringBookingFilePresenceView).active), [preserved[MAX]]);
  // Which is the point: the reconciliation is what shrinks preserved history, so a refusal used to be self-sealing.
  assert.equal(outcome.asked.length, 2);
});

test("13. Load more landing between chunks does not corrupt the answer", () => {
  const preserved = ids(MAX + 10);
  // Pagination changes what is PRESERVED, not what a chunk asked about: the answer is folded in against the chunk
  // it was sent for, so a set that changed mid-flight settles exactly the ids that were actually asked and echoed.
  const server = holding(preserved.slice(0, MAX + 9));
  const outcome = reconcile(preserved, server);
  const view = outcome.view as CateringBookingFilePresenceView;
  assert.deepEqual(cateringReconciledRemovals(view.requested, view.active), [preserved[MAX + 9]]);
  // A later, smaller question is a different query identity, so the two never merge into one cache entry.
  const before = cateringPresenceQuestion(preserved).join(",");
  const after = cateringPresenceQuestion(preserved.slice(0, MAX)).join(",");
  assert.notEqual(before, after);
});

test("14. chunking discloses nothing new: the answer is a subset of what was sent", () => {
  const preserved = ids(MAX + 5);
  const outcome = reconcile(preserved, holding(preserved));
  const view = outcome.view as CateringBookingFilePresenceView;
  const asked = new Set(outcome.asked.flat());
  for (const id of view.requested) assert.equal(asked.has(id), true, id);
  for (const id of view.active) assert.equal(asked.has(id), true, id);
  // The client only ever asks about ids it already holds, which is unchanged -- a provider-private file it was
  // never served is not in preserved history and so is never part of any chunk.
  assert.equal(component.includes("const preservedIds = cateringPresenceQuestion(cateringPreservedTailIds(history, refreshedFiles));"), true);
});

test("15. the component builds the request from the shared contract, one bounded chunk at a time", () => {
  assert.equal(component.includes("const presenceChunks = cateringPresenceChunks(preservedIds);"), true);
  assert.equal(component.includes("for (const chunk of presenceChunks) {"), true);
  assert.equal(component.includes("cateringFilePresencePath(bookingId, chunk)"), true);
  assert.equal(component.includes("cateringFilePresencePath(bookingId, preservedIds)"), false);
  // No local copy of the server's maximum: the bound comes from the schema's own constant.
  assert.equal(/CATERING_FILE_PRESENCE_MAXIMUM/.test(component), false, "the client must not restate the limit");
  assert.equal(component.includes("cateringMergePresenceAnswer(reconciled, chunk, body as CateringBookingFilePresenceView)"), true);
  // All or nothing: any chunk that does not answer correctly throws, so none of the cycle is applied.
  assert.equal(component.includes(`if (!Array.isArray(body.requested) || !Array.isArray(body.active)) throw new Error("Files could not be reconciled");`), true);
  const queryFn = component.slice(component.indexOf("queryFn: async (): Promise<CateringBookingFilePresenceView>"), component.indexOf("// The answer names the ids it was asked about"));
  assert.equal((queryFn.match(/throw /g) ?? []).length, 2, "a transport failure and a malformed answer, both fatal to the cycle");
  assert.equal(queryFn.includes("catch"), true, "only the JSON parse is tolerated, and it feeds the not-ok throw");
  assert.equal(/return reconciled;/.test(queryFn), true);
});
