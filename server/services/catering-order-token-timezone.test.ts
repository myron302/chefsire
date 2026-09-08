import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_ORDER_TOKEN_FORMAT, CATERING_ORDER_TOKEN_SEPARATOR } from "./catering-booking-order-token";

/**
 * An order token must not depend on the database session's TimeZone.
 *
 * One helper applied `AT TIME ZONE 'UTC'` to every `created_at`, and that operator means opposite things on the two
 * column types Phase 2I actually has:
 *
 *  - on `timestamptz` (activity, files) it PINS the instant to UTC and yields a plain timestamp, which `to_char`
 *    then renders identically whatever the session TimeZone is. Correct, and unchanged.
 *  - on `timestamp` WITHOUT time zone (`dm_messages.created_at`) it INTERPRETS the stored wall clock as UTC and
 *    yields a `timestamptz`. `to_char` of a `timestamptz` renders in the SESSION's TimeZone -- so the token was a
 *    function of a connection setting, and around a DST fall-back the repeated local hour makes a later row render
 *    with an earlier text. `cateringRecordIsOlder` compares those texts, so it would classify a message it had
 *    loaded as older than the refreshed boundary and discard preserved history that was never stale.
 *
 * There is no PostgreSQL harness in this suite, so both SQL forms are modelled faithfully -- `to_char` of a plain
 * timestamp is the stored fields; `to_char` of a `timestamptz` is that instant rendered in the session zone -- and
 * the helper's own SQL is asserted structurally against those models.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "catering-booking-order-token.ts"), "utf8");
const messagesRoute = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-communication.ts"), "utf8");
const filesRoute = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");
const workspaceRoute = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-workspace.ts"), "utf8");

/** One `timestamp without time zone` value: a wall clock, to microseconds, belonging to no zone at all. */
type Stamp = { year: number; month: number; day: number; hour: number; minute: number; second: number; micros: number };
const stamp = (year: number, month: number, day: number, hour: number, minute: number, second: number, micros = 0): Stamp =>
  ({ year, month, day, hour, minute, second, micros });
const pad = (value: number, width: number) => String(value).padStart(width, "0");

/** `to_char(<timestamp>, 'YYYY-MM-DD"T"HH24:MI:SS.US')`: the stored fields, rendered. No zone is involved. */
function renderStamp(value: Stamp): string {
  return `${pad(value.year, 4)}-${pad(value.month, 2)}-${pad(value.day, 2)}T${pad(value.hour, 2)}:${pad(value.minute, 2)}:${pad(value.second, 2)}.${pad(value.micros, 6)}`;
}
/**
 * `to_char(<timestamp> AT TIME ZONE 'UTC', ...)` in a session on `zone`: the stored fields are read as UTC, and the
 * resulting instant is rendered in the session's zone. This is what the old helper did to `dm_messages`.
 */
const zoned = new Map<string, Intl.DateTimeFormat>();
function renderThroughSession(value: Stamp, zone: string): string {
  if (!zoned.has(zone)) zoned.set(zone, new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
  const instant = new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second));
  const [date, clock] = zoned.get(zone)!.format(instant).split(", ");
  return `${date}T${clock}.${pad(value.micros, 6)}`;
}
const unzonedToken = (value: Stamp, id: string) => `${renderStamp(value)}${CATERING_ORDER_TOKEN_SEPARATOR}${id}`;
const sessionToken = (value: Stamp, id: string, zone: string) => `${renderThroughSession(value, zone)}${CATERING_ORDER_TOKEN_SEPARATOR}${id}`;

/** The authoritative SQL ordering: `ORDER BY created_at DESC, id DESC`, expressed as a comparator over rows. */
const stampKey = (value: Stamp) => [value.year, value.month, value.day, value.hour, value.minute, value.second, value.micros].map((part, index) => pad(part, index === 0 ? 4 : index === 6 ? 6 : 2)).join("-");
const sqlOrder = (rows: readonly { at: Stamp; id: string }[]) =>
  [...rows].sort((left, right) => (stampKey(right.at).localeCompare(stampKey(left.at)) || right.id.localeCompare(left.id)));

const ZONES = ["UTC", "America/New_York", "Australia/Lord_Howe", "Europe/Berlin", "Pacific/Chatham"];

