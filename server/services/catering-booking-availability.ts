import type { AvailabilityException } from "@shared/catering-availability";
import { resolveCateringDateOverride } from "./catering-availability";

export type ExistingBookingDateDecision = { available: true; reason: "available" } | { available: false; reason: "explicitly_blocked" };

/**
 * An accepted inquiry that the provider explicitly offered is no longer subject to
 * marketplace intake, rolling lead/advance windows, listing visibility, or generic
 * weekly schedule changes. Only an explicit block covering this exact date revokes
 * its confirmability; a block wins over a conflicting explicit available override.
 */
export function evaluateExistingCateringBookingDate(input: { targetDate: string; exceptions: AvailabilityException[] }): ExistingBookingDateDecision {
  return resolveCateringDateOverride(input) === "blocked"
    ? { available: false, reason: "explicitly_blocked" }
    : { available: true, reason: "available" };
}

export const evaluateBookingDateForOffer = evaluateExistingCateringBookingDate;
export const evaluateBookingDateForConfirmation = evaluateExistingCateringBookingDate;
