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
 *
 * `updatedAt` is PROVIDER ONLY for the same reason. A reorder rewrites every item's position and bumps every
 * version with it -- moving a provider-private item shifts the shared ones below it -- so a customer holding the
 * version would watch it change while nothing they can read changed, which reports that hidden records were
 * rearranged and when.
 *
 * `createdAt` and `completedAt` are the PRIVATE-ERA case, and the reason `sharedAt` exists. An item created
 * privately at 09:00, completed privately at 09:30 and shared at 11:00 used to reach the customer carrying both of
 * those instants -- two hours of activity they were never entitled to see, and obviously so, because the shared
 * activity row announcing the item arrived at 11:00. A customer now receives `visibleSince` in place of `createdAt`,
 * and a completion instant only when the completion happened at or after it. Nothing is invented: the stamps are
 * persisted facts, and where there is no customer-era fact to report the field is null rather than filled in.
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
    ...(role === "provider"
      ? { sortOrder: row.sortOrder, updatedAt: row.updatedAt.toISOString(), createdAt: row.createdAt.toISOString() }
      : { visibleSince: row.sharedAt?.toISOString() ?? null }),
    isBlocker: row.isBlocker,
    // Completion is exposed as the fact plus its instant. Who ticked it is persisted and never serialized: only the
    // provider can complete an item, so the id would tell no participant anything they do not already know.
    //
    // The FACT is the customer's either way -- it describes the item they are looking at now. The INSTANT is only
    // theirs when it fell inside the era they could see it in.
    completed: row.completedAt !== null,
    completedAt: role === "provider" ? row.completedAt?.toISOString() ?? null : cateringSharedEraInstant(row.completedAt, row.sharedAt),
  };
}

/**
 * An instant a customer may be told, or null.
 *
 * Anything that happened before the current shared era began happened somewhere the customer could not see, so it
 * is withheld rather than approximated. A record with no shared era at all yields null, which is the safe answer
 * for a row that should not have reached a customer in the first place.
 */
export function cateringSharedEraInstant(instant: Date | null, sharedAt: Date | null): string | null {
  if (!instant || !sharedAt) return null;
  return instant.getTime() >= sharedAt.getTime() ? instant.toISOString() : null;
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

/**
 * One equipment record, with the same era rules as the run-of-show and for the same reason.
 *
 * `createdAt` is provider-only: a chafer added privately last week and shared this morning would otherwise tell the
 * customer it existed last week. `updatedAt` stays customer-visible, because every column emitted here is
 * customer-visible -- there is no private-only write that could move it -- and because the visibility transition is
 * itself a write, so a shared row's version is never older than the moment it became shared.
 */
export function serializeExecutionEquipment(row: CateringBookingEquipmentItem, role: "provider" | "customer"): CateringExecutionEquipmentView {
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
    ...(role === "provider" ? { createdAt: row.createdAt.toISOString() } : { visibleSince: row.sharedAt?.toISOString() ?? null }),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The access record a booking with no instructions yet still serializes, so the client renders a real empty form. */
const EMPTY_ACCESS: CateringExecutionAccessView = {
  loadInEntrance: null, loadingDockNotes: null, elevatorNotes: null, kitchenAccessNotes: null,
  parkingInstructions: null, securityCheckInNotes: null, accessWindowStart: null, accessWindowEnd: null,
  venueContactName: null, venueContactPhone: null, venueContactSource: null,
  powerWaterNotes: null, trashRemovalNotes: null, specialRestrictions: null,
  accessConfirmed: false,
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
 *
 * `updatedAt` is decided in the same place and for the same reason. This row carries a provider-private column, so
 * a provider who edits only `providerPrivateNotes` moves the version while every customer-readable field stays
 * identical -- and a customer who could compare versions would read that hidden activity happened and when, and on
 * a private-only first save that a record now exists at all. The provider keeps it because their optimistic
 * concurrency is built on it; the customer, who never writes this object, is given no key rather than a derived
 * stand-in that would have to be trusted not to track the private edits it was invented to hide.
 */
export function serializeExecutionAccess(row: CateringBookingAccessDetail | undefined, role: "provider" | "customer"): CateringExecutionAccessView {
  if (!row) return role === "provider" ? { ...EMPTY_ACCESS, updatedAt: null, providerPrivateNotes: null } : { ...EMPTY_ACCESS };
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
  };
  return role === "provider" ? { ...shared, updatedAt: row.updatedAt.toISOString(), providerPrivateNotes: row.providerPrivateNotes } : shared;
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
