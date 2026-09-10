import { z } from "zod";
import { calendarDateSchema } from "./catering-availability";
import type { CateringBookingStatus } from "./catering-bookings";
import { CATERING_WORKSPACE_READ_ONLY_CODE, cateringBookingWorkspacePath, mayEditCateringWorkspace } from "./catering-booking-operations";

/**
 * Phase 2J: event EXECUTION, layered beneath an existing catering booking.
 *
 * Nothing here is a booking status. The authoritative lifecycle stays exactly the four Phase 2G values, the
 * provider's completion action stays the only way a booking becomes `completed`, and every record in this module is
 * operational state that lives underneath that booking without ever moving it. A provider who marks setup complete,
 * service started, or every milestone done has changed no booking status at all -- which is why milestones are a
 * separate narrow model rather than an extra column on the booking.
 *
 * Two rules shape every contract below.
 *
 * The server is the only authority on identity. No schema here accepts a providerId, customerId, createdBy,
 * completedBy, actor, role or visibility-authorization field, and every one of them is `.strict()`, so such a field
 * is REFUSED rather than quietly dropped. Participants are derived from the persisted booking, and the acting user
 * from the authenticated session.
 *
 * And provider-private execution data is private in every channel. Staffing and milestones are provider-only
 * models with no customer representation at all -- not an empty array, not a count, not a key on the payload --
 * while timeline items and equipment carry an explicit two-value visibility and are filtered in SQL, so a customer
 * cannot infer a private record from a list, a count, a readiness signal, an activity row, a notification or the
 * wording of a refusal.
 */

/**
 * The visibility of one execution record.
 *
 * Deliberately spelled `provider_private` rather than reusing the Phase 2H/2I `provider` value. Those two vocabularies
 * describe different things and are never mixed: a task or file is `provider`/`shared`, an execution record is
 * `provider_private`/`shared`, and the activity row an execution change writes is translated through
 * `cateringExecutionActivityVisibility` rather than assuming the two spellings coincide.
 */
export const CATERING_EXECUTION_VISIBILITIES = ["shared", "provider_private"] as const;
export type CateringExecutionVisibility = typeof CATERING_EXECUTION_VISIBILITIES[number];

/**
 * The run-of-show category allowlist. A freeform category string is never accepted: the value is constrained by this
 * array, by a Zod enum, and by a database CHECK, so the three layers cannot drift and no client can invent a
 * category the UI has no label for. `custom` exists so an unusual moment has a home without opening the enum.
 */
export const CATERING_TIMELINE_CATEGORIES = [
  "arrival", "load_in", "setup", "food_prep", "guest_arrival", "service",
  "cake_or_special_moment", "cleanup", "breakdown", "load_out", "custom",
] as const;
export type CateringTimelineCategory = typeof CATERING_TIMELINE_CATEGORIES[number];

/**
 * The crew role allowlist. This is deliberately NOT an HR model: an assignment is a label, a role and some
 * operational notes scoped to ONE booking. It is never linked to a ChefSire user account, so nothing here creates,
 * implies or invents an employee, a profile or a second identity system.
 */
export const CATERING_STAFF_ROLES = [
  "lead", "chef", "prep", "server", "bartender", "runner", "setup", "breakdown", "driver", "coordinator", "custom",
] as const;
export type CateringStaffRole = typeof CATERING_STAFF_ROLES[number];

/** Where a piece of equipment comes from. Separate from its operational status, which is what happens to it. */
export const CATERING_EQUIPMENT_SOURCES = ["provider_owned", "rental", "venue_supplied", "customer_supplied"] as const;
export type CateringEquipmentSource = typeof CATERING_EQUIPMENT_SOURCES[number];

/**
 * The operational status of one piece of equipment. This is emphatically NOT a booking lifecycle value: a cancelled
 * rental says nothing about the booking, and a booking that is `confirmed` has no bearing on whether the chafers
 * have arrived. The two vocabularies are kept apart on purpose and share no value except by coincidence of English.
 */
export const CATERING_EQUIPMENT_STATUSES = ["planned", "confirmed", "received", "in_use", "returned", "cancelled"] as const;
export type CateringEquipmentStatus = typeof CATERING_EQUIPMENT_STATUSES[number];
/** Statuses that mean the item is no longer an outstanding dependency, however it was flagged. */
export const CATERING_EQUIPMENT_SETTLED_STATUSES: readonly CateringEquipmentStatus[] = ["received", "in_use", "returned", "cancelled"];
/** Statuses that still owe an answer before the event, and so feed the "equipment unconfirmed" readiness signal. */
export function cateringEquipmentIsUnconfirmed(status: CateringEquipmentStatus): boolean { return status === "planned"; }
export function cateringEquipmentIsSettled(status: CateringEquipmentStatus): boolean { return CATERING_EQUIPMENT_SETTLED_STATUSES.includes(status); }

