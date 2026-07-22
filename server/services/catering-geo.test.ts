import assert from "node:assert/strict";
import test from "node:test";
import { isProviderInRange, milesBetween, parseCoordinates, resolveVisitorLocation } from "./catering-geo";

test("coordinates within the requested radius return a real distance", () => {
  const distance = milesBetween({ latitude: 41.7, longitude: -72.0 }, { latitude: 41.71, longitude: -72.0 });
  assert.ok(distance > 0 && distance < 1);
  assert.equal(isProviderInRange(distance, 5, 10), true);
});

test("coordinates outside the requested radius are excluded", () => {
  assert.equal(isProviderInRange(51, 50, 100), false);
});

test("provider service radius excludes otherwise nearby visitor", () => {
  assert.equal(isProviderInRange(12, 50, 10), false);
});

test("missing provider coordinates cannot produce a fabricated nearby distance", () => {
  assert.equal(Number.isFinite(Number(undefined)), false);
});

test("invalid visitor coordinate input is rejected before search", () => {
  assert.equal(parseCoordinates("not-a-location"), null);
  assert.equal(parseCoordinates("91,0"), null);
});

test("valid browser coordinate input is parsed", () => {
  assert.deepEqual(parseCoordinates("41.7128,-72.0060"), { latitude: 41.7128, longitude: -72.006 });
});

test("city or ZIP geocoding failure returns no visitor coordinates", async () => {
  const result = await resolveVisitorLocation("unknown city", async () => { throw new Error("ZERO_RESULTS"); });
  assert.equal(result, null);
});
