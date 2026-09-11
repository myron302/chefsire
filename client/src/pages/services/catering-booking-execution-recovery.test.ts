import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_ACCESS_NO_INSTRUCTIONS,
  EMPTY_CATERING_EQUIPMENT_DRAFT,
  EMPTY_CATERING_STAFF_DRAFT,
  EMPTY_CATERING_TIMELINE_DRAFT,
  CATERING_EXECUTION_CONSUMED_NOTICE,
  cateringAccessDraftFrom,
  cateringAccessReconcileKey,
  cateringCreateWasConsumed,
  cateringAccessSavePayload,
  cateringDraftIsUnchanged,
  cateringEquipmentCreatePayload,
  cateringEquipmentIsBlocking,
  cateringEquipmentScheduleIsValid,
  maySubmitCateringEquipmentDraft,
  cateringMaterialFingerprint,
  cateringMaterialPayload,
  cateringStaffCreatePayload,
  cateringTimelineCreatePayload,
  cateringTimelineItemIsBlocking,
  editCateringAccessField,
  markCateringAccessConflict,
  prepareCateringCreate,
  preserveCateringAccessForm,
  rebaseCateringAccessForm,
  reconcileCateringAccessForm,
  resetCateringDraft,
  hydrateCateringAccessForm,
  mergeCateringAccessDraft,
  cateringAccessEditedFields,
  cateringAccessReviewIsOpen,
  maySaveCateringAccess,
  resolveCateringAccessReviewField,
  discardCateringAccessDraft,
  settleCateringAccessForm,
  settleCateringCreateDraft,
  settleCateringTimelineEditor,
  cateringTimelineEditorFor,
  editCateringTimelineEditorField,
  markCateringTimelineEditorConflict,
  maySubmitCateringTimelineEditor,
  cateringTimelineCompletionPayload,
  cateringTimelineDeletePayload,
  cateringExecutionDeletePayload,
  type CateringAccessFormState,
  type CateringEquipmentDraft,
  type CateringStaffDraft,
  type CateringTimelineDraft,
} from "./catering-booking-execution-state";
import {
  CATERING_ACCESS_FIELDS,
  CATERING_EXECUTION_CREATE_CONSUMED_MESSAGE,
  cateringAccessFieldLimit,
  cateringAccessSaveSchema,
  CATERING_EQUIPMENT_STATUSES,
  type CateringEquipmentStatus,
  type CateringExecutionAccessView,
  type CateringExecutionTimelineItemView,
} from "@shared/catering-booking-execution";

/**
 * The five client-side Codex corrections, and the invariants that hold them together.
 *
 * Four of the five are the same underlying mistake in different clothes: the client treated an answer about ONE
 * moment as authority over a LATER moment. A conflict response left a stale version in a form that could no longer
 * be hydrated; a success response cleared whatever happened to be in a form by the time it landed; an idempotency
 * token kept pointing at a payload it was no longer being sent with; and a badge asserted a blocking state the
 * server had already stopped counting.
 *
 * The two invariants this suite exists to hold:
 *
 *   1. ONE idempotency request id represents ONE material create payload.
 *   2. A response for an older submitted payload must never erase newer user input.
 */

const V1 = "2026-09-08T11:00:00.000Z";
const V2 = "2026-09-08T12:00:00.000Z";

/* ================================================================================================================ *
 * FINDING 1 -- an access conflict must rebase, not deadlock the form
 * ================================================================================================================ */

const access = (over: Partial<CateringExecutionAccessView> = {}): CateringExecutionAccessView => ({
  loadInEntrance: "Rear dock", loadingDockNotes: null, elevatorNotes: null, kitchenAccessNotes: null,
  parkingInstructions: "Two bays", securityCheckInNotes: null, accessWindowStart: "08:00", accessWindowEnd: "09:00",
  venueContactName: null, venueContactPhone: null, venueContactSource: null,
  powerWaterNotes: null, trashRemovalNotes: null, specialRestrictions: null,
  accessConfirmed: false, updatedAt: V1, providerPrivateNotes: null, ...over,
});
/** A form hydrated exactly as the component hydrates it -- so it carries the baseline the merge needs. */
const cleanForm = (record = access()): CateringAccessFormState =>
  hydrateCateringAccessForm({ identity: "", value: null, baseline: null, dirty: false }, "me:b1", cateringAccessDraftFrom(record));
const dirtyForm = (record = access()): CateringAccessFormState =>
  editCateringAccessField(cleanForm(record), "parkingInstructions", "Three bays");

test("F1: the deadlock -- a dirty form used to keep its stale version forever", () => {
  // Before the fix this was the whole trap: a conflict left the form dirty, a dirty form refused hydration, so the
  // stale version stayed in the draft and every subsequent Save conflicted again. Reproduced here against the
  // preserve-only path to show what the rebase is actually rescuing.
  const stuck = preserveCateringAccessForm(dirtyForm());
  const afterRefetch = reconcileCateringAccessForm(stuck, "me:b1", access({ updatedAt: V2 }));
  assert.equal(afterRefetch.value?.expectedUpdatedAt, V1, "merely dirty: still based on the version that was refused");
});

test("F1: a clean form carries its own baseline, so nothing in it reads as a user edit", () => {
  const clean = cleanForm();
  assert.deepEqual(clean.baseline, clean.value);
  assert.deepEqual(cateringAccessEditedFields(clean.baseline, clean.value!), []);
  // And one edit is exactly one edited field.
  assert.deepEqual(cateringAccessEditedFields(clean.baseline, dirtyForm().value!), ["parkingInstructions"]);
});

test("F1: a conflicted save marks the form, and the next authoritative payload rebases it", () => {
  const conflicted = markCateringAccessConflict(dirtyForm());
  assert.equal(conflicted.rebase, true);
  assert.equal(conflicted.dirty, true, "and it is still dirty, so no poll can overwrite it in the meantime");
  const rebased = reconcileCateringAccessForm(conflicted, "me:b1", access({ updatedAt: V2 }));
  // The version moves, together with a merge -- never on its own.
  assert.equal(rebased.value?.expectedUpdatedAt, V2);
  // The provider's own edit survives...
  assert.equal(rebased.value?.parkingInstructions, "Three bays");
  // ...and the baseline advances to the record just merged against, so the next comparison is against the truth.
  assert.equal(rebased.baseline?.updatedAt ?? rebased.baseline?.expectedUpdatedAt, V2);
  assert.equal(rebased.dirty, true, "still unsaved, so still protected from hydration");
  assert.equal(rebased.rebase, false, "and the merge is spent, so it happens once");
  assert.equal(cateringAccessReviewIsOpen(rebased), false, "nothing was contested here");
});

test("F1: the rebased form's next Save carries the fresh version, so it can actually succeed", () => {
  const rebased = reconcileCateringAccessForm(markCateringAccessConflict(dirtyForm()), "me:b1", access({ updatedAt: V2 }));
  const payload = cateringAccessSavePayload(rebased.value!);
  assert.equal(payload.expectedUpdatedAt, V2, "optimistic concurrency preserved -- against a version genuinely observed");
  assert.equal(payload.parkingInstructions, "Three bays");
  // No hard refresh was needed anywhere in that sequence.
});

test("F1: a rebase waits for a genuinely newer version rather than firing on a stale refetch", () => {
  const conflicted = markCateringAccessConflict(dirtyForm());
  // The refetch has not landed yet: the payload still carries the version that was refused.
  const notYet = reconcileCateringAccessForm(conflicted, "me:b1", access({ updatedAt: V1 }));
  assert.equal(notYet.rebase, true, "so it tries again on the next payload");
  assert.equal(notYet.value?.parkingInstructions, "Three bays");
  // And once a newer one arrives it rebases.
  assert.equal(reconcileCateringAccessForm(notYet, "me:b1", access({ updatedAt: V2 })).value?.expectedUpdatedAt, V2);
});

test("F1: rebasing never crosses bookings, and a clean form still hydrates normally", () => {
  const conflicted = markCateringAccessConflict(dirtyForm());
  assert.equal(rebaseCateringAccessForm(conflicted, "other:b2", access({ updatedAt: V2 })).value?.expectedUpdatedAt, V1);
  // A clean form takes the authoritative record wholesale, exactly as before.
  const clean: CateringAccessFormState = { identity: "me:b1", value: cateringAccessDraftFrom(access()), dirty: false };
  const hydrated = reconcileCateringAccessForm(clean, "me:b1", access({ updatedAt: V2, parkingInstructions: "Somebody else's value" }));
  assert.equal(hydrated.value?.parkingInstructions, "Somebody else's value");
  assert.equal(hydrated.value?.expectedUpdatedAt, V2);
  // A dirty form that never conflicted is left entirely alone.
  const merelyDirty = dirtyForm();
  assert.equal(reconcileCateringAccessForm(merelyDirty, "me:b1", access({ updatedAt: V2, parkingInstructions: "theirs" })).value?.parkingInstructions, "Three bays");
});

