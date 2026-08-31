import assert from "node:assert/strict";
import test from "node:test";
import { cateringBookingProviderDetailsSchema, type CateringBookingActivityView, type CateringBookingDetailsView, type CateringBookingTaskView } from "@shared/catering-booking-operations";
import { activeTaskEditor, cateringTaskCreatePayload, cateringTaskDeletePayload, cateringTaskDraftsEqual, cateringTaskEditPayload, cateringTaskStatusPayload, cateringWorkspaceErrorCode, closeTaskEditorAfterSave, isCateringTaskNotFound, combineCateringActivityPages, editTaskEditorField, editWorkspaceForm, editWorkspaceFormField, EMPTY_CATERING_TASK_DRAFT, formatCateringTaskDeadline, historicalOperationalDetails, hydrateWorkspaceForm, isCateringTaskVersionConflict, markTaskEditorConflict, maySubmitTaskEditor, nextCateringActivityPage, normalizeOptionalWallClockInput, openTaskEditor, preserveTaskEditorAfterSaveFailure, preserveWorkspaceFormAfterSaveFailure, providerDraftFrom, reconcileTaskEditorWithTasks, reconcileWorkspaceFormAfterSave, saveWorkspaceForm, shouldRefetchWorkspaceAfterError, splitCateringWorkspaceTasks, taskEditorForTask, type CateringTaskDraft, type OpenTaskEditorState, type ProviderDetailsDraft, type SubmittedTaskEdit } from "./catering-booking-workspace-state";

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
const TASK_VERSION = "2026-08-29T00:00:00.000Z";
const submittedEdit: SubmittedTaskEdit = { identity: "actor:booking", taskId: "task-1", draft: editorDraft, expectedUpdatedAt: TASK_VERSION };
const openEditor = (draft: CateringTaskDraft = editorDraft, taskId = "task-1", identity = "actor:booking", expectedUpdatedAt = TASK_VERSION, conflict = false): OpenTaskEditorState => ({ identity, taskId, draft, expectedUpdatedAt, conflict });

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

const timeFields = ["arrivalTime", "serviceStartTime", "serviceEndTime"] as const;
const hydratedTimes = (times: Partial<Record<(typeof timeFields)[number], string | null>>) => ({ identity: "actor:booking", value: providerDraftFrom({ ...emptyDetails, arrivalTime: "15:00", serviceStartTime: "17:30", serviceEndTime: "21:00", ...times }), dirty: false });

test("a valid wall-clock entry reaches the provider draft unchanged", () => {
  for (const field of timeFields) for (const entered of ["00:00", "09:05", "17:30", "23:59"]) {
    assert.equal(normalizeOptionalWallClockInput(entered), entered);
    assert.equal(editWorkspaceFormField(hydratedTimes({}), field, normalizeOptionalWallClockInput(entered)).value?.[field], entered);
  }
});
test("clearing a provider service time stores null rather than an empty string", () => {
  for (const field of timeFields) {
    assert.equal(normalizeOptionalWallClockInput(""), null);
    const cleared = editWorkspaceFormField(hydratedTimes({}), field, normalizeOptionalWallClockInput(""));
    assert.equal(cleared.value?.[field], null);
    assert.equal(cleared.dirty, true);
  }
});
test("a persisted service time can be cleared and submitted, and an empty string stays rejected", () => {
  for (const field of timeFields) {
    const cleared = editWorkspaceFormField(hydratedTimes({}), field, normalizeOptionalWallClockInput(""));
    const submitted = cateringBookingProviderDetailsSchema.safeParse(cleared.value);
    assert.equal(submitted.success, true);
    assert.equal(submitted.success && submitted.data[field], null);
    assert.equal(cateringBookingProviderDetailsSchema.safeParse({ ...cleared.value, [field]: "" }).success, false);
  }
});
test("clearing one service time leaves the other operational values untouched", () => {
  const cleared = editWorkspaceFormField(hydratedTimes({}), "serviceStartTime", normalizeOptionalWallClockInput(""));
  assert.equal(cleared.value?.serviceStartTime, null);
  assert.equal(cleared.value?.arrivalTime, "15:00");
  assert.equal(cleared.value?.serviceEndTime, "21:00");
});
test("service times stay event-local wall clock, with no date, UTC, or browser-timezone conversion", () => {
  for (let hour = 0; hour < 24; hour += 1) for (const minute of ["00", "30", "59"]) {
    const entered = `${String(hour).padStart(2, "0")}:${minute}`;
    assert.equal(normalizeOptionalWallClockInput(entered), entered);
    for (const field of timeFields) assert.equal(editWorkspaceFormField(hydratedTimes({}), field, normalizeOptionalWallClockInput(entered)).value?.[field], entered);
  }
});

