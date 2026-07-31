import assert from "node:assert/strict";
import test from "node:test";
import { cateringQuoteDateSchema, parseCateringCalendarDate } from "./catering-date";

const now = new Date("2026-07-31T15:00:00.000Z");

test("allows today and tomorrow but rejects yesterday", () => {
  assert.equal(parseCateringCalendarDate("2026-07-31", 0, now).toISOString(), "2026-07-31T12:00:00.000Z");
  assert.equal(parseCateringCalendarDate("2026-08-01", 0, now).toISOString(), "2026-08-01T12:00:00.000Z");
  assert.throws(() => parseCateringCalendarDate("2026-07-30", 0, now), /before today/);
});

test("rejects invalid formats and nonexistent dates without rollover", () => {
  for (const value of ["07/31/2026", "2026-7-31", "2026-07-31T00:00:00Z"]) {
    assert.throws(() => parseCateringCalendarDate(value, 0, now), /YYYY-MM-DD/);
  }
  for (const value of ["2026-02-29", "2026-04-31", "2026-13-01"]) {
    assert.throws(() => parseCateringCalendarDate(value, 0, now), /valid calendar date/);
  }
});

test("handles month and year boundaries", () => {
  const yearEnd = new Date("2026-12-31T20:00:00.000Z");
  assert.equal(parseCateringCalendarDate("2026-12-31", 0, yearEnd).toISOString(), "2026-12-31T12:00:00.000Z");
  assert.equal(parseCateringCalendarDate("2027-01-01", 0, yearEnd).toISOString(), "2027-01-01T12:00:00.000Z");
});

test("uses the requester's offset west of UTC after UTC midnight", () => {
  const afterUtcMidnight = new Date("2026-08-01T00:30:00.000Z");
  assert.equal(parseCateringCalendarDate("2026-07-31", 240, afterUtcMidnight).toISOString(), "2026-07-31T12:00:00.000Z");
  assert.throws(() => parseCateringCalendarDate("2026-07-30", 240, afterUtcMidnight), /before today/);
});

test("schema reports date failures as validation errors", () => {
  const result = cateringQuoteDateSchema.safeParse({ eventDate: "2026-02-30", timezoneOffsetMinutes: 0 });
  assert.equal(result.success, false);
  assert.match(result.error?.issues[0]?.message ?? "", /valid calendar date/);
});
