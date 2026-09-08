import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_ACCESS_SHARED_FIELDS,
  CATERING_EQUIPMENT_SOURCES,
  CATERING_EQUIPMENT_STATUSES,
  CATERING_EXECUTION_EQUIPMENT_LIMIT,
  CATERING_EXECUTION_MILESTONE_KEYS,
  CATERING_EXECUTION_MILESTONE_LABELS,
  CATERING_EXECUTION_NOT_FOUND_CODE,
  CATERING_EXECUTION_SET_CHANGED_CODE,
  CATERING_EXECUTION_STAFF_LIMIT,
  CATERING_EXECUTION_TIMELINE_LIMIT,
  CATERING_EXECUTION_VERSION_CONFLICT_CODE,
  CATERING_EXECUTION_VISIBILITIES,
  CATERING_PROVIDER_ONLY_READINESS_SIGNALS,
  CATERING_READINESS_DETAILS,
  CATERING_READINESS_SIGNALS,
  CATERING_READINESS_STATES,
  CATERING_STAFF_ROLES,
  CATERING_TIMELINE_CATEGORIES,
  CATERING_TIMELINE_CATEGORY_LABELS,
  CATERING_WORKSPACE_READ_ONLY_CODE,
  cateringAccessSaveSchema,
  cateringEquipmentCreateSchema,
  cateringEquipmentDeleteSchema,
  cateringEquipmentIsSettled,
  cateringEquipmentIsUnconfirmed,
  cateringEquipmentUpdateSchema,
  cateringExecutionActivityVisibility,
  cateringExecutionSectionPath,
  cateringExecutionVisibleTo,
  cateringMilestoneToggleSchema,
  cateringReadinessSignalState,
  cateringReadinessSignalVisibleTo,
  cateringStaffCreateSchema,
  cateringStaffDeleteSchema,
  cateringStaffUpdateSchema,
  cateringTimelineCreateSchema,
  cateringTimelineDeleteSchema,
  cateringTimelineReorderSchema,
  cateringTimelineUpdateSchema,
  cateringWorstReadinessState,
  deriveCateringReadiness,
  mayMutateCateringExecution,
  mayReadCateringExecution,
  type CateringReadinessFacts,
} from "./catering-booking-execution";
import { CATERING_BOOKING_STATUSES } from "./catering-bookings";

/**
 * The Phase 2J contract.
 *
 * Three things are asserted here and nowhere else: that no execution schema accepts an identity or authorization
 * field, that every controlled vocabulary really is closed, and that readiness is a deterministic function of
 * already-authorized facts whose customer projection cannot be moved by a provider-private record.
 */

/** Every field a client might try to smuggle in to name an actor, an owner, or its own authority. */
const FORGED_IDENTITY_FIELDS = [
  "providerId", "customerId", "bookingId", "createdBy", "completedBy", "updatedBy", "actorUserId",
  "actorId", "ownerId", "userId", "role", "id", "sortOrder", "createdAt", "updatedAt",
];

test("the booking lifecycle is untouched by Phase 2J", () => {
  // The authoritative statuses are exactly the Phase 2G four. Nothing in this phase adds "in progress", "arrived"
  // or "setup complete" to them: operational progress lives in its own models entirely.
  assert.deepEqual([...CATERING_BOOKING_STATUSES], ["pending_confirmation", "confirmed", "cancelled", "completed"]);
  for (const value of ["in_progress", "arrived", "setup_complete", "service_started"]) {
    assert.equal((CATERING_BOOKING_STATUSES as readonly string[]).includes(value), false, value);
  }
});

test("execution mutations are provider-only and close exactly when the workspace closes", () => {
  assert.equal(mayMutateCateringExecution("pending_confirmation", "provider"), true);
  assert.equal(mayMutateCateringExecution("confirmed", "provider"), true);
  assert.equal(mayMutateCateringExecution("cancelled", "provider"), false);
  assert.equal(mayMutateCateringExecution("completed", "provider"), false);
  // There is no customer execution mutation at all, on any status.
  for (const status of CATERING_BOOKING_STATUSES) assert.equal(mayMutateCateringExecution(status, "customer"), false, status);
  // Reading never closes: a historical booking keeps its execution record under the same visibility rules.
  assert.equal(mayReadCateringExecution(), true);
});

