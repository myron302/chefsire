import test from "node:test";
import assert from "node:assert/strict";
import { replaceWeeklyRule } from "./availability-actions";

test("consecutive weekly changes compose into a complete unique rule set", () => {
  const mondayOff = replaceWeeklyRule([], 1, false);
  const mondayAndTuesdayOff = replaceWeeklyRule(mondayOff, 2, false);
  assert.equal(mondayAndTuesdayOff.length, 7);
  assert.equal(new Set(mondayAndTuesdayOff.map((rule) => rule.dayOfWeek)).size, 7);
  assert.equal(mondayAndTuesdayOff[1].available, false);
  assert.equal(mondayAndTuesdayOff[2].available, false);
  assert.equal(replaceWeeklyRule(mondayAndTuesdayOff, 1, true)[1].available, true);
});
