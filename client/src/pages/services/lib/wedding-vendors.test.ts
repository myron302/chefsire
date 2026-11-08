import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVendorCategory, toVendor } from "./wedding-planning-core";

test("vendor categories map free text onto directory filters", () => {
  assert.equal(normalizeVendorCategory("Catering"), "caterer");
  assert.equal(normalizeVendorCategory("Wedding Cakes & Desserts"), "caterer");
  assert.equal(normalizeVendorCategory("Photography & Video"), "photographer");
  assert.equal(normalizeVendorCategory("Live Band"), "dj");
  assert.equal(normalizeVendorCategory("Florist"), "florist");
  assert.equal(normalizeVendorCategory("Barn Venue"), "venue");
  assert.equal(normalizeVendorCategory("Day-of Coordinator"), "planner");
  assert.equal(normalizeVendorCategory("Limo Service"), "other");
  assert.equal(normalizeVendorCategory(null), "other");
});

test("published listing becomes a vendor with no fabricated ratings", () => {
  const v = toVendor({
    id: "42",
    businessName: "Real Bakery",
    category: "Cakes",
    city: "Hartford",
    state: "CT",
    description: "Custom cakes",
    website: "https://example.com",
    instagramHandle: "@realbakery",
    minPrice: 300,
    maxPrice: 1200,
    yearsInBusiness: 8,
  });
  assert.deepEqual(v, {
    id: 42,
    type: "caterer",
    name: "Real Bakery",
    priceRange: "$300–$1,200",
    description: "Custom cakes",
    location: "Hartford, CT",
    website: "https://example.com",
    instagramHandle: "realbakery",
    yearsInBusiness: 8,
  });
  assert.equal("rating" in v, false);
  assert.equal("reviews" in v, false);
});

test("unsafe or missing optional fields are dropped", () => {
  const v = toVendor({ id: 7, businessName: "X", website: "javascript:alert(1)", minPrice: 0, maxPrice: null, yearsInBusiness: 0 });
  assert.equal(v.website, null);
  assert.equal(v.priceRange, null);
  assert.equal(v.location, null);
  assert.equal(v.yearsInBusiness, null);
  assert.equal(toVendor({ id: 1, businessName: "Y", minPrice: 500 }).priceRange, "From $500");
});