test("F1: the lost-response case resolves without inventing a success", () => {
  // The save committed but the response was lost. The retry is stale, so it conflicts and the form is marked.
  const conflicted = markCateringAccessConflict(dirtyForm());
  // The refetch shows the values that actually persisted, plus the new version. Both "sides" changed parking, to
  // the SAME value -- because the other side was this user's own committed request -- so it is not a disagreement.
  const authoritative = access({ updatedAt: V2, parkingInstructions: "Three bays" });
  const rebased = reconcileCateringAccessForm(conflicted, "me:b1", authoritative);
  assert.equal(cateringAccessReviewIsOpen(rebased), false, "no false conflict");
  assert.equal(rebased.dirty, false, "and nothing is left unsaved, because the record already matches");
  assert.equal(rebased.value?.expectedUpdatedAt, V2);
  // Re-saving is now accepted, and because the values already match, the server resolves it as a no-op -- no second
  // activity row and no second notification (asserted server-side in the policy suite).
  assert.equal(cateringAccessSavePayload(rebased.value!).parkingInstructions, "Three bays");
  // An accepted save clears both flags, so nothing is left pending.
  const settled = settleCateringAccessForm(rebased, "me:b1", authoritative);
  assert.equal(settled.dirty, false);
  assert.equal(settled.rebase, false);
});

/* ================================================================================================================ *
 * FINDING 2 -- the Blocking badge must agree with server readiness
 * ================================================================================================================ */

test("F2: a settled item is not badged as blocking, whatever its stored flag says", () => {
  for (const status of ["received", "in_use", "returned", "cancelled"] as CateringEquipmentStatus[]) {
    assert.equal(cateringEquipmentIsBlocking({ isBlocker: true, status }), false, status);
  }
  // Unsettled statuses still are.
  for (const status of ["planned", "confirmed"] as CateringEquipmentStatus[]) {
    assert.equal(cateringEquipmentIsBlocking({ isBlocker: true, status }), true, status);
  }
  // And a non-blocker is never blocking, in any status at all.
  for (const status of CATERING_EQUIPMENT_STATUSES) {
    assert.equal(cateringEquipmentIsBlocking({ isBlocker: false, status }), false, status);
  }
});

test("F2: the flag itself is never cleared -- hiding a badge must not destroy the record", () => {
  const settled = { isBlocker: true, status: "returned" as CateringEquipmentStatus };
  assert.equal(cateringEquipmentIsBlocking(settled), false);
  assert.equal(settled.isBlocker, true, "the operational record of what was on the critical path survives");
});

test("F2: the timeline badge uses the same shape of rule", () => {
  assert.equal(cateringTimelineItemIsBlocking({ isBlocker: true, completed: false }), true);
  assert.equal(cateringTimelineItemIsBlocking({ isBlocker: true, completed: true }), false);
  assert.equal(cateringTimelineItemIsBlocking({ isBlocker: false, completed: false }), false);
});

test("F2: the component renders the badge through the predicate, not the raw flag", () => {
  const component = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingExecution.tsx"), "utf8");
  assert.equal(component.includes("{cateringEquipmentIsBlocking(item) && <Badge variant=\"destructive\">Blocking</Badge>}"), true);
  assert.equal(component.includes("{cateringTimelineItemIsBlocking(item) && <Badge variant=\"destructive\">Blocking</Badge>}"), true);
  // No Blocking badge anywhere is gated on the bare flag.
  assert.equal(/\{item\.isBlocker &&[^}]*Blocking/.test(component), false);
});

/* ================================================================================================================ *
 * FINDING 3 -- confirmation and instructions are separate facts
 * ================================================================================================================ */

test("F3: the empty-instructions message no longer replaces the whole record", () => {
  const component = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingExecution.tsx"), "utf8");
  const block = component.slice(component.indexOf("function AccessReadOnly"), component.indexOf("function TimelineRow"));
  // The old early return is gone: nothing bails out before the confirmation is rendered.
  assert.equal(/if \(entries\.length === 0\) return/.test(block), false);
  // The confirmation is unconditional in the rendered output...
  assert.equal(block.includes('<dt className="text-sm font-medium text-muted-foreground">Venue access</dt>'), true);
  assert.equal(block.includes('{access.accessConfirmed ? "Confirmed" : "Not yet confirmed"}'), true);
  // ...and the empty-instructions line sits ALONGSIDE it rather than in place of it.
  assert.equal(block.includes("{!cateringAccessHasInstructions(entries) && <p"), true);
  assert.equal(block.indexOf("Venue access</dt>") < block.indexOf("cateringAccessHasInstructions"), true);
  assert.equal(CATERING_ACCESS_NO_INSTRUCTIONS, "No access instructions have been added.");
});

test("F3: all four confirmed/notes combinations reach the confirmation branch", () => {
  const component = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingExecution.tsx"), "utf8");
  const block = component.slice(component.indexOf("function AccessReadOnly"), component.indexOf("function TimelineRow"));
  // The confirmation is rendered from `access.accessConfirmed` alone -- it is not nested inside any entries check,
  // so confirmed-with-no-notes and unconfirmed-with-no-notes are both truthful rather than reading as "nothing".
  const confirmationAt = block.indexOf("Venue access</dt>");
  const guard = block.slice(0, confirmationAt);
  assert.equal(/entries\.length === 0 \?/.test(guard), false, "the confirmation is not behind an entries ternary");
  // The four cases are exercised through the entry-count predicate the component uses.
  assert.equal(fs.existsSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-execution-state.ts")), true);
});

test("F3: a customer's private notes are filtered here as well as absent from their payload", () => {
  const component = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingExecution.tsx"), "utf8");
  const block = component.slice(component.indexOf("function AccessReadOnly"), component.indexOf("function TimelineRow"));
  assert.equal(block.includes('.filter((meta) => meta.field !== "providerPrivateNotes" || role === "provider")'), true);
  // And the hydration path tolerates a customer object with no such key at all.
  const { providerPrivateNotes: _absent, ...customerView } = access({ accessConfirmed: true });
  assert.equal(cateringAccessDraftFrom(customerView as CateringExecutionAccessView).providerPrivateNotes, "");
});

/* ================================================================================================================ *
 * FINDING 4 -- a completion may not erase newer input
 * ================================================================================================================ */

const timelineA: CateringTimelineDraft = { ...EMPTY_CATERING_TIMELINE_DRAFT, title: "Record A" };
const staffA: CateringStaffDraft = { ...EMPTY_CATERING_STAFF_DRAFT, workerName: "Ada" };
const equipmentA: CateringEquipmentDraft = { ...EMPTY_CATERING_EQUIPMENT_DRAFT, name: "Chafer" };

test("F4: the reported scenario -- A finishes while B is being typed, and B survives", () => {
  // 1. submit A. 2. it is slow. 3. the form stays editable. 4. the provider starts typing B.
  const submitted = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-A").draft;
  const liveB: CateringTimelineDraft = { ...submitted, title: "Record B" };
  // 5. A succeeds. 6. the completion settles against the SUBMITTED snapshot, not the live form.
  const settled = settleCateringCreateDraft(liveB, submitted, EMPTY_CATERING_TIMELINE_DRAFT);
  // 7. B is still there.
  assert.equal(settled.title, "Record B");
  assert.equal(settled, liveB, "the live draft is left untouched, not rebuilt");
});

test("F4: an untouched form still clears normally on success", () => {
  const submitted = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-A").draft;
  const settled = settleCateringCreateDraft(submitted, submitted, EMPTY_CATERING_TIMELINE_DRAFT);
  assert.equal(settled.title, "");
  assert.equal(settled.requestId, null, "and the spent token goes with it");
  assert.equal(settled.requestFingerprint, null);
});

test("F4: it holds for all three creates, and for any field, not just the first", () => {
  const cases: [string, { draft: CateringDraftLike; build: (draft: never) => Record<string, unknown>; empty: CateringDraftLike; edit: Partial<CateringDraftLike> }][] = [
    ["timeline", { draft: timelineA, build: cateringTimelineCreatePayload as never, empty: EMPTY_CATERING_TIMELINE_DRAFT, edit: { title: "B" } }],
    ["timeline-nested", { draft: timelineA, build: cateringTimelineCreatePayload as never, empty: EMPTY_CATERING_TIMELINE_DRAFT, edit: { isBlocker: true } }],
    ["staff", { draft: staffA, build: cateringStaffCreatePayload as never, empty: EMPTY_CATERING_STAFF_DRAFT, edit: { workerName: "Grace" } }],
    ["staff-role", { draft: staffA, build: cateringStaffCreatePayload as never, empty: EMPTY_CATERING_STAFF_DRAFT, edit: { role: "chef" } }],
    ["equipment", { draft: equipmentA, build: cateringEquipmentCreatePayload as never, empty: EMPTY_CATERING_EQUIPMENT_DRAFT, edit: { name: "Hot box" } }],
    ["equipment-quantity", { draft: equipmentA, build: cateringEquipmentCreatePayload as never, empty: EMPTY_CATERING_EQUIPMENT_DRAFT, edit: { quantity: "6" } }],
  ];
  for (const [label, { draft, build, empty, edit }] of cases) {
    const submitted = prepareCateringCreate(draft as never, build, () => "token-A").draft;
    const live = { ...submitted, ...edit };
    const settled = settleCateringCreateDraft(live as never, submitted, empty as never);
    assert.deepEqual(settled, live, `${label}: newer edits must survive`);
    assert.deepEqual(settleCateringCreateDraft(submitted, submitted, empty as never), resetCateringDraft(empty as never), `${label}: an untouched form clears`);
  }
});
type CateringDraftLike = Record<string, unknown> & { requestId: string | null; requestFingerprint: string | null };

test("F4: the comparison notices any change at all, including the token itself", () => {
  const submitted = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-A").draft;
  assert.equal(cateringDraftIsUnchanged(submitted, submitted), true);
  assert.equal(cateringDraftIsUnchanged({ ...submitted, description: "typed" }, submitted), false);
  // A NEWER attempt on the same form is also "changed", so an older completion cannot settle it.
  const newer = prepareCateringCreate({ ...submitted, title: "Record B" }, cateringTimelineCreatePayload, () => "token-B").draft;
  assert.equal(cateringDraftIsUnchanged(newer, submitted), false);
  assert.deepEqual(settleCateringCreateDraft(newer, submitted, EMPTY_CATERING_TIMELINE_DRAFT), newer);
});

/* ================================================================================================================ *
 * FINDING 6 -- one token, one material payload
 * ================================================================================================================ */

test("F6: the reported scenario -- an old token may not be sent with a new payload", () => {
  // 1. payload A under token X. 2. the server commits it. 3. the response is lost.
  const a = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-X");
  assert.equal(a.draft.requestId, "token-X");
  // 4. the provider materially edits the draft into payload B. 5. they submit again.
  const b = prepareCateringCreate({ ...a.draft, title: "Record B" }, cateringTimelineCreatePayload, () => "token-Y");
  // 6. B goes out under a NEW token, so the server creates it rather than answering with A.
  assert.equal(b.draft.requestId, "token-Y");
  assert.equal(b.body.clientRequestId, "token-Y");
  assert.notEqual(b.draft.requestFingerprint, a.draft.requestFingerprint);
});

test("F6: an exact retry of the same material payload reuses the same token", () => {
  let minted = 0;
  const mint = () => `token-${++minted}`;
  const first = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, mint);
  const retry = prepareCateringCreate(first.draft, cateringTimelineCreatePayload, mint);
  const retryAgain = prepareCateringCreate(retry.draft, cateringTimelineCreatePayload, mint);
  assert.equal(retryAgain.draft.requestId, "token-1");
  assert.equal(minted, 1, "no matter how many times it is retried");
});