test("visibility is a closed two-value vocabulary, kept apart from the activity spelling", () => {
  assert.deepEqual([...CATERING_EXECUTION_VISIBILITIES], ["shared", "provider_private"]);
  assert.equal(cateringExecutionActivityVisibility("shared"), "shared");
  assert.equal(cateringExecutionActivityVisibility("provider_private"), "provider");
  assert.equal(cateringExecutionVisibleTo("provider_private", "provider"), true);
  assert.equal(cateringExecutionVisibleTo("provider_private", "customer"), false);
  assert.equal(cateringExecutionVisibleTo("shared", "customer"), true);
});

test("timeline categories are an explicit allowlist, never a freeform string", () => {
  assert.deepEqual([...CATERING_TIMELINE_CATEGORIES], [
    "arrival", "load_in", "setup", "food_prep", "guest_arrival", "service",
    "cake_or_special_moment", "cleanup", "breakdown", "load_out", "custom",
  ]);
  for (const category of CATERING_TIMELINE_CATEGORIES) assert.equal(typeof CATERING_TIMELINE_CATEGORY_LABELS[category], "string");
  for (const category of ["", "plating", "Setup", "arrival ", "load-in"]) {
    assert.equal(cateringTimelineCreateSchema.safeParse({ title: "Item", category }).success, false, category);
  }
});

test("crew roles and equipment vocabularies are closed too", () => {
  assert.deepEqual([...CATERING_STAFF_ROLES], ["lead", "chef", "prep", "server", "bartender", "runner", "setup", "breakdown", "driver", "coordinator", "custom"]);
  assert.deepEqual([...CATERING_EQUIPMENT_SOURCES], ["provider_owned", "rental", "venue_supplied", "customer_supplied"]);
  assert.deepEqual([...CATERING_EQUIPMENT_STATUSES], ["planned", "confirmed", "received", "in_use", "returned", "cancelled"]);
  for (const role of ["sous_chef", "", "Lead"]) assert.equal(cateringStaffCreateSchema.safeParse({ workerName: "A", role }).success, false, role);
  for (const status of ["pending_confirmation", "completed", "delivered", ""]) {
    assert.equal(cateringEquipmentCreateSchema.safeParse({ name: "Chafer", sourceType: "rental", status }).success, false, status);
  }
});

test("equipment status is a separate operational vocabulary from the booking lifecycle", () => {
  // "confirmed" and "cancelled" appear in both by coincidence of English, and that coincidence is exactly why they
  // are two closed enums rather than one shared set: a cancelled RENTAL says nothing about the booking, and a
  // confirmed BOOKING says nothing about the chafers. Neither list is a subset of the other, and no code path in
  // this phase reads one where the other belongs.
  assert.notDeepEqual([...CATERING_EQUIPMENT_STATUSES], [...CATERING_BOOKING_STATUSES]);
  assert.equal(CATERING_EQUIPMENT_STATUSES.some((status) => !(CATERING_BOOKING_STATUSES as readonly string[]).includes(status)), true);
  assert.equal(CATERING_BOOKING_STATUSES.some((status) => !(CATERING_EQUIPMENT_STATUSES as readonly string[]).includes(status)), true);
  // A booking-only status is never an accepted equipment status.
  assert.equal(cateringEquipmentCreateSchema.safeParse({ name: "Chafer", sourceType: "rental", status: "pending_confirmation" }).success, false);
  assert.equal(cateringEquipmentIsUnconfirmed("planned"), true);
  for (const status of ["confirmed", "received", "in_use", "returned", "cancelled"] as const) assert.equal(cateringEquipmentIsUnconfirmed(status), false, status);
  for (const status of ["received", "in_use", "returned", "cancelled"] as const) assert.equal(cateringEquipmentIsSettled(status), true, status);
  for (const status of ["planned", "confirmed"] as const) assert.equal(cateringEquipmentIsSettled(status), false, status);
});

