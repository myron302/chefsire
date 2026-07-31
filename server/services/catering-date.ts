import { z } from "zod";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Quote dates use the requester's reported browser UTC offset as their calendar policy.
 * Same-day inquiries are allowed. Dates are stored at noon UTC to preserve the calendar
 * day in existing timestamp-backed displays without relying on date-string parsing.
 */
export function parseCateringCalendarDate(
  value: string,
  timezoneOffsetMinutes: number,
  now = new Date(),
): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) throw new Error("Event date must use YYYY-MM-DD format");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const storedDate = new Date(Date.UTC(year, month - 1, day, 12));
  if (storedDate.getUTCFullYear() !== year || storedDate.getUTCMonth() !== month - 1 || storedDate.getUTCDate() !== day) {
    throw new Error("Event date must be a valid calendar date");
  }

  const requesterNow = new Date(now.getTime() - timezoneOffsetMinutes * 60_000);
  const requesterToday = `${requesterNow.getUTCFullYear().toString().padStart(4, "0")}-${(requesterNow.getUTCMonth() + 1).toString().padStart(2, "0")}-${requesterNow.getUTCDate().toString().padStart(2, "0")}`;
  if (value < requesterToday) throw new Error("Event date cannot be before today");
  return storedDate;
}

export const cateringQuoteDateSchema = z.object({
  eventDate: z.string(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840),
}).transform(({ eventDate, timezoneOffsetMinutes }, context) => {
  try {
    return { eventDate: parseCateringCalendarDate(eventDate, timezoneOffsetMinutes) };
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["eventDate"], message: error instanceof Error ? error.message : "Invalid event date" });
    return z.NEVER;
  }
});
