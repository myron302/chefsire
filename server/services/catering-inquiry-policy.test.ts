import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionCateringInquiry, cateringInquiryRole } from "./catering-inquiry-policy";
import type { CateringInquiry } from "@shared/schema";

const inquiry = { chefId: "provider", customerId: "customer", status: "pending" } as CateringInquiry;

test("only inquiry participants receive a role", () => {
  assert.equal(cateringInquiryRole(inquiry, "provider"), "provider");
  assert.equal(cateringInquiryRole(inquiry, "customer"), "customer");
  assert.equal(cateringInquiryRole(inquiry, "stranger"), null);
});

test("provider and customer transitions are role restricted", () => {
  assert.equal(canTransitionCateringInquiry("provider", "pending", "accepted"), true);
  assert.equal(canTransitionCateringInquiry("provider", "pending", "declined"), true);
  assert.equal(canTransitionCateringInquiry("provider", "pending", "cancelled"), false);
  assert.equal(canTransitionCateringInquiry("customer", "pending", "cancelled"), true);
  assert.equal(canTransitionCateringInquiry("customer", "pending", "accepted"), false);
  assert.equal(canTransitionCateringInquiry("provider", "accepted", "declined"), false);
});

