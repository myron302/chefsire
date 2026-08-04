import test from "node:test";
import assert from "node:assert/strict";
import {
  cateringPackageInputSchema,
  hasExactPackageSet,
  orderPublicPackages,
  packageMetadataPayload,
  validateMergedPackage,
} from "./catering-packages";

const valid = {
  title: "Wedding feast",
  description: "A complete seasonal wedding menu.",
  category: "Wedding Reception" as const,
  pricingModel: "per_person" as const,
  startingPrice: 75,
  minimumGuests: 10,
  maximumGuests: 50,
};

test("package validation accepts professional values", () => {
  assert.equal(cateringPackageInputSchema.parse(valid).currency, "USD");
});

test("full create rejects negative pricing and inverted guest ranges", () => {
  assert.equal(cateringPackageInputSchema.safeParse({ ...valid, startingPrice: -1 }).success, false);
  assert.equal(cateringPackageInputSchema.safeParse({ ...valid, minimumGuests: 60 }).success, false);
});

test("merged PATCH rejects a minimum above the stored maximum", () => {
  assert.throws(() => validateMergedPackage(cateringPackageInputSchema.parse(valid), { minimumGuests: 60 }), /Maximum guests/);
});

test("merged PATCH rejects a maximum below the stored minimum", () => {
  const existing = cateringPackageInputSchema.parse({ ...valid, minimumGuests: 60, maximumGuests: 100 });
  assert.throws(() => validateMergedPackage(existing, { maximumGuests: 50 }), /Maximum guests/);
});

test("merged PATCH accepts valid individual guest limit changes", () => {
  const existing = cateringPackageInputSchema.parse(valid);
  assert.equal(validateMergedPackage(existing, { minimumGuests: 20 }).minimumGuests, 20);
  assert.equal(validateMergedPackage(existing, { maximumGuests: 100 }).maximumGuests, 100);
});

test("merged PATCH accepts an unlimited maximum and preserves guests for unrelated edits", () => {
  const existing = cateringPackageInputSchema.parse(valid);
  assert.equal(validateMergedPackage(existing, { maximumGuests: null }).maximumGuests, null);
  const changed = validateMergedPackage(existing, { title: "Updated wedding feast" });
  assert.equal(changed.minimumGuests, 10);
  assert.equal(changed.maximumGuests, 50);
});

test("metadata save payload cannot overwrite newly uploaded cover or server fields", () => {
  const beforeUpload = cateringPackageInputSchema.parse({ ...valid, coverImage: null });
  const afterUpload = { ...beforeUpload, coverImage: "/uploads/new-cover.webp" };
  const payload = packageMetadataPayload({ ...afterUpload, title: "Updated wedding feast" });
  for (const serverManaged of ["coverImage", "galleryImages", "id", "providerId", "displayOrder", "createdAt", "updatedAt"]) {
    assert.equal(serverManaged in payload, false, `${serverManaged} must not be submitted as metadata`);
  }
  assert.equal(validateMergedPackage(afterUpload, payload).coverImage, "/uploads/new-cover.webp");
});

test("featured packages sort before display order", () => {
  const values = orderPublicPackages([{ featured: false, displayOrder: 0, id: "a" }, { featured: true, displayOrder: 9, id: "b" }]);
  assert.deepEqual(values.map((item) => item.id), ["b", "a"]);
});

test("reordering requires the exact owned set", () => {
  assert.equal(hasExactPackageSet(["a", "b"], ["b", "a"]), true);
  assert.equal(hasExactPackageSet(["a", "b"], ["a", "x"]), false);
});