test("no execution schema accepts an identity, ownership or ordering field", () => {
  const bases: [string, { safeParse: (value: unknown) => { success: boolean } }][] = [
    ["timeline create", cateringTimelineCreateSchema],
    ["timeline update", cateringTimelineUpdateSchema],
    ["timeline delete", cateringTimelineDeleteSchema],
    ["timeline reorder", cateringTimelineReorderSchema],
    ["staff create", cateringStaffCreateSchema],
    ["staff update", cateringStaffUpdateSchema],
    ["staff delete", cateringStaffDeleteSchema],
    ["equipment create", cateringEquipmentCreateSchema],
    ["equipment update", cateringEquipmentUpdateSchema],
    ["equipment delete", cateringEquipmentDeleteSchema],
    ["access save", cateringAccessSaveSchema],
    ["milestone toggle", cateringMilestoneToggleSchema],
  ];
  const version = new Date().toISOString();
  for (const [name, schema] of bases) {
    for (const field of FORGED_IDENTITY_FIELDS) {
      // Every schema is `.strict()`, so an unexpected field is REFUSED rather than silently dropped -- which is the
      // difference between "the server ignored your forged providerId" and "the server told you it will not accept
      // one". `expectedUpdatedAt` is supplied where a schema requires it, so the refusal is about the forged field.
      const body = { title: "x", workerName: "x", role: "server", name: "x", sourceType: "rental", completed: true, items: [{ id: "11111111-1111-4111-8111-111111111111", expectedUpdatedAt: version }], expectedUpdatedAt: version, [field]: "forged" };
      assert.equal(schema.safeParse(body).success, false, `${name} accepted ${field}`);
    }
  }
});

test("timeline creation cannot claim a position, a completion or a version", () => {
  assert.equal(cateringTimelineCreateSchema.safeParse({ title: "Load in", category: "load_in", scheduledTime: "07:30", endTime: "08:30", visibility: "shared", isBlocker: true }).success, true);
  for (const field of ["completed", "completedAt", "expectedUpdatedAt", "sortOrder", "position"]) {
    assert.equal(cateringTimelineCreateSchema.safeParse({ title: "Item", [field]: "forged" }).success, false, field);
  }
  // Defaults are the private, non-blocking, uncategorised ones: sharing is always an explicit act.
  const parsed = cateringTimelineCreateSchema.parse({ title: "Item" });
  assert.equal(parsed.visibility, "provider_private");
  assert.equal(parsed.isBlocker, false);
  assert.equal(parsed.category, "custom");
});

test("event-local wall clocks are required in canonical HH:mm and must run forwards", () => {
  for (const value of ["00:00", "07:30", "23:59"]) assert.equal(cateringTimelineCreateSchema.safeParse({ title: "x", scheduledTime: value }).success, true, value);
  for (const value of ["7:30", "24:00", "07:60", "2026-09-01T07:30Z", ""]) assert.equal(cateringTimelineCreateSchema.safeParse({ title: "x", scheduledTime: value }).success, false, value);
  assert.equal(cateringTimelineCreateSchema.safeParse({ title: "x", scheduledTime: "18:00", endTime: "17:00" }).success, false);
  assert.equal(cateringTimelineCreateSchema.safeParse({ title: "x", scheduledTime: "18:00", endTime: "18:00" }).success, true);
  assert.equal(cateringStaffCreateSchema.safeParse({ workerName: "A", role: "chef", arrivalTime: "18:00", departureTime: "17:00" }).success, false);
  assert.equal(cateringAccessSaveSchema.safeParse({ accessWindowStart: "18:00", accessWindowEnd: "17:00" }).success, false);
});

test("a custom crew role must be named and a listed role must not carry one", () => {
  assert.equal(cateringStaffCreateSchema.safeParse({ workerName: "A", role: "custom", customRole: "Pastry lead" }).success, true);
  assert.equal(cateringStaffCreateSchema.safeParse({ workerName: "A", role: "custom" }).success, false);
  assert.equal(cateringStaffCreateSchema.safeParse({ workerName: "A", role: "custom", customRole: "   " }).success, false);
  assert.equal(cateringStaffCreateSchema.safeParse({ workerName: "A", role: "chef", customRole: "Pastry lead" }).success, false);
});

