import assert from "node:assert/strict";
import test from "node:test";
import { cateringDashboardActions, type CateringDashboardFacts } from "./catering-dashboard";

const ready: CateringDashboardFacts = { listingEnabled: true, acceptingInquiries: true, availabilityConfigured: true, profileComplete: true, inquiriesPending: 0, packagesTotal: 2, packagesActive: 1, portfolioCount: 1, reviewCount: 0, averageRating: null, reviewsAwaitingResponse: 0 };

test("ready providers have no manufactured action or rating", () => {
  assert.deepEqual(cateringDashboardActions(ready), []);
  assert.equal(ready.averageRating, null);
});
test("hidden and paused states remain distinct", () => {
  const hidden = cateringDashboardActions({ ...ready, listingEnabled: false, acceptingInquiries: false });
  assert.deepEqual(hidden.map((item) => item.section), ["profile"]);
  const paused = cateringDashboardActions({ ...ready, acceptingInquiries: false });
  assert.deepEqual(paused.map((item) => item.section), ["availability"]);
});
test("persisted empty and attention states produce truthful setup actions", () => {
  const actions = cateringDashboardActions({ ...ready, profileComplete: false, availabilityConfigured: false, packagesTotal: 0, packagesActive: 0, portfolioCount: 0, inquiriesPending: 2, reviewCount: 1, averageRating: 4, reviewsAwaitingResponse: 1 });
  assert.deepEqual(actions.map((item) => item.section), ["profile", "packages", "portfolio", "availability", "inquiries", "reviews"]);
});