/**
 * Whether one record is ACTUALLY an unresolved execution dependency right now.
 *
 * `isBlocker` alone is not that question. It is a persisted intent -- "this thing is on the critical path" -- and it
 * stays true for the life of the record, because a chafer that was blocking last Tuesday is still the item that was
 * blocking. What decides whether it is blocking TODAY is that intent AND the record's own progress: an item that has
 * been received, put into use, returned or cancelled is settled, and a run-of-show item that is done is done.
 *
 * These two predicates are the single definition of that, used by the server's readiness derivation and by the
 * interface's Blocking badge alike. Keeping them here is what stops the badge from claiming a rental is blocking the
 * event while the readiness summary beside it -- computed from the same row -- reports ready. The alternative, which
 * this replaces, was for the badge to read `isBlocker` on its own; the fix is emphatically NOT to clear the stored
 * flag when a record settles, because that would destroy the operational record of what actually held the event up.
 */
export function cateringEquipmentIsBlocking(item: { isBlocker: boolean; status: CateringEquipmentStatus }): boolean {
  return item.isBlocker && !cateringEquipmentIsSettled(item.status);
}
export function cateringTimelineItemIsBlocking(item: { isBlocker: boolean; completed: boolean }): boolean {
  return item.isBlocker && !item.completed;
}

/**
 * The event-day milestone allowlist. These are provider-only operational checkpoints, and completing every one of
 * them still does not complete the booking: the Phase 2G provider completion action remains the authoritative
 * mechanism, and nothing in this module calls it.
 */
export const CATERING_EXECUTION_MILESTONE_KEYS = [
  "crew_confirmed", "equipment_loaded", "departed_for_venue", "arrived", "load_in_complete",
  "setup_complete", "food_ready", "service_started", "service_complete", "cleanup_complete", "load_out_complete",
] as const;
export type CateringExecutionMilestoneKey = typeof CATERING_EXECUTION_MILESTONE_KEYS[number];

/** Launch bounds, enforced under the collection lock and by database CHECK constraints, never by types alone. */
export const CATERING_EXECUTION_TIMELINE_LIMIT = 100;
export const CATERING_EXECUTION_STAFF_LIMIT = 60;
export const CATERING_EXECUTION_EQUIPMENT_LIMIT = 100;
export const CATERING_EQUIPMENT_QUANTITY_MINIMUM = 1;
export const CATERING_EQUIPMENT_QUANTITY_MAXIMUM = 9999;

/**
 * The ONE event-local time-range rule in this phase: a range is ordered when either end is absent, or when the end
 * does not precede the start.
 *
 * It lives here, in the contract, because four different layers have to agree on it -- the create schemas, the
 * merged-state validation each PATCH runs against the authoritative row, and the database CHECK that backs both.
 * Restating the comparison in each of them is exactly how a partial update came to produce a state the schema had
 * accepted and the CHECK then rejected.
 *
 * An absent end is deliberately valid: clearing one side of a range is a real edit, not an invalid one.
 */
export function cateringTimeRangeIsOrdered(start: string | null | undefined, end: string | null | undefined): boolean {
  return start == null || end == null || start <= end;
}

/**
 * The wording every rejected time range answers with -- whether the request's OWN fields were out of order, or the
 * state they would merge into was. A participant who moves a start time past a persisted end time is told the same
 * thing either way, because from their point of view it is the same mistake.
 */
export const CATERING_TIMELINE_TIME_RANGE_MESSAGE = "Timeline end time must not precede its start time";
export const CATERING_STAFF_TIME_RANGE_MESSAGE = "Crew departure time must not precede arrival time";
export const CATERING_ACCESS_WINDOW_MESSAGE = "The access window end must not precede its start";

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
/** Event-local 24-hour wall clock, exactly as Phase 2H stores arrival and service times. Never a device timezone. */
const wallClock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm event-local time").nullable();
const calendarDate = calendarDateSchema.nullable();
/**
 * The optimistic-concurrency precondition every execution update carries: the serialized `updatedAt` the submitted
 * edit was based on. It is a precondition ONLY -- the server remains authoritative for the next `updatedAt` and
 * never persists a client-supplied one.
 */
export const cateringExecutionVersionSchema = z.string().datetime();
/**
 * The retry token for a creating mutation. Scoped by the server to (booking, creator, token) through a partial
 * unique index, so a retry resolves to the record the first attempt already created rather than adding a second one,
 * and a token replayed on another booking or by another actor is simply a different request.
 */
const clientRequestId = z.string().uuid().optional();

/* ------------------------------------------------------------------------------------------------------------- *
 * Run-of-show timeline
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Creating one run-of-show item. Position is NOT accepted: the server appends and assigns the authoritative
 * `sortOrder`, so a client cannot claim a slot, and reordering is its own versioned request.
 */
export const cateringTimelineCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: optionalText(2000),
  category: z.enum(CATERING_TIMELINE_CATEGORIES).default("custom"),
  scheduledTime: wallClock.optional(),
  endTime: wallClock.optional(),
  visibility: z.enum(CATERING_EXECUTION_VISIBILITIES).default("provider_private"),
  isBlocker: z.boolean().default(false),
  clientRequestId,
}).strict().refine(
  (value) => cateringTimeRangeIsOrdered(value.scheduledTime, value.endTime),
  { message: CATERING_TIMELINE_TIME_RANGE_MESSAGE, path: ["endTime"] },
);