test("1-3. an unzoned column's token is identical in every session timezone", () => {
  const value = stamp(2024, 6, 15, 13, 45, 30, 123456);
  const token = unzonedToken(value, "m-1");
  // The rendering does not consult a zone at all, so there is nothing for a session setting to change.
  assert.equal(token, "2024-06-15T13:45:30.123456|m-1");
  for (const zone of ZONES) {
    // The old form disagreed with itself across sessions; the new one cannot, because it never leaves the column.
    assert.equal(unzonedToken(value, "m-1"), token, zone);
  }
  // And the old form really did differ -- this is the defect, stated as a fact rather than assumed.
  assert.notEqual(sessionToken(value, "m-1", "America/New_York"), sessionToken(value, "m-1", "UTC"));
  assert.notEqual(sessionToken(value, "m-1", "Australia/Lord_Howe"), sessionToken(value, "m-1", "UTC"));
});

test("4 & 5. the DST fall-back repeated hour inverted the old token, and cannot touch the new one", () => {
  // Two stored values one minute apart, straddling the instant New York repeats 01:00-01:59.
  const earlier = stamp(2024, 11, 3, 5, 59, 0);
  const later = stamp(2024, 11, 3, 6, 0, 0);
  assert.equal(renderStamp(earlier) < renderStamp(later), true, "the stored order is unambiguous");
  // Rendered through a New York session the LATER row reads 01:00 and the earlier one 01:59: the order inverts.
  assert.equal(renderThroughSession(earlier, "America/New_York"), "2024-11-03T01:59:00.000000");
  assert.equal(renderThroughSession(later, "America/New_York"), "2024-11-03T01:00:00.000000");
  assert.equal(sessionToken(later, "m-2", "America/New_York") < sessionToken(earlier, "m-1", "America/New_York"), true, "the later message compared as older");
  // The new token keeps them in the stored order, in that session and every other.
  for (const zone of ZONES) assert.equal(unzonedToken(earlier, "m-1") < unzonedToken(later, "m-2"), true, zone);
});

test("5b. the client helper would have discarded live history on that inversion", () => {
  // `cateringRecordIsOlder` is a plain lexical comparison of these tokens, so an inverted pair reads as "older than
  // the refreshed boundary" -- which is exactly the condition for preserving, or dropping, loaded history.
  const boundary = { orderToken: sessionToken(stamp(2024, 11, 3, 5, 59, 0), "m-1", "America/New_York") };
  const newer = { orderToken: sessionToken(stamp(2024, 11, 3, 6, 0, 0), "m-2", "America/New_York") };
  assert.equal(newer.orderToken < boundary.orderToken, true, "a genuinely newer message misclassified as older");
  const fixedBoundary = { orderToken: unzonedToken(stamp(2024, 11, 3, 5, 59, 0), "m-1") };
  const fixedNewer = { orderToken: unzonedToken(stamp(2024, 11, 3, 6, 0, 0), "m-2") };
  assert.equal(fixedNewer.orderToken < fixedBoundary.orderToken, false);
});

test("6. equal timestamps fall through to the id, exactly as the ORDER BY does", () => {
  const at = stamp(2024, 6, 15, 13, 45, 30, 500000);
  assert.equal(unzonedToken(at, "m-1") < unzonedToken(at, "m-2"), true);
  const rows = [{ at, id: "m-1" }, { at, id: "m-2" }];
  assert.deepEqual(sqlOrder(rows).map((row) => row.id), ["m-2", "m-1"], "DESC by id on a genuine tie");
  const byToken = [...rows].sort((left, right) => unzonedToken(right.at, right.id).localeCompare(unzonedToken(left.at, left.id)));
  assert.deepEqual(byToken.map((row) => row.id), ["m-2", "m-1"]);
});

