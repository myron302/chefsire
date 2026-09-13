import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringCloseoutChecklistFromResponse,
  cateringCloseoutFailureNotice,
  cateringCloseoutResponseCarries,
  cateringCloseoutVersionsFromResponse,
  adoptCateringCloseoutVersions,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  isCateringCloseoutConflict,
  markCateringCloseoutEditorConflict,
  markCateringCloseoutFormConflict,
  mayDiscardCateringCloseoutNotes,
  mayEditCateringCloseoutNotes,
  maySubmitCateringCloseoutEditor,
  settleCateringCloseoutForm,
  shouldRefetchCloseoutAfterError,
  EMPTY_CATERING_CLOSEOUT_VERSIONS,
  type CateringCloseoutError,
  type OpenCateringCloseoutItemEditor,
} from "@/pages/services/catering-booking-closeout-state";
import { CATERING_CLOSEOUT_VERSION_CONFLICT_CODE } from "@shared/catering-booking-closeout";

/**
 * A 2xx IS NOT ENOUGH TO SETTLE FROM.
 *
 * The request flow read every response as `await response.json().catch(() => ({}))`. On the refusal path that is
 * harmless -- an unreadable error body just loses its wording. On the SUCCESS path it fabricated an authoritative
 * response out of nothing, and the settlement below it believed the fabrication:
 *
 *   1. the provider's notes PUT commits on the server
 *   2. the server answers 2xx with the record it wrote
 *   3. the body is truncated, corrupted, or replaced by an intermediary's page under a 200
 *   4. the parse fails and becomes `{}`
 *   5. success settlement runs -- `{}` carries no `closeout`
 *   6. `savedRecord?.providerNotes ?? ""` reads as "the server says these notes are empty"
 *   7. the provider's own words are cleared, against a null version
 *   8. the reconciliation refetch is failing for whatever reason the body did, so nothing corrects it
 *
 * An unreadable success is an INDETERMINATE write: it may well have committed. So it is classified as the lost
 * response it is and takes the existing transport path, where every draft is kept and the retry is safe because
 * every Phase 2K write is idempotent.
 */

const IDENTITY = "user-1:booking-a";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T10:00:05.000Z";

/** What the request flow throws for an unreadable or structurally wrong 2xx. */
const UNREADABLE: CateringCloseoutError = { message: "ChefSire's answer could not be read", offline: true, unreadable: true };

const hydrated = (text: string, version: string | null) =>
  hydrateCateringCloseoutForm(emptyCateringCloseoutForm(""), IDENTITY, text, version);
const dirtyDraft = () => editCateringCloseoutForm(hydrated("stored", V1), "my unsaved words");
const openEditor = (): OpenCateringCloseoutItemEditor =>
  ({ identity: IDENTITY, key: "equipment_return_confirmed", state: "completed", note: "returned today", expectedUpdatedAt: V1, conflicted: false });

/** The component's own success/failure decision for a parsed body, as `mutationFn` makes it. */
const settleable = (parsed: unknown, expects: "closeout" | "checklist") => cateringCloseoutResponseCarries(parsed, expects);

/* ------------------------------------------------------------------------------------------------------------- *
 * What counts as a settleable success
 * ------------------------------------------------------------------------------------------------------------- */

test("a parse failure is never settleable, whatever the write was", () => {
  // The parse threw; there is no parsed value at all. `{}` is what the old code substituted for it.
  for (const expects of ["closeout", "checklist"] as const) {
    assert.equal(settleable({}, expects), false, expects);
    assert.equal(settleable(undefined, expects), false, expects);
    assert.equal(settleable(null, expects), false, expects);
  }
});

test("a 2xx carrying the wrong shape is not settleable either", () => {
  assert.equal(settleable({ closeout: null }, "closeout"), false, "an explicit null is not a record");
  assert.equal(settleable({ closeout: "closed" }, "closeout"), false, "nor is a string");
  assert.equal(settleable({ closeout: [] }, "closeout"), false, "nor an array");
  assert.equal(settleable({ checklist: null }, "checklist"), false);
  assert.equal(settleable({ checklist: {} }, "checklist"), false, "the checklist is a list");
  assert.equal(settleable({ checklist: [] }, "closeout"), false, "a checklist response does not settle a record write");
  assert.equal(settleable({ closeout: {} }, "checklist"), false, "and a record response does not settle an item write");
  assert.equal(settleable("<!doctype html>", "closeout"), false, "an intermediary's page under a 200");
  assert.equal(settleable([{ closeout: {} }], "closeout"), false, "a top-level array is not a response object");
});