/** Every timeline field a PATCH may persist, plus the version precondition. At least one real field is required. */
export const cateringTimelineUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: optionalText(2000),
  category: z.enum(CATERING_TIMELINE_CATEGORIES).optional(),
  scheduledTime: wallClock.optional(),
  endTime: wallClock.optional(),
  visibility: z.enum(CATERING_EXECUTION_VISIBILITIES).optional(),
  isBlocker: z.boolean().optional(),
  completed: z.boolean().optional(),
  expectedUpdatedAt: cateringExecutionVersionSchema,
}).strict().refine((value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"), "At least one timeline field is required");

export const cateringTimelineDeleteSchema = z.object({ expectedUpdatedAt: cateringExecutionVersionSchema }).strict();

/**
 * Reordering is a write against every item it moves, so each entry carries the version the client observed and the
 * ARRAY ORDER is the requested order. A client-supplied `sortOrder` is never read, and `.strict()` rejects one.
 */
export const cateringTimelineReorderEntrySchema = z.object({ id: z.string().uuid(), expectedUpdatedAt: cateringExecutionVersionSchema }).strict();
export const cateringTimelineReorderSchema = z.object({
  items: z.array(cateringTimelineReorderEntrySchema).min(1).max(CATERING_EXECUTION_TIMELINE_LIMIT),
}).strict().refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length, "Timeline item IDs must be unique");

/* ------------------------------------------------------------------------------------------------------------- *
 * Crew assignments (provider-private in every channel)
 * ------------------------------------------------------------------------------------------------------------- */

const staffShape = {
  workerName: z.string().trim().min(1).max(120),
  role: z.enum(CATERING_STAFF_ROLES),
  /** Only meaningful for the `custom` role, and required there -- enforced by refinement and by a database CHECK. */
  customRole: optionalText(60),
  contactNote: optionalText(200),
  arrivalTime: wallClock.optional(),
  departureTime: wallClock.optional(),
  responsibilityNote: optionalText(2000),
};
/** A custom role must actually name the role, and a listed role must not carry a conflicting custom label. */
function staffRoleIsCoherent(value: { role?: string; customRole?: string | null }): boolean {
  if (value.role === undefined) return true;
  return value.role === "custom" ? Boolean(value.customRole && value.customRole.trim()) : !value.customRole;
}
function staffTimesAreOrdered(value: { arrivalTime?: string | null; departureTime?: string | null }): boolean {
  return cateringTimeRangeIsOrdered(value.arrivalTime, value.departureTime);
}
export const cateringStaffCreateSchema = z.object({ ...staffShape, clientRequestId }).strict()
  .refine(staffRoleIsCoherent, { message: "A custom crew role must be named, and a listed role must not carry one", path: ["customRole"] })
  .refine(staffTimesAreOrdered, { message: CATERING_STAFF_TIME_RANGE_MESSAGE, path: ["departureTime"] });
export const cateringStaffUpdateSchema = z.object({
  workerName: staffShape.workerName.optional(),
  role: staffShape.role.optional(),
  customRole: staffShape.customRole,
  contactNote: staffShape.contactNote,
  arrivalTime: staffShape.arrivalTime,
  departureTime: staffShape.departureTime,
  responsibilityNote: staffShape.responsibilityNote,
  expectedUpdatedAt: cateringExecutionVersionSchema,
}).strict()
  .refine((value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"), "At least one crew field is required")
  .refine(staffTimesAreOrdered, { message: CATERING_STAFF_TIME_RANGE_MESSAGE, path: ["departureTime"] });
export const cateringStaffDeleteSchema = z.object({ expectedUpdatedAt: cateringExecutionVersionSchema }).strict();

/* ------------------------------------------------------------------------------------------------------------- *
 * Equipment and rentals
 * ------------------------------------------------------------------------------------------------------------- */

const equipmentShape = {
  name: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().int().min(CATERING_EQUIPMENT_QUANTITY_MINIMUM).max(CATERING_EQUIPMENT_QUANTITY_MAXIMUM),
  sourceType: z.enum(CATERING_EQUIPMENT_SOURCES),
  sourceName: optionalText(160),
  /**
   * A rental can be collected the day before and returned the day after, so these are a real calendar date plus an
   * event-local wall clock rather than a time alone. The booking's own authoritative `eventDate` is never copied
   * here -- these are the equipment's dates, not the event's.
   */
  pickupDate: calendarDate.optional(),
  pickupTime: wallClock.optional(),
  returnDate: calendarDate.optional(),
  returnTime: wallClock.optional(),
  notes: optionalText(2000),
  visibility: z.enum(CATERING_EXECUTION_VISIBILITIES),
  isBlocker: z.boolean(),
};
export const cateringEquipmentCreateSchema = z.object({
  ...equipmentShape,
  quantity: equipmentShape.quantity.default(1),
  status: z.enum(CATERING_EQUIPMENT_STATUSES).default("planned"),
  visibility: equipmentShape.visibility.default("provider_private"),
  isBlocker: equipmentShape.isBlocker.default(false),
  clientRequestId,
}).strict();
export const cateringEquipmentUpdateSchema = z.object({
  name: equipmentShape.name.optional(),
  quantity: equipmentShape.quantity.optional(),
  sourceType: equipmentShape.sourceType.optional(),
  sourceName: equipmentShape.sourceName,
  pickupDate: equipmentShape.pickupDate,
  pickupTime: equipmentShape.pickupTime,
  returnDate: equipmentShape.returnDate,
  returnTime: equipmentShape.returnTime,
  notes: equipmentShape.notes,
  visibility: equipmentShape.visibility.optional(),
  isBlocker: equipmentShape.isBlocker.optional(),
  status: z.enum(CATERING_EQUIPMENT_STATUSES).optional(),
  expectedUpdatedAt: cateringExecutionVersionSchema,
}).strict().refine((value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"), "At least one equipment field is required");
export const cateringEquipmentDeleteSchema = z.object({ expectedUpdatedAt: cateringExecutionVersionSchema }).strict();

/* ------------------------------------------------------------------------------------------------------------- *
 * Venue access instructions
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Operational access instructions attached to the event location Phase 2H already owns.
 *
 * There is deliberately NO address, city, state, postal code or event date here. Those live on the booking and on
 * `catering_booking_details`, they stay the single source of truth, and duplicating them into a second table is
 * exactly the drift this contract refuses. Everything below is an INSTRUCTION about reaching and working in that
 * already-recorded place.
 */
export const CATERING_ACCESS_CONTACT_SOURCES = ["provider", "customer"] as const;
export type CateringAccessContactSource = typeof CATERING_ACCESS_CONTACT_SOURCES[number];

/**
 * The ONE definition of every editable access field: what it is called, what control edits it, and how long it may
 * be. The Zod schema below is BUILT from this, and the interface renders from it, so a browser constraint and the
 * validation it is supposed to anticipate cannot drift apart.
 *
 * They had drifted: every textarea allowed 4000 characters and the text inputs allowed unlimited, while the schema
 * capped most notes at 2000, the load-in entrance at 240, a contact name at 120 and a phone at 40. A provider could
 * type something the browser accepted happily and the server could only ever answer with a 400.
 *
 * `time` fields carry no length at all -- they are `HH:mm` wall clocks validated by a regex, and a character count
 * would be a meaningless constraint on a time picker.
 */
export const CATERING_ACCESS_FIELDS = [
  { field: "loadInEntrance", label: "Load-in entrance", control: "text", maxLength: 240 },
  { field: "loadingDockNotes", label: "Loading dock", control: "textarea", maxLength: 2000 },
  { field: "elevatorNotes", label: "Elevator", control: "textarea", maxLength: 2000 },
  { field: "kitchenAccessNotes", label: "Kitchen access", control: "textarea", maxLength: 2000 },
  { field: "parkingInstructions", label: "Parking", control: "textarea", maxLength: 2000 },
  { field: "securityCheckInNotes", label: "Security / check-in", control: "textarea", maxLength: 2000 },
  { field: "accessWindowStart", label: "Access from (event local)", control: "time" },
  { field: "accessWindowEnd", label: "Access until (event local)", control: "time" },
  { field: "venueContactName", label: "Venue contact", control: "text", maxLength: 120 },
  { field: "venueContactPhone", label: "Venue contact phone", control: "text", maxLength: 40 },
  { field: "powerWaterNotes", label: "Power and water", control: "textarea", maxLength: 2000 },
  { field: "trashRemovalNotes", label: "Trash and removal", control: "textarea", maxLength: 2000 },
  { field: "specialRestrictions", label: "Special restrictions", control: "textarea", maxLength: 2000 },
  { field: "providerPrivateNotes", label: "Private provider notes", control: "textarea", maxLength: 4000 },
] as const;
export type CateringAccessFieldMeta = typeof CATERING_ACCESS_FIELDS[number];
export type CateringAccessFieldName = CateringAccessFieldMeta["field"];
export type CateringAccessControl = CateringAccessFieldMeta["control"];
/** The length limit for one field, or undefined for the time controls, which have none. */
export function cateringAccessFieldLimit(field: CateringAccessFieldName): number | undefined {
  const meta = CATERING_ACCESS_FIELDS.find((entry) => entry.field === field);
  return meta && "maxLength" in meta ? meta.maxLength : undefined;
}
/** Reads a limit that must exist, so the schema below cannot silently be built from a missing entry. */
const accessLimit = (field: CateringAccessFieldName): number => {
  const limit = cateringAccessFieldLimit(field);
  if (limit === undefined) throw new Error(`catering access field ${field} has no length limit`);
  return limit;
};

export const cateringAccessSaveSchema = z.object({
  loadInEntrance: optionalText(accessLimit("loadInEntrance")),
  loadingDockNotes: optionalText(accessLimit("loadingDockNotes")),
  elevatorNotes: optionalText(accessLimit("elevatorNotes")),
  kitchenAccessNotes: optionalText(accessLimit("kitchenAccessNotes")),
  parkingInstructions: optionalText(accessLimit("parkingInstructions")),
  securityCheckInNotes: optionalText(accessLimit("securityCheckInNotes")),
  accessWindowStart: wallClock.optional(),
  accessWindowEnd: wallClock.optional(),
  venueContactName: optionalText(accessLimit("venueContactName")),
  venueContactPhone: optionalText(accessLimit("venueContactPhone")),
  /**
   * Who the venue contact came from. Customer-supplied contact details keep that provenance visible to both
   * participants rather than being silently re-attributed to the provider who transcribed them.
   */
  venueContactSource: z.enum(CATERING_ACCESS_CONTACT_SOURCES).nullable().optional(),
  powerWaterNotes: optionalText(accessLimit("powerWaterNotes")),
  trashRemovalNotes: optionalText(accessLimit("trashRemovalNotes")),
  specialRestrictions: optionalText(accessLimit("specialRestrictions")),
  /** Never serialized to the customer. The one provider-private field on an otherwise shared record. */
  providerPrivateNotes: optionalText(accessLimit("providerPrivateNotes")),
  accessConfirmed: z.boolean().optional(),
  /**
   * Absent means "I am creating this record and expect none to exist". A present value is the version the edit was
   * based on. Either way a concurrent save cannot be silently overwritten.
   */
  expectedUpdatedAt: cateringExecutionVersionSchema.optional(),
}).strict().refine(
  (value) => cateringTimeRangeIsOrdered(value.accessWindowStart, value.accessWindowEnd),
  { message: CATERING_ACCESS_WINDOW_MESSAGE, path: ["accessWindowEnd"] },
);
/** The access fields a customer may ever observe. `providerPrivateNotes` is deliberately absent from this list. */
export const CATERING_ACCESS_SHARED_FIELDS = [
  "loadInEntrance", "loadingDockNotes", "elevatorNotes", "kitchenAccessNotes", "parkingInstructions",
  "securityCheckInNotes", "accessWindowStart", "accessWindowEnd", "venueContactName", "venueContactPhone",
  "venueContactSource", "powerWaterNotes", "trashRemovalNotes", "specialRestrictions",
] as const;
export type CateringAccessSharedField = typeof CATERING_ACCESS_SHARED_FIELDS[number];

/* ------------------------------------------------------------------------------------------------------------- *
 * Milestones
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Toggling one milestone. It is a STATE assertion, not an event: asking for `completed: true` twice leaves exactly
 * one row in exactly one state, which is what makes a retried request from a phone on a bad connection harmless.
 * `expectedUpdatedAt` is absent the first time a key is touched, and present thereafter.
 */
export const cateringMilestoneToggleSchema = z.object({
  completed: z.boolean(),
  expectedUpdatedAt: cateringExecutionVersionSchema.optional(),
}).strict();

/* ------------------------------------------------------------------------------------------------------------- *
 * Refusal codes
 * ------------------------------------------------------------------------------------------------------------- */

/** A submitted edit was based on a version the record has since moved past. The client must reload, not retry. */
export const CATERING_EXECUTION_VERSION_CONFLICT_CODE = "catering_execution_version_conflict";
export const CATERING_EXECUTION_VERSION_CONFLICT_MESSAGE = "This execution record changed since you started editing it. Reload the latest version before saving.";
/**
 * The authoritative timeline collection gained or lost an item since the client composed its reorder, so the
 * submission is no longer the complete current set. Distinct from a version conflict: no submitted item is stale,
 * the membership itself changed, and the client needs the new collection rather than newer versions.
 */
export const CATERING_EXECUTION_SET_CHANGED_CODE = "catering_execution_set_changed";
export const CATERING_EXECUTION_SET_CHANGED_MESSAGE = "Reorder must contain the complete current run-of-show";
/** A record the actor may mutate but that no longer exists. Never reported as a fabricated version conflict. */
export const CATERING_EXECUTION_NOT_FOUND_CODE = "catering_execution_not_found";
export const CATERING_EXECUTION_NOT_FOUND_MESSAGE = "Execution record not found";
/** Re-exported so the execution client classifies a terminal booking by the same code every other section uses. */
export { CATERING_WORKSPACE_READ_ONLY_CODE };
export const CATERING_EXECUTION_READ_ONLY_MESSAGE = "Cancelled and completed bookings are read-only";

/**
 * Every Phase 2J mutation is provider-only, and closes exactly when the Phase 2H workspace closes.
 *
 * There is no customer execution mutation at all. A customer reads shared execution data and nothing else, so there
 * is no route on which a customer could change provider-owned operational state, and no code path that has to
 * decide whether a particular customer write is permitted.
 */
export function mayMutateCateringExecution(status: CateringBookingStatus, role: "provider" | "customer"): boolean {
  return mayEditCateringWorkspace(status) && role === "provider";
}
/** Reading never closes. A cancelled or completed booking keeps its execution history, under the same visibility rules. */
export function mayReadCateringExecution(): boolean { return true; }

/**
 * The activity visibility one execution record's history is written at.
 *
 * The activity table speaks `provider`/`shared`; execution records speak `provider_private`/`shared`. Translating
 * here, once, is what stops a private record's history from being written as customer-visible because two enums
 * happened to be spelled differently.
 */
export function cateringExecutionActivityVisibility(visibility: CateringExecutionVisibility): "provider" | "shared" {
  return visibility === "shared" ? "shared" : "provider";
}
/** Whether one execution record is visible to an actor at all. A customer sees shared records and nothing else. */
export function cateringExecutionVisibleTo(visibility: CateringExecutionVisibility, role: "provider" | "customer"): boolean {
  return role === "provider" || visibility === "shared";
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Event-day readiness
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Readiness is DERIVED, never stored.
 *
 * There is no persisted score, no cached summary and no client-supplied count anywhere in this module: the server
 * reads the actor's own authorized rows, reduces them to the facts below, and derives the presentation state from
 * them deterministically. That is what makes a blocker impossible to forge from a request body -- there is nothing
 * to forge, because nothing about readiness is accepted as input.
 *
 * The three states are presentation only. They are NOT booking statuses, they never appear on the booking record,
 * and nothing here can move a booking's lifecycle.
 */
export const CATERING_READINESS_STATES = ["ready", "needs_attention", "blocked"] as const;
export type CateringReadinessState = typeof CATERING_READINESS_STATES[number];
/**
 * The signals a readiness summary is built from, in the order they are reported.
 *
 * `staffing` is the only provider-only signal, and it is omitted from a customer's summary ENTIRELY -- not reported
 * as ready, not reported as unknown, simply absent -- because its presence in any state would tell a customer that
 * crew assignments exist as a concept and that this booking's one is or is not satisfied.
 */
export const CATERING_READINESS_SIGNALS = [
  "timeline", "staffing", "venue_access", "equipment", "shared_requirements", "guest_count", "execution_blockers",
] as const;
export type CateringReadinessSignal = typeof CATERING_READINESS_SIGNALS[number];
export const CATERING_PROVIDER_ONLY_READINESS_SIGNALS: readonly CateringReadinessSignal[] = ["staffing"];
export function cateringReadinessSignalVisibleTo(signal: CateringReadinessSignal, role: "provider" | "customer"): boolean {
  return role === "provider" || !CATERING_PROVIDER_ONLY_READINESS_SIGNALS.includes(signal);
}

/**
 * The reduced, already-authorized facts a readiness summary is derived from.
 *
 * Every count is computed from rows the ACTOR may see, so a customer's facts are built from shared records only and
 * a provider-private blocker cannot change a single number a customer receives. Nothing here is ever read from a
 * request.
 */
export type CateringReadinessFacts = {
  /** Timeline items visible to this actor. */
  timelineItemCount: number;
  /** Crew assignments. Always 0 in a customer's facts, and the signal it feeds is omitted from their summary. */
  staffAssignmentCount: number;
  /** The provider's explicit assertion that venue access is settled. Not inferred from the notes being non-empty. */
  venueAccessConfirmed: boolean;
  /** Whether any shared access instruction has actually been written down. */
  hasSharedAccessInstructions: boolean;
  /** Equipment visible to this actor whose status is still `planned`. */
  unconfirmedEquipmentCount: number;
  /** Equipment visible to this actor flagged as a blocker and not yet settled. */
  blockingEquipmentCount: number;
  /** Timeline items visible to this actor flagged as a blocker and not yet completed. */
  openBlockingTimelineCount: number;
  /** Phase 2H SHARED requirements still pending. Both actors already see these, so both actors' facts count them. */
  outstandingSharedRequirementCount: number;
  /** Whether the booking records a final guest count. Read from the booking, never from execution data. */
  guestCountRecorded: boolean;
};

/**
 * The exact derivation rules, one signal at a time. They are total, deterministic, and depend on nothing but the
 * facts above -- no clock, no randomness, no ordering of rows, and no request input.
 *
 *  - `timeline`            ready when at least one visible item exists; needs_attention at zero.
 *  - `staffing`            ready when at least one crew assignment exists; needs_attention at zero. Provider only.
 *  - `venue_access`        blocked until the provider confirms access; needs_attention while confirmed but with no
 *                          instruction written down; ready otherwise.
 *  - `equipment`           blocked while any visible blocking item is unsettled; needs_attention while any visible
 *                          item is still `planned`; ready otherwise.
 *  - `shared_requirements` needs_attention while any shared Phase 2H requirement is pending; ready otherwise.
 *  - `guest_count`         blocked until the booking records a guest count; ready once it does.
 *  - `execution_blockers`  blocked while any visible timeline item is flagged and incomplete; ready otherwise.
 *
 * Milestones deliberately contribute NO state. Before the event every milestone is legitimately incomplete, so a
 * signal derived from them would read "needs attention" for the entire life of every booking and mean nothing. They
 * are reported as counts instead, to the provider only.
 */
export function cateringReadinessSignalState(signal: CateringReadinessSignal, facts: CateringReadinessFacts): CateringReadinessState {
  switch (signal) {
    case "timeline": return facts.timelineItemCount > 0 ? "ready" : "needs_attention";
    case "staffing": return facts.staffAssignmentCount > 0 ? "ready" : "needs_attention";
    case "venue_access": return !facts.venueAccessConfirmed ? "blocked" : facts.hasSharedAccessInstructions ? "ready" : "needs_attention";
    case "equipment": return facts.blockingEquipmentCount > 0 ? "blocked" : facts.unconfirmedEquipmentCount > 0 ? "needs_attention" : "ready";
    case "shared_requirements": return facts.outstandingSharedRequirementCount > 0 ? "needs_attention" : "ready";
    case "guest_count": return facts.guestCountRecorded ? "ready" : "blocked";
    case "execution_blockers": return facts.openBlockingTimelineCount > 0 ? "blocked" : "ready";
  }
}

/**
 * The fixed wording for every (signal, state) pair.
 *
 * Nothing a provider typed ever reaches a customer through readiness. A blocker's detail is looked up here by two
 * enum values, so a private note, a crew member's name, a vendor, or an internal staffing failure cannot leak into a
 * customer's summary however it was worded -- there is no path from a persisted string to this text.
 */
export const CATERING_READINESS_DETAILS: Record<CateringReadinessSignal, Record<CateringReadinessState, string>> = {
  timeline: { ready: "A run-of-show is prepared", needs_attention: "No run-of-show has been prepared yet", blocked: "No run-of-show has been prepared yet" },
  staffing: { ready: "Crew is assigned", needs_attention: "No crew has been assigned yet", blocked: "No crew has been assigned yet" },
  venue_access: { ready: "Venue access is confirmed", needs_attention: "Venue access is confirmed, but no access instructions have been added", blocked: "Venue access needs confirmation" },
  equipment: { ready: "Equipment is accounted for", needs_attention: "Some equipment is still unconfirmed", blocked: "Equipment delivery is unresolved" },
  shared_requirements: { ready: "No outstanding requirements", needs_attention: "Requirements are still outstanding", blocked: "Requirements are still outstanding" },
  guest_count: { ready: "A final guest count is recorded", needs_attention: "A final guest count is missing", blocked: "A final guest count is missing" },
  execution_blockers: { ready: "No flagged run-of-show blockers", needs_attention: "A run-of-show item is flagged", blocked: "A run-of-show item is flagged as blocking" },
};

export type CateringReadinessSignalView = { signal: CateringReadinessSignal; state: CateringReadinessState; detail: string };
/**
 * `milestones` is reported to the provider only, and as counts alone. `blockers` is the subset of `signals` in the
 * blocked state, repeated for the client's convenience rather than derived separately -- so the two can never
 * disagree, and a customer's blockers are by construction drawn from the signals a customer may already see.
 */
export type CateringExecutionReadinessView = {
  state: CateringReadinessState;
  signals: CateringReadinessSignalView[];
  blockers: CateringReadinessSignalView[];
  milestones?: { completed: number; total: number };
};

/** The overall state is the worst signal present: blocked dominates needs_attention, which dominates ready. */
export function cateringWorstReadinessState(states: readonly CateringReadinessState[]): CateringReadinessState {
  if (states.includes("blocked")) return "blocked";
  if (states.includes("needs_attention")) return "needs_attention";
  return "ready";
}

/**
 * The whole derivation, for one actor.
 *
 * A customer's summary is built from a customer's facts and a customer's signal list, so their overall state is a
 * function of shared records alone: a provider-private blocking rental or an unfilled crew slot changes nothing they
 * receive -- not the state, not a count, not the number of signals.
 */
export function deriveCateringReadiness(facts: CateringReadinessFacts, role: "provider" | "customer"): CateringExecutionReadinessView {
  const signals = CATERING_READINESS_SIGNALS.filter((signal) => cateringReadinessSignalVisibleTo(signal, role)).map((signal) => {
    const state = cateringReadinessSignalState(signal, facts);
    return { signal, state, detail: CATERING_READINESS_DETAILS[signal][state] };
  });
  return { state: cateringWorstReadinessState(signals.map((entry) => entry.state)), signals, blockers: signals.filter((entry) => entry.state === "blocked") };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Serialized views
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * What a timeline item serializes. There is no `createdBy` and no `completedBy`: both are persisted for audit, and
 * neither is a user id any participant's interface needs, so neither is serialized to ANY actor.
 */
export type CateringExecutionTimelineItemView = {
  id: string; title: string; description: string | null; category: CateringTimelineCategory;
  scheduledTime: string | null; endTime: string | null; visibility: CateringExecutionVisibility;
  isBlocker: boolean; completed: boolean; completedAt: string | null;
  createdAt: string; updatedAt: string;
  /**
   * The authoritative persisted position -- PROVIDER ONLY, and absent from a customer's items entirely.
   *
   * It is numbered across the whole run-of-show, private items included, so a customer receiving it could read the
   * gaps: shared items at 0 and 3 say plainly that two records they may not see sit between them. The order of the
   * array is what any client actually renders from, and it survives filtering, so a customer needs no position at
   * all -- and is given none, rather than a renumbered one that would still have to be trusted not to leak.
   */
  sortOrder?: number;
};
/** Provider-only in every channel. A customer's execution payload has no `staff` key at all. */
export type CateringExecutionStaffView = {
  id: string; workerName: string; role: CateringStaffRole; customRole: string | null;
  contactNote: string | null; arrivalTime: string | null; departureTime: string | null;
  responsibilityNote: string | null; createdAt: string; updatedAt: string;
};
export type CateringExecutionEquipmentView = {
  id: string; name: string; quantity: number; sourceType: CateringEquipmentSource; sourceName: string | null;
  pickupDate: string | null; pickupTime: string | null; returnDate: string | null; returnTime: string | null;
  status: CateringEquipmentStatus; isBlocker: boolean; notes: string | null;
  visibility: CateringExecutionVisibility; createdAt: string; updatedAt: string;
};
/** `providerPrivateNotes` is present only in a provider's view; a customer's object does not carry the key. */
export type CateringExecutionAccessView = {
  loadInEntrance: string | null; loadingDockNotes: string | null; elevatorNotes: string | null;
  kitchenAccessNotes: string | null; parkingInstructions: string | null; securityCheckInNotes: string | null;
  accessWindowStart: string | null; accessWindowEnd: string | null;
  venueContactName: string | null; venueContactPhone: string | null; venueContactSource: CateringAccessContactSource | null;
  powerWaterNotes: string | null; trashRemovalNotes: string | null; specialRestrictions: string | null;
  accessConfirmed: boolean; updatedAt: string | null;
  providerPrivateNotes?: string | null;
};
export type CateringExecutionMilestoneView = { key: CateringExecutionMilestoneKey; completed: boolean; completedAt: string | null; updatedAt: string | null };

/**
 * One cohesive execution payload rather than a dozen generic CRUD reads. `staff` and `milestones` are OPTIONAL in
 * the type because they are genuinely absent from a customer's response -- the serializer omits the keys, so a
 * customer's payload contains no provider-only field to be ignored by a well-behaved client.
 */
export type CateringBookingExecutionView = {
  role: "provider" | "customer";
  editable: boolean;
  timeline: CateringExecutionTimelineItemView[];
  equipment: CateringExecutionEquipmentView[];
  access: CateringExecutionAccessView;
  readiness: CateringExecutionReadinessView;
  staff?: CateringExecutionStaffView[];
  milestones?: CateringExecutionMilestoneView[];
};

/* ------------------------------------------------------------------------------------------------------------- *
 * Client-facing constants
 * ------------------------------------------------------------------------------------------------------------- */

export const CATERING_EXECUTION_SECTION = "execution";
export const cateringBookingExecutionPath = (bookingId: string) => `/api/catering/bookings/${bookingId}/execution`;
export const cateringBookingExecutionKey = (userId: string, bookingId: string) => ["catering", "booking-execution", userId, bookingId] as const;
/** A shared execution change deep-links into the execution section of the workspace, never a generic inbox. */
export function cateringExecutionSectionPath(role: "provider" | "customer", bookingId: string): string {
  return `${cateringBookingWorkspacePath(role, bookingId)}#${CATERING_EXECUTION_SECTION}`;
}
/**
 * Neutral notification copy. No title, note, crew name, vendor or instruction text ever travels in a notification:
 * the participant is told that something shared changed and follows the link to the authorized workspace to read it.
 */
export const CATERING_EXECUTION_TIMELINE_NOTIFICATION = {
  type: "catering_booking_execution_timeline",
  title: "Event timeline updated",
  message: "Your caterer changed the shared plan for your event.",
} as const;
export const CATERING_EXECUTION_ACCESS_NOTIFICATION = {
  type: "catering_booking_execution_access",
  title: "Venue access instructions updated",
  message: "Your caterer updated the venue and access instructions for your event.",
} as const;

export const CATERING_TIMELINE_CATEGORY_LABELS: Record<CateringTimelineCategory, string> = {
  arrival: "Arrival", load_in: "Load-in", setup: "Setup", food_prep: "Food prep", guest_arrival: "Guest arrival",
  service: "Service", cake_or_special_moment: "Cake or special moment", cleanup: "Cleanup", breakdown: "Breakdown",
  load_out: "Load-out", custom: "Other",
};
export const CATERING_STAFF_ROLE_LABELS: Record<CateringStaffRole, string> = {
  lead: "Lead", chef: "Chef", prep: "Prep", server: "Server", bartender: "Bartender", runner: "Runner",
  setup: "Setup", breakdown: "Breakdown", driver: "Driver", coordinator: "Coordinator", custom: "Custom role",
};
export const CATERING_EQUIPMENT_SOURCE_LABELS: Record<CateringEquipmentSource, string> = {
  provider_owned: "Ours", rental: "Rental", venue_supplied: "Venue supplied", customer_supplied: "Customer supplied",
};
export const CATERING_EQUIPMENT_STATUS_LABELS: Record<CateringEquipmentStatus, string> = {
  planned: "Planned", confirmed: "Confirmed", received: "Received", in_use: "In use", returned: "Returned", cancelled: "Cancelled",
};
export const CATERING_EXECUTION_MILESTONE_LABELS: Record<CateringExecutionMilestoneKey, string> = {
  crew_confirmed: "Crew confirmed", equipment_loaded: "Equipment loaded", departed_for_venue: "Departed for venue",
  arrived: "Arrived", load_in_complete: "Load-in complete", setup_complete: "Setup complete", food_ready: "Food ready",
  service_started: "Service started", service_complete: "Service complete", cleanup_complete: "Cleanup complete",
  load_out_complete: "Load-out complete",
};
export const CATERING_READINESS_STATE_LABELS: Record<CateringReadinessState, string> = {
  ready: "Ready", needs_attention: "Needs attention", blocked: "Blocked",
};
