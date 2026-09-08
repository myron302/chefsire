import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_ACCESS_TEXT_FIELDS,
  EMPTY_CATERING_EQUIPMENT_DRAFT,
  EMPTY_CATERING_STAFF_DRAFT,
  EMPTY_CATERING_TIMELINE_DRAFT,
  activeCateringTimelineEditor,
  cateringAccessDraftFrom,
  cateringAccessSavePayload,
  cateringEquipmentCreatePayload,
  cateringEquipmentQuantityIsValid,
  cateringExecutionDeletePayload,
  cateringExecutionFailureNotice,
  cateringExecutionVisibilityChoices,
  cateringReadinessVariant,
  cateringStaffCreatePayload,
  cateringStaffRoleLabel,
  cateringTimelineCompletionPayload,
  cateringTimelineCreatePayload,
  cateringTimelineDeletePayload,
  cateringTimelineEditPayload,
  cateringTimelineEditorFor,
  cateringTimelineReorderControls,
  cateringTimelineReorderPayload,
  editCateringAccessField,
  editCateringTimelineEditorField,
  formatCateringEquipmentWindow,
  formatCateringTimelineWindow,
  hydrateCateringAccessForm,
  isCateringExecutionConflict,
  markCateringTimelineEditorConflict,
  mayReloadCateringTimelineEditor,
  maySubmitCateringEquipmentDraft,
  maySubmitCateringStaffDraft,
  maySubmitCateringTimelineDraft,
  maySubmitCateringTimelineEditor,
  moveCateringTimelineItem,
  optionalText,
  preserveCateringAccessForm,
  reconcileCateringTimelineEditor,
  resetCateringDraft,
  settleCateringAccessForm,
  shouldRefetchExecutionAfterError,
  splitCateringEquipment,
  splitCateringTimeline,
  withCateringRequestId,
  type CateringAccessFormState,
  type CateringTimelineDraft,
} from "./catering-booking-execution-state";
import {
  CATERING_EXECUTION_NOT_FOUND_CODE,
  CATERING_EXECUTION_SET_CHANGED_CODE,
  CATERING_EXECUTION_VERSION_CONFLICT_CODE,
  CATERING_STAFF_ROLE_LABELS,
  CATERING_WORKSPACE_READ_ONLY_CODE,
  type CateringExecutionAccessView,
  type CateringExecutionTimelineItemView,
} from "@shared/catering-booking-execution";

/**
 * The Phase 2J client rules.
 *
 * The three things a participant can actually lose -- an unsaved edit, an idempotency token, and their place in a
 * concurrent edit -- are all decided here, so they are all tested here.
 */

const item = (id: string, updatedAt: string, over: Partial<CateringExecutionTimelineItemView> = {}): CateringExecutionTimelineItemView => ({
  id, title: `Item ${id}`, description: null, category: "setup", scheduledTime: "07:00", endTime: null,
  visibility: "provider_private", sortOrder: 0, isBlocker: false, completed: false, completedAt: null,
  createdAt: "2026-09-08T10:00:00.000Z", updatedAt, ...over,
});
const V1 = "2026-09-08T11:00:00.000Z";
const V2 = "2026-09-08T12:00:00.000Z";

/* ------------------------------------------------------------------------------------------------------------- *
 * Refusal classification and unsaved work
 * ------------------------------------------------------------------------------------------------------------- */

test("a conflict and a changed collection are the two refusals that mean 'reload, do not retry'", () => {
  assert.equal(isCateringExecutionConflict({ message: "", code: CATERING_EXECUTION_VERSION_CONFLICT_CODE }), true);
  assert.equal(isCateringExecutionConflict({ message: "", code: CATERING_EXECUTION_SET_CHANGED_CODE }), true);
  assert.equal(isCateringExecutionConflict({ message: "", code: CATERING_WORKSPACE_READ_ONLY_CODE }), false);
  assert.equal(isCateringExecutionConflict(undefined), false);
});

test("only refusals the server can settle trigger a refetch", () => {
  for (const code of [CATERING_EXECUTION_VERSION_CONFLICT_CODE, CATERING_EXECUTION_SET_CHANGED_CODE, CATERING_EXECUTION_NOT_FOUND_CODE, CATERING_WORKSPACE_READ_ONLY_CODE]) {
    assert.equal(shouldRefetchExecutionAfterError({ message: "", code }), true, code);
  }
  // A validation refusal changes nothing on the server, so refetching would only discard the participant's work.
  assert.equal(shouldRefetchExecutionAfterError({ message: "Quantity must be a whole number" }), false);
  // And a connectivity failure may never have reached the server at all: there is nothing new to read.
  assert.equal(shouldRefetchExecutionAfterError({ message: "network", offline: true }), false);
  assert.equal(shouldRefetchExecutionAfterError(null), false);
});

