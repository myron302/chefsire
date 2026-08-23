import test from "node:test";
import assert from "node:assert/strict";
import { isCateringProviderBookable } from "./catering-bookability";

test("enabled provider with accepting bookings enabled is bookable", () => {
  assert.equal(isCateringProviderBookable({ cateringEnabled: true, cateringAvailable: false, acceptingBookings: true }), true);
});
test("Phase 2D accepting state overrides the legacy availability flag", () => {
  assert.equal(isCateringProviderBookable({ cateringEnabled: true, cateringAvailable: true, acceptingBookings: false }), false);
});
test("legacy provider without settings falls back to cateringAvailable", () => {
  assert.equal(isCateringProviderBookable({ cateringEnabled: true, cateringAvailable: true, acceptingBookings: null }), true);
  assert.equal(isCateringProviderBookable({ cateringEnabled: true, cateringAvailable: false, acceptingBookings: undefined }), false);
});
test("disabled listing is never bookable regardless of booking settings", () => {
  assert.equal(isCateringProviderBookable({ cateringEnabled: false, cateringAvailable: true, acceptingBookings: true }), false);
});
