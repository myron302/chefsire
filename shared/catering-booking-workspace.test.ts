import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_ACTIVITY_DEFAULT_LIMIT, CATERING_ACTIVITY_MAX_LIMIT, CATERING_TASK_LIMIT, canEditBookingWorkspace, cateringBookingDetailsSchema, cateringTaskCreateSchema, serializeBookingDetails, serializeBookingTask, wallClockTimeSchema } from "./catering-booking-workspace";

test("only pending-confirmation and confirmed workspaces are editable", () => {
  assert.equal(canEditBookingWorkspace("pending_confirmation"), true);
  assert.equal(canEditBookingWorkspace("confirmed"), true);
  assert.equal(canEditBookingWorkspace("cancelled"), false);
  assert.equal(canEditBookingWorkspace("completed"), false);
});

test("customer serialization cannot leak provider notes or private tasks", () => {
  const details = serializeBookingDetails({ bookingId: "b", venueName: "Hall", providerNotes: "internal staffing concern" }, "customer");
  assert.deepEqual(details, { bookingId: "b", venueName: "Hall" });
  assert.equal(serializeBookingTask({ id: "t", title: "Buy supplies", visibility: "provider" }, "customer"), null);
  assert.equal(serializeBookingTask({ id: "t", title: "Clear refrigerator space", visibility: "shared" }, "customer")?.title, "Clear refrigerator space");
});

test("operational schemas are allowlisted and do not accept commercial snapshots", () => {
  assert.equal(cateringBookingDetailsSchema.safeParse({ venueName: "Hall", eventDate: "2030-01-01" }).success, false);
  assert.equal(cateringTaskCreateSchema.safeParse({ title: "Setup", visibility: "shared", createdBy: "client-controlled" }).success, false);
});

test("event-local times and collection bounds are explicit", () => {
  assert.equal(wallClockTimeSchema.safeParse("23:59").success, true);
  assert.equal(wallClockTimeSchema.safeParse("24:00").success, false);
  assert.equal(CATERING_TASK_LIMIT, 100);
  assert.ok(CATERING_ACTIVITY_DEFAULT_LIMIT < CATERING_ACTIVITY_MAX_LIMIT);
});
