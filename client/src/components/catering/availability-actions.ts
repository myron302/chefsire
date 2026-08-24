import type { WeeklyRule } from "@shared/catering-availability";

/** Produces the complete, unique replacement required by the weekly rules API. */
export function replaceWeeklyRule(rules: WeeklyRule[], dayOfWeek: number, available: boolean): WeeklyRule[] {
  const byDay = new Map(rules.map((rule) => [rule.dayOfWeek, rule.available]));
  byDay.set(dayOfWeek, available);
  return Array.from({ length: 7 }, (_, day) => ({ dayOfWeek: day, available: byDay.get(day) ?? true }));
}