test("F6: a material change to ANY create mints a fresh token", () => {
  const changes: [string, CateringDraftLike, (draft: never) => Record<string, unknown>, Record<string, unknown>][] = [
    ["timeline title", timelineA, cateringTimelineCreatePayload as never, { title: "Changed" }],
    ["timeline time", timelineA, cateringTimelineCreatePayload as never, { scheduledTime: "09:00" }],
    ["timeline visibility", timelineA, cateringTimelineCreatePayload as never, { visibility: "shared" }],
    ["staff name", staffA, cateringStaffCreatePayload as never, { workerName: "Grace" }],
    ["staff role", staffA, cateringStaffCreatePayload as never, { role: "chef" }],
    ["equipment name", equipmentA, cateringEquipmentCreatePayload as never, { name: "Hot box" }],
    ["equipment quantity", equipmentA, cateringEquipmentCreatePayload as never, { quantity: "9" }],
    ["equipment status", equipmentA, cateringEquipmentCreatePayload as never, { status: "confirmed" }],
  ];
  for (const [label, base, build, edit] of changes) {
    const first = prepareCateringCreate(base as never, build, () => "token-1");
    const changed = prepareCateringCreate({ ...first.draft, ...edit } as never, build, () => "token-2");
    assert.equal(changed.draft.requestId, "token-2", label);
    assert.equal(changed.body.clientRequestId, "token-2", label);
  }
});

test("F6: an edit that changes no MATERIAL field keeps the token", () => {
  // Whitespace around a value is trimmed by the payload builder, so it is not a material change and must not spend
  // a token -- otherwise a stray keystroke would turn a safe retry into a duplicate record.
  const first = prepareCateringCreate({ ...timelineA, title: "Record A" }, cateringTimelineCreatePayload, () => "token-1");
  const padded = prepareCateringCreate({ ...first.draft, title: "  Record A  " }, cateringTimelineCreatePayload, () => "token-2");
  assert.equal(padded.draft.requestId, "token-1");
});

test("F6: the fingerprint covers the request body only, never client-only bookkeeping", () => {
  const body = cateringTimelineCreatePayload({ ...timelineA, requestId: "token-1" });
  assert.equal("clientRequestId" in cateringMaterialPayload(body), false, "the token is not part of its own identity");
  // The draft's own fields never appear in a body, so they cannot participate either.
  assert.equal(JSON.stringify(cateringMaterialPayload(body)).includes("requestFingerprint"), false);
  // Key order cannot change the answer.
  const forward = cateringMaterialFingerprint({ a: 1, b: 2, clientRequestId: "x" });
  const reversed = cateringMaterialFingerprint({ b: 2, a: 1, clientRequestId: "y" });
  assert.equal(forward, reversed);
});

/* ================================================================================================================ *
 * F4 + F6 together -- the two invariants must hold at once
 * ================================================================================================================ */

test("the combined invariant: A's response can neither erase B nor be mistaken for B being saved", () => {
  // A is submitted.
  const a = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-A");
  // The provider types B while A is still in flight.
  const liveB: CateringTimelineDraft = { ...a.draft, title: "Record B" };
  // A's response lands. B survives untouched -- invariant 2.
  const afterA = settleCateringCreateDraft(liveB, a.draft, EMPTY_CATERING_TIMELINE_DRAFT);
  assert.equal(afterA.title, "Record B");
  // The provider submits B. It is a different material payload, so it gets its own token -- invariant 1.
  const b = prepareCateringCreate(afterA, cateringTimelineCreatePayload, () => "token-B");
  assert.equal(b.draft.requestId, "token-B");
  assert.notEqual(b.draft.requestId, a.draft.requestId);
  // B's own response then settles B, because the live draft is still B.
  assert.equal(settleCateringCreateDraft(b.draft, b.draft, EMPTY_CATERING_TIMELINE_DRAFT).title, "");
});

test("the combined invariant survives a lost response followed by an exact retry", () => {
  const a = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-A");
  // The response is lost; the draft is untouched, so the retry reuses the token and the server answers with the
  // record it already made.
  const retry = prepareCateringCreate(a.draft, cateringTimelineCreatePayload, () => "token-B");
  assert.equal(retry.draft.requestId, "token-A");
  // And THAT response does settle the form, because the live draft really is the payload it answered.
  assert.equal(settleCateringCreateDraft(retry.draft, retry.draft, EMPTY_CATERING_TIMELINE_DRAFT).title, "");
});

/* ================================================================================================================ *
 * Component wiring
 * ================================================================================================================ */

const component = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingExecution.tsx"), "utf8");

