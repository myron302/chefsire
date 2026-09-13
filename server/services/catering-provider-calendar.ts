import { eq } from "drizzle-orm";
import { cateringAvailabilitySettings } from "@shared/schema";
import { db } from "../db";
import { calendarDateInTimezone } from "./catering-availability";

/**
 * WHAT DAY IS IT FOR THIS PROVIDER.
 *
 * One owner for the question, because Catering already answers it in one way and a second answer would be a second
 * calendar. The source is `catering_availability_settings.timezone` -- the same column the booking and inquiry
 * availability rules read -- and the formatter is `calendarDateInTimezone`, the same `Intl`-based one they use.
 *
 * It was previously a private function inside `server/routes/catering-bookings.ts`. Phase 2L needs exactly the same
 * value for its own date-only rules, and copying four lines would have been the beginning of a divergence, so the
 * function moved here and that route now imports it. Nothing about what it returns changed.
 *
 * THE FALLBACK IS THE EXISTING ONE: a provider with no settings row is UTC, exactly as before. The one addition is
 * that a persisted timezone `Intl` cannot parse also falls back to UTC instead of throwing. The column is free
 * text, and the previous behaviour was a RangeError out of a formatter -- which in an availability check is an
 * error response and in a billing read would be a whole section a provider could not open because of a value they
 * cannot see or correct. The fallback VALUE is unchanged; only the crash is gone.
 */
export async function providerCalendarDate(executor: typeof db, providerId: string, now: Date): Promise<string> {
  const [settings] = await executor
    .select({ timezone: cateringAvailabilitySettings.timezone })
    .from(cateringAvailabilitySettings)
    .where(eq(cateringAvailabilitySettings.providerId, providerId))
    .limit(1);
  return calendarDateInProviderTimezone(now, settings?.timezone ?? "UTC");
}

/** The formatter with the timezone guard, so an unparseable identifier reads as UTC rather than throwing. */
export function calendarDateInProviderTimezone(now: Date, timezone: string | null | undefined): string {
  try {
    return calendarDateInTimezone(now, timezone ?? "UTC");
  } catch {
    return calendarDateInTimezone(now, "UTC");
  }
}