test("equipment quantity is bounded, integral and coerced from a form value", () => {
  assert.equal(cateringEquipmentCreateSchema.parse({ name: "Chafer", sourceType: "rental", quantity: "12" }).quantity, 12);
  for (const quantity of [0, -1, 10_000, 1.5, "abc", ""]) {
    assert.equal(cateringEquipmentCreateSchema.safeParse({ name: "Chafer", sourceType: "rental", quantity }).success, false, String(quantity));
  }
  assert.equal(cateringEquipmentCreateSchema.parse({ name: "Chafer", sourceType: "rental" }).quantity, 1);
});

test("every update and delete carries a version precondition, and a reorder carries one per item", () => {
  const version = new Date().toISOString();
  assert.equal(cateringTimelineUpdateSchema.safeParse({ title: "x" }).success, false, "update without a version");
  assert.equal(cateringTimelineUpdateSchema.safeParse({ expectedUpdatedAt: version }).success, false, "version alone is not an edit");
  assert.equal(cateringTimelineUpdateSchema.safeParse({ title: "x", expectedUpdatedAt: version }).success, true);
  assert.equal(cateringTimelineDeleteSchema.safeParse({}).success, false);
  assert.equal(cateringStaffUpdateSchema.safeParse({ workerName: "x" }).success, false);
  assert.equal(cateringEquipmentUpdateSchema.safeParse({ status: "received" }).success, false);
  assert.equal(cateringEquipmentUpdateSchema.safeParse({ status: "received", expectedUpdatedAt: version }).success, true);
  const item = { id: "11111111-1111-4111-8111-111111111111", expectedUpdatedAt: version };
  assert.equal(cateringTimelineReorderSchema.safeParse({ items: [item] }).success, true);
  assert.equal(cateringTimelineReorderSchema.safeParse({ items: [{ id: item.id }] }).success, false, "an entry without a version");
  assert.equal(cateringTimelineReorderSchema.safeParse({ items: [item, item] }).success, false, "duplicate ids");
  assert.equal(cateringTimelineReorderSchema.safeParse({ items: [] }).success, false);
  // A client-supplied sort order is refused outright, so array position stays the only ordering input.
  assert.equal(cateringTimelineReorderSchema.safeParse({ items: [{ ...item, sortOrder: 0 }] }).success, false);
});

test("an access save may omit its version, which asserts that no record exists yet", () => {
  assert.equal(cateringAccessSaveSchema.safeParse({ parkingInstructions: "Rear lot" }).success, true);
  assert.equal(cateringAccessSaveSchema.safeParse({ parkingInstructions: "Rear lot", expectedUpdatedAt: new Date().toISOString() }).success, true);
  assert.equal(cateringAccessSaveSchema.safeParse({ venueAddress: "1 Main St" }).success, false, "the authoritative address is not restated here");
  for (const field of ["eventDate", "venueAddress", "venueCity", "venuePostalCode", "guestCount", "agreedPrice", "status"]) {
    assert.equal(cateringAccessSaveSchema.safeParse({ [field]: "forged" }).success, false, field);
  }
});

test("the access record has no second copy of the authoritative event location or date", () => {
  for (const field of ["venueAddress", "venueCity", "venueState", "venuePostalCode", "eventDate", "guestCount"]) {
    assert.equal((CATERING_ACCESS_SHARED_FIELDS as readonly string[]).includes(field), false, field);
  }
  // And the one provider-private field is not in the shared set, so it can never be serialized as shared.
  assert.equal((CATERING_ACCESS_SHARED_FIELDS as readonly string[]).includes("providerPrivateNotes"), false);
});

