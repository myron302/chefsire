import type { CateringBookingActivity, CateringBookingDetails, CateringBookingTask } from "@shared/schema";

const EMPTY_DETAILS = { venueName: null, venueAddress: null, venueCity: null, venueState: null, venuePostalCode: null, venueInstructions: null, arrivalTime: null, serviceStartTime: null, serviceEndTime: null, setupNotes: null, accessNotes: null, kitchenAvailable: null, refrigerationAvailable: null, powerAvailable: null, waterAvailable: null, indoorOutdoor: null, customerNotes: null, updatedAt: null };
export function serializeBookingDetails(row: CateringBookingDetails | undefined, role: "provider" | "customer") {
  if (!row) return role === "provider" ? { ...EMPTY_DETAILS, providerNotes: null } : EMPTY_DETAILS;
  const shared = { venueName: row.venueName, venueAddress: row.venueAddress, venueCity: row.venueCity, venueState: row.venueState, venuePostalCode: row.venuePostalCode, venueInstructions: row.venueInstructions, arrivalTime: row.arrivalTime, serviceStartTime: row.serviceStartTime, serviceEndTime: row.serviceEndTime, setupNotes: row.setupNotes, accessNotes: row.accessNotes, kitchenAvailable: row.kitchenAvailable, refrigerationAvailable: row.refrigerationAvailable, powerAvailable: row.powerAvailable, waterAvailable: row.waterAvailable, indoorOutdoor: row.indoorOutdoor, customerNotes: row.customerNotes, updatedAt: row.updatedAt.toISOString() };
  return role === "provider" ? { ...shared, providerNotes: row.providerNotes } : shared;
}
export function serializeBookingTask(row: CateringBookingTask) { return { id: row.id, title: row.title, description: row.description, status: row.status, visibility: row.visibility, dueDate: row.dueDate, dueTime: row.dueTime, sortOrder: row.sortOrder, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() }; }
/**
 * `orderToken` is the row's authoritative place in the activity query's own ordering, produced in SQL at full
 * `timestamptz` precision before the driver rounds it to a millisecond `Date`. Opaque, comparison-only, and
 * separate from `createdAt`, which remains the display value.
 */
export function serializeBookingActivity(row: CateringBookingActivity & { orderToken?: string }) { return { id: row.id, eventType: row.eventType, metadata: row.metadata, createdAt: row.createdAt.toISOString(), ...(row.orderToken === undefined ? {} : { orderToken: row.orderToken }) }; }
