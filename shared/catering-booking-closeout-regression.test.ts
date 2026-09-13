import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_STATUSES } from "./catering-bookings";
import { CATERING_BOOKING_TASK_STATUSES, CATERING_BOOKING_TASK_VISIBILITIES, mayEditCateringWorkspace } from "./catering-booking-operations";
import { CATERING_FILE_VISIBILITIES, mayMutateCateringFiles } from "./catering-booking-files";
import { mayPostCateringBookingMessage } from "./catering-booking-communication";
import {
  CATERING_EQUIPMENT_STATUSES,
  CATERING_EXECUTION_MILESTONE_KEYS,
  CATERING_EXECUTION_VISIBILITIES,
  CATERING_READINESS_SIGNALS,
  cateringEquipmentIsSettled,
  mayMutateCateringExecution,
} from "./catering-booking-execution";
import { qualifiesAsVerifiedCateringEvent } from "./catering-reviews";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "./catering-booking-activity-events";
import { mayMutateCateringCloseout } from "./catering-booking-closeout";

/**
 * What Phase 2K did NOT change.
 *
 * Every phase this one builds on keeps its contract exactly: the Phase 2G lifecycle, the Phase 2H task and workspace
 * rules, the Phase 2I file and message rules, the Phase 2J execution vocabulary and visibility, and the Phase 2E
 * review verification rule. Closeout layers underneath a completed booking rather than widening any of them, and
 * these assertions are what would catch a later change that quietly did.
 */

test("the Phase 2G lifecycle is still exactly four values, in the same order", () => {
  assert.deepEqual([...CATERING_BOOKING_STATUSES], ["pending_confirmation", "confirmed", "cancelled", "completed"]);
  // Nothing in Phase 2K is a booking status. `closed_out` lives on its own record and never on this list.
  assert.equal((CATERING_BOOKING_STATUSES as readonly string[]).includes("closed_out"), false);
  assert.equal((CATERING_BOOKING_STATUSES as readonly string[]).includes("archived"), false);
});

test("the Phase 2H workspace still closes on exactly the two active statuses", () => {
  assert.equal(mayEditCateringWorkspace("pending_confirmation"), true);
  assert.equal(mayEditCateringWorkspace("confirmed"), true);
  assert.equal(mayEditCateringWorkspace("cancelled"), false);
  assert.equal(mayEditCateringWorkspace("completed"), false);
  assert.deepEqual([...CATERING_BOOKING_TASK_STATUSES], ["pending", "completed"]);
  assert.deepEqual([...CATERING_BOOKING_TASK_VISIBILITIES], ["provider", "shared"]);
});

test("Phase 2K is the exact complement of the Phase 2H workspace, not an extension of it", () => {
  // This is why the closeout checklist is its own model rather than Phase 2H tasks: the two are open at opposite
  // times, so a checklist built on tasks could never be ticked.
  for (const status of CATERING_BOOKING_STATUSES) {
    const booking = { status, completedAt: status === "completed" ? new Date() : null };
    const workspaceOpen = mayEditCateringWorkspace(status);
    const closeoutOpen = mayMutateCateringCloseout(booking, "provider");
    assert.equal(workspaceOpen && closeoutOpen, false, `${status}: the two are never open together`);
  }
});

test("Phase 2I file and message rules are untouched", () => {
  assert.deepEqual([...CATERING_FILE_VISIBILITIES], ["provider", "shared"]);
  for (const status of CATERING_BOOKING_STATUSES) {
    assert.equal(mayMutateCateringFiles(status), mayEditCateringWorkspace(status), `${status}`);
    assert.equal(mayPostCateringBookingMessage(status), mayEditCateringWorkspace(status), `${status}`);
  }
});

test("Phase 2J execution rules and vocabulary are untouched", () => {
  assert.deepEqual([...CATERING_EXECUTION_VISIBILITIES], ["shared", "provider_private"]);
  assert.deepEqual([...CATERING_EQUIPMENT_STATUSES], ["planned", "confirmed", "received", "in_use", "returned", "cancelled"]);
  assert.equal(CATERING_EXECUTION_MILESTONE_KEYS.length, 11);
  assert.deepEqual([...CATERING_READINESS_SIGNALS], ["timeline", "staffing", "venue_access", "equipment", "shared_requirements", "guest_count", "execution_blockers"]);
  for (const status of CATERING_BOOKING_STATUSES) {
    assert.equal(mayMutateCateringExecution(status, "provider"), mayEditCateringWorkspace(status), `${status}`);
    assert.equal(mayMutateCateringExecution(status, "customer"), false, `${status}`);
  }
});

