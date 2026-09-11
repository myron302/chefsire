/**
 * The canonical catering booking activity allowlist, in one place with no imports.
 *
 * Three layers have to agree on this list -- the shared contract, the Drizzle table's CHECK constraint, and the SQL
 * migration -- and they previously each spelled it out separately. That drifted: Phase 2I added the four file events
 * to the contract and the migration, but the Drizzle CHECK still ended at `shared_requirement_deleted`, so a
 * database built or reconciled from the schema would have restored the old constraint and rejected every file
 * activity insert.
 *
 * The contract and the Drizzle constraint now both derive from this array, so those two cannot diverge at all. The
 * migration is plain SQL and cannot import it, so a test asserts it carries exactly the same events.
 *
 * Messages deliberately appear nowhere here: a booking conversation is its own chronological history and writes no
 * activity rows.
 */
export const CATERING_BOOKING_ACTIVITY_EVENT_TYPES = [
  "booking_offered",
  "customer_confirmed",
  "booking_cancelled",
  "booking_completed",
  "details_updated",
  "shared_requirement_added",
  "shared_requirement_updated",
  "shared_requirement_completed",
  "shared_requirement_deleted",
  "shared_file_uploaded",
  "shared_file_removed",
  "provider_file_uploaded",
  "provider_file_removed",
  // Phase 2J execution events. Every "execution_*" and "shared_equipment_*" event below is written ONLY for a
  // shared-visibility execution record, so it is customer-visible history by construction; a provider-private
  // timeline item, staffing assignment or private equipment record writes no activity row at all, which is why
  // there is no private counterpart for most of them. The single private event is the milestone one: milestone
  // state is provider-only operational progress, it is bounded by the eleven-key allowlist, and it is recorded
  // with `provider` visibility so a customer's activity feed never contains it.
  "execution_timeline_added",
  "execution_timeline_updated",
  "execution_timeline_completed",
  "execution_timeline_removed",
  "shared_equipment_added",
  "shared_equipment_status_changed",
  "execution_access_updated",
  "provider_execution_milestone_completed",
] as const;

export type CateringBookingActivityEventType = typeof CATERING_BOOKING_ACTIVITY_EVENT_TYPES[number];

/**
 * The allowlist rendered as the value list of a SQL `IN (...)` clause, so the Drizzle CHECK constraint is generated
 * from the same array rather than restating it. Every value is a compile-time constant from the array above -- there
 * is no runtime or user input anywhere in this string.
 */
export const CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST: string =
  CATERING_BOOKING_ACTIVITY_EVENT_TYPES.map((event) => `'${event}'`).join(", ");
