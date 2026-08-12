import test from "node:test";
import assert from "node:assert/strict";
import { availabilityExceptionSchema, availabilitySettingsSchema, calendarDateSchema, weeklyRulesSchema } from "./catering-availability";

test("calendar validation rejects malformed and impossible dates", () => { for (const value of ["2028-2-01", "2027-02-29", "2028-13-01", "not-a-date"]) assert.equal(calendarDateSchema.safeParse(value).success, false); assert.equal(calendarDateSchema.safeParse("2028-02-29").success, true); });
test("date range cannot run backwards", () => assert.equal(availabilityExceptionSchema.safeParse({ startDate: "2028-03-02", endDate: "2028-03-01", type: "blocked" }).success, false));
test("lead and advance windows remain sensible", () => { assert.equal(availabilitySettingsSchema.safeParse({ acceptingBookings: true, minimumLeadDays: -1, maximumAdvanceDays: 2, timezone: "UTC" }).success, false); assert.equal(availabilitySettingsSchema.safeParse({ acceptingBookings: true, minimumLeadDays: 5, maximumAdvanceDays: 2, timezone: "UTC" }).success, false); });
test("timezone and duplicate weekly rules are rejected", () => { assert.equal(availabilitySettingsSchema.safeParse({ acceptingBookings: true, minimumLeadDays: 1, maximumAdvanceDays: 2, timezone: "Nowhere/Invalid" }).success, false); assert.equal(weeklyRulesSchema.safeParse({ rules: [{ dayOfWeek: 1, available: true }, { dayOfWeek: 1, available: false }] }).success, false); });
