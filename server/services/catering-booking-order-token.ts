import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * The authoritative ordering of one paginated row, produced by the database rather than reconstructed from what
 * reaches the browser.
 *
 * Every Phase 2I collection is ordered `ORDER BY created_at DESC, id DESC` and paginated on that exact pair. The
 * client has to reproduce that ordering to decide which already-loaded records lie outside a refreshed page and may
 * therefore be preserved -- and it could not. `created_at` is `timestamptz`, which Postgres keeps to MICROSECONDS;
 * the node-postgres driver parses it into a JavaScript `Date`, which holds MILLISECONDS, and `toISOString()` then
 * writes down what is left. Two rows a thousandth of a millisecond apart arrive at the client bearing the same
 * instant, and the tie-break falls through to comparing ids -- which say nothing whatever about the microseconds
 * that were dropped. An older loaded record could be judged newer than the refreshed boundary and thrown away.
 *
 * So the ordering value is computed IN SQL, before any of that happens: the full-precision instant rendered as
 * fixed-width UTC text, then the id, in that order. It is opaque and for comparison only -- never a display date --
 * and it carries nothing but the two values the ORDER BY already uses, so it discloses nothing new.
 *
 * Comparing two tokens as strings reproduces the query's ordering exactly. The timestamp half is fixed width and
 * strictly numeric, so its lexical order IS its chronological order; the id half decides only a genuine full
 * precision tie, which is the same case the database itself resolves by id.
 *
 * THE COLUMN TYPE DECIDES THE SQL, and Phase 2I has both:
 *
 *  - `catering_booking_activity.created_at` and `catering_booking_files.created_at` are `timestamptz`. A
 *    `timestamptz` has no text form of its own, so it must be pinned to a zone before it is formatted;
 *    `AT TIME ZONE 'UTC'` yields the plain UTC wall clock and `to_char` of a plain timestamp is not affected by
 *    the session's TimeZone.
 *  - `dm_messages.created_at` is `timestamp` WITHOUT time zone. It is ALREADY a wall clock, and `AT TIME ZONE 'UTC'`
 *    on it does the opposite of what it does above: it INTERPRETS the value as UTC and produces a `timestamptz`.
 *    `to_char` then renders that in the session's TimeZone -- so the token depended on a connection setting, and
 *    around a DST fall-back the repeated local hour makes lexical order disagree with `ORDER BY created_at`
 *    outright. A later row could compare as older, and `cateringRecordIsOlder` would discard preserved history
 *    that was never stale.
 *
 * So there are two helpers rather than one conversion applied blindly. Both emit the SAME format, because both
 * describe the same thing: the ordering value of one row, compared only against others from its own collection.
 */
export const CATERING_ORDER_TOKEN_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.US';
export const CATERING_ORDER_TOKEN_SEPARATOR = "|";

const token = (formatted: SQL<string>, id: SQLWrapper) =>
  sql<string>`${formatted} || ${CATERING_ORDER_TOKEN_SEPARATOR} || ${id}`;

/** For a `timestamptz` column: pinned to UTC first, which yields a plain timestamp, then formatted. */
export function cateringOrderToken(createdAt: SQLWrapper, id: SQLWrapper) {
  return token(sql<string>`to_char(${createdAt} AT TIME ZONE 'UTC', ${CATERING_ORDER_TOKEN_FORMAT})`, id);
}
/**
 * For a `timestamp` WITHOUT time zone column: formatted exactly as stored.
 *
 * No conversion at all, which is the whole point. The stored value is what `ORDER BY created_at` compares, so
 * rendering that value is what reproduces the ordering -- whatever zone it was recorded in, and whatever TimeZone
 * the reading session happens to have. Converting it first would introduce a dependency the column does not have.
 */
export function cateringUnzonedOrderToken(createdAt: SQLWrapper, id: SQLWrapper) {
  return token(sql<string>`to_char(${createdAt}, ${CATERING_ORDER_TOKEN_FORMAT})`, id);
}
