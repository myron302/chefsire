import assert from "node:assert/strict";
import test from "node:test";
import { cateringDashboardActions, isCateringAvailabilityConfigured, type CateringDashboardFacts } from "./catering-dashboard";

const ready: CateringDashboardFacts = { listingEnabled: true, acceptingInquiries: true, availabilityConfigured: true, profileComplete: true, inquiriesPending: 0, packagesTotal: 2, packagesActive: 1, portfolioCount: 1, reviewCount: 0, averageRating: null, reviewsAwaitingResponse: 0 };

test("ready providers have no manufactured action or rating", () => {
  assert.deepEqual(cateringDashboardActions(ready), []);
  assert.equal(ready.averageRating, null);
});
test("disabled listing suppresses unavailable availability tasks", () => {
  const actions = cateringDashboardActions({ ...ready, listingEnabled: false, acceptingInquiries: false, availabilityConfigured: false, packagesTotal: 0, packagesActive: 0, portfolioCount: 0, reviewsAwaitingResponse: 1 });
  assert.deepEqual(actions.map((item) => item.label), ["Enable your marketplace listing"]);
});
test("enabled providers receive one intentional availability task", () => {
  assert.deepEqual(cateringDashboardActions({ ...ready, availabilityConfigured: false }).map((item) => item.label), ["Configure availability"]);
  assert.deepEqual(cateringDashboardActions({ ...ready, acceptingInquiries: false }).map((item) => item.label), ["Start accepting inquiries"]);
  assert.deepEqual(cateringDashboardActions({ ...ready, acceptingInquiries: false, availabilityConfigured: false }).map((item) => item.label), ["Configure availability"]);
});
test("persisted empty and attention states produce truthful setup actions", () => {
  const actions = cateringDashboardActions({ ...ready, profileComplete: false, availabilityConfigured: false, packagesTotal: 0, packagesActive: 0, portfolioCount: 0, inquiriesPending: 2, reviewCount: 1, averageRating: 4, reviewsAwaitingResponse: 1 });
  assert.deepEqual(actions.map((item) => item.section), ["profile", "packages", "portfolio", "availability", "inquiries", "reviews"]);
});
test("package actions distinguish missing, inactive, and customer-visible packages", () => {
  assert.deepEqual(cateringDashboardActions({ ...ready, packagesTotal: 0, packagesActive: 0 }).map((item) => item.label), ["Add your first package"]);
  assert.deepEqual(cateringDashboardActions({ ...ready, packagesTotal: 3, packagesActive: 0 }).map((item) => item.label), ["Activate a package"]);
  assert.deepEqual(cateringDashboardActions({ ...ready, packagesTotal: 3, packagesActive: 1 }), []);
  assert.deepEqual(cateringDashboardActions({ ...ready, packagesTotal: 3, packagesActive: 3 }), []);
});
test("every derived action targets a dashboard section", () => {
  const sections = new Set(["profile", "inquiries", "packages", "portfolio", "availability", "reviews"]);
  const actions = cateringDashboardActions({ ...ready, profileComplete: false, acceptingInquiries: false, packagesTotal: 2, packagesActive: 0, portfolioCount: 0, inquiriesPending: 1, reviewsAwaitingResponse: 1 });
  assert.ok(actions.length > 0);
  for (const action of actions) assert.equal(sections.has(action.section), true);
});
test("all persisted availability sources count as meaningful configuration", () => {
  assert.equal(isCateringAvailabilityConfigured({ hasSettings: false, weeklyRuleCount: 0, exceptionCount: 0 }), false);
  assert.equal(isCateringAvailabilityConfigured({ hasSettings: true, weeklyRuleCount: 0, exceptionCount: 0 }), true);
  assert.equal(isCateringAvailabilityConfigured({ hasSettings: false, weeklyRuleCount: 1, exceptionCount: 0 }), true);
  assert.equal(isCateringAvailabilityConfigured({ hasSettings: true, weeklyRuleCount: 1, exceptionCount: 0 }), true);
  assert.equal(isCateringAvailabilityConfigured({ hasSettings: false, weeklyRuleCount: 0, exceptionCount: 1 }), true);
  assert.equal(isCateringAvailabilityConfigured({ hasSettings: false, weeklyRuleCount: 0, exceptionCount: 0 }), false);
});
