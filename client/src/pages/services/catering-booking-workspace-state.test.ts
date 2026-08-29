import assert from "node:assert/strict";
import test from "node:test";
import type { CateringBookingActivityView, CateringBookingDetailsView } from "@shared/catering-booking-operations";
import { activeTaskEditor, cateringTaskCreatePayload, cateringTaskDraftsEqual, closeTaskEditorAfterSave, combineCateringActivityPages, editWorkspaceForm, editWorkspaceFormField, EMPTY_CATERING_TASK_DRAFT, formatCateringTaskDeadline, historicalOperationalDetails, hydrateWorkspaceForm, nextCateringActivityPage, preserveTaskEditorAfterSaveFailure, preserveWorkspaceFormAfterSaveFailure, providerDraftFrom, reconcileWorkspaceFormAfterSave, saveWorkspaceForm, type CateringTaskDraft, type ProviderDetailsDraft, type SubmittedTaskEdit } from "./catering-booking-workspace-state";

const emptyDetails: CateringBookingDetailsView = { venueName: null, venueAddress: null, venueCity: null, venueState: null, venuePostalCode: null, venueInstructions: null, arrivalTime: null, serviceStartTime: null, serviceEndTime: null, setupNotes: null, accessNotes: null, kitchenAvailable: null, refrigerationAvailable: null, powerAvailable: null, waterAvailable: null, indoorOutdoor: null, customerNotes: null, updatedAt: null };
test("historical details are empty only when every represented field is absent", () => assert.deepEqual(historicalOperationalDetails(emptyDetails, "customer"), []));
test("city, arrival, and service-end-only history remain visible", () => { for (const details of [{ venueCity: "Austin" }, { arrivalTime: "15:00" }, { serviceEndTime: "21:00" }]) assert.equal(historicalOperationalDetails({ ...emptyDetails, ...details }, "customer").length, 1); });
test("false facility values remain meaningful persisted details", () => assert.deepEqual(historicalOperationalDetails({ ...emptyDetails, kitchenAvailable: false }, "customer"), [{ label: "Kitchen available", value: "No" }]));
test("provider notes render only for providers", () => { const details = { ...emptyDetails, providerNotes: "Private staffing plan" }; assert.equal(historicalOperationalDetails(details, "provider")[0]?.value, "Private staffing plan"); assert.deepEqual(historicalOperationalDetails(details, "customer"), []); });
test("activity pages append in order without duplicate IDs", () => { const activity = (id: string): CateringBookingActivityView => ({ id, eventType: "details_updated", metadata: {}, createdAt: "2026-08-29T00:00:00.000Z" }); assert.deepEqual(combineCateringActivityPages([{ activity: [activity("new"), activity("middle")] }, { activity: [activity("middle"), activity("old")] }]).map(({ id }) => id), ["new", "middle", "old"]); });
test("activity pagination requests only an available next page", () => { assert.equal(nextCateringActivityPage({ page: 1, totalPages: 3 }), 2); assert.equal(nextCateringActivityPage({ page: 3, totalPages: 3 }), undefined); });
test("clean provider and customer forms hydrate from refreshed server values", () => { assert.equal(hydrateWorkspaceForm({ identity: "actor:booking", value: "old", dirty: false }, "actor:booking", "new").value, "new"); assert.equal(hydrateWorkspaceForm({ identity: "actor:booking", value: "old notes", dirty: false }, "actor:booking", "new notes").value, "new notes"); });
test("dirty provider and customer forms survive background refresh independently", () => { const provider = editWorkspaceForm({ identity: "actor:booking", value: "server venue", dirty: false }, "draft venue"); const customer = { identity: "actor:booking", value: "server notes", dirty: false }; assert.equal(hydrateWorkspaceForm(provider, "actor:booking", "other participant update").value, "draft venue"); assert.equal(hydrateWorkspaceForm(customer, "actor:booking", "refreshed notes").value, "refreshed notes"); assert.equal(hydrateWorkspaceForm(editWorkspaceForm(customer, "draft notes"), "actor:booking", "background notes").value, "draft notes"); });
test("save clears dirty state and booking or actor identity changes reset drafts", () => { assert.deepEqual(saveWorkspaceForm("actor:booking", "saved"), { identity: "actor:booking", value: "saved", dirty: false }); const dirty = editWorkspaceForm({ identity: "actor:booking", value: "old", dirty: false }, "unsaved"); assert.deepEqual(hydrateWorkspaceForm(dirty, "actor:new-booking", "new booking"), { identity: "actor:new-booking", value: "new booking", dirty: false }); assert.equal(hydrateWorkspaceForm(dirty, "new-actor:booking", "new actor").value, "new actor"); });
test("unchanged provider and customer submissions accept the authoritative response", () => { const provider = { identity: "actor:booking", value: { venueName: "Submitted" }, dirty: true }; assert.deepEqual(reconcileWorkspaceFormAfterSave(provider, "actor:booking", { venueName: "Submitted" }, { venueName: "Server" }), { identity: "actor:booking", value: { venueName: "Server" }, dirty: false }); const customer = { identity: "actor:booking", value: "Submitted notes", dirty: true }; assert.deepEqual(reconcileWorkspaceFormAfterSave(customer, "actor:booking", "Submitted notes", "Server notes"), { identity: "actor:booking", value: "Server notes", dirty: false }); });
test("provider and customer edits made in flight remain dirty after success", () => { const provider = { identity: "actor:booking", value: { venueName: "Newer edit" }, dirty: true }; assert.deepEqual(reconcileWorkspaceFormAfterSave(provider, "actor:booking", { venueName: "Submitted" }, { venueName: "Server" }), provider); const customer = { identity: "actor:booking", value: "Newer notes", dirty: true }; assert.deepEqual(reconcileWorkspaceFormAfterSave(customer, "actor:booking", "Submitted notes", "Server notes"), customer); });
test("stale save identity and failures preserve current form state", () => { const current = { identity: "new-actor:new-booking", value: "New draft", dirty: true }; assert.deepEqual(reconcileWorkspaceFormAfterSave(current, "old-actor:old-booking", "Old submitted", "Old server"), current); assert.equal(preserveWorkspaceFormAfterSaveFailure(current), current); });
test("provider draft includes every supported operational field and preserves false and null", () => { const draft = providerDraftFrom({ ...emptyDetails, accessNotes: "Gate B", kitchenAvailable: false, refrigerationAvailable: true, powerAvailable: false, waterAvailable: null, indoorOutdoor: "both", providerNotes: "Private" }); assert.deepEqual({ accessNotes: draft.accessNotes, kitchenAvailable: draft.kitchenAvailable, refrigerationAvailable: draft.refrigerationAvailable, powerAvailable: draft.powerAvailable, waterAvailable: draft.waterAvailable, indoorOutdoor: draft.indoorOutdoor }, { accessNotes: "Gate B", kitchenAvailable: false, refrigerationAvailable: true, powerAvailable: false, waterAvailable: null, indoorOutdoor: "both" }); });
test("new provider fields participate in save reconciliation", () => { const submitted = providerDraftFrom({ ...emptyDetails, kitchenAvailable: false, accessNotes: "Submitted" }); const clean = reconcileWorkspaceFormAfterSave({ identity: "actor:booking", value: submitted, dirty: true }, "actor:booking", { ...submitted }, { ...submitted, accessNotes: "Server" }); assert.equal(clean.dirty, false); assert.equal(clean.value.accessNotes, "Server"); const newer = { ...submitted, kitchenAvailable: true }; assert.deepEqual(reconcileWorkspaceFormAfterSave({ identity: "actor:booking", value: newer, dirty: true }, "actor:booking", submitted, submitted), { identity: "actor:booking", value: newer, dirty: true }); });
test("task create payload includes metadata without date or time conversion", () => { assert.deepEqual(cateringTaskCreatePayload({ title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared" }), { title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared" }); assert.deepEqual(cateringTaskCreatePayload(EMPTY_CATERING_TASK_DRAFT), { title: "", description: null, dueDate: null, dueTime: null, visibility: "provider" }); });
test("structured task draft clears only when unchanged and survives newer metadata or failure", () => { const submitted = { title: "Confirm rentals", description: "First", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared" as const }; assert.deepEqual(reconcileWorkspaceFormAfterSave({ identity: "actor:booking", value: submitted, dirty: true }, "actor:booking", { ...submitted }, EMPTY_CATERING_TASK_DRAFT), { identity: "actor:booking", value: EMPTY_CATERING_TASK_DRAFT, dirty: false }); const newer = { ...submitted, description: "Next task draft" }; const current = { identity: "actor:booking", value: newer, dirty: true }; assert.deepEqual(reconcileWorkspaceFormAfterSave(current, "actor:booking", submitted, EMPTY_CATERING_TASK_DRAFT), current); assert.equal(preserveWorkspaceFormAfterSaveFailure(current), current); });
test("task deadlines render every supported date and wall-clock combination", () => { assert.equal(formatCateringTaskDeadline("2026-09-15", "17:30"), "Due Sep 15, 2026 at 17:30"); assert.equal(formatCateringTaskDeadline("2026-09-15", null), "Due Sep 15, 2026"); assert.equal(formatCateringTaskDeadline(null, "17:30"), "Due at 17:30"); assert.equal(formatCateringTaskDeadline(null, null), null); });

const editorDraft: CateringTaskDraft = { title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared" };
const submittedEdit: SubmittedTaskEdit = { identity: "actor:booking", taskId: "task-1", draft: editorDraft };
const openEditor = (draft: CateringTaskDraft = editorDraft, taskId = "task-1", identity = "actor:booking") => ({ identity, taskId, draft });

test("a successful task patch closes the still-unchanged submitted editor", () => assert.equal(closeTaskEditorAfterSave(openEditor({ ...editorDraft }), submittedEdit), null));
test("a failed task patch leaves the editor open", () => { const current = openEditor(); assert.equal(preserveTaskEditorAfterSaveFailure(current), current); assert.notEqual(current, null); });
test("a failed task patch preserves every entered task edit field", () => {
  const entered = { title: "Edited title", description: "Edited description", dueDate: "2026-10-01", dueTime: "08:15", visibility: "provider" as const };
  const preserved = preserveTaskEditorAfterSaveFailure(openEditor(entered));
  assert.equal(preserved?.draft.title, "Edited title");
  assert.equal(preserved?.draft.description, "Edited description");
  assert.equal(preserved?.draft.dueDate, "2026-10-01");
  assert.equal(preserved?.draft.dueTime, "08:15");
  assert.equal(preserved?.draft.visibility, "provider");
  assert.equal(preserved?.taskId, "task-1");
});
test("an edit made while the task patch is in flight survives the success", () => {
  const newerEdits: Array<Partial<CateringTaskDraft>> = [{ title: "Newer title" }, { description: "Newer description" }, { dueDate: "2026-12-24" }, { dueTime: "23:59" }, { visibility: "provider" }];
  for (const newer of newerEdits) {
    const current = openEditor({ ...editorDraft, ...newer });
    assert.deepEqual(closeTaskEditorAfterSave(current, submittedEdit), current);
  }
});
test("switching to another task survives a stale task patch success", () => { const current = openEditor(editorDraft, "task-2"); assert.deepEqual(closeTaskEditorAfterSave(current, submittedEdit), current); });
test("a stale actor or booking response cannot close the current task editor", () => {
  for (const identity of ["other-actor:booking", "actor:other-booking"]) { const current = openEditor(editorDraft, "task-1", identity); assert.deepEqual(closeTaskEditorAfterSave(current, submittedEdit), current); }
  assert.equal(activeTaskEditor(openEditor(editorDraft, "task-1", "old-actor:old-booking"), "actor:booking"), null);
  assert.deepEqual(activeTaskEditor(openEditor(), "actor:booking"), openEditor());
});
test("an unrelated mutation success never closes an open task editor", () => { const current = openEditor(); assert.deepEqual(closeTaskEditorAfterSave(current, { ...submittedEdit, taskId: "unrelated-task" }), current); assert.equal(closeTaskEditorAfterSave(null, submittedEdit), null); });
test("task draft equality compares every editable task field", () => {
  assert.equal(cateringTaskDraftsEqual(editorDraft, { ...editorDraft }), true);
  for (const changed of [{ title: "changed" }, { description: "changed" }, { dueDate: "2026-01-01" }, { dueTime: "00:00" }] as Array<Partial<CateringTaskDraft>>) assert.equal(cateringTaskDraftsEqual(editorDraft, { ...editorDraft, ...changed }), false);
  assert.equal(cateringTaskDraftsEqual(editorDraft, { ...editorDraft, visibility: "provider" }), false);
});
test("provider field edits apply to the current form value, never a stale render snapshot", () => {
  const hydrated = { identity: "actor:booking", value: providerDraftFrom({ ...emptyDetails, venueName: "Server venue", accessNotes: "Server access" }), dirty: false };
  const edited = editWorkspaceFormField(hydrated, "venueCity", "Austin");
  assert.equal(edited.value?.venueCity, "Austin");
  assert.equal(edited.value?.venueName, "Server venue");
  assert.equal(edited.value?.accessNotes, "Server access");
  assert.equal(edited.dirty, true);
  const chained = editWorkspaceFormField(edited, "venueState", "TX");
  assert.equal(chained.value?.venueCity, "Austin");
  assert.equal(chained.value?.venueState, "TX");
  assert.equal(editWorkspaceFormField<ProviderDetailsDraft, "venueCity">({ identity: "actor:booking", value: null, dirty: false }, "venueCity", "Austin").value, null);
});
