import { sql, type SQLWrapper } from "drizzle-orm";

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
 */
export const CATERING_ORDER_TOKEN_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.US';
export const CATERING_ORDER_TOKEN_SEPARATOR = "|";

export function cateringOrderToken(createdAt: SQLWrapper, id: SQLWrapper) {
  return sql<string>`to_char(${createdAt} AT TIME ZONE 'UTC', ${CATERING_ORDER_TOKEN_FORMAT}) || ${CATERING_ORDER_TOKEN_SEPARATOR} || ${id}`;
}
