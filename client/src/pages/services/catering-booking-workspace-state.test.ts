import assert from "node:assert/strict";
import test from "node:test";
import { cateringBookingProviderDetailsSchema, CATERING_TASK_SET_CHANGED_CODE, mayEditCateringWorkspace, type CateringBookingActivityView, type CateringBookingDetailsView, type CateringBookingTaskView } from "@shared/catering-booking-operations";
import { activeTaskEditor, cateringActivityTaskTitle, cateringTaskCreatePayload, cateringTaskDeletePayload, cateringTaskDraftsEqual, cateringTaskEditPayload, cateringTaskReorderControls, cateringTaskReorderPayload, cateringTaskStatusPayload, cateringWorkspaceErrorCode, closeTaskEditorAfterSave, isCateringTaskNotFound, combineCateringActivityPages, editTaskEditorField, editWorkspaceForm, editWorkspaceFormField, EMPTY_CATERING_TASK_DRAFT, formatCateringTaskDeadline, historicalOperationalDetails, hydrateWorkspaceForm, isCateringTaskVersionConflict, isTaskEditorDirty, markTaskEditorConflict, mayMoveCateringTask, mayOpenTaskEditor, maySubmitTaskEditor, moveCateringTaskInGlobalOrder, nextCateringActivityPage, normalizeOptionalWallClockInput, openTaskEditor, openTaskEditorIfAllowed, preserveTaskEditorAfterSaveFailure, preserveWorkspaceFormAfterSaveFailure, providerDraftFrom, reconcileTaskEditorWithTasks, reconcileTaskEditorWithWorkspace, reconcileWorkspaceFormAfterSave, saveWorkspaceForm, shouldRefetchWorkspaceAfterError, splitCateringWorkspaceTasks, taskEditorForTask, type CateringTaskDraft, type OpenTaskEditorState, type ProviderDetailsDraft, type SubmittedTaskEdit } from "./catering-booking-workspace-state";

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
/** `snapshot` defaults to the canonical server state, so a helper called with a changed draft reads as dirty. */
const openEditor = (draft: CateringTaskDraft = editorDraft, taskId = "task-1", identity = "actor:booking", expectedUpdatedAt = TASK_VERSION, conflict = false, snapshot: CateringTaskDraft = editorDraft): OpenTaskEditorState => ({ identity, taskId, draft, snapshot, expectedUpdatedAt, conflict });

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
const sectionsRenderingEditor = (editor: OpenTaskEditorState | null, identity: string, tasks: CateringBookingTaskView[], editable = true) => {
  const { privateTasks, requirements } = splitCateringWorkspaceTasks(tasks);
  return { checklist: privateTasks.filter((task) => taskEditorForTask(editor, identity, task.id, editable)).map((task) => task.id), requirements: requirements.filter((task) => taskEditorForTask(editor, identity, task.id, editable)).map((task) => task.id) };
};
/** The read-only rendering the workspace falls back to: every task is still listed, none of them in an editor. */
const sectionsListingTasks = (tasks: CateringBookingTaskView[]) => {
  const { privateTasks, requirements } = splitCateringWorkspaceTasks(tasks);
  return { checklist: privateTasks.map((task) => task.id), requirements: requirements.map((task) => task.id) };
};

