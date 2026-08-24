import type { AvailabilityException, AvailabilityReason, AvailabilitySettings, WeeklyRule } from "@shared/catering-availability";
import { calendarDateParts } from "@shared/catering-availability";

const DAY_MS = 86_400_000;
export function dateOrdinal(value: string): number { const p = calendarDateParts(value); if (!p) throw new Error("Invalid calendar date"); return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS); }
export function addCalendarDays(value: string, days: number): string { const d = new Date((dateOrdinal(value) + days) * DAY_MS); return `${d.getUTCFullYear().toString().padStart(4, "0")}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`; }
export function calendarDateInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function resolveCateringAvailability(input: { settings: AvailabilitySettings; rules: WeeklyRule[]; exceptions: AvailabilityException[]; targetDate: string; currentDate: string; packageId?: string }): { available: boolean; reason: AvailabilityReason } {
  const target = dateOrdinal(input.targetDate), current = dateOrdinal(input.currentDate), delta = target - current;
  if (!input.settings.acceptingBookings) return { available: false, reason: "not_accepting" };
  if (delta < input.settings.minimumLeadDays) return { available: false, reason: "lead_time" };
  if (delta > input.settings.maximumAdvanceDays) return { available: false, reason: "advance_window" };
  // Package-level rules can be composed here later; provider exceptions remain canonical today.
  const matches = input.exceptions.filter((item) => input.targetDate >= item.startDate && input.targetDate <= item.endDate);
  if (matches.some((item) => item.type === "blocked")) return { available: false, reason: "blocked" };
  if (matches.some((item) => item.type === "available")) return { available: true, reason: "available" };
  const weekday = new Date(target * DAY_MS).getUTCDay();
  if (input.rules.find((rule) => rule.dayOfWeek === weekday)?.available === false) return { available: false, reason: "weekly_unavailable" };
  return { available: true, reason: "available" };
}
