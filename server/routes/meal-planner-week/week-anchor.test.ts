/**
 * A week anchor is a calendar date, not an instant.
 *
 * `new Date("2030-01-14")` parses a date-only string as UTC midnight, so on any server west of UTC
 * it lands on the previous evening. The anchor 2030-01-14 -- a Monday -- became Sunday the 13th at
 * 19:00 on a UTC-5 server, and startOfWeekMonday then walked back to Monday the 7th. A shared week
 * therefore showed the week BEFORE the one that was shared, which is normally empty: every share
 * link looked broken.
 *
 * It survived because it depends on the deployment's timezone rather than the code path, so it is
 * invisible on a UTC server and certain on an American one. These assertions are timezone-relative
 * on purpose -- they must hold wherever the suite runs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseCalendarDate, startOfWeekMonday, addDays, endOfDay, fmtISODate } from "./utils";

test("a date-only anchor keeps the day of the week it names", () => {
  // 2030-01-14 is a Monday, in every timezone, because it is a calendar date.
  const parsed = parseCalendarDate("2030-01-14");
  assert.equal(parsed.getFullYear(), 2030);
  assert.equal(parsed.getMonth(), 0);
  assert.equal(parsed.getDate(), 14);
  assert.equal(parsed.getDay(), 1, "Monday");
  assert.equal(fmtISODate(parsed), "2030-01-14", "and round-trips to the same date it came from");
});

test("the week built from the anchor contains the days that week contains", () => {
  const weekStart = startOfWeekMonday(parseCalendarDate("2030-01-14"));
  const weekEnd = endOfDay(addDays(weekStart, 6));
  assert.equal(fmtISODate(weekStart), "2030-01-14", "the Monday anchor IS the start of its week");
  assert.equal(fmtISODate(weekEnd), "2030-01-20");

  // The entry that used to disappear: the Tuesday of the shared week.
  const tuesday = parseCalendarDate("2030-01-15");
  assert.ok(tuesday >= weekStart && tuesday <= weekEnd, "Tuesday is in the week starting on its Monday");
});

test("the UTC-midnight trap is the thing being avoided, and is demonstrated rather than assumed", () => {
  // Not an assertion about our code -- an assertion about the platform, so nobody reintroduces it.
  const offsetMinutes = new Date(2030, 0, 14).getTimezoneOffset();
  const naive = new Date("2030-01-14");
  if (offsetMinutes > 0) {
    // West of UTC: the naive parse lands on the 13th locally, and the week walks back a week.
    assert.equal(naive.getDate(), 13, "a date-only string is a UTC instant, not a local date");
    assert.equal(fmtISODate(startOfWeekMonday(naive)), "2030-01-07",
      "which is exactly how the shared week ended up a week early");
    assert.notEqual(fmtISODate(startOfWeekMonday(naive)), fmtISODate(startOfWeekMonday(parseCalendarDate("2030-01-14"))));
  } else {
    // At or east of UTC the naive parse happens to agree, which is why this was invisible in CI.
    assert.equal(fmtISODate(startOfWeekMonday(naive)), "2030-01-14");
  }
});

test("a Date and a full timestamp still work, and a Sunday still belongs to the week before", () => {
  assert.equal(fmtISODate(parseCalendarDate(new Date(2030, 0, 14))), "2030-01-14");
  assert.equal(fmtISODate(parseCalendarDate("2030-01-14T15:30:00")), "2030-01-14");
  // Sunday the 20th closes the week that began on Monday the 14th.
  assert.equal(fmtISODate(startOfWeekMonday(parseCalendarDate("2030-01-20"))), "2030-01-14");
});