const taskView = (id: string, visibility: "provider" | "shared", overrides: Partial<CateringBookingTaskView> = {}): CateringBookingTaskView => ({ id, title: "Confirm rentals", description: "Call supplier", status: "pending", visibility, dueDate: "2026-09-15", dueTime: "17:30", sortOrder: 0, createdAt: "2026-08-29T00:00:00.000Z", completedAt: null, updatedAt: "2026-08-29T00:00:00.000Z", ...overrides });
const sectionsRenderingEditor = (editor: OpenTaskEditorState | null, identity: string, tasks: CateringBookingTaskView[]) => {
  const { privateTasks, requirements } = splitCateringWorkspaceTasks(tasks);
  return { checklist: privateTasks.filter((task) => taskEditorForTask(editor, identity, task.id)).map((task) => task.id), requirements: requirements.filter((task) => taskEditorForTask(editor, identity, task.id)).map((task) => task.id) };
};

test("opening the editor copies the persisted task and its authoritative version without inventing values", () => {
  assert.deepEqual(openTaskEditor("actor:booking", taskView("task-1", "provider")), { identity: "actor:booking", taskId: "task-1", draft: { title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "provider" }, expectedUpdatedAt: TASK_VERSION, conflict: false });
  assert.deepEqual(openTaskEditor("actor:booking", taskView("task-1", "shared", { description: null, dueDate: null, dueTime: null }))?.draft, { title: "Confirm rentals", description: "", dueDate: "", dueTime: "", visibility: "shared" });
  assert.equal(openTaskEditor("actor:booking", taskView("task-1", "shared", { updatedAt: "2026-08-30T09:15:00.000Z" }))?.expectedUpdatedAt, "2026-08-30T09:15:00.000Z");
});
test("one workspace editor is shared across the private and shared task sections", () => {
  const tasks = [taskView("task-1", "provider"), taskView("task-2", "shared")];
  assert.deepEqual(sectionsRenderingEditor(openEditor(editorDraft, "task-1"), "actor:booking", tasks), { checklist: ["task-1"], requirements: [] });
  assert.deepEqual(sectionsRenderingEditor(openEditor(editorDraft, "task-2"), "actor:booking", tasks), { checklist: [], requirements: ["task-2"] });
  assert.deepEqual(sectionsRenderingEditor(null, "actor:booking", tasks), { checklist: [], requirements: [] });
  assert.deepEqual(sectionsRenderingEditor(openEditor(editorDraft, "task-1", "other-actor:booking"), "actor:booking", tasks), { checklist: [], requirements: [] });
});
test("a provider-to-shared patch with a newer in-flight edit keeps the editor and follows the task into requirements", () => {
  const submitted: SubmittedTaskEdit = { identity: "actor:booking", taskId: "task-1", draft: { ...editorDraft, visibility: "shared" }, expectedUpdatedAt: TASK_VERSION };
  const newer = editTaskEditorField(openEditor({ ...submitted.draft }), "actor:booking", "task-1", "description", "Newer description");
  const afterSuccess = closeTaskEditorAfterSave(newer, submitted);
  assert.deepEqual(afterSuccess, newer);
  assert.equal(afterSuccess?.draft.description, "Newer description");
  assert.equal(afterSuccess?.draft.visibility, "shared");
  assert.deepEqual(sectionsRenderingEditor(afterSuccess, "actor:booking", [taskView("task-1", "shared"), taskView("task-2", "provider")]), { checklist: [], requirements: ["task-1"] });
});
test("a shared-to-provider patch with a newer in-flight edit keeps the editor and follows the task into the checklist", () => {
  const submitted: SubmittedTaskEdit = { identity: "actor:booking", taskId: "task-1", draft: { ...editorDraft, visibility: "provider" }, expectedUpdatedAt: TASK_VERSION };
  const newer = editTaskEditorField(openEditor({ ...submitted.draft }), "actor:booking", "task-1", "title", "Newer title");
  const afterSuccess = closeTaskEditorAfterSave(newer, submitted);
  assert.deepEqual(afterSuccess, newer);
  assert.equal(afterSuccess?.draft.title, "Newer title");
  assert.equal(afterSuccess?.draft.visibility, "provider");
  assert.deepEqual(sectionsRenderingEditor(afterSuccess, "actor:booking", [taskView("task-1", "provider"), taskView("task-2", "shared")]), { checklist: ["task-1"], requirements: [] });
});
test("a visibility patch with no newer edit closes the editor in both directions", () => {
  for (const visibility of ["shared", "provider"] as const) {
    const submitted: SubmittedTaskEdit = { identity: "actor:booking", taskId: "task-1", draft: { ...editorDraft, visibility }, expectedUpdatedAt: TASK_VERSION };
    assert.equal(closeTaskEditorAfterSave(openEditor({ ...submitted.draft }), submitted), null);
  }
});
test("a failed visibility patch preserves the editor and every entered field", () => {
  const current = editTaskEditorField(openEditor({ ...editorDraft, visibility: "shared" }), "actor:booking", "task-1", "dueTime", "08:15");
  const preserved = preserveTaskEditorAfterSaveFailure(current);
  assert.deepEqual(preserved, current);
  assert.equal(preserved?.draft.visibility, "shared");
  assert.equal(preserved?.draft.dueTime, "08:15");
  assert.deepEqual(sectionsRenderingEditor(preserved, "actor:booking", [taskView("task-1", "provider")]), { checklist: ["task-1"], requirements: [] });
});
test("switching tasks or workspaces during a visibility patch stays safe", () => {
  const submitted: SubmittedTaskEdit = { identity: "actor:booking", taskId: "task-1", draft: { ...editorDraft, visibility: "shared" }, expectedUpdatedAt: TASK_VERSION };
  const otherTask = openEditor(editorDraft, "task-2");
  assert.deepEqual(closeTaskEditorAfterSave(otherTask, submitted), otherTask);
  const otherWorkspace = openEditor(editorDraft, "task-1", "actor:other-booking");
  assert.deepEqual(closeTaskEditorAfterSave(otherWorkspace, submitted), otherWorkspace);
  assert.equal(activeTaskEditor(otherWorkspace, "actor:booking"), null);
});
test("an unrelated mutation success never closes the hoisted task editor", () => {
  const current = openEditor({ ...editorDraft, visibility: "shared" });
  assert.deepEqual(closeTaskEditorAfterSave(current, { ...submittedEdit, taskId: "unrelated-task" }), current);
  assert.deepEqual(closeTaskEditorAfterSave(current, { ...submittedEdit, identity: "actor:other-booking", draft: current.draft }), current);
});
test("task editor field edits apply to the current draft, never a stale render snapshot", () => {
  const opened = openTaskEditor("actor:booking", taskView("task-1", "provider"));
  const titled = editTaskEditorField(opened, "actor:booking", "task-1", "title", "Edited title");
  const chained = editTaskEditorField(titled, "actor:booking", "task-1", "visibility", "shared");
  assert.equal(chained?.draft.title, "Edited title");
  assert.equal(chained?.draft.visibility, "shared");
  assert.equal(chained?.draft.dueTime, "17:30");
  assert.equal(editTaskEditorField(chained, "actor:booking", "task-2", "title", "Wrong task"), chained);
  assert.equal(editTaskEditorField(chained, "actor:other-booking", "task-1", "title", "Wrong workspace"), chained);
  assert.equal(editTaskEditorField(null, "actor:booking", "task-1", "title", "No editor"), null);
});
test("the workspace task split keeps every task in exactly one visibility section", () => {
  const tasks = [taskView("task-1", "provider"), taskView("task-2", "shared"), taskView("task-3", "provider")];
  assert.deepEqual(splitCateringWorkspaceTasks(tasks).privateTasks.map(({ id }) => id), ["task-1", "task-3"]);
  assert.deepEqual(splitCateringWorkspaceTasks(tasks).requirements.map(({ id }) => id), ["task-2"]);
  assert.deepEqual(splitCateringWorkspaceTasks([]), { privateTasks: [], requirements: [] });
});

