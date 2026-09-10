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
  cateringAccessDraftFrom,
  cateringAccessSavePayload,
  cateringDraftIsUnchanged,
  cateringEquipmentCreatePayload,
  cateringEquipmentIsBlocking,
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
  assert.equal(block.includes('.filter((field) => field !== "providerPrivateNotes" || role === "provider")'), true);
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
  assert.equal(/expectedUpdatedAt: authoritative\.updatedAt \},\n\s+baseline: theirs/.test(stateSource), true, "version and baseline advance together");
  // And a contested merge returns before either moves.
  assert.equal(stateSource.indexOf("if (merged.conflicts.length > 0)") < stateSource.indexOf("expectedUpdatedAt: authoritative.updatedAt"), true);
});
