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
] as const;

export type CateringBookingActivityEventType = typeof CATERING_BOOKING_ACTIVITY_EVENT_TYPES[number];

/**
 * The allowlist rendered as the value list of a SQL `IN (...)` clause, so the Drizzle CHECK constraint is generated
 * from the same array rather than restating it. Every value is a compile-time constant from the array above -- there
 * is no runtime or user input anywhere in this string.
 */
export const CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST: string =
  CATERING_BOOKING_ACTIVITY_EVENT_TYPES.map((event) => `'${event}'`).join(", ");