test("every task update request carries the version it was based on", () => {
  assert.deepEqual(cateringTaskEditPayload(editorDraft, TASK_VERSION), { title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared", expectedUpdatedAt: TASK_VERSION });
  assert.deepEqual(cateringTaskEditPayload(EMPTY_CATERING_TASK_DRAFT, TASK_VERSION), { title: "", description: null, dueDate: null, dueTime: null, visibility: "provider", expectedUpdatedAt: TASK_VERSION });
  const editor = openTaskEditor("actor:booking", taskView("task-1", "provider", { updatedAt: "2026-08-30T09:15:00.000Z" }))!;
  assert.equal(cateringTaskEditPayload(editor.draft, editor.expectedUpdatedAt).expectedUpdatedAt, "2026-08-30T09:15:00.000Z");
  assert.deepEqual(cateringTaskStatusPayload(taskView("task-1", "provider")), { status: "completed", expectedUpdatedAt: TASK_VERSION });
  assert.deepEqual(cateringTaskStatusPayload(taskView("task-1", "shared", { status: "completed", updatedAt: "2026-08-30T09:15:00.000Z" })), { status: "pending", expectedUpdatedAt: "2026-08-30T09:15:00.000Z" });
});
test("a submitted edit keeps the version its draft was based on, not whatever arrives later", () => {
  const editor = openTaskEditor("actor:booking", taskView("task-1", "provider"))!;
  const edited = editTaskEditorField(editor, "actor:booking", "task-1", "title", "Edited title")!;
  assert.equal(edited.expectedUpdatedAt, TASK_VERSION);
  assert.equal(editTaskEditorField(edited, "actor:booking", "task-1", "visibility", "shared")?.expectedUpdatedAt, TASK_VERSION);
});
test("only a task version conflict is recognised as one", () => {
  assert.equal(isCateringTaskVersionConflict(Object.assign(new Error("stale"), { code: "task_version_conflict" })), true);
  for (const other of [Object.assign(new Error("read only"), { code: "other" }), new Error("network"), null, undefined, "task_version_conflict"]) assert.equal(isCateringTaskVersionConflict(other), false);
});
test("a rejected precondition marks the editor stale without touching the draft", () => {
  const current = editTaskEditorField(openEditor(), "actor:booking", "task-1", "title", "Edited title");
  const conflicted = markTaskEditorConflict(current, submittedEdit);
  assert.equal(conflicted?.conflict, true);
  assert.equal(conflicted?.taskId, "task-1");
  assert.equal(conflicted?.expectedUpdatedAt, TASK_VERSION);
  assert.deepEqual(conflicted?.draft, { ...editorDraft, title: "Edited title" });
  assert.equal(maySubmitTaskEditor(current), true);
  assert.equal(maySubmitTaskEditor(conflicted), false);
  assert.equal(maySubmitTaskEditor(null), false);
});
test("a stale draft survives a conflict and every further keystroke, and still may not be resubmitted", () => {
  const conflicted = markTaskEditorConflict(openEditor(), submittedEdit);
  const stillEditing = editTaskEditorField(conflicted, "actor:booking", "task-1", "description", "Typed after the conflict");
  assert.equal(stillEditing?.conflict, true);
  assert.equal(stillEditing?.draft.description, "Typed after the conflict");
  assert.equal(stillEditing?.expectedUpdatedAt, TASK_VERSION);
  assert.equal(maySubmitTaskEditor(stillEditing), false);
  assert.deepEqual(sectionsRenderingEditor(stillEditing, "actor:booking", [taskView("task-1", "provider")]), { checklist: ["task-1"], requirements: [] });
});
test("reloading the latest task clears the conflict and rebases the editor on the newest version", () => {
  const conflicted = markTaskEditorConflict(openEditor(), submittedEdit);
  const reopened = openTaskEditor("actor:booking", taskView("task-1", "shared", { title: "Newer server title", updatedAt: "2026-08-30T09:15:00.000Z" }));
  assert.equal(reopened?.conflict, false);
  assert.equal(reopened?.expectedUpdatedAt, "2026-08-30T09:15:00.000Z");
  assert.equal(reopened?.draft.title, "Newer server title");
  assert.equal(maySubmitTaskEditor(reopened), true);
  assert.notEqual(conflicted?.expectedUpdatedAt, reopened?.expectedUpdatedAt);
});
test("a conflict from another task, workspace, or already-rebased editor is ignored", () => {
  assert.equal(markTaskEditorConflict(null, submittedEdit), null);
  for (const current of [openEditor(editorDraft, "task-2"), openEditor(editorDraft, "task-1", "actor:other-booking"), openEditor(editorDraft, "task-1", "actor:booking", "2026-08-30T09:15:00.000Z")]) assert.deepEqual(markTaskEditorConflict(current, submittedEdit), current);
  const already = openEditor(editorDraft, "task-1", "actor:booking", TASK_VERSION, true);
  assert.equal(markTaskEditorConflict(already, submittedEdit), already);
});
test("a success against a version the editor no longer holds cannot close it", () => {
  const rebased = openEditor(editorDraft, "task-1", "actor:booking", "2026-08-30T09:15:00.000Z");
  assert.deepEqual(closeTaskEditorAfterSave(rebased, submittedEdit), rebased);
  assert.equal(closeTaskEditorAfterSave(openEditor(), submittedEdit), null);
});

test("deleting a task sends the version of the task the provider confirmed deleting", () => {
  assert.deepEqual(cateringTaskDeletePayload(taskView("task-1", "shared")), { expectedUpdatedAt: TASK_VERSION });
  assert.deepEqual(cateringTaskDeletePayload(taskView("task-2", "provider", { updatedAt: "2026-08-30T09:15:00.000Z" })), { expectedUpdatedAt: "2026-08-30T09:15:00.000Z" });
  const [older, newer] = [taskView("task-1", "shared"), taskView("task-2", "shared", { updatedAt: "2026-08-30T09:15:00.000Z" })];
  assert.notDeepEqual(cateringTaskDeletePayload(older), cateringTaskDeletePayload(newer));
});
test("a workspace behind the server is refetched, and nothing else is", () => {
  const withCode = (code: string) => Object.assign(new Error("refused"), { code });
  assert.equal(shouldRefetchWorkspaceAfterError(withCode("task_version_conflict")), true);
  assert.equal(shouldRefetchWorkspaceAfterError(withCode("workspace_read_only")), true);
  for (const other of [withCode("other"), new Error("network"), null, undefined, "workspace_read_only"]) assert.equal(shouldRefetchWorkspaceAfterError(other), false);
  assert.equal(isCateringTaskVersionConflict(withCode("workspace_read_only")), false);
  assert.equal(cateringWorkspaceErrorCode(withCode("workspace_read_only")), "workspace_read_only");
  assert.equal(cateringWorkspaceErrorCode(new Error("network")), null);
});
test("a refused task creation keeps the draft the provider typed", () => {
  const typed = { identity: "actor:booking", value: { title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared" as const }, dirty: true };
  assert.equal(preserveWorkspaceFormAfterSaveFailure(typed), typed);
  assert.deepEqual(preserveWorkspaceFormAfterSaveFailure(typed).value, typed.value);
  assert.notDeepEqual(preserveWorkspaceFormAfterSaveFailure(typed).value, EMPTY_CATERING_TASK_DRAFT);
});

test("a task that no longer exists is classified apart from every other refusal", () => {
  const withCode = (code: string) => Object.assign(new Error("refused"), { code });
  assert.equal(isCateringTaskNotFound(withCode("catering_task_not_found")), true);
  assert.equal(shouldRefetchWorkspaceAfterError(withCode("catering_task_not_found")), true);
  assert.equal(isCateringTaskNotFound(withCode("task_version_conflict")), false);
  assert.equal(isCateringTaskNotFound(withCode("workspace_read_only")), false);
  assert.equal(isCateringTaskVersionConflict(withCode("catering_task_not_found")), false);
  for (const ordinary of [Object.assign(new Error("Booking workspace not found"), {}), withCode("other"), null, undefined, "catering_task_not_found"]) {
    assert.equal(isCateringTaskNotFound(ordinary), false);
    assert.equal(shouldRefetchWorkspaceAfterError(ordinary), false);
  }
});
test("a coded details read-only refusal refreshes the workspace and an invalid range does not", () => {
  assert.equal(shouldRefetchWorkspaceAfterError(Object.assign(new Error("Booking became read-only before the event details could be saved"), { code: "workspace_read_only" })), true);
  assert.equal(shouldRefetchWorkspaceAfterError(new Error("The resulting service time range is invalid: service end time must not precede service start time")), false);
});
test("a refused details save keeps the newer dirty draft for both participants", () => {
  const provider = { identity: "actor:booking", value: providerDraftFrom({ ...emptyDetails, venueCity: "Dallas", serviceEndTime: "16:00" }), dirty: true };
  assert.equal(preserveWorkspaceFormAfterSaveFailure(provider), provider);
  assert.equal(preserveWorkspaceFormAfterSaveFailure(provider).value?.venueCity, "Dallas");
  assert.equal(preserveWorkspaceFormAfterSaveFailure(provider).value?.serviceEndTime, "16:00");
  const customer = { identity: "actor:booking", value: "Please arrive early", dirty: true };
  assert.equal(preserveWorkspaceFormAfterSaveFailure(customer).value, "Please arrive early");
});
test("an editor closes once the authoritative task set says its task is gone", () => {
  const open = openEditor(editorDraft, "task-1");
  assert.equal(reconcileTaskEditorWithTasks(open, "actor:booking", ["task-2", "task-3"]), null);
  assert.equal(reconcileTaskEditorWithTasks(open, "actor:booking", []), null);
  assert.deepEqual(sectionsRenderingEditor(reconcileTaskEditorWithTasks(open, "actor:booking", []), "actor:booking", [taskView("task-2", "provider")]), { checklist: [], requirements: [] });
});
test("an editor whose task still exists survives the authoritative refresh, wherever the task now lives", () => {
  for (const editor of [openEditor(editorDraft, "task-1"), markTaskEditorConflict(openEditor(), submittedEdit), editTaskEditorField(openEditor(), "actor:booking", "task-1", "visibility", "shared")]) {
    assert.deepEqual(reconcileTaskEditorWithTasks(editor, "actor:booking", ["task-1", "task-2"]), editor);
  }
  const moved = editTaskEditorField(openEditor(), "actor:booking", "task-1", "title", "Newer title");
  const survived = reconcileTaskEditorWithTasks(moved, "actor:booking", ["task-1"]);
  assert.equal(survived?.draft.title, "Newer title");
  assert.deepEqual(sectionsRenderingEditor(survived, "actor:booking", [taskView("task-1", "shared")]), { checklist: [], requirements: ["task-1"] });
});
test("another workspace's task set never closes the current editor", () => {
  const open = openEditor(editorDraft, "task-1");
  assert.equal(reconcileTaskEditorWithTasks(open, "actor:other-booking", []), open);
  assert.equal(reconcileTaskEditorWithTasks(null, "actor:booking", ["task-1"]), null);
});
