import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES, CATERING_BOOKING_TASK_LIMIT, CATERING_TASK_NOT_FOUND_CODE, CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_TASK_VERSION_CONFLICT_MESSAGE, CATERING_WORKSPACE_READ_ONLY_CODE, cateringBookingActivityPageSchema, cateringBookingCustomerDetailsSchema, cateringBookingProviderDetailsSchema, cateringBookingTaskCreateSchema, cateringBookingTaskDeleteSchema, cateringBookingTaskReorderSchema, cateringBookingTaskUpdateSchema, cateringBookingTaskVersionSchema, cateringBookingWorkspaceKey, cateringBookingWorkspacePath, cateringWorkspaceRole, hasValidCateringServiceTimeRange, mayEditCateringWorkspace, mergeCateringServiceTimes } from "./catering-booking-operations";

test("pending and confirmed workspaces are editable", () => { assert.equal(mayEditCateringWorkspace("pending_confirmation"), true); assert.equal(mayEditCateringWorkspace("confirmed"), true); });
test("cancelled and completed workspaces are read-only", () => { assert.equal(mayEditCateringWorkspace("cancelled"), false); assert.equal(mayEditCateringWorkspace("completed"), false); });
test("workspace ownership derives from persisted booking participants", () => { const booking = { providerId: "provider", customerId: "customer" }; assert.equal(cateringWorkspaceRole(booking, "provider"), "provider"); assert.equal(cateringWorkspaceRole(booking, "customer"), "customer"); assert.equal(cateringWorkspaceRole(booking, "stranger"), null); });
test("provider details accept only operational provider-owned fields", () => { assert.equal(cateringBookingProviderDetailsSchema.safeParse({ venueName: "Hall", serviceStartTime: "17:30", providerNotes: "private" }).success, true); for (const field of ["eventDate", "guestCount", "agreedPrice", "packageId", "status", "providerId", "customerId", "customerNotes", "actorUserId"]) assert.equal(cateringBookingProviderDetailsSchema.safeParse({ [field]: "forged" }).success, false); });
test("customer details accept only customer notes", () => { assert.equal(cateringBookingCustomerDetailsSchema.safeParse({ customerNotes: "Loading dock code provided" }).success, true); for (const field of ["providerNotes", "venueName", "status", "customerId"]) assert.equal(cateringBookingCustomerDetailsSchema.safeParse({ [field]: "forged" }).success, false); });
test("event-local wall-clock values require canonical HH:mm", () => { for (const value of ["00:00", "17:30", "23:59"]) assert.equal(cateringBookingProviderDetailsSchema.safeParse({ arrivalTime: value }).success, true); for (const value of ["5:30", "24:00", "17:60", "2026-01-01T17:30Z"]) assert.equal(cateringBookingProviderDetailsSchema.safeParse({ arrivalTime: value }).success, false); });
test("service times cannot run backwards", () => { assert.equal(cateringBookingProviderDetailsSchema.safeParse({ serviceStartTime: "18:00", serviceEndTime: "17:00" }).success, false); });
test("task creation rejects ownership and lifecycle fields", () => { assert.equal(cateringBookingTaskCreateSchema.safeParse({ title: "Confirm access", visibility: "shared", dueDate: "2026-09-01", dueTime: "09:00" }).success, true); for (const field of ["createdBy", "bookingId", "status", "completedAt", "providerId"]) assert.equal(cateringBookingTaskCreateSchema.safeParse({ title: "Task", [field]: "forged" }).success, false); });
test("task due dates use canonical real-calendar validation", () => {
  for (const dueDate of ["2026-01-31", "2028-02-29", null]) assert.equal(cateringBookingTaskCreateSchema.safeParse({ title: "Task", dueDate }).success, true);
  for (const dueDate of ["2026-99-01", "2026-01-32", "2026-02-29", "2026-02-31"]) assert.equal(cateringBookingTaskCreateSchema.safeParse({ title: "Task", dueDate }).success, false);
});
test("merged service times reject invalid partial updates", () => {
  const existing = { serviceStartTime: "17:00", serviceEndTime: "20:00" };
  assert.equal(hasValidCateringServiceTimeRange(mergeCateringServiceTimes(existing, { serviceStartTime: "21:00" })), false);
  assert.equal(hasValidCateringServiceTimeRange(mergeCateringServiceTimes(existing, { serviceEndTime: "16:00" })), false);
  assert.equal(hasValidCateringServiceTimeRange(mergeCateringServiceTimes(existing, { serviceStartTime: "18:00" })), true);
  assert.equal(hasValidCateringServiceTimeRange(mergeCateringServiceTimes(existing, { serviceStartTime: "21:00", serviceEndTime: "22:00" })), true);
});
test("merged service times preserve null, absent-row, and equal-time semantics", () => {
  assert.equal(hasValidCateringServiceTimeRange(mergeCateringServiceTimes({ serviceStartTime: "21:00", serviceEndTime: "20:00" }, { serviceStartTime: null })), true);
  assert.equal(hasValidCateringServiceTimeRange(mergeCateringServiceTimes(undefined, { serviceEndTime: "20:00" })), true);
  assert.equal(hasValidCateringServiceTimeRange(mergeCateringServiceTimes({ serviceStartTime: "20:00", serviceEndTime: "20:00" }, {})), true);
});
const TASK_VERSION = "2026-08-29T00:00:00.000Z";
test("task update supports explicit completion and reopening", () => { assert.equal(cateringBookingTaskUpdateSchema.safeParse({ status: "completed", expectedUpdatedAt: TASK_VERSION }).success, true); assert.equal(cateringBookingTaskUpdateSchema.safeParse({ status: "pending", expectedUpdatedAt: TASK_VERSION }).success, true); assert.equal(cateringBookingTaskUpdateSchema.safeParse({ status: "cancelled", expectedUpdatedAt: TASK_VERSION }).success, false); });
test("task update rejects an empty arbitrary patch", () => { assert.equal(cateringBookingTaskUpdateSchema.safeParse({}).success, false); assert.equal(cateringBookingTaskUpdateSchema.safeParse({ actorUserId: "attacker", expectedUpdatedAt: TASK_VERSION }).success, false); });
test("every task update requires the version it was based on", () => {
  for (const patch of [{ status: "completed" }, { title: "Confirm rentals" }, { visibility: "shared" }, { description: null }, { dueDate: null }, { dueTime: "17:30" }]) {
    assert.equal(cateringBookingTaskUpdateSchema.safeParse(patch).success, false);
    assert.equal(cateringBookingTaskUpdateSchema.safeParse({ ...patch, expectedUpdatedAt: TASK_VERSION }).success, true);
  }
  assert.equal(cateringBookingTaskUpdateSchema.safeParse({ expectedUpdatedAt: TASK_VERSION }).success, false);
});
test("the task version precondition must be a serialized updatedAt timestamp", () => {
  assert.equal(cateringBookingTaskVersionSchema.safeParse(TASK_VERSION).success, true);
  for (const invalid of ["", "not-a-timestamp", "2026-08-29", 0, null]) assert.equal(cateringBookingTaskUpdateSchema.safeParse({ status: "completed", expectedUpdatedAt: invalid }).success, false);
});
test("a client may never dictate the next task version", () => {
  const parsed = cateringBookingTaskUpdateSchema.parse({ title: "Confirm rentals", expectedUpdatedAt: TASK_VERSION });
  assert.equal("updatedAt" in parsed, false);
  assert.equal(cateringBookingTaskUpdateSchema.safeParse({ title: "Confirm rentals", expectedUpdatedAt: TASK_VERSION, updatedAt: "2030-01-01T00:00:00.000Z" }).success, false);
  assert.equal(cateringBookingTaskUpdateSchema.safeParse({ title: "Confirm rentals", expectedUpdatedAt: TASK_VERSION, completedAt: "2030-01-01T00:00:00.000Z" }).success, false);
});
test("the task conflict contract is a distinct truthful code and message", () => {
  assert.equal(CATERING_TASK_VERSION_CONFLICT_CODE, "task_version_conflict");
  assert.match(CATERING_TASK_VERSION_CONFLICT_MESSAGE, /changed since you started editing it/);
  assert.equal(CATERING_WORKSPACE_READ_ONLY_CODE, "workspace_read_only");
  assert.equal(CATERING_TASK_NOT_FOUND_CODE, "catering_task_not_found");
  assert.equal(new Set([CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_WORKSPACE_READ_ONLY_CODE, CATERING_TASK_NOT_FOUND_CODE]).size, 3);
});
test("deleting a task requires the same serialized version contract as updating one", () => {
  assert.deepEqual(cateringBookingTaskDeleteSchema.parse({ expectedUpdatedAt: TASK_VERSION }), { expectedUpdatedAt: TASK_VERSION });
  assert.equal(cateringBookingTaskDeleteSchema.safeParse({}).success, false);
  for (const invalid of ["", "not-a-timestamp", "2026-08-29", 0, null]) assert.equal(cateringBookingTaskDeleteSchema.safeParse({ expectedUpdatedAt: invalid }).success, false);
  assert.equal(cateringBookingTaskDeleteSchema.safeParse({ expectedUpdatedAt: TASK_VERSION, taskId: "attacker" }).success, false);
});
test("task reorder requires a unique complete-looking bounded ID list", () => { const id = "11111111-1111-4111-8111-111111111111"; assert.equal(cateringBookingTaskReorderSchema.safeParse({ taskIds: [id] }).success, true); assert.equal(cateringBookingTaskReorderSchema.safeParse({ taskIds: [id, id] }).success, false); assert.equal(cateringBookingTaskReorderSchema.safeParse({ taskIds: [] }).success, false); });
test("task collection has a strict server-shared maximum", () => assert.equal(CATERING_BOOKING_TASK_LIMIT, 100));
test("activity pagination is bounded", () => { assert.deepEqual(cateringBookingActivityPageSchema.parse({}), { page: 1, limit: 20 }); assert.equal(cateringBookingActivityPageSchema.safeParse({ limit: 51 }).success, false); });
test("activity event types are an explicit finite allowlist", () => { assert.ok(CATERING_BOOKING_ACTIVITY_EVENT_TYPES.includes("booking_completed")); assert.equal(CATERING_BOOKING_ACTIVITY_EVENT_TYPES.includes("review_verified" as "booking_completed"), false); });
test("workspace cache keys are actor and booking scoped", () => { assert.notDeepEqual(cateringBookingWorkspaceKey("provider", "booking"), cateringBookingWorkspaceKey("customer", "booking")); assert.notDeepEqual(cateringBookingWorkspaceKey("provider", "one"), cateringBookingWorkspaceKey("provider", "two")); });
test("provider and customer deep links resolve separately", () => { assert.equal(cateringBookingWorkspacePath("provider", "abc"), "/services/catering/provider/bookings/abc"); assert.equal(cateringBookingWorkspacePath("customer", "abc"), "/services/catering/bookings/abc"); });
