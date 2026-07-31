import assert from "node:assert/strict";
import test from "node:test";
import { cateringProviderActionState, localCalendarDate } from "./catering-provider-actions";

test("provider actions wait for authentication resolution", () => {
  const state = cateringProviderActionState(true, null, "provider");
  assert.equal(state.isAuthLoading, true);
  assert.equal(state.canResolveAuthentication, false);
  assert.equal(state.isSelf, false);
});

test("formats selected dates from local calendar fields without UTC rollover", () => {
  const localDate = new Date(2026, 6, 31, 23, 30);
  assert.equal(localCalendarDate(localDate), "2026-07-31");
});

test("resolved anonymous and authenticated viewers can continue", () => {
  assert.equal(cateringProviderActionState(false, null, "provider").canResolveAuthentication, true);
  assert.equal(cateringProviderActionState(false, "customer", "provider").isSelf, false);
  assert.equal(cateringProviderActionState(false, "provider", "provider").isSelf, true);
});