test("the real responses of all four writes ARE settleable, so the check is not merely strict", () => {
  // Exactly what the routes return: items -> { checklist }, notes/complete/reopen -> { closeout }.
  assert.equal(settleable({ checklist: [{ key: "equipment_return_confirmed", state: "completed", updatedAt: V2 }] }, "checklist"), true);
  assert.equal(settleable({ checklist: [] }, "checklist"), true, "an empty checklist is a real answer, not a missing one");
  assert.equal(settleable({ closeout: { updatedAt: V2, providerNotes: "saved" } }, "closeout"), true);
  assert.equal(settleable({ closeout: { updatedAt: V2, closedOut: true }, duplicate: true }, "closeout"), true, "completion");
  assert.equal(settleable({ closeout: { updatedAt: V2, closedOut: false } }, "closeout"), true, "reopening");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * How an unreadable success is treated
 * ------------------------------------------------------------------------------------------------------------- */

test("it is classified as a lost response, not as a conflict", () => {
  assert.equal(isCateringCloseoutConflict(UNREADABLE), false, "no concurrency conflict is inferred from silence");
  assert.equal(shouldRefetchCloseoutAfterError(UNREADABLE), false, "and no refetch is fired at whatever just failed");
  const outcome = cateringCloseoutFailureNotice(UNREADABLE);
  assert.equal(outcome.retryable, true);
  assert.equal(outcome.keepsEdit, true);
  assert.match(outcome.message, /could not be read/, "and the participant is told something true");
});

test("NOTES: the draft, its dirty state and its base version all survive untouched", () => {
  const before = dirtyDraft();
  // The error path marks a form conflicted only on a genuine conflict, so this failure touches nothing at all.
  const after = isCateringCloseoutConflict(UNREADABLE) ? markCateringCloseoutFormConflict(before) : before;
  assert.equal(after, before, "untouched, by reference");
  assert.equal(after.value, "my unsaved words");
  assert.equal(after.dirty, true);
  assert.equal(after.baseVersion, V1);
  assert.equal(after.conflicted, false);
  assert.equal(mayDiscardCateringCloseoutNotes(after, IDENTITY), false, "there is nothing to discard onto");
  // And once the mutation settles, the very same draft is retryable against the very same version.
  assert.equal(mayEditCateringCloseoutNotes(after, IDENTITY, true, false), true);
});

test("NOTES: the counterfactual -- settling from the fabricated `{}` cleared the provider's words", () => {
  const fabricated = {} as Record<string, unknown>;
  const savedRecord = fabricated.closeout as { providerNotes?: string | null; updatedAt?: string | null } | undefined;
  const savedVersion = typeof savedRecord?.updatedAt === "string" ? savedRecord.updatedAt : null;
  const settled = settleCateringCloseoutForm(dirtyDraft(), IDENTITY, "my unsaved words", savedRecord?.providerNotes ?? "", savedVersion);
  assert.equal(settled.value, "", "the draft is gone");
  assert.equal(settled.baseVersion, null, "and its version with it");
  assert.equal(settled.dirty, false, "with nothing left to say it was ever unsaved");
});

test("CHECKLIST: the editor draft survives, unconflicted and still submittable", () => {
  const before = openEditor();
  const after = isCateringCloseoutConflict(UNREADABLE) ? markCateringCloseoutEditorConflict(before, before.key) : before;
  assert.equal(after, before, "untouched, by reference");
  assert.equal((after as OpenCateringCloseoutItemEditor).note, "returned today");
  assert.equal((after as OpenCateringCloseoutItemEditor).expectedUpdatedAt, V1);
  assert.equal((after as OpenCateringCloseoutItemEditor).conflicted, false);
  assert.equal(maySubmitCateringCloseoutEditor(after as OpenCateringCloseoutItemEditor, true, false), true, "the retry is available");
});

test("no version is adopted and no checklist is installed from an unreadable body", () => {
  // Nothing downstream even runs -- but were it to, there is nothing in `{}` for it to take.
  assert.deepEqual(cateringCloseoutVersionsFromResponse({}), {});
  assert.equal(adoptCateringCloseoutVersions(EMPTY_CATERING_CLOSEOUT_VERSIONS, IDENTITY, {}).record, null);
  assert.equal(cateringCloseoutChecklistFromResponse({}), null, "and no checklist is fabricated");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The paths that must NOT change
 * ------------------------------------------------------------------------------------------------------------- */

test("a valid 2xx still settles exactly as before", () => {
  const value = { closeout: { providerNotes: "my unsaved words", updatedAt: V2 } };
  assert.equal(settleable(value, "closeout"), true);
  const settled = settleCateringCloseoutForm(dirtyDraft(), IDENTITY, "my unsaved words", value.closeout.providerNotes, value.closeout.updatedAt);
  assert.equal(settled.value, "my unsaved words");
  assert.equal(settled.baseVersion, V2);
  assert.equal(settled.dirty, false);
  assert.equal(settled.conflicted, false);
});

test("a 409 with a readable body still conflicts exactly as before", () => {
  const refusal: CateringCloseoutError = { message: "This closeout was changed", code: CATERING_CLOSEOUT_VERSION_CONFLICT_CODE };
  assert.equal(isCateringCloseoutConflict(refusal), true);
  assert.equal(shouldRefetchCloseoutAfterError(refusal), true);
  const marked = markCateringCloseoutFormConflict(dirtyDraft());
  assert.equal(marked.conflicted, true);
  assert.equal(marked.baseVersion, V1);
  assert.equal(mayEditCateringCloseoutNotes(marked, IDENTITY, true, false), false);
  assert.equal(mayDiscardCateringCloseoutNotes(marked, IDENTITY), true);
});

test("an unreadable ERROR body stays an ordinary retryable failure and is not read as a conflict", () => {
  // The non-2xx path reads what it can; an absent code is simply an absent code.
  const opaque: CateringCloseoutError = { message: "This closeout change could not be saved" };
  assert.equal(isCateringCloseoutConflict(opaque), false);
  assert.equal(cateringCloseoutFailureNotice(opaque).retryable, true, "no code means retryable");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The component's wiring
 * ------------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");
const mutationFn = component.slice(component.indexOf("mutationFn: async ("), component.indexOf("onSuccess: async (value, variables) => {"));

test("the parse failure is remembered rather than flattened into a value", () => {
  assert.equal(component.includes("response.json().catch(() => ({}))"), false, "the fabrication is gone");
  assert.ok(mutationFn.includes("let unreadable = false;"));
  assert.ok(mutationFn.includes("parsed = await response.json();"));
});

test("the READ is held to the same rule, so an unreadable view never replaces a good cached one", () => {
  const queryFn = component.slice(component.indexOf("queryFn: async ()"), component.indexOf("  const closeout = query.data;"));
  assert.ok(queryFn.includes('if (unreadable || !cateringCloseoutResponseCarries(body, "closeout")) throw new Error("The closeout view could not be loaded");'));
  assert.ok(queryFn.indexOf("if (!response.ok)") < queryFn.indexOf("cateringCloseoutResponseCarries"), "refusals are still judged first");
});

test("an unreadable or wrong-shaped success throws before anything can settle", () => {
  assert.ok(mutationFn.includes('if (unreadable || !cateringCloseoutResponseCarries(answer, expects)) {'));
  assert.ok(mutationFn.includes('throw Object.assign(new Error("ChefSire\'s answer could not be read"), { offline: true, unreadable: true });'));
  // It is a THROW, so `onSuccess` never runs: the settlement cannot be reached at all.
  assert.ok(mutationFn.indexOf("throw Object.assign(new Error(\"ChefSire's answer could not be read\")") < mutationFn.indexOf("return answer;"));
  // And it is not dressed up as a conflict.
  assert.equal(mutationFn.includes("CATERING_CLOSEOUT_VERSION_CONFLICT_CODE"), false);
});

test("the refusal path still parses the error body, and still carries its code", () => {
  assert.ok(mutationFn.includes("if (!response.ok) {"));
  assert.ok(mutationFn.includes('typeof answer.code === "string" ? answer.code : undefined'));
  assert.ok(mutationFn.indexOf("if (!response.ok) {") < mutationFn.indexOf("cateringCloseoutResponseCarries"), "refusals are judged first");
});

test("every write declares the object its response must carry", () => {
  assert.ok(component.includes('expects: "checklist",'), "the item PUT");
  assert.ok(component.includes('settle: "notes", submittedNotes: notesForm.value, expects: "closeout",'));
  assert.ok(component.includes('body: cateringCloseoutCompletePayload(rebasedRecord),'));
  assert.ok(component.includes('body: cateringCloseoutReopenPayload(rebasedRecord),'));
  // Four writes, four declarations, and the type makes it non-optional.
  assert.equal(component.split(/(?<!\| )expects: "(?:closeout|checklist)",/).length - 1, 4);
  assert.ok(component.includes('expects: "closeout" | "checklist";'));
});