test("a milestone toggle asserts a state and nothing else", () => {
  assert.equal(cateringMilestoneToggleSchema.safeParse({ completed: true }).success, true);
  assert.equal(cateringMilestoneToggleSchema.safeParse({ completed: false, expectedUpdatedAt: new Date().toISOString() }).success, true);
  assert.equal(cateringMilestoneToggleSchema.safeParse({}).success, false);
  for (const field of ["milestoneKey", "key", "completedAt", "completedBy", "bookingStatus", "status"]) {
    assert.equal(cateringMilestoneToggleSchema.safeParse({ completed: true, [field]: "forged" }).success, false, field);
  }
  assert.equal(CATERING_EXECUTION_MILESTONE_KEYS.length, 11);
  for (const key of CATERING_EXECUTION_MILESTONE_KEYS) assert.equal(typeof CATERING_EXECUTION_MILESTONE_LABELS[key], "string");
});

test("every refusal code is distinct and stable so the client can classify by it", () => {
  const codes = [CATERING_EXECUTION_VERSION_CONFLICT_CODE, CATERING_EXECUTION_SET_CHANGED_CODE, CATERING_EXECUTION_NOT_FOUND_CODE, CATERING_WORKSPACE_READ_ONLY_CODE];
  assert.equal(new Set(codes).size, codes.length);
  // The read-only code is the workspace's own, so every section classifies a terminal booking identically.
  assert.equal(CATERING_WORKSPACE_READ_ONLY_CODE, "workspace_read_only");
});