test("7 & 8. lexical token order matches ORDER BY created_at DESC, id DESC in every session timezone", () => {
  const rows = [
    { at: stamp(2024, 11, 3, 5, 59, 59, 999999), id: "m-1" },
    { at: stamp(2024, 11, 3, 6, 0, 0, 0), id: "m-2" },
    { at: stamp(2024, 11, 3, 6, 0, 0, 1), id: "m-3" },
    { at: stamp(2024, 3, 10, 6, 59, 59, 999998), id: "m-4" },
    { at: stamp(2024, 3, 10, 7, 0, 0, 0), id: "m-5" },
    { at: stamp(2024, 6, 15, 13, 45, 30, 500000), id: "m-6" },
    { at: stamp(2024, 6, 15, 13, 45, 30, 500000), id: "m-7" },
  ];
  const authoritative = sqlOrder(rows).map((row) => row.id);
  for (const zone of ZONES) {
    const byToken = [...rows].sort((left, right) => unzonedToken(right.at, right.id).localeCompare(unzonedToken(left.at, left.id))).map((row) => row.id);
    assert.deepEqual(byToken, authoritative, zone);
  }
  // The old form agreed only where no zone transition was involved.
  const stale = [...rows].sort((left, right) => sessionToken(right.at, right.id, "America/New_York").localeCompare(sessionToken(left.at, left.id, "America/New_York"))).map((row) => row.id);
  assert.notDeepEqual(stale, authoritative);
});

test("9. microsecond precision is intact and is what separates adjacent rows", () => {
  const before = stamp(2024, 6, 15, 13, 45, 30, 123456);
  const after = stamp(2024, 6, 15, 13, 45, 30, 123457);
  assert.equal(unzonedToken(before, "m-2") < unzonedToken(after, "m-1"), true, "a microsecond decides before the id ever does");
  assert.equal(unzonedToken(before, "m-1").split(CATERING_ORDER_TOKEN_SEPARATOR)[0].length, "0000-00-00T00:00:00.000000".length);
  assert.equal(CATERING_ORDER_TOKEN_FORMAT.includes(".US"), true, "microseconds, not milliseconds");
});

test("10. each call site uses the helper its column type requires", () => {
  // `dm_messages.created_at` is `timestamp` WITHOUT time zone; the other two are `timestamptz`.
  assert.equal(messagesRoute.includes("orderToken: cateringUnzonedOrderToken(dmMessages.createdAt, dmMessages.id)"), true);
  assert.equal(messagesRoute.includes("cateringOrderToken(dmMessages"), false, "the pinned helper turns an unzoned column into a timestamptz");
  assert.equal(filesRoute.includes("orderToken: cateringOrderToken(cateringBookingFiles.createdAt, cateringBookingFiles.id)"), true);
  assert.equal(workspaceRoute.includes("orderToken: cateringOrderToken(cateringBookingActivity.createdAt, cateringBookingActivity.id)"), true);
  // And the two forms really are different SQL, from one shared format and one shared join.
  assert.equal(service.includes("to_char(${createdAt} AT TIME ZONE 'UTC', ${CATERING_ORDER_TOKEN_FORMAT})"), true);
  assert.equal(service.includes("to_char(${createdAt}, ${CATERING_ORDER_TOKEN_FORMAT})"), true);
  assert.equal(service.includes("${formatted} || ${CATERING_ORDER_TOKEN_SEPARATOR} || ${id}"), true);
  assert.equal((service.match(/CATERING_ORDER_TOKEN_FORMAT = /g) ?? []).length, 1, "one format for both");
  const code = service.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.equal(code.includes("Date"), false, "nothing here goes through a JavaScript Date");
  assert.equal(code.includes("timezone("), false);
  assert.equal(code.includes("SET TimeZone"), false, "the token must not depend on a session setting, nor try to set one");
});

test("11. the token is ephemeral: it is not a cursor and nothing persists it", () => {
  // Message pagination keys on the row's own id, compared against that row's stored (created_at, id) in SQL, so a
  // change to the token's text cannot invalidate an in-flight cursor or anything a client has stored.
  assert.equal(messagesRoute.includes("(${dmMessages.createdAt}, ${dmMessages.id}) < (SELECT m.created_at, m.id FROM dm_messages m WHERE m.id = ${page.cursor})"), true);
  assert.equal(messagesRoute.includes("cursor=${encodeURIComponent"), false);
  assert.equal(messagesRoute.includes("orderToken") && messagesRoute.includes("page.cursor"), true);
  // The cursor never reads the token, and the token never reaches the cursor.
  const boundary = messagesRoute.slice(messagesRoute.indexOf("const boundary = page.cursor"), messagesRoute.indexOf("const rows:")).replace(/\/\/[^\n]*/g, "");
  assert.equal(boundary.includes("orderToken"), false);
  assert.equal(boundary.includes("to_char"), false);
});
