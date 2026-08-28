import assert from "node:assert/strict";
import test from "node:test";
import type { AvailabilityException } from "@shared/catering-availability";
import { evaluateBookingDateForConfirmation, evaluateBookingDateForOffer, evaluateExistingCateringBookingDate } from "./catering-booking-availability";
import { evaluateNewCateringInquiryAvailability } from "./catering-availability";

const targetDate = "2026-09-20";
const exception = (type: "available" | "blocked"): AvailabilityException => ({ id: type, startDate: targetDate, endDate: targetDate, type, reason: null });
const settings = { acceptingBookings: true, minimumLeadDays: 10, maximumAdvanceDays: 100, timezone: "UTC" };

test("existing offers ignore intake pause and rolling lead/advance windows", () => {
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, exceptions: [] }).available, true);
  assert.equal(evaluateNewCateringInquiryAvailability({ settings: { ...settings, acceptingBookings: false }, rules: [], exceptions: [], targetDate, currentDate: "2026-09-01" }).reason, "not_accepting");
  assert.equal(evaluateNewCateringInquiryAvailability({ settings, rules: [], exceptions: [], targetDate, currentDate: "2026-09-15" }).reason, "lead_time");
  assert.equal(evaluateNewCateringInquiryAvailability({ settings, rules: [], exceptions: [], targetDate: "2027-09-20", currentDate: "2026-09-01" }).reason, "advance_window");
});

test("provider offer and customer confirmation share exact-date block policy", () => {
  const input = { targetDate, exceptions: [exception("blocked")] };
  assert.deepEqual(evaluateBookingDateForOffer(input), { available: false, reason: "explicitly_blocked" });
  assert.deepEqual(evaluateBookingDateForOffer(input), evaluateBookingDateForConfirmation(input));
});

test("explicit available remains valid and an explicit block wins conflicts", () => {
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, exceptions: [exception("available")] }).available, true);
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, exceptions: [exception("available"), exception("blocked")] }).available, false);
});

test("weekly and listing changes do not retroactively revoke an explicit offer", () => {
  const weeklyUnavailable = [{ dayOfWeek: 0, available: false }];
  assert.equal(evaluateNewCateringInquiryAvailability({ settings, rules: weeklyUnavailable, exceptions: [], targetDate, currentDate: "2026-09-01" }).reason, "weekly_unavailable");
  // Existing-booking policy deliberately has no weekly, listing, or intake-state input.
  assert.equal(evaluateExistingCateringBookingDate({ targetDate, exceptions: [] }).available, true);
});
