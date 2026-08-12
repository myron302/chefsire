import { z } from "zod";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calendarDateParts(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day } : null;
}

export const calendarDateSchema = z.string().refine((value) => calendarDateParts(value) !== null, "Date must be a valid YYYY-MM-DD calendar date");
export const availabilitySettingsSchema = z.object({
  acceptingBookings: z.boolean(), minimumLeadDays: z.number().int().min(0).max(1095),
  maximumAdvanceDays: z.number().int().min(0).max(1095),
  timezone: z.string().trim().min(1).max(100).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }, "Invalid IANA timezone"),
}).refine((v) => v.maximumAdvanceDays >= v.minimumLeadDays, { path: ["maximumAdvanceDays"], message: "Maximum advance days must be at least the minimum lead days" });
export const availabilityExceptionSchema = z.object({ startDate: calendarDateSchema, endDate: calendarDateSchema, type: z.enum(["available", "blocked"]), reason: z.string().trim().max(300).optional().nullable() })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "End date cannot precede start date" });
export const weeklyRulesSchema = z.object({ rules: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), available: z.boolean() })).max(7) })
  .refine((v) => new Set(v.rules.map((rule) => rule.dayOfWeek)).size === v.rules.length, "Weekly days cannot be duplicated");

export type AvailabilitySettings = z.infer<typeof availabilitySettingsSchema>;
export type AvailabilityException = z.infer<typeof availabilityExceptionSchema> & { id: string };
export type WeeklyRule = z.infer<typeof weeklyRulesSchema>["rules"][number];
export type AvailabilityReason = "available" | "not_accepting" | "lead_time" | "advance_window" | "blocked" | "weekly_unavailable";

export interface PublicAvailabilitySummary { acceptingBookings: boolean; earliestInquiryDate: string | null; latestInquiryDate: string | null; }