test("the Phase 2J pre-event settled predicate is unchanged, and Phase 2K reads it rather than editing it", () => {
  assert.deepEqual(CATERING_EQUIPMENT_STATUSES.filter(cateringEquipmentIsSettled), ["received", "in_use", "returned", "cancelled"]);
});

test("the Phase 2E review verification rule is untouched", () => {
  assert.equal(qualifiesAsVerifiedCateringEvent({ status: "completed", completedAt: new Date() }), true);
  assert.equal(qualifiesAsVerifiedCateringEvent({ status: "completed", completedAt: null }), false);
  assert.equal(qualifiesAsVerifiedCateringEvent({ status: "confirmed", completedAt: new Date() }), false);
  assert.equal(qualifiesAsVerifiedCateringEvent(null), false);
});

test("the activity allowlist is widened by exactly two events and loses none", () => {
  const inherited = [
    "booking_offered", "customer_confirmed", "booking_cancelled", "booking_completed", "details_updated",
    "shared_requirement_added", "shared_requirement_updated", "shared_requirement_completed", "shared_requirement_deleted",
    "shared_file_uploaded", "shared_file_removed", "provider_file_uploaded", "provider_file_removed",
    "execution_timeline_added", "execution_timeline_updated", "execution_timeline_completed", "execution_timeline_removed",
    "shared_equipment_added", "shared_equipment_status_changed", "execution_access_updated",
    "provider_execution_milestone_completed",
  ];
  assert.deepEqual([...CATERING_BOOKING_ACTIVITY_EVENT_TYPES], [...inherited, "booking_closed_out", "booking_closeout_reopened"]);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Source-level: which files this phase may touch at all
 * ----------------------------------------------------------------------------------------------------------- */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

test("no earlier phase's route file imports anything from Phase 2K", () => {
  // Closeout depends on the earlier phases; none of them depends on closeout. That one-way direction is what keeps
  // a Phase 2K change from being able to alter Phase 2G, 2H, 2I or 2J behaviour at all.
  for (const file of [
    "server/routes/catering-bookings.ts",
    "server/routes/catering-booking-workspace.ts",
    "server/routes/catering-booking-communication.ts",
    "server/routes/catering-booking-files.ts",
    "server/routes/catering-booking-execution.ts",
    "server/routes/catering-reviews.ts",
  ]) {
    assert.equal(read(file).includes("closeout"), false, `${file} must not reference Phase 2K`);
  }
});

test("the Phase 2K route reads the earlier phases' tables and writes none of them", () => {
  const route = read("server/routes/catering-booking-closeout.ts");
  // Reads: Phase 2J equipment, Phase 2H shared tasks, Phase 2I shared files, Phase 2E reviews.
  for (const table of ["cateringBookingEquipment", "cateringBookingTasks", "cateringBookingFiles", "cateringReviews"]) {
    assert.ok(route.includes(`db.select`) && route.includes(table), `${table} is read`);
    assert.equal(route.includes(`insert(${table})`), false, `${table} is never written`);
    assert.equal(route.includes(`update(${table})`), false, `${table} is never written`);
  }
});

test("Phase 2K adds to the booking access service rather than changing what was there", () => {
  const access = read("server/services/catering-booking-access.ts");
  // The Phase 2H/2I/2J helper is untouched, and the post-event one is a separate function asking the opposite
  // question rather than a parameter that could change the first one's behaviour.
  assert.ok(access.includes('return booking?.status === "pending_confirmation" || booking?.status === "confirmed";'));
  assert.ok(access.includes("export async function lockServedCateringBooking"));
  assert.equal(/lockActiveCateringBooking\(tx: Tx, bookingId: string, \w+/.test(access), false, "no new parameter was added");
});