test("a change that did not reach the server is reported as NOT saved, and the edit is kept", () => {
  const offline = cateringExecutionFailureNotice({ message: "Failed to fetch", offline: true });
  assert.equal(offline.message.includes("was not saved"), true);
  assert.equal(offline.keepsEdit, true);
  assert.equal(offline.retryable, true);
  // Nothing here claims offline support: the promise is only that the edit survives and the retry is safe.
  assert.equal(/saved offline|will sync|queued/i.test(offline.message), false);
});

test("a conflict keeps the edit but is not retryable, and a closed booking is neither", () => {
  const conflict = cateringExecutionFailureNotice({ message: "This execution record changed", code: CATERING_EXECUTION_VERSION_CONFLICT_CODE });
  assert.equal(conflict.keepsEdit, true);
  assert.equal(conflict.retryable, false, "retrying the same stale base would overwrite the newer version");
  const closed = cateringExecutionFailureNotice({ message: "Cancelled and completed bookings are read-only", code: CATERING_WORKSPACE_READ_ONLY_CODE });
  assert.equal(closed.retryable, false);
  assert.equal(closed.keepsEdit, false, "a read-only booking refuses every write, so no draft may stay open");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Idempotency tokens
 * ------------------------------------------------------------------------------------------------------------- */

test("a draft mints its token once and keeps it across a failed attempt", () => {
  let minted = 0;
  const mint = () => `token-${++minted}`;
  const first = withCateringRequestId(EMPTY_CATERING_TIMELINE_DRAFT, mint);
  assert.equal(first.requestId, "token-1");
  // The retry after a failure reuses the SAME token, which is what makes a request that actually arrived resolve to
  // the record it already created rather than adding a second one.
  const retry = withCateringRequestId(first, mint);
  assert.equal(retry.requestId, "token-1");
  assert.equal(minted, 1);
  assert.equal(retry, first, "an unchanged draft is not even reallocated");
});

test("an accepted submit resets the draft and spends its token", () => {
  const used = withCateringRequestId(EMPTY_CATERING_TIMELINE_DRAFT, () => "token-1");
  const reset = resetCateringDraft(EMPTY_CATERING_TIMELINE_DRAFT);
  assert.equal(reset.requestId, null, "reusing a spent token would resolve to the record just created");
  assert.notEqual(used.requestId, reset.requestId);
  assert.equal(resetCateringDraft(EMPTY_CATERING_STAFF_DRAFT).requestId, null);
  assert.equal(resetCateringDraft(EMPTY_CATERING_EQUIPMENT_DRAFT).requestId, null);
});

test("a payload carries its token only when one has been minted", () => {
  assert.equal("clientRequestId" in cateringTimelineCreatePayload({ ...EMPTY_CATERING_TIMELINE_DRAFT, title: "x" }), false);
  const withToken = cateringTimelineCreatePayload({ ...EMPTY_CATERING_TIMELINE_DRAFT, title: "x", requestId: "token-1" });
  assert.equal(withToken.clientRequestId, "token-1");
  assert.equal(cateringStaffCreatePayload({ ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada", requestId: "t" }).clientRequestId, "t");
  assert.equal(cateringEquipmentCreatePayload({ ...EMPTY_CATERING_EQUIPMENT_DRAFT, name: "Chafer", requestId: "t" }).clientRequestId, "t");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Payloads
 * ------------------------------------------------------------------------------------------------------------- */

test("an empty input means 'not set', which the API spells null", () => {
  assert.equal(optionalText(""), null);
  assert.equal(optionalText("   "), null);
  assert.equal(optionalText("  Rear dock "), "Rear dock");
  const payload = cateringTimelineCreatePayload({ ...EMPTY_CATERING_TIMELINE_DRAFT, title: "  Load in  " });
  assert.equal(payload.title, "Load in");
  assert.equal(payload.description, null);
  assert.equal(payload.scheduledTime, null);
});

test("a custom crew label is dropped unless the role is actually custom", () => {
  const listed = cateringStaffCreatePayload({ ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada", role: "chef", customRole: "Pastry lead" });
  assert.equal(listed.customRole, null, "a listed role must not carry a conflicting label");
  const custom = cateringStaffCreatePayload({ ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada", role: "custom", customRole: "Pastry lead" });
  assert.equal(custom.customRole, "Pastry lead");
});

test("no create payload names an actor, an owner, an id or a position", () => {
  const payloads: Record<string, unknown>[] = [
    cateringTimelineCreatePayload({ ...EMPTY_CATERING_TIMELINE_DRAFT, title: "x", requestId: "t" }),
    cateringStaffCreatePayload({ ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada", requestId: "t" }),
    cateringEquipmentCreatePayload({ ...EMPTY_CATERING_EQUIPMENT_DRAFT, name: "Chafer", requestId: "t" }),
  ];
  for (const payload of payloads) {
    for (const field of ["providerId", "customerId", "bookingId", "createdBy", "completedBy", "id", "sortOrder", "role" in payload ? "userId" : "role"]) {
      assert.equal(field in payload, false, `${JSON.stringify(Object.keys(payload))} carried ${field}`);
    }
  }
});

test("every update and delete payload carries the version it was based on", () => {
  const target = item("a", V1);
  assert.deepEqual(cateringTimelineDeletePayload(target), { expectedUpdatedAt: V1 });
  assert.deepEqual(cateringExecutionDeletePayload({ updatedAt: V1 }), { expectedUpdatedAt: V1 });
  assert.deepEqual(cateringTimelineCompletionPayload(target), { completed: true, expectedUpdatedAt: V1 });
  assert.deepEqual(cateringTimelineCompletionPayload({ ...target, completed: true }), { completed: false, expectedUpdatedAt: V1 });
  assert.equal(cateringTimelineEditPayload(cateringTimelineEditorFor(target, "me:b1")).expectedUpdatedAt, V1);
});

test("quantity is checked before a round trip as well as by the server and the database", () => {
  for (const quantity of ["1", "9999", "42"]) assert.equal(cateringEquipmentQuantityIsValid(quantity), true, quantity);
  for (const quantity of ["0", "-1", "10000", "1.5", "", "abc"]) assert.equal(cateringEquipmentQuantityIsValid(quantity), false, quantity);
  assert.equal(maySubmitCateringEquipmentDraft({ ...EMPTY_CATERING_EQUIPMENT_DRAFT, name: "Chafer", quantity: "0" }, true, false), false);
  assert.equal(maySubmitCateringEquipmentDraft({ ...EMPTY_CATERING_EQUIPMENT_DRAFT, name: "Chafer" }, true, false), true);
});

test("a control is disabled while a request is in flight, and on a read-only booking", () => {
  const draft: CateringTimelineDraft = { ...EMPTY_CATERING_TIMELINE_DRAFT, title: "Load in" };
  assert.equal(maySubmitCateringTimelineDraft(draft, true, false), true);
  assert.equal(maySubmitCateringTimelineDraft(draft, true, true), false, "pending");
  assert.equal(maySubmitCateringTimelineDraft(draft, false, false), false, "read-only");
  assert.equal(maySubmitCateringTimelineDraft(EMPTY_CATERING_TIMELINE_DRAFT, true, false), false, "empty title");
  // A crew assignment additionally needs its custom role named, when the role is custom.
  assert.equal(maySubmitCateringStaffDraft({ ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada", role: "custom" }, true, false), false);
  assert.equal(maySubmitCateringStaffDraft({ ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada", role: "custom", customRole: "Pastry lead" }, true, false), true);
  assert.equal(maySubmitCateringStaffDraft({ ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada" }, true, true), false, "pending");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The item editor
 * ------------------------------------------------------------------------------------------------------------- */

test("an editor opens from the item's authoritative version and edits only its own item", () => {
  const editor = cateringTimelineEditorFor(item("a", V1, { title: "Load in", visibility: "shared" }), "me:b1");
  assert.equal(editor.expectedUpdatedAt, V1);
  assert.equal(editor.draft.title, "Load in");
  assert.equal(editor.draft.visibility, "shared");
  assert.equal(editor.conflict, false);
  // A field edit aimed at another item, or another booking, is ignored rather than applied to the open one.
  assert.equal(editCateringTimelineEditorField(editor, "me:b1", "b", "title", "x")?.draft.title, "Load in");
  assert.equal(editCateringTimelineEditorField(editor, "other:b2", "a", "title", "x")?.draft.title, "Load in");
  assert.equal(editCateringTimelineEditorField(editor, "me:b1", "a", "title", "x")?.draft.title, "x");
});

test("a refused save marks the editor rather than closing it, so nothing typed is discarded", () => {
  const editor = cateringTimelineEditorFor(item("a", V1), "me:b1");
  const edited = editCateringTimelineEditorField(editor, "me:b1", "a", "title", "Renamed by me")!;
  const conflicted = markCateringTimelineEditorConflict(edited, "a")!;
  assert.equal(conflicted.conflict, true);
  assert.equal(conflicted.draft.title, "Renamed by me", "the participant's words survive the refusal");
  // And saving is refused until they reload, because saving would overwrite the newer version with an older base.
  assert.equal(maySubmitCateringTimelineEditor(conflicted, true, false), false);
  assert.equal(maySubmitCateringTimelineEditor(edited, true, false), true);
  // A conflict on a different item leaves this editor alone.
  assert.equal(markCateringTimelineEditorConflict(edited, "b")!.conflict, false);
});

test("conflict recovery waits for a genuinely newer version before offering a reload", () => {
  const conflicted = markCateringTimelineEditorConflict(cateringTimelineEditorFor(item("a", V1), "me:b1"), "a")!;
  // The refetch has not landed yet: the collection still holds the very version the server refused.
  assert.equal(mayReloadCateringTimelineEditor(conflicted, "me:b1", [item("a", V1)]), false);
  assert.equal(mayReloadCateringTimelineEditor(conflicted, "me:b1", [item("a", V2)]), true);
  // An item that has since been deleted offers no reload either.
  assert.equal(mayReloadCateringTimelineEditor(conflicted, "me:b1", []), false);
  // And an editor with no conflict never offers one.
  assert.equal(mayReloadCateringTimelineEditor(cateringTimelineEditorFor(item("a", V1), "me:b1"), "me:b1", [item("a", V2)]), false);
});

test("an editor closes when its item is gone, when the booking closes, or on another booking", () => {
  const editor = cateringTimelineEditorFor(item("a", V1), "me:b1");
  assert.equal(reconcileCateringTimelineEditor(editor, "me:b1", true, ["a", "b"]), editor);
  assert.equal(reconcileCateringTimelineEditor(editor, "me:b1", true, ["b"]), null, "another tab deleted it");
  assert.equal(reconcileCateringTimelineEditor(editor, "me:b1", false, ["a"]), null, "the booking became terminal");
  assert.equal(reconcileCateringTimelineEditor(editor, "other:b2", true, ["a"]), null, "a different booking");
  assert.equal(reconcileCateringTimelineEditor(null, "me:b1", true, ["a"]), null);
});

test("an editor is only active on its own booking, its own item, and an editable section", () => {
  const editor = cateringTimelineEditorFor(item("a", V1), "me:b1");
  assert.equal(activeCateringTimelineEditor(editor, "me:b1", "a", true), editor);
  assert.equal(activeCateringTimelineEditor(editor, "me:b1", "b", true), null);
  assert.equal(activeCateringTimelineEditor(editor, "other:b2", "a", true), null);
  assert.equal(activeCateringTimelineEditor(editor, "me:b1", "a", false), null);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Reordering
 * ------------------------------------------------------------------------------------------------------------- */

const three = [item("a", V1), item("b", V1), item("c", V1)];

test("a move produces the requested order, and nothing at all at the ends", () => {
  assert.deepEqual(moveCateringTimelineItem(three, "b", "up")!.map((entry) => entry.id), ["b", "a", "c"]);
  assert.deepEqual(moveCateringTimelineItem(three, "b", "down")!.map((entry) => entry.id), ["a", "c", "b"]);
  assert.equal(moveCateringTimelineItem(three, "a", "up"), null, "no request is sent for a no-op");
  assert.equal(moveCateringTimelineItem(three, "c", "down"), null);
  assert.equal(moveCateringTimelineItem(three, "missing", "up"), null);
  // The input is not mutated: the caller's authoritative list survives the computation.
  assert.deepEqual(three.map((entry) => entry.id), ["a", "b", "c"]);
});

test("a reorder submits the complete set with each item's observed version", () => {
  const payload = cateringTimelineReorderPayload(moveCateringTimelineItem(three, "c", "up")!);
  assert.deepEqual(payload, { items: [{ id: "a", expectedUpdatedAt: V1 }, { id: "c", expectedUpdatedAt: V1 }, { id: "b", expectedUpdatedAt: V1 }] });
  // No sort order is submitted: the array position IS the requested order, and the server assigns from it.
  for (const entry of payload.items) assert.deepEqual(Object.keys(entry).sort(), ["expectedUpdatedAt", "id"]);
});

test("move controls are offered only where a reorder could actually succeed", () => {
  const state = { role: "provider" as const, editable: true, editorOpen: false, pending: false };
  assert.deepEqual(cateringTimelineReorderControls(three, "a", state), { up: false, down: true });
  assert.deepEqual(cateringTimelineReorderControls(three, "b", state), { up: true, down: true });
  assert.deepEqual(cateringTimelineReorderControls(three, "c", state), { up: true, down: false });
  assert.equal(cateringTimelineReorderControls(three, "a", { ...state, role: "customer" }), null);
  assert.equal(cateringTimelineReorderControls(three, "a", { ...state, editable: false }), null);
  // An open editor holds a version a reorder would immediately invalidate, so moving while editing is not offered.
  assert.equal(cateringTimelineReorderControls(three, "a", { ...state, editorOpen: true }), null);
  assert.deepEqual(cateringTimelineReorderControls(three, "b", { ...state, pending: true }), { up: false, down: false });
  assert.equal(cateringTimelineReorderControls([item("a", V1)], "a", state), null, "nothing to reorder");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The access form
 * ------------------------------------------------------------------------------------------------------------- */

const access: CateringExecutionAccessView = {
  loadInEntrance: "Rear dock", loadingDockNotes: null, elevatorNotes: null, kitchenAccessNotes: null,
  parkingInstructions: "Two bays", securityCheckInNotes: null, accessWindowStart: "06:00", accessWindowEnd: "23:00",
  venueContactName: "Sam", venueContactPhone: "555-0100", venueContactSource: "customer",
  powerWaterNotes: null, trashRemovalNotes: null, specialRestrictions: null, accessConfirmed: true, updatedAt: V1,
  providerPrivateNotes: "Site manager is unreliable",
};

test("the access form hydrates from the authoritative record, version included", () => {
  const draft = cateringAccessDraftFrom(access);
  assert.equal(draft.loadInEntrance, "Rear dock");
  assert.equal(draft.providerPrivateNotes, "Site manager is unreliable");
  assert.equal(draft.venueContactSource, "customer");
  assert.equal(draft.accessConfirmed, true);
  assert.equal(draft.expectedUpdatedAt, V1);
  // A customer's object has no private key at all, and hydrating from it produces an empty field rather than throwing.
  const { providerPrivateNotes: _omitted, ...customerView } = access;
  assert.equal(cateringAccessDraftFrom(customerView as CateringExecutionAccessView).providerPrivateNotes, "");
});

test("a poll never overwrites an edit in progress", () => {
  const clean: CateringAccessFormState = { identity: "me:b1", value: cateringAccessDraftFrom(access), dirty: false };
  const edited = editCateringAccessField(clean, "parkingInstructions", "Three bays");
  assert.equal(edited.dirty, true);
  const polled = cateringAccessDraftFrom({ ...access, parkingInstructions: "Somebody else's value", updatedAt: V2 });
  assert.equal(hydrateCateringAccessForm(edited, "me:b1", polled).value?.parkingInstructions, "Three bays");
  // A clean form does hydrate, and a different booking always replaces the form outright.
  assert.equal(hydrateCateringAccessForm(clean, "me:b1", polled).value?.parkingInstructions, "Somebody else's value");
  assert.equal(hydrateCateringAccessForm(edited, "other:b2", polled).value?.parkingInstructions, "Somebody else's value");
});

test("a failed save keeps the unsaved instructions and their dirty flag", () => {
  const edited = editCateringAccessField({ identity: "me:b1", value: cateringAccessDraftFrom(access), dirty: false }, "parkingInstructions", "Three bays");
  const preserved = preserveCateringAccessForm(edited);
  assert.equal(preserved.value?.parkingInstructions, "Three bays");
  assert.equal(preserved.dirty, true, "so the next poll still cannot replace it");
});

test("an accepted save re-bases the form on the authoritative response, including its new version", () => {
  const edited = editCateringAccessField({ identity: "me:b1", value: cateringAccessDraftFrom(access), dirty: false }, "parkingInstructions", "Three bays");
  const settled = settleCateringAccessForm(edited, "me:b1", { ...access, parkingInstructions: "Three bays", updatedAt: V2 });
  assert.equal(settled.dirty, false);
  assert.equal(settled.value?.expectedUpdatedAt, V2, "the next save is judged against the version just written");
  // A response for a different booking never re-bases this form.
  assert.equal(settleCateringAccessForm(edited, "other:b2", access).value?.parkingInstructions, "Three bays");
});

test("an access save omits its version only when no record existed, which is a different assertion from null", () => {
  const draft = cateringAccessDraftFrom(access);
  assert.equal(cateringAccessSavePayload(draft).expectedUpdatedAt, V1);
  const fresh = cateringAccessDraftFrom({ ...access, updatedAt: null });
  assert.equal("expectedUpdatedAt" in cateringAccessSavePayload(fresh), false);
});

test("the access payload sends nulls for cleared fields and never an authoritative location value", () => {
  const cleared = { ...cateringAccessDraftFrom(access), parkingInstructions: "   ", venueContactSource: "" as const };
  const payload = cateringAccessSavePayload(cleared);
  assert.equal(payload.parkingInstructions, null);
  assert.equal(payload.venueContactSource, null);
  assert.equal(payload.accessConfirmed, true);
  for (const field of ["venueAddress", "venueCity", "eventDate", "guestCount", "bookingId", "updatedBy"]) {
    assert.equal(field in payload, false, field);
  }
  // Exactly the contract's field set, and nothing else.
  assert.deepEqual(Object.keys(payload).sort(), [...CATERING_ACCESS_TEXT_FIELDS, "accessConfirmed", "expectedUpdatedAt", "venueContactSource"].sort());
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Presentation
 * ------------------------------------------------------------------------------------------------------------- */

test("only a provider is offered a visibility choice", () => {
  assert.deepEqual(cateringExecutionVisibilityChoices("customer"), []);
  assert.deepEqual(cateringExecutionVisibilityChoices("provider").map((choice) => choice.value), ["provider_private", "shared"]);
});

test("splitting a collection shows the provider what the customer is reading", () => {
  const items = [item("a", V1, { visibility: "shared" }), item("b", V1)];
  assert.deepEqual(splitCateringTimeline(items).shared.map((entry) => entry.id), ["a"]);
  assert.deepEqual(splitCateringTimeline(items).providerPrivate.map((entry) => entry.id), ["b"]);
  // A customer's payload holds shared records only, so for them the private list is always empty -- the split is
  // not what enforces privacy, the server's SQL filter is.
  assert.deepEqual(splitCateringTimeline([items[0]]).providerPrivate, []);
  assert.deepEqual(splitCateringEquipment([{ visibility: "shared" }, { visibility: "provider_private" }] as never).shared.length, 1);
});

test("readiness badges are derived from the state alone", () => {
  assert.equal(cateringReadinessVariant("ready"), "default");
  assert.equal(cateringReadinessVariant("needs_attention"), "secondary");
  assert.equal(cateringReadinessVariant("blocked"), "destructive");
});

test("an unscheduled item says so rather than rendering an empty range", () => {
  assert.equal(formatCateringTimelineWindow(null, null), "Unscheduled");
  assert.equal(formatCateringTimelineWindow("07:00", "08:30"), "07:00–08:30");
  assert.equal(formatCateringTimelineWindow("07:00", null), "07:00");
  assert.equal(formatCateringTimelineWindow(null, "08:30"), "until 08:30");
  assert.equal(formatCateringEquipmentWindow(null, null), null);
  assert.equal(formatCateringEquipmentWindow("2026-09-07", "16:00"), "2026-09-07 16:00");
  assert.equal(formatCateringEquipmentWindow("2026-09-07", null), "2026-09-07");
});

test("a crew member is labelled by their allowlisted role, or by the custom label the row carries", () => {
  assert.equal(cateringStaffRoleLabel({ role: "chef", customRole: null }, CATERING_STAFF_ROLE_LABELS), "Chef");
  assert.equal(cateringStaffRoleLabel({ role: "custom", customRole: "Pastry lead" }, CATERING_STAFF_ROLE_LABELS), "Pastry lead");
  assert.equal(cateringStaffRoleLabel({ role: "custom", customRole: null }, CATERING_STAFF_ROLE_LABELS), "Custom role");
});
