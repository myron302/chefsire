import test from "node:test";
import assert from "node:assert/strict";
import { filterVendorsByLocation, formatPhone, normalizeVendorCategory, phoneHref, safeWebsite, toVendor } from "./wedding-planning-core";

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
    city: "Hartford",
    state: "CT",
    phone: null,
    unclaimed: false,
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

test("unclaimed listings keep their public phone; member listings never show one", () => {
  const unclaimed = toVendor({ id: 3, businessName: "Open Data Florist", category: "Florist", city: "Danbury", state: "CT", phone: "12037462471", unclaimed: true, website: "www.flowers.example" });
  assert.equal(unclaimed.unclaimed, true);
  assert.equal(unclaimed.phone, "12037462471");
  assert.equal(unclaimed.website, "https://www.flowers.example");
  const member = toVendor({ id: 4, businessName: "Member", phone: "2035550100", unclaimed: false });
  assert.equal(member.phone, null);
  assert.equal(member.unclaimed, false);
});

test("websites, phones and location filtering", () => {
  assert.equal(safeWebsite("http://Www.kaylanskitchens.com/"), "http://Www.kaylanskitchens.com/");
  assert.equal(safeWebsite("www.villageflowershop.net"), "https://www.villageflowershop.net");
  assert.equal(safeWebsite("javascript:alert(1)"), null);
  assert.equal(safeWebsite("not a site"), null);
  assert.equal(formatPhone("+19145239904"), "(914) 523-9904");
  assert.equal(formatPhone("8602443311"), "(860) 244-3311");
  assert.equal(formatPhone("(203) 969-5993"), "(203) 969-5993");
  assert.equal(phoneHref("(203) 969-5993"), "tel:2039695993");
  assert.equal(phoneHref("+19145239904"), "tel:+19145239904");
  assert.equal(phoneHref("n/a"), null);

  const vs = [
    toVendor({ id: 1, businessName: "A", city: "Hartford", state: "CT" }),
    toVendor({ id: 2, businessName: "B", city: "West Hartford", state: "CT" }),
    toVendor({ id: 3, businessName: "C", city: "Boston", state: "MA" }),
  ];
  assert.equal(filterVendorsByLocation(vs, "").length, 3);
  assert.deepEqual(filterVendorsByLocation(vs, "Hartford, CT, USA").map((v) => v.id), [1]);
  assert.deepEqual(filterVendorsByLocation(vs, "west hartford").map((v) => v.id), [2]);
  assert.deepEqual(filterVendorsByLocation(vs, "CT").map((v) => v.id), [1, 2]);
});
