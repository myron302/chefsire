import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_INQUIRY_MAX_PAGE_SIZE, canViewProviderInquiryPage, cateringInquiryPageMetadata, cateringInquiryPageSchema } from "./catering-inquiry-pagination";

test("inquiry pagination applies bounded defaults and validation", () => {
  assert.deepEqual(cateringInquiryPageSchema.parse({}), { page: 1, limit: 20 });
  assert.deepEqual(cateringInquiryPageSchema.parse({ page: "2", limit: "50" }), { page: 2, limit: CATERING_INQUIRY_MAX_PAGE_SIZE });
  assert.equal(cateringInquiryPageSchema.safeParse({ page: 0 }).success, false);
  assert.equal(cateringInquiryPageSchema.safeParse({ limit: 51 }).success, false);
});

test("page metadata is derived from the database total", () => {
  assert.deepEqual(cateringInquiryPageMetadata(2, 20, 41), { page: 2, limit: 20, total: 41, totalPages: 3 });
  assert.deepEqual(cateringInquiryPageMetadata(1, 20, 0), { page: 1, limit: 20, total: 0, totalPages: 0 });
});

test("paginated provider history remains owner-only", () => {
  assert.equal(canViewProviderInquiryPage("provider", "provider"), true);
  assert.equal(canViewProviderInquiryPage("other-user", "provider"), false);
});
