import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringCloseoutNotesPayload,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  markCateringCloseoutFormConflict,
  mayEditCateringCloseoutNotes,
  rebaseCateringCloseoutFormVersion,
  sameCateringVersion,
  settleCateringCloseoutForm,
} from "@/pages/services/catering-booking-closeout-state";

/**
 * THE REBASE IS ONLY SAFE WHEN THE CHAIN IS UNBROKEN.
 *
 * A dirty notes draft may follow the version this tab's own complete or reopen produced, because neither of those
 * writes touches `providerNotes` -- without it the provider conflicted with themselves. But "my own write" is not
 * the condition. The condition is that the write started from the version the draft is holding:
 *
 *   V1  the form hydrates; the provider starts typing
 *   V2  ANOTHER TAB saves different notes. This tab polls V2, correctly keeps the draft AND keeps V1
 *   V3  this tab completes -- and completing states the CURRENT record, which is V2, so the server accepts
 *
 * Rebasing on "this tab's own accepted write" hands the draft V3. The provider's next notes save then states a
 * version newer than notes they have never seen, the server accepts it, and V2's words are silently gone -- the
 * exact overwrite the version-with-the-text rule exists to prevent, reintroduced from the other side.
 *
 * So the precondition the mutation actually submitted travels on the request, and the draft advances only if its
 * own base equals it. Not the current query version, not the returned version, and not merely same-tab origin.
 */

const IDENTITY = "user-1:booking-a";
const OTHER = "user-1:booking-b";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T10:00:05.000Z";
const V3 = "2026-09-05T10:00:09.000Z";

const hydrated = (text: string, version: string | null) =>
  hydrateCateringCloseoutForm(emptyCateringCloseoutForm(""), IDENTITY, text, version);
const dirtyAt = (version: string | null, draft = "my unsaved words") => editCateringCloseoutForm(hydrated("stored", version), draft);

/* ------------------------------------------------------------------------------------------------------------- *
 * The safe case
 * ------------------------------------------------------------------------------------------------------------- */

test("complete submitted V1, returned V2, form based on V1: the draft advances and keeps every word", () => {
  const form = rebaseCateringCloseoutFormVersion(dirtyAt(V1), IDENTITY, V1, V2);
  assert.equal(form.baseVersion, V2);
  assert.equal(form.value, "my unsaved words");
  assert.equal(form.dirty, true);
  assert.equal(form.conflicted, false);
  // And the immediate next save states V2, so the provider does not conflict with their own completion.
  assert.equal(cateringCloseoutNotesPayload(form.value, form.baseVersion).expectedUpdatedAt, V2);
});

test("reopen behaves identically", () => {
  const form = rebaseCateringCloseoutFormVersion(dirtyAt(V1, "still writing"), IDENTITY, V1, V2);
  assert.equal(form.baseVersion, V2);
  assert.equal(form.value, "still writing");
});