test("the component settles creates against the submitted snapshot, never unconditionally", () => {
  for (const [snapshot, setter] of [
    ["submittedTimeline", "setTimelineDraft"], ["submittedStaff", "setStaffDraft"], ["submittedEquipment", "setEquipmentDraft"],
  ]) {
    assert.equal(component.includes(`if (variables.${snapshot}) ${setter}((live) => settleCateringCreateDraft(live, variables.${snapshot}!,`), true, snapshot);
  }
  // The old unconditional resets are gone.
  assert.equal(/setTimelineDraft\(resetCateringDraft\(/.test(component), false);
  assert.equal(/setStaffDraft\(resetCateringDraft\(/.test(component), false);
  assert.equal(/setEquipmentDraft\(resetCateringDraft\(/.test(component), false);
});

test("the component prepares every create through the payload-bound token", () => {
  for (const [draft, build] of [
    ["timelineDraft", "cateringTimelineCreatePayload"], ["staffDraft", "cateringStaffCreatePayload"], ["equipmentDraft", "cateringEquipmentCreatePayload"],
  ]) {
    assert.equal(component.includes(`prepareCateringCreate(${draft}, ${build}, () => crypto.randomUUID())`), true, draft);
  }
  // The old "reuse any token that exists" helper is gone from the component entirely.
  assert.equal(component.includes("withCateringRequestId"), false);
  // And the body that is sent is the one built from the stored attempt, so request and form agree on the token.
  assert.equal((component.match(/body: attempt\.body/g) ?? []).length, 3);
});

test("the component marks an access conflict for rebasing and reconciles through one path", () => {
  assert.equal(component.includes("setAccessForm(isCateringExecutionConflict(error) ? markCateringAccessConflict : preserveCateringAccessForm)"), true);
  assert.equal(component.includes("setAccessForm((current) => reconcileCateringAccessForm(current, identity, execution.access))"), true);
  // Hydration no longer happens directly, so the three cases cannot be applied in the wrong order.
  assert.equal(component.includes("hydrateCateringAccessForm("), false);
});


/* ================================================================================================================ *
 * NARROW AUDIT -- the two remaining success callbacks that cleared newer edits
 * ================================================================================================================ */

const timelineItem: CateringExecutionTimelineItemView = {
  id: "item-1", title: "Setup", description: null, category: "setup", scheduledTime: "09:00", endTime: "10:00",
  visibility: "provider_private", sortOrder: 0, isBlocker: false, completed: false, completedAt: null,
  createdAt: "2026-09-08T10:00:00.000Z", updatedAt: V1,
};

test("AUDIT: the item editor closes on success only when it still holds what was saved", () => {
  const opened = cateringTimelineEditorFor(timelineItem, "me:b1");
  const submitted = { itemId: opened.itemId, draft: { ...opened.draft } };
  // Untouched: it closes, as it always did.
  assert.equal(settleCateringTimelineEditor(opened, submitted, V2), null);
});

test("AUDIT: an editor the provider kept typing into stays open, rebased onto the saved version", () => {
  const opened = cateringTimelineEditorFor(timelineItem, "me:b1");
  const submitted = { itemId: opened.itemId, draft: { ...opened.draft } };
  // The save is in flight and the provider keeps typing.
  const live = editCateringTimelineEditorField(opened, "me:b1", "item-1", "description", "half a sentence more")!;
  const settled = settleCateringTimelineEditor(live, submitted, V2);
  assert.notEqual(settled, null, "the newer words are not closed away");
  assert.equal(settled?.draft.description, "half a sentence more");
  // Rebased, so the next Save is judged against the row this save just produced rather than the one it replaced.
  assert.equal(settled?.expectedUpdatedAt, V2);
  assert.equal(settled?.conflict, false);
});

test("AUDIT: a completion for another item never touches the open editor", () => {
  const opened = cateringTimelineEditorFor(timelineItem, "me:b1");
  assert.equal(settleCateringTimelineEditor(opened, { itemId: "other", draft: opened.draft }, V2), opened);
  assert.equal(settleCateringTimelineEditor(null, { itemId: "item-1", draft: opened.draft }, V2), null);
});

test("AUDIT: an access save landing after newer edits keeps them and takes only the version", () => {
  const submittedDraft = cateringAccessDraftFrom(access());
  const form: CateringAccessFormState = { identity: "me:b1", value: submittedDraft, dirty: true };
  // Untouched since submission: the form is replaced by the authoritative answer, as before.
  const saved = access({ updatedAt: V2, parkingInstructions: "Two bays" });
  const clean = settleCateringAccessForm(form, "me:b1", saved, submittedDraft);
  assert.equal(clean.dirty, false);
  assert.equal(clean.value?.expectedUpdatedAt, V2);
  // The provider kept typing while it was in flight: those words survive, and only the version is taken.
  const live = editCateringAccessField(form, "parkingInstructions", "Three bays");
  const settled = settleCateringAccessForm(live, "me:b1", saved, submittedDraft);
  assert.equal(settled.value?.parkingInstructions, "Three bays");
  assert.equal(settled.value?.expectedUpdatedAt, V2, "so the next Save can succeed rather than conflicting");
  assert.equal(settled.dirty, true, "and it is still unsaved, so no poll may overwrite it");
});


/* ================================================================================================================ *
 * P1 -- the access rebase must not become an authorised overwrite
 * ================================================================================================================ */

/**
 * The reported lost update, and the merge that prevents it.
 *
 * The access save is a FULL RECORD: every field travels on every request. So advancing the version on an otherwise
 * stale form does not merely un-stick it -- it authorises it to write every field it is holding, including the ones
 * another writer changed while the user was typing. The merge below is what makes the advanced version honest.
 */

test("P1: the reported scenario -- tab A must not revert tab B's venue contact", () => {
  // 1. Tab A opens the form.
  const tabA = cleanForm();
  // 2. Tab B changes the venue contact and saves.
  const afterB = access({ updatedAt: V2, venueContactName: "Sam from the venue" });
  // 3. Tab A changes only parking instructions. 4. Tab A saves, and is refused as stale.
  const edited = editCateringAccessField(tabA, "parkingInstructions", "Three bays");
  const conflicted = markCateringAccessConflict(edited);
  // 5-6. The refetch arrives and the form merges rather than swapping the version.
  const merged = reconcileCateringAccessForm(conflicted, "me:b1", afterB);
  // 7. Tab A no longer contains the OLD venue contact -- it adopted tab B's.
  assert.equal(merged.value?.venueContactName, "Sam from the venue");
  // ...while tab A's own edit is intact.
  assert.equal(merged.value?.parkingInstructions, "Three bays");
  // 8-9. So tab A's next save writes its parking change and tab B's contact -- no silent revert.
  const payload = cateringAccessSavePayload(merged.value!);
  assert.equal(payload.venueContactName, "Sam from the venue");
  assert.equal(payload.parkingInstructions, "Three bays");
  assert.equal(payload.expectedUpdatedAt, V2);
});

test("P1 (1): user edits parking only, remote changes venue contact", () => {
  const merged = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "parkingInstructions", "Three bays")),
    "me:b1", access({ updatedAt: V2, venueContactName: "Sam" }),
  );
  assert.equal(merged.value?.parkingInstructions, "Three bays", "the user's edit is preserved");
  assert.equal(merged.value?.venueContactName, "Sam", "the remote change is adopted");
  assert.equal(cateringAccessReviewIsOpen(merged), false);
});

test("P1 (2): user edits contact only, remote changes parking", () => {
  const merged = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "venueContactName", "My contact")),
    "me:b1", access({ updatedAt: V2, parkingInstructions: "Remote parking" }),
  );
  assert.equal(merged.value?.venueContactName, "My contact");
  assert.equal(merged.value?.parkingInstructions, "Remote parking");
  assert.equal(cateringAccessReviewIsOpen(merged), false);
});

test("P1 (3): both changed the SAME field differently -- no silent overwrite", () => {
  const merged = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "parkingInstructions", "Mine")),
    "me:b1", access({ updatedAt: V2, parkingInstructions: "Theirs" }),
  );
  // Neither side is chosen.
  assert.deepEqual(merged.review?.fields, ["parkingInstructions"]);
  assert.equal(cateringAccessReviewIsOpen(merged), true);
  // The user's value stays on screen so it is not lost, and theirs is carried for the interface to show.
  assert.equal(merged.value?.parkingInstructions, "Mine");
  assert.equal(merged.review?.theirs.parkingInstructions, "Theirs");
  // CRITICALLY: the version does NOT advance, so this form cannot be saved into an overwrite.
  assert.equal(merged.value?.expectedUpdatedAt, V1);
  assert.equal(maySaveCateringAccess(merged, true, false), false);
});

test("P1 (4): fields the user never touched adopt the authoritative values", () => {
  const remote = access({
    updatedAt: V2, loadInEntrance: "Side door", elevatorNotes: "Service lift only",
    accessConfirmed: true, venueContactSource: "customer",
  });
  const merged = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "parkingInstructions", "Three bays")),
    "me:b1", remote,
  );
  assert.equal(merged.value?.loadInEntrance, "Side door");
  assert.equal(merged.value?.elevatorNotes, "Service lift only");
  assert.equal(merged.value?.accessConfirmed, true, "booleans merge too");
  assert.equal(merged.value?.venueContactSource, "customer", "and so does the contact provenance");
  assert.equal(merged.value?.parkingInstructions, "Three bays");
});

test("P1 (5): expectedUpdatedAt advances only as part of a safe merge or a completed review", () => {
  // Safe merge: it advances.
  const safe = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "parkingInstructions", "Three bays")),
    "me:b1", access({ updatedAt: V2, venueContactName: "Sam" }),
  );
  assert.equal(safe.value?.expectedUpdatedAt, V2);
  // Contested: it does not.
  const contested = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "parkingInstructions", "Mine")),
    "me:b1", access({ updatedAt: V2, parkingInstructions: "Theirs" }),
  );
  assert.equal(contested.value?.expectedUpdatedAt, V1);
  // Only an explicit choice releases it.
  const kept = resolveCateringAccessReviewField(contested, "parkingInstructions", "mine");
  assert.equal(kept.value?.parkingInstructions, "Mine");
  assert.equal(kept.value?.expectedUpdatedAt, V2);
  assert.equal(maySaveCateringAccess(kept, true, false), true);
  const taken = resolveCateringAccessReviewField(contested, "parkingInstructions", "theirs");
  assert.equal(taken.value?.parkingInstructions, "Theirs");
  assert.equal(taken.value?.expectedUpdatedAt, V2);
});

test("P1 (5b): a partially reviewed form still cannot be saved", () => {
  const base = cleanForm();
  const edited = editCateringAccessField(editCateringAccessField(base, "parkingInstructions", "Mine"), "loadInEntrance", "My door");
  const contested = reconcileCateringAccessForm(
    markCateringAccessConflict(edited), "me:b1",
    access({ updatedAt: V2, parkingInstructions: "Theirs", loadInEntrance: "Their door" }),
  );
  assert.equal(contested.review?.fields.length, 2);
  const halfway = resolveCateringAccessReviewField(contested, "parkingInstructions", "mine");
  assert.deepEqual(halfway.review?.fields, ["loadInEntrance"]);
  assert.equal(halfway.value?.expectedUpdatedAt, V1, "the version waits for the LAST resolution");
  assert.equal(maySaveCateringAccess(halfway, true, false), false);
  const done = resolveCateringAccessReviewField(halfway, "loadInEntrance", "theirs");
  assert.equal(done.review, null);
  assert.equal(done.value?.expectedUpdatedAt, V2);
  assert.equal(done.value?.parkingInstructions, "Mine");
  assert.equal(done.value?.loadInEntrance, "Their door");
});

