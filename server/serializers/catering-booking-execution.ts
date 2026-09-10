import type {
  CateringBookingAccessDetail,
  CateringBookingEquipmentItem,
  CateringBookingExecutionMilestone,
  CateringBookingExecutionTimelineItem,
  CateringBookingStaffAssignment,
} from "@shared/schema";
import {
  CATERING_EXECUTION_MILESTONE_KEYS,
  type CateringAccessContactSource,
  type CateringEquipmentSource,
  type CateringEquipmentStatus,
  type CateringExecutionAccessView,
  type CateringExecutionEquipmentView,
  type CateringExecutionMilestoneView,
  type CateringExecutionStaffView,
  type CateringExecutionTimelineItemView,
  type CateringExecutionVisibility,
  type CateringStaffRole,
  type CateringTimelineCategory,
} from "@shared/catering-booking-execution";

/**
 * The Phase 2J serializers, written as EXPLICIT projections rather than as a spread of the row with a few fields
 * deleted.
 *
 * Every one of these functions names the fields it emits. Nothing is serialized and then expected to be ignored by
 * the client, and a column added to one of these tables later cannot start reaching a customer merely because it
 * exists -- it would have to be added to a view here, deliberately.
 *
 * What is never emitted to ANY actor: `bookingId` (the caller supplied it), `createdBy`, `completedBy` and
 * `updatedBy` (server ownership metadata, persisted for audit and needed by no interface), and `clientRequestId`
 * (the caller's own retry token, which nothing else has a use for).
 */

/**
 * One run-of-show item.
 *
 * `sortOrder` is PROVIDER ONLY. It is numbered across the whole collection -- provider-private items included -- so
 * handing it to a customer whose list has been visibility-filtered publishes the gaps: shared items arriving as 0
 * and 3 say plainly that two records they may not see sit between them, and how many. The array order is what any
 * client renders from and it survives filtering intact, so a customer needs no position at all.
 *
 * It is omitted rather than renumbered. A dense customer-side position would also be safe, but it would be one more
 * derived value that has to be trusted to stay safe as the code changes; absence needs no such trust.
 */
export function serializeExecutionTimelineItem(row: CateringBookingExecutionTimelineItem, role: "provider" | "customer"): CateringExecutionTimelineItemView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as CateringTimelineCategory,
    scheduledTime: row.scheduledTime,
    endTime: row.endTime,
    visibility: row.visibility as CateringExecutionVisibility,
    ...(role === "provider" ? { sortOrder: row.sortOrder } : {}),
    isBlocker: row.isBlocker,
    // Completion is exposed as the fact plus its instant. Who ticked it is persisted and never serialized: only the
    // provider can complete an item, so the id would tell no participant anything they do not already know.
    completed: row.completedAt !== null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Crew assignments have exactly one view, and it is the provider's.
 *
 * There is no customer variant of this function, and the route never reaches this code for a customer: a customer's
 * execution payload carries no `staff` key at all. The absence is the privacy boundary -- not a filter that could
 * be called with the wrong argument.
 */
export function serializeExecutionStaffAssignment(row: CateringBookingStaffAssignment): CateringExecutionStaffView {
  return {
    id: row.id,
    workerName: row.workerName,
    role: row.role as CateringStaffRole,
    customRole: row.customRole,
    contactNote: row.contactNote,
    arrivalTime: row.arrivalTime,
    departureTime: row.departureTime,
    responsibilityNote: row.responsibilityNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeExecutionEquipment(row: CateringBookingEquipmentItem): CateringExecutionEquipmentView {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    sourceType: row.sourceType as CateringEquipmentSource,
    sourceName: row.sourceName,
    pickupDate: row.pickupDate,
    pickupTime: row.pickupTime,
    returnDate: row.returnDate,
    returnTime: row.returnTime,
    status: row.status as CateringEquipmentStatus,
    isBlocker: row.isBlocker,
    notes: row.notes,
    visibility: row.visibility as CateringExecutionVisibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The access record a booking with no instructions yet still serializes, so the client renders a real empty form. */
const EMPTY_ACCESS: CateringExecutionAccessView = {
  loadInEntrance: null, loadingDockNotes: null, elevatorNotes: null, kitchenAccessNotes: null,
  parkingInstructions: null, securityCheckInNotes: null, accessWindowStart: null, accessWindowEnd: null,
  venueContactName: null, venueContactPhone: null, venueContactSource: null,
  powerWaterNotes: null, trashRemovalNotes: null, specialRestrictions: null,
  accessConfirmed: false, updatedAt: null,
};

/**
 * Access instructions, in the one place the provider-private note is decided.
 *
 * A customer's object does not carry `providerPrivateNotes` as null -- it does not carry the KEY. A null would still
 * tell them the field exists, and an interface built on that shape would have somewhere to render it the moment a
 * serializer changed.
 *
 * No address, city, postal code or event date appears here for either actor: those stay on the booking and on the
 * Phase 2H details, and this record deliberately cannot restate them.
 */
export function serializeExecutionAccess(row: CateringBookingAccessDetail | undefined, role: "provider" | "customer"): CateringExecutionAccessView {
  if (!row) return role === "provider" ? { ...EMPTY_ACCESS, providerPrivateNotes: null } : { ...EMPTY_ACCESS };
  const shared: CateringExecutionAccessView = {
    loadInEntrance: row.loadInEntrance,
    loadingDockNotes: row.loadingDockNotes,
    elevatorNotes: row.elevatorNotes,
    kitchenAccessNotes: row.kitchenAccessNotes,
    parkingInstructions: row.parkingInstructions,
    securityCheckInNotes: row.securityCheckInNotes,
    accessWindowStart: row.accessWindowStart,
    accessWindowEnd: row.accessWindowEnd,
    venueContactName: row.venueContactName,
    venueContactPhone: row.venueContactPhone,
    // Provenance travels with the contact, so customer-supplied details are never presented as the provider's own.
    venueContactSource: row.venueContactSource as CateringAccessContactSource | null,
    powerWaterNotes: row.powerWaterNotes,
    trashRemovalNotes: row.trashRemovalNotes,
    specialRestrictions: row.specialRestrictions,
    accessConfirmed: row.accessConfirmed,
    updatedAt: row.updatedAt.toISOString(),
  };
  return role === "provider" ? { ...shared, providerPrivateNotes: row.providerPrivateNotes } : shared;
}

/**
 * The full milestone board, provider-only.
 *
 * Every allowlisted key is reported, including those with no row yet, so the provider sees the whole event-day
 * checklist rather than only the parts they have already touched. A key with no row has `updatedAt: null`, which is
 * exactly the precondition the client sends back to create it.
 */
export function serializeExecutionMilestones(rows: readonly CateringBookingExecutionMilestone[]): CateringExecutionMilestoneView[] {
  const byKey = new Map(rows.map((row) => [row.milestoneKey, row] as const));
  return CATERING_EXECUTION_MILESTONE_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      completed: Boolean(row?.completedAt),
      completedAt: row?.completedAt?.toISOString() ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}
