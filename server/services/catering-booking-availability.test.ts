import assert from "node:assert/strict";
import test from "node:test";
import type { AvailabilityException } from "@shared/catering-availability";
import { evaluateBookingDateForConfirmation, evaluateBookingDateForOffer, evaluateExistingCateringBookingDate } from "./catering-booking-availability";
import { calendarDateInTimezone, evaluateNewCateringInquiryAvailability } from "./catering-availability";

const targetDate = "2026-09-20";
const exception = (type: "available" | "blocked", date = targetDate): AvailabilityException => ({ id: `${type}-${date}`, startDate: date, endDate: date, type, reason: null });
const settings = { acceptingBookings: true, minimumLeadDays: 10, maximumAdvanceDays: 100, timezone: "UTC" };

test("existing offers ignore intake pause and rolling lead/advance windows", () => {
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, currentDate: "2026-09-15", exceptions: [] }).available, true);
  assert.equal(evaluateNewCateringInquiryAvailability({ settings: { ...settings, acceptingBookings: false }, rules: [], exceptions: [], targetDate, currentDate: "2026-09-01" }).reason, "not_accepting");
  assert.equal(evaluateNewCateringInquiryAvailability({ settings, rules: [], exceptions: [], targetDate, currentDate: "2026-09-15" }).reason, "lead_time");
  assert.equal(evaluateNewCateringInquiryAvailability({ settings, rules: [], exceptions: [], targetDate: "2027-09-20", currentDate: "2026-09-01" }).reason, "advance_window");
});

test("provider offer and customer confirmation share exact-date block policy", () => {
  const input = { targetDate, currentDate: "2026-09-20", exceptions: [exception("blocked")] };
  assert.deepEqual(evaluateBookingDateForOffer(input), { available: false, reason: "explicitly_blocked" });
  assert.deepEqual(evaluateBookingDateForOffer(input), evaluateBookingDateForConfirmation(input));
});

test("explicit available remains valid and an explicit block wins conflicts", () => {
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, currentDate: "2026-09-20", exceptions: [exception("available")] }).available, true);
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, currentDate: "2026-09-20", exceptions: [exception("available"), exception("blocked")] }).available, false);
});

test("weekly and listing changes do not retroactively revoke an explicit offer", () => {
  const weeklyUnavailable = [{ dayOfWeek: 0, available: false }];
  assert.equal(evaluateNewCateringInquiryAvailability({ settings, rules: weeklyUnavailable, exceptions: [], targetDate, currentDate: "2026-09-01" }).reason, "weekly_unavailable");
  // Existing-booking policy deliberately has no weekly, listing, or intake-state input.
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, currentDate: "2026-09-15", exceptions: [] }).available, true);
});

test("offer and confirmation reject past dates but allow today and tomorrow", () => {
  const yesterday = { targetDate: "2026-09-19", currentDate: "2026-09-20", exceptions: [] };
  assert.deepEqual(evaluateBookingDateForOffer(yesterday), { available: false, reason: "past_event" });
  assert.deepEqual(evaluateBookingDateForConfirmation(yesterday), { available: false, reason: "past_event" });
  assert.equal(evaluateBookingDateForOffer({ targetDate: "2026-09-20", currentDate: "2026-09-20", exceptions: [] }).available, true);
  assert.equal(evaluateBookingDateForConfirmation({ targetDate: "2026-09-20", currentDate: "2026-09-20", exceptions: [] }).available, true);
  assert.equal(evaluateBookingDateForOffer({ targetDate: "2026-09-21", currentDate: "2026-09-20", exceptions: [] }).available, true);
});

test("explicit available cannot override a past date and blocks still reject today or future", () => {
  assert.equal(evaluateBookingDateForOffer({ targetDate: "2026-09-19", currentDate: "2026-09-20", exceptions: [exception("available", "2026-09-19")] }).available, false);
  assert.equal(evaluateBookingDateForOffer({ targetDate: "2026-09-20", currentDate: "2026-09-20", exceptions: [exception("blocked", "2026-09-20")] }).available, false);
  assert.equal(evaluateBookingDateForOffer({ targetDate: "2026-09-21", currentDate: "2026-09-20", exceptions: [exception("blocked", "2026-09-21")] }).available, false);
  assert.equal(evaluateBookingDateForOffer({ targetDate: "2026-09-21", currentDate: "2026-09-20", exceptions: [exception("available", "2026-09-21")] }).available, true);
});

test("provider-local date boundaries drive offer and confirmation policy", () => {
  const now = new Date("2026-08-28T12:30:00.000Z");
  for (const [timezone, expected] of [["America/Los_Angeles", "2026-08-28"], ["Pacific/Auckland", "2026-08-29"], ["Pacific/Kiritimati", "2026-08-29"]] as const) {
    const currentDate = calendarDateInTimezone(now, timezone);
    assert.equal(currentDate, expected);
    assert.equal(evaluateBookingDateForOffer({ targetDate: expected, currentDate, exceptions: [] }).available, true);
    assert.equal(evaluateBookingDateForConfirmation({ targetDate: "2026-08-28", currentDate, exceptions: [] }).available, expected === "2026-08-28");
  }
});