test("collection limits are real numbers the server can enforce", () => {
  assert.equal(CATERING_EXECUTION_TIMELINE_LIMIT, 100);
  assert.equal(CATERING_EXECUTION_STAFF_LIMIT, 60);
  assert.equal(CATERING_EXECUTION_EQUIPMENT_LIMIT, 100);
  assert.equal(cateringTimelineReorderSchema.safeParse({ items: Array.from({ length: CATERING_EXECUTION_TIMELINE_LIMIT + 1 }, (_value, index) => ({ id: `1111111${index.toString().padStart(1, "0")}-1111-4111-8111-111111111111`, expectedUpdatedAt: new Date().toISOString() })) }).success, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Readiness derivation
 * ------------------------------------------------------------------------------------------------------------- */

const READY_FACTS: CateringReadinessFacts = {
  timelineItemCount: 3,
  staffAssignmentCount: 2,
  venueAccessConfirmed: true,
  hasSharedAccessInstructions: true,
  unconfirmedEquipmentCount: 0,
  blockingEquipmentCount: 0,
  openBlockingTimelineCount: 0,
  outstandingSharedRequirementCount: 0,
  guestCountRecorded: true,
};

test("a fully prepared event derives ready, on every signal", () => {
  const readiness = deriveCateringReadiness(READY_FACTS, "provider");
  assert.equal(readiness.state, "ready");
  assert.deepEqual(readiness.signals.map((signal) => signal.state), readiness.signals.map(() => "ready"));
  assert.deepEqual(readiness.blockers, []);
  assert.deepEqual(readiness.signals.map((signal) => signal.signal), [...CATERING_READINESS_SIGNALS]);
});

test("each signal's derivation is exactly the documented rule", () => {
  assert.equal(cateringReadinessSignalState("timeline", { ...READY_FACTS, timelineItemCount: 0 }), "needs_attention");
  assert.equal(cateringReadinessSignalState("timeline", READY_FACTS), "ready");
  assert.equal(cateringReadinessSignalState("staffing", { ...READY_FACTS, staffAssignmentCount: 0 }), "needs_attention");
  assert.equal(cateringReadinessSignalState("venue_access", { ...READY_FACTS, venueAccessConfirmed: false }), "blocked");
  assert.equal(cateringReadinessSignalState("venue_access", { ...READY_FACTS, hasSharedAccessInstructions: false }), "needs_attention");
  assert.equal(cateringReadinessSignalState("equipment", { ...READY_FACTS, unconfirmedEquipmentCount: 1 }), "needs_attention");
  assert.equal(cateringReadinessSignalState("equipment", { ...READY_FACTS, unconfirmedEquipmentCount: 1, blockingEquipmentCount: 1 }), "blocked");
  assert.equal(cateringReadinessSignalState("shared_requirements", { ...READY_FACTS, outstandingSharedRequirementCount: 2 }), "needs_attention");
  assert.equal(cateringReadinessSignalState("guest_count", { ...READY_FACTS, guestCountRecorded: false }), "blocked");
  assert.equal(cateringReadinessSignalState("execution_blockers", { ...READY_FACTS, openBlockingTimelineCount: 1 }), "blocked");
});

test("the derivation is total, deterministic and free of any input but the facts", () => {
  for (const signal of CATERING_READINESS_SIGNALS) {
    const state = cateringReadinessSignalState(signal, READY_FACTS);
    assert.equal((CATERING_READINESS_STATES as readonly string[]).includes(state), true, signal);
    // Called twice with the same facts, it answers the same: no clock, no randomness, no ordering dependency.
    assert.equal(cateringReadinessSignalState(signal, READY_FACTS), state);
    assert.equal(typeof CATERING_READINESS_DETAILS[signal][state], "string");
  }
});

test("the overall state is the worst signal present", () => {
  assert.equal(cateringWorstReadinessState(["ready", "ready"]), "ready");
  assert.equal(cateringWorstReadinessState(["ready", "needs_attention"]), "needs_attention");
  assert.equal(cateringWorstReadinessState(["needs_attention", "blocked", "ready"]), "blocked");
  assert.equal(cateringWorstReadinessState([]), "ready");
});

test("blockers are exactly the blocked signals, never a separately computed list", () => {
  const readiness = deriveCateringReadiness({ ...READY_FACTS, guestCountRecorded: false, venueAccessConfirmed: false }, "customer");
  assert.deepEqual(readiness.blockers.map((entry) => entry.signal).sort(), ["guest_count", "venue_access"]);
  assert.equal(readiness.state, "blocked");
  // Every blocker is present in the signals list it was drawn from, so the two can never disagree.
  for (const blocker of readiness.blockers) assert.equal(readiness.signals.includes(blocker), true);
});

test("a customer's readiness never carries the provider-only staffing signal, in any state", () => {
  assert.deepEqual([...CATERING_PROVIDER_ONLY_READINESS_SIGNALS], ["staffing"]);
  assert.equal(cateringReadinessSignalVisibleTo("staffing", "customer"), false);
  assert.equal(cateringReadinessSignalVisibleTo("staffing", "provider"), true);
  for (const staffAssignmentCount of [0, 5]) {
    const customer = deriveCateringReadiness({ ...READY_FACTS, staffAssignmentCount }, "customer");
    assert.equal(customer.signals.some((signal) => signal.signal === "staffing"), false);
    assert.equal(customer.blockers.some((signal) => signal.signal === "staffing"), false);
    // And a crew problem cannot even move a customer's OVERALL state, which is what would leak it indirectly.
    assert.equal(customer.state, "ready");
  }
});

test("a customer's blocker detail is fixed wording, never anything a provider typed", () => {
  const readiness = deriveCateringReadiness({ ...READY_FACTS, venueAccessConfirmed: false }, "customer");
  const blocker = readiness.blockers.find((entry) => entry.signal === "venue_access");
  assert.equal(blocker?.detail, "Venue access needs confirmation");
  // The detail comes from the two-enum lookup table and from nowhere else, so no persisted string can reach it.
  assert.equal(blocker?.detail, CATERING_READINESS_DETAILS.venue_access.blocked);
  for (const signal of CATERING_READINESS_SIGNALS) {
    for (const state of CATERING_READINESS_STATES) {
      assert.equal(CATERING_READINESS_DETAILS[signal][state].includes("undefined"), false, `${signal}/${state}`);
    }
  }
});

test("a notification deep-links into the execution section of the right participant's workspace", () => {
  assert.equal(cateringExecutionSectionPath("customer", "b1"), "/services/catering/bookings/b1#execution");
  assert.equal(cateringExecutionSectionPath("provider", "b1"), "/services/catering/provider/bookings/b1#execution");
});
