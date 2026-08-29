import assert from "node:assert/strict";
import test from "node:test";
import { mayMutateWorkspace, nextCateringTaskSortOrder, sharedTaskUpdateActivity } from "./catering-booking-workspace-policy";

test("provider can prepare pending and confirmed operational state", () => { for (const status of ["pending_confirmation", "confirmed"] as const) { assert.equal(mayMutateWorkspace(status, "provider", "provider-details"), true); assert.equal(mayMutateWorkspace(status, "provider", "tasks"), true); } });
test("customer can edit only explicitly customer-owned notes", () => { assert.equal(mayMutateWorkspace("confirmed", "customer", "customer-notes"), true); assert.equal(mayMutateWorkspace("confirmed", "customer", "provider-details"), false); assert.equal(mayMutateWorkspace("confirmed", "customer", "tasks"), false); });
test("every cancelled workspace mutation is rejected", () => { for (const role of ["provider", "customer"] as const) for (const resource of ["provider-details", "customer-notes", "tasks"] as const) assert.equal(mayMutateWorkspace("cancelled", role, resource), false); });
test("every completed workspace mutation is rejected", () => { for (const role of ["provider", "customer"] as const) for (const resource of ["provider-details", "customer-notes", "tasks"] as const) assert.equal(mayMutateWorkspace("completed", role, resource), false); });
test("task append order starts at zero and advances past the maximum after gaps", () => {
  assert.equal(nextCateringTaskSortOrder(null), 0);
  assert.equal(nextCateringTaskSortOrder(0), 1);
  assert.equal(nextCateringTaskSortOrder(2), 3);
  const afterFirstDeleted = [1, 2]; const appended = nextCateringTaskSortOrder(Math.max(...afterFirstDeleted));
  assert.equal(appended, 3); assert.equal(new Set([...afterFirstDeleted, appended]).size, 3);
  const afterMiddleDeleted = [0, 2, 3]; const next = nextCateringTaskSortOrder(Math.max(...afterMiddleDeleted));
  assert.equal(next, 4); assert.deepEqual([...afterMiddleDeleted, next].sort((a, b) => a - b), [0, 2, 3, 4]);
});
test("shared task activity derives from current locked state", () => {
  assert.deepEqual(sharedTaskUpdateActivity({ title: "Current", visibility: "shared", status: "pending" }, { title: "Updated" }), { eventType: "shared_requirement_updated", taskTitle: "Updated" });
  assert.deepEqual(sharedTaskUpdateActivity({ title: "Current", visibility: "shared", status: "pending" }, { status: "completed" }), { eventType: "shared_requirement_completed", taskTitle: "Current" });
});
test("shared to private task updates produce no shared activity", () => assert.equal(sharedTaskUpdateActivity({ title: "Private title", visibility: "shared", status: "pending" }, { visibility: "provider" }), null));