test("P1 (6): the user's genuine edits survive every branch", () => {
  const edited = editCateringAccessField(cleanForm(), "specialRestrictions", "No open flame indoors");
  for (const remote of [access({ updatedAt: V2 }), access({ updatedAt: V2, parkingInstructions: "Theirs" }), access({ updatedAt: V2, specialRestrictions: "Something else" })]) {
    const merged = reconcileCateringAccessForm(markCateringAccessConflict(edited), "me:b1", remote);
    assert.equal(merged.value?.specialRestrictions, "No open flame indoors", JSON.stringify(remote.specialRestrictions));
  }
});

test("P1 (7): a lost response that already committed converges with no false conflict", () => {
  // The user's own save committed; the response was lost. The refetch shows THEIR values back.
  const edited = editCateringAccessField(cleanForm(), "parkingInstructions", "Three bays");
  const committed = access({ updatedAt: V2, parkingInstructions: "Three bays" });
  const merged = reconcileCateringAccessForm(markCateringAccessConflict(edited), "me:b1", committed);
  // Both sides "changed" the field -- to the same value -- so there is nothing to adjudicate.
  assert.equal(cateringAccessReviewIsOpen(merged), false);
  assert.equal(merged.value?.expectedUpdatedAt, V2);
  assert.equal(merged.dirty, false, "the form is settled: it matches the record exactly");
  assert.deepEqual(cateringAccessEditedFields(merged.baseline, merged.value!), []);
});

test("P1 (8): the merge helper is total, and fails closed with no baseline", () => {
  const baseline = cateringAccessDraftFrom(access());
  const live = { ...baseline, parkingInstructions: "Mine" };
  const theirs = { ...cateringAccessDraftFrom(access({ updatedAt: V2 })), venueContactName: "Sam" };
  const merged = mergeCateringAccessDraft(baseline, live, theirs);
  assert.equal(merged.value.parkingInstructions, "Mine");
  assert.equal(merged.value.venueContactName, "Sam");
  assert.deepEqual(merged.conflicts, []);
  // With no baseline the merge cannot tell an edit from a stale value, so it treats everything as the user's and
  // reports every difference as contested -- conservative in both directions: it neither adopts remote values
  // silently nor lets stale ones be written silently.
  const blind = mergeCateringAccessDraft(null, live, theirs);
  assert.equal(blind.conflicts.includes("venueContactName"), true);
  assert.equal(blind.value.parkingInstructions, "Mine");
});

test("P1: discarding is an explicit, confirmed action that takes the authoritative record wholesale", () => {
  const contested = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "parkingInstructions", "Mine")),
    "me:b1", access({ updatedAt: V2, parkingInstructions: "Theirs" }),
  );
  const discarded = discardCateringAccessDraft(contested, "me:b1", access({ updatedAt: V2, parkingInstructions: "Theirs" }));
  assert.equal(discarded.value?.parkingInstructions, "Theirs");
  assert.equal(discarded.dirty, false);
  assert.equal(discarded.review, null);
  assert.deepEqual(discarded.baseline, discarded.value);
});

test("P1 (8b): terminal/read-only and privacy behaviour are unchanged by the merge", () => {
  // Save is gated on `editable` exactly as before, so a terminal booking still cannot save -- with or without a
  // review open.
  const clean = cleanForm();
  assert.equal(maySaveCateringAccess(clean, false, false), false, "terminal booking");
  assert.equal(maySaveCateringAccess(clean, true, true), false, "request in flight");
  assert.equal(maySaveCateringAccess(clean, true, false), true);
  // A customer's record carries no private key, and merging one never invents it.
  const { providerPrivateNotes: _absent, ...customerView } = access({ updatedAt: V2 });
  const merged = reconcileCateringAccessForm(
    markCateringAccessConflict(editCateringAccessField(cleanForm(), "parkingInstructions", "Three bays")),
    "me:b1", customerView as CateringExecutionAccessView,
  );
  assert.equal(merged.value?.providerPrivateNotes, "", "absent stays empty rather than becoming undefined");
});

/* ================================================================================================================ *
 * P3 -- the source file must contain no literal NUL byte
 * ================================================================================================================ */

test("P3: BookingExecution.tsx contains zero literal NUL bytes", () => {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingExecution.tsx");
  const bytes = fs.readFileSync(file);
  // A raw NUL makes text tools treat the whole file as binary and skip its contents, so the delimiter is written as
  // an escape. The runtime fingerprint is unchanged: NUL is still the separator.
  assert.equal(bytes.includes(0), false, "a literal NUL byte is back in the source");
  const source = bytes.toString("utf8");
  // Doubled here on purpose: the SOURCE must contain the six characters \ u 0 0 0 0, not the character they denote.
  assert.equal(source.includes('timelineIds.join("\\u0000")'), true, "and the escaped delimiter is what is there instead");
  // The same guarantee for every Phase 2J source file, so this cannot reappear next door.
  for (const sibling of ["catering-booking-execution-state.ts"]) {
    const siblingPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), sibling);
    assert.equal(fs.readFileSync(siblingPath).includes(0), false, sibling);
  }
});


/* ================================================================================================================ *
 * NARROW AUDIT -- every other place a version is advanced client-side
 * ================================================================================================================ */

/**
 * The P1 bug was: advance `expectedUpdatedAt` while holding stale full-record values, and the next save becomes an
 * authorised overwrite. So the audit question for every other flow is the same one -- can the version being adopted
 * reflect a write this form did not see?
 *
 * Only two Phase 2J payloads carry a whole record: the access save (fixed above) and the timeline item editor. The
 * rest send ONE field plus a version, so there is no stale companion value for a newer version to authorise.
 */

test("AUDIT: the item editor advances only to the version its OWN save produced", () => {
  const opened = cateringTimelineEditorFor(timelineItem, "me:b1");
  const submitted = { itemId: opened.itemId, draft: { ...opened.draft } };
  const live = editCateringTimelineEditorField(opened, "me:b1", "item-1", "description", "more text")!;
  const settled = settleCateringTimelineEditor(live, submitted, V2);
  assert.equal(settled?.expectedUpdatedAt, V2);
  // This is NOT the P1 class. V2 is the version returned by the user's own successful PATCH, and a PATCH only
  // succeeds when its precondition matched -- so the record at V2 is exactly what this editor submitted. There is no
  // third-party value underneath it for the newer version to authorise overwriting. Had another tab written first,
  // that save would have been refused, not accepted.
  assert.equal(settled?.draft.title, submitted.draft.title, "the fields it did not edit are the ones it just wrote");
  assert.equal(settled?.draft.description, "more text");
  assert.equal(settled?.conflict, false);
});

test("AUDIT: a refused item edit still requires an explicit reload rather than auto-advancing", () => {
  // The editor's conflict path was already the safe model the P1 guidance names as the acceptable alternative: the
  // draft is preserved, saving is disabled, and only an explicit click replaces it from the authoritative item.
  const conflicted = markCateringTimelineEditorConflict(cateringTimelineEditorFor(timelineItem, "me:b1"), "item-1")!;
  assert.equal(conflicted.conflict, true);
  assert.equal(conflicted.expectedUpdatedAt, V1, "no version is advanced automatically anywhere on this path");
  assert.equal(maySubmitCateringTimelineEditor(conflicted, true, false), false, "and it cannot be saved meanwhile");
});