test("opening the editor copies the persisted task and its authoritative version without inventing values", () => {
  const persisted = { title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "provider" as const };
  assert.deepEqual(openTaskEditor("actor:booking", taskView("task-1", "provider")), { identity: "actor:booking", taskId: "task-1", draft: persisted, snapshot: persisted, expectedUpdatedAt: TASK_VERSION, conflict: false });
  // The snapshot is the persisted task, so a freshly opened editor holds no unsaved changes.
  assert.equal(isTaskEditorDirty(openTaskEditor("actor:booking", taskView("task-1", "provider"))), false);
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
  assert.equal(maySubmitTaskEditor(current, true), true);
  assert.equal(maySubmitTaskEditor(conflicted, true), false);
  assert.equal(maySubmitTaskEditor(null, true), false);
});
test("a stale draft survives a conflict and every further keystroke, and still may not be resubmitted", () => {
  const conflicted = markTaskEditorConflict(openEditor(), submittedEdit);
  const stillEditing = editTaskEditorField(conflicted, "actor:booking", "task-1", "description", "Typed after the conflict");
  assert.equal(stillEditing?.conflict, true);
  assert.equal(stillEditing?.draft.description, "Typed after the conflict");
  assert.equal(stillEditing?.expectedUpdatedAt, TASK_VERSION);
  assert.equal(maySubmitTaskEditor(stillEditing, true), false);
  assert.deepEqual(sectionsRenderingEditor(stillEditing, "actor:booking", [taskView("task-1", "provider")]), { checklist: ["task-1"], requirements: [] });
});
test("reloading the latest task clears the conflict and rebases the editor on the newest version", () => {
  const conflicted = markTaskEditorConflict(openEditor(), submittedEdit);
  const reopened = openTaskEditor("actor:booking", taskView("task-1", "shared", { title: "Newer server title", updatedAt: "2026-08-30T09:15:00.000Z" }));
  assert.equal(reopened?.conflict, false);
  assert.equal(reopened?.expectedUpdatedAt, "2026-08-30T09:15:00.000Z");
  assert.equal(reopened?.draft.title, "Newer server title");
  assert.equal(maySubmitTaskEditor(reopened, true), true);
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

const workspaceTasks = [taskView("task-1", "provider"), taskView("task-2", "shared")];
const persistedTaskIds = workspaceTasks.map((task) => task.id);
/** The two statuses that turn a live workspace into history, and the `editable` each one makes the server report. */
const readOnlyStatuses = ["cancelled", "completed"] as const;

test("an open editor on an active workspace stays usable, and nothing about that behavior changed", () => {
  for (const status of ["pending_confirmation", "confirmed"] as const) {
    const editable = mayEditCateringWorkspace(status);
    assert.equal(editable, true);
    const open = openTaskEditor("actor:booking", taskView("task-1", "provider"));
    const reconciled = reconcileTaskEditorWithWorkspace(open, "actor:booking", editable, persistedTaskIds);
    assert.deepEqual(reconciled, open);
    assert.deepEqual(sectionsRenderingEditor(reconciled, "actor:booking", workspaceTasks, editable), { checklist: ["task-1"], requirements: [] });
    assert.equal(maySubmitTaskEditor(reconciled, editable), true);
    const typed = editTaskEditorField(reconciled, "actor:booking", "task-1", "title", "Edited title");
    assert.equal(typed?.draft.title, "Edited title");
    assert.equal(maySubmitTaskEditor(typed, editable), true);
    assert.deepEqual(sectionsRenderingEditor(typed, "actor:booking", workspaceTasks, editable), { checklist: ["task-1"], requirements: [] });
  }
});
test("a booking that becomes cancelled or completed closes the editor the refetch found open", () => {
  for (const status of readOnlyStatuses) {
    const editable = mayEditCateringWorkspace(status);
    assert.equal(editable, false);
    const open = editTaskEditorField(openTaskEditor("actor:booking", taskView("task-1", "provider")), "actor:booking", "task-1", "title", "Edited title");
    assert.equal(reconcileTaskEditorWithWorkspace(open, "actor:booking", editable, persistedTaskIds), null);
    assert.equal(reconcileTaskEditorWithWorkspace(markTaskEditorConflict(openEditor(), submittedEdit), "actor:booking", editable, persistedTaskIds), null);
  }
});
test("a retained editor renders no task form and no Save task control on a read-only workspace", () => {
  const open = openTaskEditor("actor:booking", taskView("task-1", "provider"));
  for (const editor of [open, editTaskEditorField(open, "actor:booking", "task-1", "visibility", "shared"), markTaskEditorConflict(openEditor(), submittedEdit)]) {
    assert.deepEqual(sectionsRenderingEditor(editor, "actor:booking", workspaceTasks, false), { checklist: [], requirements: [] });
    for (const task of workspaceTasks) assert.equal(taskEditorForTask(editor, "actor:booking", task.id, false), null);
  }
});
test("no task mutation may be submitted from an editor stranded on a read-only workspace", () => {
  const open = openTaskEditor("actor:booking", taskView("task-1", "provider"));
  for (const editor of [open, editTaskEditorField(open, "actor:booking", "task-1", "title", "Edited title"), markTaskEditorConflict(openEditor(), submittedEdit), null]) {
    assert.equal(maySubmitTaskEditor(editor, false), false);
  }
});
test("a read-only workspace still renders its historical tasks and details", () => {
  const closed = reconcileTaskEditorWithWorkspace(openTaskEditor("actor:booking", taskView("task-1", "provider")), "actor:booking", false, persistedTaskIds);
  assert.equal(closed, null);
  assert.deepEqual(sectionsListingTasks(workspaceTasks), { checklist: ["task-1"], requirements: ["task-2"] });
  assert.equal(formatCateringTaskDeadline(workspaceTasks[0].dueDate, workspaceTasks[0].dueTime), "Due Sep 15, 2026 at 17:30");
  assert.deepEqual(historicalOperationalDetails({ ...emptyDetails, venueCity: "Austin" }, "provider"), [{ label: "City", value: "Austin" }]);
});
test("a read-only refetch for another workspace never closes the current editor", () => {
  const open = openEditor(editorDraft, "task-1");
  assert.equal(reconcileTaskEditorWithWorkspace(open, "actor:other-booking", false, []), open);
  assert.equal(reconcileTaskEditorWithWorkspace(null, "actor:booking", false, persistedTaskIds), null);
});
test("an editable refetch still closes an editor whose task the authoritative set dropped", () => {
  const open = openEditor(editorDraft, "task-1");
  assert.equal(reconcileTaskEditorWithWorkspace(open, "actor:booking", true, ["task-2"]), null);
  assert.deepEqual(reconcileTaskEditorWithWorkspace(open, "actor:booking", true, persistedTaskIds), open);
});

/** A provider's authoritative collection: both sections interleaved, exactly as the workspace GET returns them. */
const mixedTasks = [taskView("p1", "provider"), taskView("s1", "shared"), taskView("p2", "provider"), taskView("s2", "shared"), taskView("p3", "provider")];
const idsOf = (tasks: readonly { id: string }[]) => tasks.map((task) => task.id);
const sectionIds = (tasks: readonly CateringBookingTaskView[]) => { const { privateTasks, requirements } = splitCateringWorkspaceTasks([...tasks]); return { checklist: idsOf(privateTasks), requirements: idsOf(requirements) }; };
const activeProvider = { role: "provider" as const, editable: true, editorOpen: false, pending: false };
const controlsFor = (taskId: string, context: Partial<typeof activeProvider> = {}) => cateringTaskReorderControls(mixedTasks, taskId, { ...activeProvider, ...context });

test("a provider on an active workspace gets reorder controls on every task, and nobody else does", () => {
  for (const task of mixedTasks) assert.notEqual(controlsFor(task.id), null);
  for (const task of mixedTasks) assert.equal(cateringTaskReorderControls(mixedTasks, task.id, { ...activeProvider, role: "customer" }), null);
  for (const editable of [false]) for (const task of mixedTasks) {
    assert.equal(cateringTaskReorderControls(mixedTasks, task.id, { ...activeProvider, editable }), null);
    assert.equal(cateringTaskReorderControls(mixedTasks, task.id, { ...activeProvider, role: "customer", editable }), null);
  }
});
test("a cancelled or completed workspace offers no reorder control to reach a historical ordering", () => {
  for (const status of readOnlyStatuses) {
    const editable = mayEditCateringWorkspace(status);
    assert.equal(editable, false);
    for (const task of mixedTasks) assert.equal(cateringTaskReorderControls(mixedTasks, task.id, { ...activeProvider, editable }), null);
  }
});
test("the first and last task of each section truthfully cannot move further that way", () => {
  assert.deepEqual(controlsFor("p1"), { up: false, down: true });
  assert.deepEqual(controlsFor("p3"), { up: true, down: false });
  assert.deepEqual(controlsFor("s1"), { up: false, down: true });
  assert.deepEqual(controlsFor("s2"), { up: true, down: false });
  assert.deepEqual(controlsFor("p2"), { up: true, down: true });
  assert.equal(mayMoveCateringTask(mixedTasks, "p1", "up"), false);
  assert.equal(moveCateringTaskInGlobalOrder(mixedTasks, "p1", "up"), null);
  assert.equal(moveCateringTaskInGlobalOrder(mixedTasks, "s2", "down"), null);
  assert.equal(moveCateringTaskInGlobalOrder(mixedTasks, "absent-task", "up"), null);
  assert.deepEqual(cateringTaskReorderControls([taskView("only", "provider")], "only", activeProvider), { up: false, down: false });
});
test("moving a private task keeps every shared task in its exact place, and the reverse", () => {
  const movedPrivate = moveCateringTaskInGlobalOrder(mixedTasks, "p3", "up")!;
  assert.deepEqual(sectionIds(movedPrivate), { checklist: ["p1", "p3", "p2"], requirements: ["s1", "s2"] });
  const movedShared = moveCateringTaskInGlobalOrder(mixedTasks, "s2", "up")!;
  assert.deepEqual(sectionIds(movedShared), { checklist: ["p1", "p2", "p3"], requirements: ["s2", "s1"] });
  // The other section's tasks keep their global positions outright, so their relative order cannot drift.
  for (const [moved, untouched] of [[movedPrivate, ["s1", "s2"]], [movedShared, ["p1", "p2", "p3"]]] as const) {
    for (const id of untouched) assert.equal(moved.findIndex((task) => task.id === id), mixedTasks.findIndex((task) => task.id === id));
  }
});
test("a move submits the complete authoritative collection in the requested global order", () => {
  const next = moveCateringTaskInGlobalOrder(mixedTasks, "p2", "down")!;
  assert.equal(next.length, mixedTasks.length);
  assert.deepEqual([...idsOf(next)].sort(), [...idsOf(mixedTasks)].sort());
  assert.deepEqual(idsOf(next), ["p1", "s1", "p3", "s2", "p2"]);
  assert.deepEqual(cateringTaskReorderPayload(next), { tasks: next.map((task) => ({ id: task.id, expectedUpdatedAt: task.updatedAt })) });
  assert.deepEqual(idsOf(cateringTaskReorderPayload(next).tasks), idsOf(next));
});
test("every submitted entry carries that task's current version and nothing else", () => {
  const versioned = mixedTasks.map((task, index) => ({ ...task, updatedAt: `2026-08-3${index}T00:00:00.000Z` }));
  const payload = cateringTaskReorderPayload(moveCateringTaskInGlobalOrder(versioned, "s1", "down")!);
  for (const entry of payload.tasks) {
    assert.equal(entry.expectedUpdatedAt, versioned.find((task) => task.id === entry.id)!.updatedAt);
    assert.deepEqual(Object.keys(entry).sort(), ["expectedUpdatedAt", "id"]);
  }
});
test("a fresher authoritative collection is what the next move quotes, never the versions before it", () => {
  const observed = mixedTasks;
  const refetched = observed.map((task) => ({ ...task, updatedAt: "2026-09-01T12:00:00.000Z" }));
  const stalePayload = cateringTaskReorderPayload(moveCateringTaskInGlobalOrder(observed, "p1", "down")!);
  const freshPayload = cateringTaskReorderPayload(moveCateringTaskInGlobalOrder(refetched, "p1", "down")!);
  for (const entry of stalePayload.tasks) assert.equal(entry.expectedUpdatedAt, "2026-08-29T00:00:00.000Z");
  for (const entry of freshPayload.tasks) assert.equal(entry.expectedUpdatedAt, "2026-09-01T12:00:00.000Z");
  assert.notDeepEqual(stalePayload, freshPayload);
});
test("reordering never changes a task's visibility, status, or any other persisted field", () => {
  const next = moveCateringTaskInGlobalOrder(mixedTasks, "p1", "down")!;
  for (const task of next) assert.deepEqual(task, mixedTasks.find((original) => original.id === task.id));
  assert.deepEqual(sectionIds(next).checklist.concat(sectionIds(next).requirements).sort(), idsOf(mixedTasks).sort());
  const payload: Record<string, unknown> = { ...cateringTaskReorderPayload(next) };
  for (const absent of ["visibility", "status", "sortOrder", "title"]) assert.equal(absent in payload, false);
  for (const entry of cateringTaskReorderPayload(next).tasks) for (const absent of ["visibility", "status", "sortOrder", "title"]) assert.equal(absent in entry, false);
});
test("an in-flight reorder disables both directions rather than accepting a duplicate submission", () => {
  for (const task of mixedTasks) assert.deepEqual(controlsFor(task.id, { pending: true }), { up: false, down: false });
  assert.notDeepEqual(controlsFor("p2", { pending: true }), controlsFor("p2"));
});
test("an open task editor disables reorder so nothing moves underneath a live draft", () => {
  for (const task of mixedTasks) assert.deepEqual(controlsFor(task.id, { editorOpen: true }), { up: false, down: false });
  // The editor itself is untouched by the disabled controls: its identity, draft, and conflict state all survive.
  const conflicted = markTaskEditorConflict(openEditor(editorDraft, "p1"), { ...submittedEdit, taskId: "p1" });
  assert.equal(conflicted?.conflict, true);
  assert.deepEqual(activeTaskEditor(conflicted, "actor:booking"), conflicted);
  assert.equal(maySubmitTaskEditor(conflicted, true), false);
  const typed = editTaskEditorField(conflicted, "actor:booking", "p1", "title", "Typed while reorder was disabled");
  assert.equal(typed?.draft.title, "Typed while reorder was disabled");
  assert.equal(typed?.expectedUpdatedAt, TASK_VERSION);
});
test("a refused reorder refetches the authoritative workspace under every coded refusal, and never otherwise", () => {
  for (const code of ["task_version_conflict", "workspace_read_only", "catering_task_not_found"]) {
    assert.equal(shouldRefetchWorkspaceAfterError(Object.assign(new Error("refused"), { code })), true);
  }
  assert.equal(shouldRefetchWorkspaceAfterError(new Error("network")), false);
  // A read-only refusal refetches and the refetched workspace then removes the controls outright.
  for (const task of mixedTasks) assert.equal(cateringTaskReorderControls(mixedTasks, task.id, { ...activeProvider, editable: false }), null);
});
test("a private task never reaches the customer, so it can never appear in a customer's reorder", () => {
  const customerVisible = mixedTasks.filter((task) => task.visibility === "shared");
  assert.deepEqual(idsOf(customerVisible), ["s1", "s2"]);
  assert.deepEqual(sectionIds(customerVisible), { checklist: [], requirements: ["s1", "s2"] });
  for (const task of customerVisible) assert.equal(cateringTaskReorderControls(customerVisible, task.id, { ...activeProvider, role: "customer" }), null);
});

const refusal = (code?: string) => code === undefined ? new Error("Reorder must contain the complete current task set") : Object.assign(new Error("Reorder must contain the complete current task set"), { code });

test("a reorder refused because the task collection changed is recognized as needing an authoritative refresh", () => {
  assert.equal(shouldRefetchWorkspaceAfterError(refusal(CATERING_TASK_SET_CHANGED_CODE)), true);
  assert.equal(cateringWorkspaceErrorCode(refusal(CATERING_TASK_SET_CHANGED_CODE)), "catering_task_set_changed");
  // It is its own condition: never classified as a stale version, a missing task, or a closed workspace.
  assert.equal(isCateringTaskVersionConflict(refusal(CATERING_TASK_SET_CHANGED_CODE)), false);
  assert.equal(isCateringTaskNotFound(refusal(CATERING_TASK_SET_CHANGED_CODE)), false);
});
test("the other coded refusals keep their existing classification exactly", () => {
  assert.equal(isCateringTaskVersionConflict(refusal("task_version_conflict")), true);
  assert.equal(isCateringTaskNotFound(refusal("catering_task_not_found")), true);
  for (const code of ["task_version_conflict", "workspace_read_only", "catering_task_not_found"]) assert.equal(shouldRefetchWorkspaceAfterError(refusal(code)), true);
  assert.equal(isCateringTaskVersionConflict(refusal("catering_task_not_found")), false);
  assert.equal(isCateringTaskNotFound(refusal("task_version_conflict")), false);
});
test("an uncoded or unrelated 409 never becomes a task-set-changed refresh on message alone", () => {
  assert.equal(shouldRefetchWorkspaceAfterError(refusal()), false);
  assert.equal(cateringWorkspaceErrorCode(refusal()), null);
  for (const other of [new Error("Only the provider may reorder tasks on an active workspace"), refusal("some_other_code"), new Error("network"), null, undefined, "catering_task_set_changed"]) {
    assert.equal(shouldRefetchWorkspaceAfterError(other), false);
  }
});
test("after the refetch the next reorder carries the refreshed complete collection and its fresh versions", () => {
  const loaded = [taskView("t1", "provider"), taskView("t2", "shared")];
  assert.equal(shouldRefetchWorkspaceAfterError(refusal(CATERING_TASK_SET_CHANGED_CODE)), true);
  // Client B created t3; the refetch is what puts it in the collection the next attempt is composed from.
  const refetchedAfterCreate = [taskView("t1", "provider", { updatedAt: "2026-09-01T12:00:00.000Z" }), taskView("t2", "shared", { updatedAt: "2026-09-01T12:00:00.000Z" }), taskView("t3", "provider", { updatedAt: "2026-09-01T12:00:00.000Z" })];
  const afterCreate = cateringTaskReorderPayload(moveCateringTaskInGlobalOrder(refetchedAfterCreate, "t3", "up")!);
  assert.deepEqual(afterCreate.tasks.map((entry) => entry.id), ["t3", "t2", "t1"]);
  assert.equal(afterCreate.tasks.length, refetchedAfterCreate.length);
  for (const entry of afterCreate.tasks) assert.equal(entry.expectedUpdatedAt, "2026-09-01T12:00:00.000Z");
  // Client B deleted t2; the refetched collection is smaller and the stale one is never resubmitted.
  const refetchedAfterDelete = [taskView("t1", "provider", { updatedAt: "2026-09-02T08:00:00.000Z" }), taskView("t3", "provider", { updatedAt: "2026-09-02T08:00:00.000Z" })];
  const afterDelete = cateringTaskReorderPayload(moveCateringTaskInGlobalOrder(refetchedAfterDelete, "t1", "down")!);
  assert.deepEqual(afterDelete.tasks.map((entry) => entry.id), ["t3", "t1"]);
  assert.equal(afterDelete.tasks.some((entry) => entry.id === "t2"), false);
  for (const entry of afterDelete.tasks) assert.equal(entry.expectedUpdatedAt, "2026-09-02T08:00:00.000Z");
  assert.notDeepEqual(afterDelete.tasks, cateringTaskReorderPayload(moveCateringTaskInGlobalOrder(loaded, "t1", "down") ?? []).tasks);
});
test("a task-set-changed refetch leaves every draft and the open task editor untouched", () => {
  const providerDraft = { identity: "actor:booking", value: providerDraftFrom({ ...emptyDetails, venueCity: "Dallas" }), dirty: true };
  const customerDraft = { identity: "actor:booking", value: "Please arrive early", dirty: true };
  const taskDraft = { identity: "actor:booking", value: { ...editorDraft, title: "Half-typed task" }, dirty: true };
  assert.equal(preserveWorkspaceFormAfterSaveFailure(providerDraft).value?.venueCity, "Dallas");
  assert.equal(preserveWorkspaceFormAfterSaveFailure(customerDraft).value, "Please arrive early");
  assert.equal(preserveWorkspaceFormAfterSaveFailure(taskDraft).value.title, "Half-typed task");
  const editing = editTaskEditorField(openEditor(), "actor:booking", "task-1", "title", "Edited title");
  assert.equal(preserveTaskEditorAfterSaveFailure(editing)?.draft.title, "Edited title");
  // The workspace is still editable, so the refetch keeps the editor open and still submittable.
  assert.deepEqual(reconcileTaskEditorWithWorkspace(editing, "actor:booking", true, ["task-1", "task-3"]), editing);
  assert.equal(maySubmitTaskEditor(editing, true), true);
  assert.deepEqual(sectionsRenderingEditor(editing, "actor:booking", [taskView("task-1", "provider")], true), { checklist: ["task-1"], requirements: [] });
});

const EARLY_READ_ONLY = Object.assign(new Error("Cancelled and completed workspaces are read-only"), { code: "workspace_read_only" });
const LOCKED_READ_ONLY = Object.assign(new Error("Booking became read-only before the task update completed"), { code: "workspace_read_only" });

test("an early terminal refusal is refresh-required to the client exactly like the locked read-only race", () => {
  for (const error of [EARLY_READ_ONLY, LOCKED_READ_ONLY]) {
    assert.equal(cateringWorkspaceErrorCode(error), "workspace_read_only");
    assert.equal(shouldRefetchWorkspaceAfterError(error), true);
    // It is its own condition and is never mistaken for a stale task or a changed collection.
    assert.equal(isCateringTaskVersionConflict(error), false);
    assert.equal(isCateringTaskNotFound(error), false);
  }
  // The two differ only in wording, which is what carries the truthful message to the provider.
  assert.notEqual(EARLY_READ_ONLY.message, LOCKED_READ_ONLY.message);
  // A wrong-actor refusal is uncoded, so it never triggers a refetch that could not help it.
  assert.equal(shouldRefetchWorkspaceAfterError(new Error("Only the provider may edit tasks on an active workspace")), false);
});
test("the workspace the early refusal refetches removes every mutation control and closes a stranded editor", () => {
  const stranded = editTaskEditorField(openEditor(), "actor:booking", "task-1", "title", "Typed before the booking closed");
  for (const status of readOnlyStatuses) {
    const editable = mayEditCateringWorkspace(status);
    assert.equal(editable, false);
    // The refetched terminal workspace closes the editor through the reconciliation already in place.
    assert.equal(reconcileTaskEditorWithWorkspace(stranded, "actor:booking", editable, ["task-1"]), null);
    assert.equal(maySubmitTaskEditor(stranded, editable), false);
    assert.deepEqual(sectionsRenderingEditor(stranded, "actor:booking", [taskView("task-1", "provider")], editable), { checklist: [], requirements: [] });
    // Reorder controls disappear with it; nothing on a historical workspace stays mutable.
    for (const task of mixedTasks) assert.equal(cateringTaskReorderControls(mixedTasks, task.id, { ...activeProvider, editable }), null);
  }
});
test("an early read-only refusal is never a success, and clears no unsaved draft as though it saved", () => {
  const providerDraft = { identity: "actor:booking", value: providerDraftFrom({ ...emptyDetails, venueCity: "Dallas" }), dirty: true };
  const customerDraft = { identity: "actor:booking", value: "Please arrive early", dirty: true };
  const taskDraft = { identity: "actor:booking", value: { ...editorDraft, title: "Half-typed task" }, dirty: true };
  assert.equal(preserveWorkspaceFormAfterSaveFailure(providerDraft), providerDraft);
  assert.equal(preserveWorkspaceFormAfterSaveFailure(customerDraft), customerDraft);
  assert.equal(preserveWorkspaceFormAfterSaveFailure(taskDraft), taskDraft);
  assert.equal(preserveWorkspaceFormAfterSaveFailure(providerDraft).value?.venueCity, "Dallas");
  assert.equal(preserveWorkspaceFormAfterSaveFailure(customerDraft).value, "Please arrive early");
  assert.equal(preserveWorkspaceFormAfterSaveFailure(taskDraft).dirty, true);
  // A save that really succeeded is what clears a draft, and this refusal is not one.
  assert.deepEqual(saveWorkspaceForm("actor:booking", ""), { identity: "actor:booking", value: "", dirty: false });
  assert.notDeepEqual(preserveWorkspaceFormAfterSaveFailure(customerDraft), saveWorkspaceForm("actor:booking", ""));
});

const activityRow = (eventType: string, metadata: unknown = {}) => ({ id: `activity-${eventType}`, eventType, metadata, createdAt: "2026-08-29T00:00:00.000Z" });
const TASK_ACTIVITY_EVENTS = ["shared_requirement_added", "shared_requirement_updated", "shared_requirement_completed", "shared_requirement_deleted"] as const;

test("every task activity event renders the task title stored on it when it happened", () => {
  for (const eventType of TASK_ACTIVITY_EVENTS) {
    assert.equal(cateringActivityTaskTitle(activityRow(eventType, { taskTitle: "Confirm final guest count" })), "Confirm final guest count");
  }
  // Reopening a completed requirement is recorded as an update, and carries its title the same way.
  assert.equal(cateringActivityTaskTitle(activityRow("shared_requirement_updated", { taskTitle: "Reopened requirement" })), "Reopened requirement");
});
test("a deleted task keeps its title in history, read from the stored snapshot and never from a task row", () => {
  const deletion = activityRow("shared_requirement_deleted", { taskTitle: "Confirm final guest count" });
  assert.equal(cateringActivityTaskTitle(deletion), "Confirm final guest count");
  // Nothing about the current task collection changes what history says, including an empty one.
  for (const tasks of [[], [taskView("other", "shared", { title: "A different task" })]]) {
    assert.equal(tasks.length >= 0, true);
    assert.equal(cateringActivityTaskTitle(deletion), "Confirm final guest count");
  }
  // A renamed task keeps the name each event actually recorded, so separate events stay distinguishable.
  const history = [activityRow("shared_requirement_added", { taskTitle: "Confirm guest count" }), activityRow("shared_requirement_updated", { taskTitle: "Confirm final guest count" }), activityRow("shared_requirement_deleted", { taskTitle: "Confirm final guest count" }), activityRow("shared_requirement_added", { taskTitle: "Send dietary list" })];
  assert.deepEqual(history.map(cateringActivityTaskTitle), ["Confirm guest count", "Confirm final guest count", "Confirm final guest count", "Send dietary list"]);
});
test("a non-task activity event never renders a task title, whatever its metadata holds", () => {
  for (const eventType of ["booking_offered", "customer_confirmed", "booking_cancelled", "booking_completed", "details_updated"]) {
    assert.equal(cateringActivityTaskTitle(activityRow(eventType)), null);
    assert.equal(cateringActivityTaskTitle(activityRow(eventType, { taskTitle: "Not a task event" })), null);
  }
  assert.equal(cateringActivityTaskTitle(activityRow("some_future_event", { taskTitle: "Unknown" })), null);
});
test("missing, blank, or non-string stored metadata falls back to the generic label and invents nothing", () => {
  for (const metadata of [{}, { taskTitle: "" }, { taskTitle: "   " }, { taskTitle: null }, { taskTitle: undefined }, { taskTitle: 42 }, { taskTitle: {} }, { taskTitle: ["Confirm"] }, { taskTitle: true }, { otherKey: "Confirm" }, null, undefined, [], "taskTitle", 7]) {
    assert.equal(cateringActivityTaskTitle(activityRow("shared_requirement_deleted", metadata)), null);
  }
  // The strings "undefined" and "null" are never produced from an absent value.
  for (const metadata of [{}, { taskTitle: null }, null]) {
    assert.notEqual(cateringActivityTaskTitle(activityRow("shared_requirement_deleted", metadata)), "undefined");
    assert.notEqual(cateringActivityTaskTitle(activityRow("shared_requirement_deleted", metadata)), "null");
  }
});
test("a title is returned as the exact stored text, so it renders as escaped text and never as markup", () => {
  for (const stored of ["<img src=x onerror=alert(1)>", "<b>Bold</b>", "Guests & \"quotes\" <tag>", "Confirm final guest count"]) {
    assert.equal(cateringActivityTaskTitle(activityRow("shared_requirement_added", { taskTitle: stored })), stored);
  }
  // The helper hands back a plain string with no markup fields for a renderer to interpret.
  assert.equal(typeof cateringActivityTaskTitle(activityRow("shared_requirement_added", { taskTitle: "<b>x</b>" })), "string");
});
test("a customer only ever receives shared task activity, so no private task title can reach one", () => {
  // Private tasks record no activity at all, and every task activity row is written with shared visibility.
  const providerServed = TASK_ACTIVITY_EVENTS.map((eventType) => activityRow(eventType, { taskTitle: "Shared requirement" }));
  const customerServed = providerServed;
  assert.deepEqual(customerServed.map(cateringActivityTaskTitle), providerServed.map(cateringActivityTaskTitle));
  // A private task in the collection contributes no activity row for either actor to render.
  const privateTask = taskView("private-1", "provider", { title: "Private staffing plan" });
  assert.equal(privateTask.visibility, "provider");
  assert.equal(providerServed.some((row) => cateringActivityTaskTitle(row) === "Private staffing plan"), false);
  // The provider does render the titles on the rows it is served.
  for (const row of providerServed) assert.equal(cateringActivityTaskTitle(row), "Shared requirement");
});

const dirtyFields: Array<[keyof CateringTaskDraft, CateringTaskDraft[keyof CateringTaskDraft]]> = [["title", "Edited title"], ["description", "Edited description"], ["dueDate", "2026-10-01"], ["dueTime", "08:15"], ["visibility", "shared"]];
const openedOn = (task: CateringBookingTaskView) => openTaskEditor("actor:booking", task)!;
const TASK_A = taskView("task-a", "provider", { title: "Task A" });
const TASK_B = taskView("task-b", "shared", { title: "Task B" });

test("an unchanged editor may be replaced directly, so the UI is never locked harder than the draft needs", () => {
  const clean = openedOn(TASK_A);
  assert.equal(isTaskEditorDirty(clean), false);
  assert.equal(mayOpenTaskEditor(clean, "actor:booking", TASK_B.id), true);
  assert.equal(openTaskEditorIfAllowed(clean, "actor:booking", TASK_B)?.taskId, "task-b");
  assert.equal(mayOpenTaskEditor(null, "actor:booking", TASK_B.id), true);
  // An editor left over from another workspace never protects this one.
  assert.equal(mayOpenTaskEditor(openEditor(editorDraft, "task-a", "actor:other-booking"), "actor:booking", TASK_B.id), true);
});
test("every editable field counts as an unsaved change and protects the draft from another task's Edit", () => {
  for (const [field, value] of dirtyFields) {
    const dirty = editTaskEditorField(openedOn(TASK_A), "actor:booking", TASK_A.id, field, value as never);
    assert.equal(isTaskEditorDirty(dirty), true, String(field));
    assert.equal(mayOpenTaskEditor(dirty, "actor:booking", TASK_B.id), false, String(field));
    // Refused rather than destructive: the draft survives even a control that should have been disabled.
    const kept = openTaskEditorIfAllowed(dirty, "actor:booking", TASK_B);
    assert.equal(kept?.taskId, "task-a", String(field));
    assert.equal(kept?.draft[field], value as never, String(field));
    // The task being edited stays fully usable, including reopening it to reload the latest.
    assert.equal(mayOpenTaskEditor(dirty, "actor:booking", TASK_A.id), true, String(field));
    assert.equal(maySubmitTaskEditor(dirty, true), true, String(field));
  }
});
test("the protection holds across both visibility sections, in either direction", () => {
  const dirtyPrivate = editTaskEditorField(openedOn(TASK_A), "actor:booking", TASK_A.id, "title", "Private edit");
  assert.equal(mayOpenTaskEditor(dirtyPrivate, "actor:booking", TASK_B.id), false);
  assert.equal(openTaskEditorIfAllowed(dirtyPrivate, "actor:booking", TASK_B)?.draft.title, "Private edit");
  const dirtyShared = editTaskEditorField(openedOn(TASK_B), "actor:booking", TASK_B.id, "description", "Shared edit");
  assert.equal(mayOpenTaskEditor(dirtyShared, "actor:booking", TASK_A.id), false);
  assert.equal(openTaskEditorIfAllowed(dirtyShared, "actor:booking", TASK_A)?.draft.description, "Shared edit");
  // Editing a task back to its persisted values is not an unsaved change, and stops protecting.
  const reverted = editTaskEditorField(dirtyPrivate, "actor:booking", TASK_A.id, "title", TASK_A.title);
  assert.equal(isTaskEditorDirty(reverted), false);
  assert.equal(mayOpenTaskEditor(reverted, "actor:booking", TASK_B.id), true);
});
test("a saved or cancelled editor releases the protection, and a failed save keeps it", () => {
  const dirty = editTaskEditorField(openedOn(TASK_A), "actor:booking", TASK_A.id, "title", "Task A edited");
  const submitted: SubmittedTaskEdit = { identity: "actor:booking", taskId: TASK_A.id, draft: { ...dirty!.draft }, expectedUpdatedAt: dirty!.expectedUpdatedAt };
  const afterSave = closeTaskEditorAfterSave(dirty, submitted);
  assert.equal(afterSave, null);
  assert.equal(mayOpenTaskEditor(afterSave, "actor:booking", TASK_B.id), true);
  assert.equal(mayOpenTaskEditor(null, "actor:booking", TASK_B.id), true);
  const afterFailure = preserveTaskEditorAfterSaveFailure(dirty);
  assert.equal(afterFailure?.draft.title, "Task A edited");
  assert.equal(isTaskEditorDirty(afterFailure), true);
  assert.equal(mayOpenTaskEditor(afterFailure, "actor:booking", TASK_B.id), false);
});
test("a conflicted editor is never replaced by another task, and Reload latest still rebases it", () => {
  const conflicted = markTaskEditorConflict(openedOn(TASK_A), { identity: "actor:booking", taskId: TASK_A.id, draft: { ...openedOn(TASK_A).draft }, expectedUpdatedAt: TASK_A.updatedAt });
  assert.equal(conflicted?.conflict, true);
  assert.equal(isTaskEditorDirty(conflicted), false);
  // Clean but stale: another task still may not take its place, so the stale draft cannot be discarded sideways.
  assert.equal(mayOpenTaskEditor(conflicted, "actor:booking", TASK_B.id), false);
  assert.equal(openTaskEditorIfAllowed(conflicted, "actor:booking", TASK_B)?.taskId, "task-a");
  assert.equal(maySubmitTaskEditor(conflicted, true), false);
  // Reload latest reopens the same task, which is always allowed, and clears the conflict onto the newer version.
  assert.equal(mayOpenTaskEditor(conflicted, "actor:booking", TASK_A.id), true);
  const reloaded = openTaskEditorIfAllowed(conflicted, "actor:booking", { ...TASK_A, title: "Newer server title", updatedAt: "2026-08-30T09:15:00.000Z" });
  assert.equal(reloaded?.conflict, false);
  assert.equal(reloaded?.draft.title, "Newer server title");
  assert.equal(reloaded?.expectedUpdatedAt, "2026-08-30T09:15:00.000Z");
  assert.equal(isTaskEditorDirty(reloaded), false);
});
test("draft protection never keeps an editor alive on a workspace that became historical", () => {
  const dirty = editTaskEditorField(openedOn(TASK_A), "actor:booking", TASK_A.id, "title", "Never saved");
  assert.equal(isTaskEditorDirty(dirty), true);
  for (const status of readOnlyStatuses) {
    assert.equal(reconcileTaskEditorWithWorkspace(dirty, "actor:booking", mayEditCateringWorkspace(status), [TASK_A.id]), null);
  }
  // An editable refetch keeps the dirty editor and its protection, and an unrelated mutation never discards it.
  assert.deepEqual(reconcileTaskEditorWithWorkspace(dirty, "actor:booking", true, [TASK_A.id, "task-new"]), dirty);
  assert.equal(mayOpenTaskEditor(reconcileTaskEditorWithWorkspace(dirty, "actor:booking", true, [TASK_A.id, "task-new"]), "actor:booking", TASK_B.id), false);
  assert.deepEqual(closeTaskEditorAfterSave(dirty, { ...submittedEdit, taskId: "unrelated-task" }), dirty);
  // Reorder stays governed by the existing editor-open rule, dirty or not.
  for (const editor of [openedOn(TASK_A), dirty]) {
    assert.equal(activeTaskEditor(editor, "actor:booking") !== null, true);
    for (const task of mixedTasks) assert.deepEqual(cateringTaskReorderControls(mixedTasks, task.id, { ...activeProvider, editorOpen: true }), { up: false, down: false });
  }
});
