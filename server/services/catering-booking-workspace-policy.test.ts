import assert from "node:assert/strict";
import test from "node:test";
import { mayMutateWorkspace } from "./catering-booking-workspace-policy";

test("provider can prepare pending and confirmed operational state", () => { for (const status of ["pending_confirmation", "confirmed"] as const) { assert.equal(mayMutateWorkspace(status, "provider", "provider-details"), true); assert.equal(mayMutateWorkspace(status, "provider", "tasks"), true); } });
test("customer can edit only explicitly customer-owned notes", () => { assert.equal(mayMutateWorkspace("confirmed", "customer", "customer-notes"), true); assert.equal(mayMutateWorkspace("confirmed", "customer", "provider-details"), false); assert.equal(mayMutateWorkspace("confirmed", "customer", "tasks"), false); });
test("every cancelled workspace mutation is rejected", () => { for (const role of ["provider", "customer"] as const) for (const resource of ["provider-details", "customer-notes", "tasks"] as const) assert.equal(mayMutateWorkspace("cancelled", role, resource), false); });
test("every completed workspace mutation is rejected", () => { for (const role of ["provider", "customer"] as const) for (const resource of ["provider-details", "customer-notes", "tasks"] as const) assert.equal(mayMutateWorkspace("completed", role, resource), false); });