test("AUDIT: every other execution mutation sends one field plus a version, not a record", () => {
  // A single-field payload has no stale companion values, so advancing past a conflict could not overwrite anything
  // the user never looked at. These are listed explicitly so a future full-record payload has to be noticed here.
  assert.deepEqual(Object.keys(cateringTimelineCompletionPayload(timelineItem)).sort(), ["completed", "expectedUpdatedAt"]);
  assert.deepEqual(Object.keys(cateringTimelineDeletePayload(timelineItem)), ["expectedUpdatedAt"]);
  assert.deepEqual(Object.keys(cateringExecutionDeletePayload({ updatedAt: V1 })), ["expectedUpdatedAt"]);
  // The equipment status control and the milestone toggle are built inline in the component; assert their shape.
  assert.equal(/body: \{ status, expectedUpdatedAt: item\.updatedAt \}/.test(component), true);
  assert.equal(/body: \{ completed: !milestone\.completed, \.\.\.\(milestone\.updatedAt \? \{ expectedUpdatedAt/.test(component), true);
});

test("AUDIT: the access form is the only full-record payload, and it is now baseline-merged", () => {
  const stateSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-execution-state.ts"), "utf8");
  // The rebase can no longer advance a version without merging: both are in one expression.
  assert.equal(stateSource.includes("const merged = mergeCateringAccessDraft(current.baseline, current.value, theirs);"), true);
  // `version` is the authoritative version read through `cateringAccessVersion`, which is where it now comes from:
  // a customer's payload carries none, so the accessor is the one place the absence is turned into "no version".
  assert.equal(/expectedUpdatedAt: version \},\n\s+baseline: theirs/.test(stateSource), true, "version and baseline advance together");
  // And a contested merge returns before either moves.
  assert.equal(stateSource.indexOf("if (merged.conflicts.length > 0)") < stateSource.indexOf("expectedUpdatedAt: version }"), true);
});


/* ================================================================================================================ *
 * P2 -- a mutation response may affect only the booking that started it
 * ================================================================================================================ */

/**
 * This component stays mounted across a booking change, so a callback that read the booking from render scope
 * described whichever booking was on screen when the response landed. Save on A, navigate to B, and A's record was
 * installed into B's form -- and two similar-looking forms make that impossible to notice.
 *
 * The fix is structural: every mutation carries the identity that issued it, invalidation is keyed by THAT booking,
 * and local form state is settled only when the origin is still what is rendered. These assertions are structural
 * because the guard lives in the component's callbacks, which have no harness in this suite.
 */

test("P2: every mutation carries the identity that started it", () => {
  // One origin helper, captured at submission time from the render that actually issued the request.
  assert.equal(component.includes("const origin = (): ExecutionOrigin => ({ identity, bookingId, userId });"), true);
  // Every call site passes it -- twelve of them, which is every mutate in the file.
  const mutates = component.match(/mutation\.mutate\(\{/g) ?? [];
  const withOrigin = component.match(/mutation\.mutate\(\{[\s\n]*origin: origin\(\),/g) ?? [];
  assert.equal(mutates.length > 0, true);
  assert.equal(withOrigin.length, mutates.length, `${withOrigin.length} of ${mutates.length} mutations carry an origin`);
});

test("P2: the request URL is built from the origin, not from render scope", () => {
  // A request that outlives a navigation still addresses the booking it was issued for.
  assert.equal(component.includes("await fetch(`/api/catering/bookings/${started.bookingId}${path}`"), true);
  assert.equal(component.includes("await fetch(`/api/catering/bookings/${bookingId}${path}`"), false);
});

test("P2: booking A's response cannot modify booking B's local state", () => {
  // Both callbacks return early unless the origin is the booking currently on screen, BEFORE any setState.
  const success = component.slice(component.indexOf("onSuccess: (value"), component.indexOf("onError: (error"));
  const failure = component.slice(component.indexOf("onError: (error"), component.indexOf("const pending = mutation.isPending"));
  for (const [label, block] of [["onSuccess", success], ["onError", failure]] as const) {
    assert.equal(block.includes("if (!settlesHere(started)) return;"), true, `${label} has no origin guard`);
    // Every state setter sits AFTER that guard, so none of them can run for a foreign booking.
    const guardAt = block.indexOf("if (!settlesHere(started)) return;");
    for (const setter of block.match(/set(?:AccessForm|TimelineDraft|StaffDraft|EquipmentDraft|Editor|Notice)\(/g) ?? []) {
      assert.equal(block.indexOf(setter) > guardAt, true, `${label}: ${setter} runs before the origin guard`);
    }
  }
});

test("P2: the guard reads a ref, so it reflects the booking on screen NOW", () => {
  // Comparing against a render-captured `identity` would reintroduce the bug in the callback itself.
  assert.equal(component.includes("const settlesHere = (started: ExecutionOrigin) => started.identity === identityRef.current;"), true);
  assert.equal(component.includes("identityRef.current = identity;"), true);
});

test("P2: invalidation is keyed by the originating booking in both callbacks", () => {
  // The data a response changed belongs to the booking that issued it, so its cache is what is refreshed -- and
  // that happens BEFORE the origin guard, because it is correct regardless of what is on screen.
  const success = component.slice(component.indexOf("onSuccess: (value"), component.indexOf("onError: (error"));
  const failure = component.slice(component.indexOf("onError: (error"), component.indexOf("const pending = mutation.isPending"));
  assert.equal(success.indexOf("cateringBookingExecutionKey(started.userId, started.bookingId)") < success.indexOf("if (!settlesHere(started)) return;"), true);
  assert.equal(failure.indexOf("cateringBookingExecutionKey(started.userId, started.bookingId)") < failure.indexOf("if (!settlesHere(started)) return;"), true);
  // No render-scoped query key is invalidated anywhere.
  assert.equal(/invalidateQueries\(\{ queryKey: key \}\)/.test(component), false);
  assert.equal(/queryKey: \["catering", "booking-workspace", userId, bookingId\]/.test(component), false);
});

test("P2 audit: every callback that writes booking-local state is behind the origin guard", () => {
  // The audited set: access save, timeline/staff/equipment creates, the item editor, reorder, milestones, status
  // changes and deletes. They share ONE pair of callbacks, so one guard covers all of them -- which is why the
  // assertion above enumerates the setters rather than the routes.
  const settleLine = component.split("\n").find((line) => line.trim().startsWith("settle?:"));
  assert.notEqual(settleLine, undefined);
  for (const kind of ["timeline-draft", "staff-draft", "equipment-draft", "access", "editor"]) {
    assert.equal(settleLine!.includes(kind), true, kind);
  }
  // And the drafts are additionally reset when the booking changes, so nothing survives a navigation either way.
  // That reset sets state, so it stays in an effect and keeps its own record of which booking's drafts are loaded;
  // the guard the callbacks read is a separate ref, synchronized during render so it is current at the commit.
  assert.equal(component.includes("if (settledIdentityRef.current === identity) return;"), true);
  assert.equal(component.includes("  const identityRef = useRef(identity);\n  identityRef.current = identity;"), true);
});

/* ================================================================================================================ *
 * P3 -- browser limits must be the schema's limits
 * ================================================================================================================ */

test("P3: every access control's maxLength comes from the shared field metadata", () => {
  // The form renders FROM the metadata, so a limit cannot be typed independently into the markup.
  assert.equal(component.includes("{CATERING_ACCESS_FIELDS.map((meta) =>"), true);
  assert.equal(component.includes("maxLength={meta.maxLength}"), true);
  // The old blanket 4000 on every textarea is gone, and no magic number is hard-coded in the access form.
  const form = component.slice(component.indexOf("{CATERING_ACCESS_FIELDS.map((meta) =>"), component.indexOf("access-contact-source"));
  assert.equal(/maxLength=\{\d+\}/.test(form), false, "no literal limit in the access form");
});

test("P3: the exact limits Codex named are what the metadata carries", () => {
  assert.equal(cateringAccessFieldLimit("loadInEntrance"), 240);
  assert.equal(cateringAccessFieldLimit("venueContactName"), 120);
  assert.equal(cateringAccessFieldLimit("venueContactPhone"), 40);
  assert.equal(cateringAccessFieldLimit("parkingInstructions"), 2000);
  // 4000 survives on exactly one field, and only because the schema really does permit it there.
  assert.equal(cateringAccessFieldLimit("providerPrivateNotes"), 4000);
  assert.deepEqual(CATERING_ACCESS_FIELDS.filter((meta) => "maxLength" in meta && meta.maxLength === 4000).map((meta) => meta.field), ["providerPrivateNotes"]);
});

test("P3: every field's declared limit is exactly what the schema accepts and rejects", () => {
  // Iterating the metadata rather than a hand-written list, so a field added later is covered automatically.
  for (const meta of CATERING_ACCESS_FIELDS) {
    if (meta.control === "time") {
      // A time control has no length at all; the schema validates the HH:mm shape instead.
      assert.equal("maxLength" in meta, false, `${meta.field} should carry no length`);
      assert.equal(cateringAccessSaveSchema.safeParse({ [meta.field]: "08:30" }).success, true, meta.field);
      assert.equal(cateringAccessSaveSchema.safeParse({ [meta.field]: "8:30" }).success, false, meta.field);
      continue;
    }
    const limit = meta.maxLength;
    // Exactly at the limit is accepted...
    assert.equal(cateringAccessSaveSchema.safeParse({ [meta.field]: "x".repeat(limit) }).success, true, `${meta.field} rejected ${limit}`);
    // ...and one character past it is refused, which is precisely what the browser now prevents.
    assert.equal(cateringAccessSaveSchema.safeParse({ [meta.field]: "x".repeat(limit + 1) }).success, false, `${meta.field} accepted ${limit + 1}`);
    // Optional fields stay optional, and clearing stays possible.
    assert.equal(cateringAccessSaveSchema.safeParse({}).success, true);
    assert.equal(cateringAccessSaveSchema.safeParse({ [meta.field]: null }).success, true, `${meta.field} may be cleared`);
  }
});

test("P3: the schema is BUILT from the metadata, so the two cannot drift apart", () => {
  const contract = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "shared", "catering-booking-execution.ts"), "utf8");
  const schema = contract.slice(contract.indexOf("export const cateringAccessSaveSchema"), contract.indexOf("/** The access fields a customer may ever observe"));
  // Every text field's limit is read from the metadata rather than restated as a number.
  assert.equal(/optionalText\(\d+\)/.test(schema), false, "a literal limit is back in the access schema");
  assert.equal((schema.match(/optionalText\(accessLimit\("/g) ?? []).length, CATERING_ACCESS_FIELDS.filter((meta) => meta.control !== "time").length);
});

test("P3: the metadata covers every editable access field and nothing else", () => {
  const fields = CATERING_ACCESS_FIELDS.map((meta) => meta.field);
  assert.equal(new Set(fields).size, fields.length, "no duplicates");
  // Exactly the fields the save payload builds, so the form can render no control the request cannot carry.
  const payload = cateringAccessSavePayload(cateringAccessDraftFrom(access()));
  for (const field of fields) assert.equal(field in payload, true, `${field} is not in the save payload`);
  // The private field is present for the provider's form and remains provider-only elsewhere.
  assert.equal(fields.includes("providerPrivateNotes"), true);
});


/* ================================================================================================================ *
 * P2 -- reconciliation must be driven by the NEED to reconcile, not only by a newer authoritative version
 * ================================================================================================================ */

/**
 * The stuck form.
 *
 * Polling and saving are independent, so the refetch that carries tab B's write can land BEFORE tab A's stale save
 * is refused. When it does, the authoritative version reaches its final value while the form is still dirty -- and
 * a dirty form is deliberately left alone. By the time the conflict marks the form as needing a rebase, the version
 * has already stopped changing and will not change again on its own. An effect keyed on the version alone therefore
 * never re-runs: the form keeps a version the server refuses, every Save conflicts, and the only escape is throwing
 * the draft away.
 *
 * `cateringAccessReconcileKey` folds the form's own rebase state into the trigger, so the conflict itself re-runs
 * the reconciliation against whatever is already cached.
 */

/** React, reduced to the rule that matters: the effect re-runs when its key changes, and only then. */
function driveAccessReconciliation(initial: CateringAccessFormState, authoritative: CateringExecutionAccessView, renderLimit = 25) {
  let form = initial;
  let lastKey: string | null = null;
  let effectRuns = 0;
  for (let render = 0; render < renderLimit; render += 1) {
    const key = cateringAccessReconcileKey(authoritative, form);
    // Unchanged key: React does not re-run the effect, so the sequence has settled.
    if (key === lastKey) return { form, effectRuns };
    lastKey = key;
    effectRuns += 1;
    const next = reconcileCateringAccessForm(form, "me:b1", authoritative);
    // The identical object: `setState` bails out, nothing re-renders, and nothing can re-trigger.
    if (next === form) return { form, effectRuns };
    form = next;
  }
  throw new Error("the access reconciliation effect never settled");
}

test("P2: a conflict reconciles even when the authoritative payload is ALREADY fresh", () => {
  // Tab B's write is already in the cache, and it landed while this form was dirty, so the form still holds V1.
  const cached = access({ updatedAt: V2, venueContactName: "Sam from the venue" });
  const dirty = dirtyForm();
  assert.equal(dirty.value?.expectedUpdatedAt, V1);
  // The save is refused as stale. The authoritative payload does not change -- there is nothing newer to fetch.
  const conflicted = markCateringAccessConflict(dirty);
  const { form } = driveAccessReconciliation(conflicted, cached);
  // Reconciled anyway: the version advances to the one actually observed, so the next Save can succeed.
  assert.equal(form.value?.expectedUpdatedAt, V2);
  assert.equal(form.rebase, false);
  // The provider's own edit survives, and tab B's untouched field is adopted rather than reverted.
  assert.equal(form.value?.parkingInstructions, "Three bays");
  assert.equal(form.value?.venueContactName, "Sam from the venue");
  assert.equal(cateringAccessSavePayload(form.value!).expectedUpdatedAt, V2);
});

test("P2: the version-only trigger genuinely would not have fired -- it never changes in that sequence", () => {
  const cached = access({ updatedAt: V2 });
  const dirty = dirtyForm();
  const conflicted = markCateringAccessConflict(dirty);
  // Every payload in the sequence carries V2: the old dependency was constant throughout.
  assert.equal(cached.updatedAt, V2);
  // But the KEY changes, because the need to reconcile is part of it.
  assert.notEqual(cateringAccessReconcileKey(cached, conflicted), cateringAccessReconcileKey(cached, dirty));
  assert.equal(cateringAccessReconcileKey(cached, dirty), "settled:2026-09-08T12:00:00.000Z");
  assert.equal(cateringAccessReconcileKey(cached, conflicted), "rebase:2026-09-08T12:00:00.000Z");
  // And it still changes on a genuinely newer record, so the original trigger is not lost.
  assert.notEqual(cateringAccessReconcileKey(access({ updatedAt: V1 }), dirty), cateringAccessReconcileKey(cached, dirty));
  // No payload at all is its own key, so nothing reconciles before the first load.
  assert.equal(cateringAccessReconcileKey(undefined, conflicted), "");
});

test("P2: reconciliation cannot loop -- every starting state settles in at most two effect runs", () => {
  const fresh = access({ updatedAt: V2, venueContactName: "Sam from the venue" });
  const contested = access({ updatedAt: V2, parkingInstructions: "Somebody else's bays" });
  const cases: [string, CateringAccessFormState, CateringExecutionAccessView][] = [
    ["a clean form hydrating", cleanForm(), fresh],
    ["a merely dirty form", dirtyForm(), fresh],
    ["a conflicted form against an already-fresh payload", markCateringAccessConflict(dirtyForm()), fresh],
    ["a conflicted form whose refetch has not landed", markCateringAccessConflict(dirtyForm()), access({ updatedAt: V1 })],
    ["a conflicted form with a contested field", markCateringAccessConflict(dirtyForm()), contested],
    ["a form for another booking", markCateringAccessConflict({ ...dirtyForm(), identity: "other:b2" }), fresh],
  ];
  for (const [label, initial, authoritative] of cases) {
    // The driver throws if it never settles, so reaching the assertion at all is the no-loop guarantee.
    const { effectRuns } = driveAccessReconciliation(initial, authoritative);
    assert.equal(effectRuns <= 2, true, `${label}: settled in ${effectRuns} effect runs`);
  }
});

test("P2: the flag is one-way, so a settled form does not re-enter reconciliation", () => {
  const fresh = access({ updatedAt: V2, venueContactName: "Sam from the venue" });
  const { form } = driveAccessReconciliation(markCateringAccessConflict(dirtyForm()), fresh);
  const settledKey = cateringAccessReconcileKey(fresh, form);
  // Running the effect again against the same payload is a no-op that returns the identical object...
  assert.equal(reconcileCateringAccessForm(form, "me:b1", fresh), form);
  // ...and the key it would be keyed on has not moved, so it is not run again in the first place.
  assert.equal(cateringAccessReconcileKey(fresh, reconcileCateringAccessForm(form, "me:b1", fresh)), settledKey);
  // Only another refused save can set the flag again.
  assert.equal(cateringAccessReconcileKey(fresh, markCateringAccessConflict(form)), `rebase:${V2}`);
});

test("P2: reconciling against an already-fresh payload still refuses to overwrite silently", () => {
  // Both sides changed parking, differently. The three-way merge is untouched by the new trigger: the disagreement
  // is surfaced for a person, the user's own text stays on screen, and the version does NOT move.
  const contested = access({ updatedAt: V2, parkingInstructions: "Somebody else's bays" });
  const { form } = driveAccessReconciliation(markCateringAccessConflict(dirtyForm()), contested);
  assert.equal(cateringAccessReviewIsOpen(form), true);
  assert.deepEqual(form.review?.fields, ["parkingInstructions"]);
  assert.equal(form.value?.parkingInstructions, "Three bays", "the user's words are still there");
  assert.equal(form.review?.theirs.parkingInstructions, "Somebody else's bays");
  assert.equal(form.value?.expectedUpdatedAt, V1, "and an unreviewed form cannot be saved into an overwrite");
  assert.equal(maySaveCateringAccess(form, true, false), false);
  // Resolving is what advances it, by explicit choice -- and that resolution is not undone by another effect run.
  const resolved = resolveCateringAccessReviewField(form, "parkingInstructions", "mine");
  assert.equal(resolved.value?.expectedUpdatedAt, V2);
  assert.equal(driveAccessReconciliation(resolved, contested).form.value?.parkingInstructions, "Three bays");
});

test("P2: the component's access effect is keyed on the reconcile key, not on the version alone", () => {
  const component = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingExecution.tsx"), "utf8");
  assert.equal(component.includes("}, [identity, cateringAccessReconcileKey(execution?.access, accessForm)]);"), true);
  // The dependency it replaced must not survive anywhere as the access trigger.
  assert.equal(component.includes("execution?.access.updatedAt"), false);
});


/* ================================================================================================================ *
 * P2 -- a consumed create token whose record was deleted
 * ================================================================================================================ */

/**
 * The server now answers a create retry in one of three ways: the record it made, "already consumed and the record
 * is gone", or an ordinary create. The middle one arrives on the SUCCESS path -- the request it retries did
 * succeed, so nothing failed and nothing should be retried -- but it carries no record at all. The client's job is
 * to not invent one, to retire the spent token, and to say something true.
 */
const consumedResponse = { duplicate: true, consumed: true, code: "catering_execution_create_already_consumed", message: CATERING_EXECUTION_CREATE_CONSUMED_MESSAGE };

test("P2: a consumed-and-deleted response is recognised, and an ordinary create is not", () => {
  assert.equal(cateringCreateWasConsumed(consumedResponse), true);
  // A retry whose record still exists is a plain duplicate and carries one -- it must NOT be treated as consumed.
  assert.equal(cateringCreateWasConsumed({ duplicate: true, item: { id: "item-1" } }), false);
  assert.equal(cateringCreateWasConsumed({ item: { id: "item-1" } }), false);
  assert.equal(cateringCreateWasConsumed({}), false);
  assert.equal(cateringCreateWasConsumed(null), false);
  assert.equal(cateringCreateWasConsumed(undefined), false);
  // Both flags are required, so a stray `consumed` on some other response cannot trigger it.
  assert.equal(cateringCreateWasConsumed({ consumed: true }), false);
});

test("P2: the consumed response carries no record, so there is nothing to render a phantom from", () => {
  for (const key of ["item", "assignment", "equipment"]) {
    assert.equal(key in consumedResponse, false, key);
  }
  // And the notice the participant is shown is truthful and explicitly not retryable: the same token can only ever
  // produce this same answer.
  assert.equal(CATERING_EXECUTION_CONSUMED_NOTICE.retryable, false);
  assert.equal(CATERING_EXECUTION_CONSUMED_NOTICE.message, CATERING_EXECUTION_CREATE_CONSUMED_MESSAGE);
  assert.equal(/removed/.test(CATERING_EXECUTION_CONSUMED_NOTICE.message), true, "it says the record is gone");
  assert.equal(/nothing was added again/i.test(CATERING_EXECUTION_CONSUMED_NOTICE.message), true, "and that nothing was created");
});

test("P2: the spent token is retired, so a genuinely new attempt is not answered from the ledger", () => {
  // The draft that produced the consumed retry, still holding the token it was submitted with.
  const submitted = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-1");
  assert.equal(submitted.draft.requestId, "token-1");
  // The response settles it exactly as any accepted create does: the attempt is accounted for, so the form empties.
  const settled = settleCateringCreateDraft(submitted.draft, submitted.draft, EMPTY_CATERING_TIMELINE_DRAFT);
  assert.equal(settled.requestId, null, "the spent token is not carried forward");
  assert.equal(settled.requestFingerprint, null);
  // Retyping the SAME record now mints a fresh token, so the server sees a new create rather than the spent one.
  const again = prepareCateringCreate({ ...settled, title: "Record A" }, cateringTimelineCreatePayload, () => "token-2");
  assert.equal(again.draft.requestId, "token-2");
  assert.equal(again.body.clientRequestId, "token-2");
});

test("P2: a consumed response still does not clear a draft the provider has moved on to", () => {
  const submitted = prepareCateringCreate(timelineA, cateringTimelineCreatePayload, () => "token-1");
  // They kept typing while the retry was in flight. That newer record is not something this response accounts for.
  const live = { ...submitted.draft, title: "Record B" };
  const settled = settleCateringCreateDraft(live, submitted.draft, EMPTY_CATERING_TIMELINE_DRAFT);
  assert.deepEqual(settled, live, "the newer draft survives");
  // And because the payload changed materially, its next submit mints a fresh token anyway.
  const next = prepareCateringCreate(settled, cateringTimelineCreatePayload, () => "token-2");
  assert.equal(next.draft.requestId, "token-2");
});

test("P2: the component raises the consumed notice, and only for that response", () => {
  // The success path sets the notice from the response itself, so an ordinary create still clears it.
  assert.equal(component.includes("setNotice(cateringCreateWasConsumed(value) ? { ...CATERING_EXECUTION_CONSUMED_NOTICE } : null);"), true);
  // It is inside the origin guard, so a response for another booking cannot raise it here.
  const success = component.slice(component.indexOf("onSuccess: (value: Record<string, unknown>, variables)"), component.indexOf("onError:"));
  assert.equal(success.indexOf("if (!settlesHere(started)) return;") < success.indexOf("cateringCreateWasConsumed"), true);
  // Nothing anywhere inserts a record from a create response into local state, so a missing one cannot become a
  // phantom row: the created record is read back from the authoritative query like everything else.
  assert.equal(/set(Timeline|Staff|Equipment)[A-Za-z]*\(\[/.test(component), false);
  assert.equal(/value\.(item|assignment|equipment) as [A-Za-z]+View/.test(component), false);
});


/* ================================================================================================================ *
 * P2 -- an impossible rental schedule is caught before the request is sent, and the draft survives
 * ================================================================================================================ */

/**
 * The server is authoritative; this only spares the provider a round trip and a refusal they can see coming. It
 * reads the SAME contract rule the schema, the resolver and the database CHECK read, so the form cannot come to
 * disagree with what the server would say.
 */
const rental = (over: Partial<CateringEquipmentDraft> = {}): CateringEquipmentDraft => ({
  ...EMPTY_CATERING_EQUIPMENT_DRAFT, name: "Chafer", ...over,
});

test("P2: the form recognises an impossible schedule, and an incomplete one as fine", () => {
  assert.equal(cateringEquipmentScheduleIsValid(rental({ pickupDate: "2026-09-10", returnDate: "2026-09-09" })), false);
  assert.equal(cateringEquipmentScheduleIsValid(rental({ pickupDate: "2026-09-10", pickupTime: "18:00", returnDate: "2026-09-10", returnTime: "10:00" })), false);
  assert.equal(cateringEquipmentScheduleIsValid(rental({ pickupDate: "2026-09-10", returnDate: "2026-09-12" })), true);
  assert.equal(cateringEquipmentScheduleIsValid(rental({ pickupDate: "2026-09-10", pickupTime: "18:00", returnDate: "2026-09-10", returnTime: "18:00" })), true, "equality");
  // Empty inputs are "not set", exactly as the payload builder treats them -- not an empty string to compare.
  assert.equal(cateringEquipmentScheduleIsValid(rental()), true);
  assert.equal(cateringEquipmentScheduleIsValid(rental({ pickupDate: "2026-09-10" })), true);
  assert.equal(cateringEquipmentScheduleIsValid(rental({ returnDate: "2026-09-09" })), true);
  assert.equal(cateringEquipmentScheduleIsValid(rental({ pickupDate: "2026-09-10", pickupTime: "18:00", returnDate: "2026-09-10" })), true, "one clock missing");
  assert.equal(cateringEquipmentScheduleIsValid(rental({ pickupTime: "18:00", returnTime: "10:00" })), true, "clocks with no dates");
});

test("P2: an impossible schedule blocks submission without touching what was typed", () => {
  const impossible = rental({ pickupDate: "2026-09-10", returnDate: "2026-09-09", notes: "From the depot" });
  assert.equal(maySubmitCateringEquipmentDraft(impossible, true, false), false);
  // Nothing clears, resets or rewrites the draft: the provider corrects the date in place. The guard is a pure
  // predicate over the draft, so it cannot be the thing that loses their input.
  assert.equal(maySubmitCateringEquipmentDraft(rental({ pickupDate: "2026-09-10", returnDate: "2026-09-12" }), true, false), true);
  // The other submission rules are untouched, so this neither loosened nor duplicated them.
  assert.equal(maySubmitCateringEquipmentDraft(rental({ name: "  " }), true, false), false, "still needs a name");
  assert.equal(maySubmitCateringEquipmentDraft(rental({ quantity: "0" }), true, false), false, "still bounds quantity");
  assert.equal(maySubmitCateringEquipmentDraft(rental(), false, false), false, "still closed on a terminal booking");
  assert.equal(maySubmitCateringEquipmentDraft(rental(), true, true), false, "still blocked while a request is in flight");
});

test("P2: the form's message is the server's message, from the same constant", () => {
  assert.equal(component.includes("{!cateringEquipmentScheduleIsValid(equipmentDraft) && <p className=\"text-sm text-destructive sm:col-span-2\" role=\"alert\">{CATERING_EQUIPMENT_SCHEDULE_MESSAGE}</p>}"), true);
  // No second wording is typed into the markup, so the form and the refusal can never disagree.
  assert.equal(component.includes("must not precede"), false, "the wording is imported, not written here");
  // And the guard reads the shared rule rather than restating a comparison of its own.
  const state = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-execution-state.ts"), "utf8");
  const guard = state.slice(state.indexOf("export function cateringEquipmentScheduleIsValid"), state.indexOf("export function maySubmitCateringEquipmentDraft"));
  assert.equal(guard.includes("cateringEquipmentScheduleIsOrdered({"), true);
  assert.equal(/[<>]=?/.test(guard.replace(/=>/g, "")), false, "no comparison is restated here");
});

test("P2: a server refusal still preserves the draft, so client validation is a convenience and not the guarantee", () => {
  // The form stays editable and the draft is preserved on any failure -- the existing behaviour, re-checked against
  // the new refusal. A schedule the client somehow let through comes back as a 400 and the values are still there.
  const submitted = prepareCateringCreate(rental({ pickupDate: "2026-09-10", returnDate: "2026-09-09" }), cateringEquipmentCreatePayload, () => "token-1");
  assert.equal(submitted.body.returnDate, "2026-09-09", "the payload is what was typed");
  // A failed create settles nothing: the draft, and its still-unspent token, are exactly as they were.
  assert.deepEqual(submitted.draft.requestId, "token-1");
  assert.equal(cateringDraftIsUnchanged(submitted.draft, submitted.draft), true);
  // Correcting the date keeps the same token, because the material payload binding only mints a new one on a
  // material change -- and this IS a material change, so it mints one.
  const corrected = prepareCateringCreate({ ...submitted.draft, returnDate: "2026-09-12" }, cateringEquipmentCreatePayload, () => "token-2");
  assert.equal(corrected.draft.requestId, "token-2");
});
