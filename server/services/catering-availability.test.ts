import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays, calendarDateInTimezone, resolveCateringAvailability } from "./catering-availability";

const settings = { acceptingBookings: true, minimumLeadDays: 0, maximumAdvanceDays: 365, timezone: "UTC" };
const decide = (targetDate: string, overrides: Partial<Parameters<typeof resolveCateringAvailability>[0]> = {}) => resolveCateringAvailability({ settings, rules: [], exceptions: [], currentDate: "2028-02-28", targetDate, ...overrides });

test("today and tomorrow are available with zero lead time", () => { assert.equal(decide("2028-02-28").available, true); assert.equal(decide("2028-02-29").available, true); });
test("minimum lead and maximum advance boundaries are inclusive", () => {
  const policy = { ...settings, minimumLeadDays: 2, maximumAdvanceDays: 10 };
  assert.equal(decide("2028-02-29", { settings: policy }).reason, "lead_time");
  assert.equal(decide("2028-03-01", { settings: policy }).available, true);
  assert.equal(decide("2028-03-09", { settings: policy }).available, true);
  assert.equal(decide("2028-03-10", { settings: policy }).reason, "advance_window");
});
test("single-date and range blocks include both boundaries", () => {
  const exceptions = [{ id: "one", startDate: "2028-02-29", endDate: "2028-03-02", type: "blocked" as const, reason: null }];
  assert.equal(decide("2028-02-29", { exceptions }).reason, "blocked"); assert.equal(decide("2028-03-02", { exceptions }).reason, "blocked");
});
test("available exception overrides a recurring unavailable weekday", () => {
  const rules = [{ dayOfWeek: 2, available: false }];
  assert.equal(decide("2028-02-29", { rules }).reason, "weekly_unavailable");
  assert.equal(decide("2028-02-29", { rules, exceptions: [{ id: "override", startDate: "2028-02-29", endDate: "2028-02-29", type: "available", reason: null }] }).available, true);
});
test("an explicit block wins if conflicting explicit exceptions overlap", () => {
  const exceptions = ["available", "blocked"].map((type, id) => ({ id: String(id), startDate: "2028-02-29", endDate: "2028-03-01", type: type as "available" | "blocked", reason: null }));
  assert.equal(decide("2028-02-29", { exceptions }).reason, "blocked");
});
test("month, year, and leap-day arithmetic is date-only", () => { assert.equal(addCalendarDays("2028-02-28", 1), "2028-02-29"); assert.equal(addCalendarDays("2028-12-31", 1), "2029-01-01"); });
test("provider timezone determines its current calendar day east and west of UTC", () => {
  const instant = new Date("2028-01-01T01:00:00Z");
  assert.equal(calendarDateInTimezone(instant, "Pacific/Honolulu"), "2027-12-31");
  assert.equal(calendarDateInTimezone(instant, "Pacific/Kiritimati"), "2028-01-01");
});
test("accepting bookings false rejects every date", () => { assert.equal(decide("2028-03-01", { settings: { ...settings, acceptingBookings: false } }).reason, "not_accepting"); });
