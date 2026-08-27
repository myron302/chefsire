import assert from "node:assert/strict";
import test from "node:test";
import { cateringProviderSectionFromHash, cateringProviderSectionHash } from "./catering-provider-navigation";

test("provider booking and inquiry fragments resolve to usable sections", () => {
  assert.equal(cateringProviderSectionFromHash("#bookings"), "bookings");
  assert.equal(cateringProviderSectionFromHash("#inquiries"), "inquiries");
});
test("missing and unsupported fragments safely resolve to overview", () => {
  assert.equal(cateringProviderSectionFromHash(""), "overview");
  assert.equal(cateringProviderSectionFromHash("#private-arbitrary-value"), "overview");
});
test("every supported section has a stable linkable fragment", () => {
  for (const section of ["overview", "profile", "inquiries", "bookings", "packages", "portfolio", "availability", "reviews"] as const) {
    assert.equal(cateringProviderSectionFromHash(cateringProviderSectionHash(section)), section);
  }
});