test("a first-ever record: both sides absent, which is still an unbroken chain", () => {
  // No row existed, so `cateringCloseoutCompletePayload` states no precondition and the form was hydrated from none.
  // The server accepts an absent precondition only while the row is genuinely absent, so nobody's notes can be lost.
  const form = rebaseCateringCloseoutFormVersion(dirtyAt(null), IDENTITY, null, V2);
  assert.equal(form.baseVersion, V2);
  assert.equal(form.value, "my unsaved words");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The unsafe case this closes
 * ------------------------------------------------------------------------------------------------------------- */

test("another writer's notes landed first: complete submitted V2 while the draft holds V1, so nothing moves", () => {
  // 1-2. Hydrated at V1 and typed into.
  let form = dirtyAt(V1);
  // 3-6. Another tab saves DIFFERENT notes; the poll brings V2; the dirty form correctly keeps both.
  form = hydrateCateringCloseoutForm(form, IDENTITY, "words this provider has never seen", V2);
  assert.equal(form.baseVersion, V1);
  assert.equal(form.value, "my unsaved words");
  // 7-9. This tab completes. It states the CURRENT record -- V2 -- and the server accepts, returning V3.
  const after = rebaseCateringCloseoutFormVersion(form, IDENTITY, V2, V3);

  assert.equal(after, form, "untouched, by reference");
  assert.equal(after.baseVersion, V1, "the draft is still based on the last notes this provider actually read");
  assert.equal(after.value, "my unsaved words", "and it is still theirs to save");
  assert.equal(after.conflicted, false, "nothing has been refused yet, so nothing is conflicted yet");
  assert.equal(mayEditCateringCloseoutNotes(after, IDENTITY, true, false), true, "Save stays available -- and will conflict");
  // 10-14. The save states V1 against a V3 record, so the server refuses it. The other tab's words survive.
  assert.equal(cateringCloseoutNotesPayload(after.value, after.baseVersion).expectedUpdatedAt, V1);
});

test("the same shape through a reopen", () => {
  let form = dirtyAt(V1);
  form = hydrateCateringCloseoutForm(form, IDENTITY, "theirs", V2);
  const after = rebaseCateringCloseoutFormVersion(form, IDENTITY, V2, V3);
  assert.equal(after.baseVersion, V1);
  assert.equal(cateringCloseoutNotesPayload(after.value, after.baseVersion).expectedUpdatedAt, V1);
});

test("the counterfactual: rebasing on same-tab origin alone is what silently overwrote them", () => {
  // What the previous head did -- advance whenever this tab's own record write came back with a version.
  const unconditional = { ...dirtyAt(V1), baseVersion: V3 };
  assert.equal(cateringCloseoutNotesPayload(unconditional.value, unconditional.baseVersion).expectedUpdatedAt, V3);
  // The server would accept that: V3 IS the current record. The V2 notes are gone with no conflict reported.
});

/* ------------------------------------------------------------------------------------------------------------- *
 * What the decision is actually made from
 * ------------------------------------------------------------------------------------------------------------- */

test("it is the SUBMITTED version that decides, not the returned one", () => {
  // Same form, same returned version, two different submitted versions -- two different outcomes.
  assert.equal(rebaseCateringCloseoutFormVersion(dirtyAt(V1), IDENTITY, V1, V3).baseVersion, V3);
  assert.equal(rebaseCateringCloseoutFormVersion(dirtyAt(V1), IDENTITY, V2, V3).baseVersion, V1);
});

test("and not the version the query happens to hold", () => {
  // The draft is on V1 while the query has long since polled V2. The query's value is never consulted: the only
  // two inputs are the form's own base and the precondition the request carried.
  const polled = hydrateCateringCloseoutForm(dirtyAt(V1), IDENTITY, "theirs", V2);
  assert.equal(polled.baseVersion, V1, "the form kept its own");
  assert.equal(rebaseCateringCloseoutFormVersion(polled, IDENTITY, V2, V3), polled, "and V2 is not its base, so no");
});

test("and not merely that the response came back to this tab", () => {
  for (const submitted of [V2, V3, null]) {
    assert.equal(rebaseCateringCloseoutFormVersion(dirtyAt(V1), IDENTITY, submitted, V3).baseVersion, V1, String(submitted));
  }
});

test("versions compare as instants, so an equivalent ISO spelling is still the same version", () => {
  const spelled = "2026-09-05T10:00:00Z";                    // the same moment as V1, differently written
  assert.equal(sameCateringVersion(V1, spelled), true);
  assert.equal(rebaseCateringCloseoutFormVersion(dirtyAt(V1), IDENTITY, spelled, V2).baseVersion, V2);
  // With the opposite result for a genuinely different instant.
  assert.equal(sameCateringVersion(V1, V2), false);
});

test("an unparseable version authorizes nothing, including against itself", () => {
  assert.equal(sameCateringVersion("not-a-date", "not-a-date"), false);
  assert.equal(sameCateringVersion(null, V1), false);
  assert.equal(sameCateringVersion(V1, null), false);
  assert.equal(sameCateringVersion(null, null), true, "two absent versions are one state: no record existed");
  assert.equal(rebaseCateringCloseoutFormVersion(dirtyAt("not-a-date"), IDENTITY, "not-a-date", V2).baseVersion, "not-a-date");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The other refusals are unchanged
 * ------------------------------------------------------------------------------------------------------------- */

test("a conflicted form is never rebased, chain or no chain", () => {
  const conflicted = markCateringCloseoutFormConflict(dirtyAt(V1));
  const after = rebaseCateringCloseoutFormVersion(conflicted, IDENTITY, V1, V2);
  assert.equal(after, conflicted, "untouched, by reference");
  assert.equal(after.conflicted, true);
  assert.equal(after.baseVersion, V1);
  assert.equal(mayEditCateringCloseoutNotes(after, IDENTITY, true, false), false);
});

test("another booking's form, an absent returned version and an unchanged version all still do nothing", () => {
  const form = dirtyAt(V1);
  assert.equal(rebaseCateringCloseoutFormVersion(form, OTHER, V1, V2), form, "booking B's completion");
  assert.equal(rebaseCateringCloseoutFormVersion(form, IDENTITY, V1, null), form, "no version returned");
  assert.equal(rebaseCateringCloseoutFormVersion(form, IDENTITY, V1, V1), form, "the same version");
});

test("a CLEAN form is left to ordinary hydration, which adopts the authoritative record as it always did", () => {
  const clean = hydrated("stored", V1);
  assert.equal(clean.dirty, false);
  // The rebase would move it too, harmlessly -- but the poll's hydration gets there with the text as well.
  assert.equal(hydrateCateringCloseoutForm(clean, IDENTITY, "newest", V2).baseVersion, V2);
  assert.equal(hydrateCateringCloseoutForm(clean, IDENTITY, "newest", V2).value, "newest");
});

test("this form's own accepted NOTES save still advances it, because that write carried the text", () => {
  const settled = settleCateringCloseoutForm(dirtyAt(V1), IDENTITY, "my unsaved words", "my unsaved words", V2);
  assert.equal(settled.baseVersion, V2);
  assert.equal(settled.dirty, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The component's wiring
 * ------------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");

test("complete and reopen record the exact precondition they submit, on the request itself", () => {
  assert.equal(component.split("submittedRecordVersion: rebasedRecord.updatedAt ?? null").length - 1, 2);
  const complete = component.slice(component.indexOf('path: "/closeout/complete"'));
  assert.ok(complete.slice(0, 600).includes("submittedRecordVersion: rebasedRecord.updatedAt ?? null"));
  const reopen = component.slice(component.indexOf('path: "/closeout/reopen"'));
  assert.ok(reopen.slice(0, 600).includes("submittedRecordVersion: rebasedRecord.updatedAt ?? null"));
  // The very value that goes into the body, so the two cannot drift apart.
  assert.ok(component.includes("body: cateringCloseoutCompletePayload(rebasedRecord),"));
  assert.ok(component.includes("body: cateringCloseoutReopenPayload(rebasedRecord),"));
});

test("the settlement passes that recorded version, and never re-reads one from the cache", () => {
  const success = component.slice(component.indexOf("onSuccess: async (value, variables) => {"), component.indexOf("onError: async"));
  assert.ok(success.includes("} else if (variables.submittedRecordVersion !== undefined && savedVersion) {"));
  assert.ok(success.includes("setNotesForm((current) => rebaseCateringCloseoutFormVersion(current, started.identity, variables.submittedRecordVersion!, savedVersion));"));
  // `undefined` is the marker for "not a record-only write", so an item save cannot reach this branch at all.
  assert.equal(component.includes("submittedRecordVersion?: string | null;"), true);
  assert.equal(component.split("submittedRecordVersion").length - 1, 5, "declared, documented, set twice, read once");
});

test("the notes save itself is untouched and still submits the form's own base version", () => {
  assert.ok(component.includes("cateringCloseoutNotesPayload(notesForm.value, notesForm.baseVersion)"));
});
