import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_CUSTOMER_INQUIRY_STAGES, CATERING_CUSTOMER_REQUESTS_URL, CATERING_PROVIDER_INQUIRIES_URL,
  canCustomerWithdrawCateringInquiry, cateringInquiryContactSchema, deriveCateringCustomerInquiryStage,
} from "./catering-inquiries";
import { CATERING_DASHBOARD_SECTIONS } from "./catering-dashboard";

const parse = (input: unknown) => cateringInquiryContactSchema.parse(input);

test("blank contact fields mean not given, not an empty string", () => {
  assert.equal(parse({}).customerEmail, undefined);
  assert.equal(parse({}).customerPhone, undefined);
  const blank = parse({ customerEmail: "", customerPhone: "   " });
  assert.equal(blank.customerEmail, undefined);
  assert.equal(blank.customerPhone, undefined);
});

test("an email is trimmed, lowercased and validated", () => {
  assert.equal(parse({ customerEmail: "  Ann.Lee@Example.COM " }).customerEmail, "ann.lee@example.com");
  for (const bad of ["not-an-email", "a@b", "@example.com", "ann@", "ann lee@example.com"]) {
    assert.equal(cateringInquiryContactSchema.safeParse({ customerEmail: bad }).success, false, bad);
  }
});

test("an email longer than the column is refused rather than truncated", () => {
  const tooLong = `${"a".repeat(250)}@example.com`;
  assert.equal(cateringInquiryContactSchema.safeParse({ customerEmail: tooLong }).success, false);
});

test("a phone number keeps only dialling characters, collapses whitespace and needs 7 to 15 digits", () => {
  assert.equal(parse({ customerPhone: "  +1   (555) 010-2030 " }).customerPhone, "+1 (555) 010-2030");
  assert.equal(parse({ customerPhone: "555.010.2030" }).customerPhone, "555.010.2030");
  for (const bad of ["12345", "call me maybe", "555-010-2030 ext 9", "1".repeat(16), "+".repeat(10)]) {
    assert.equal(cateringInquiryContactSchema.safeParse({ customerPhone: bad }).success, false, bad);
  }
  assert.equal(cateringInquiryContactSchema.safeParse({ customerPhone: `${"1".repeat(30)}   ` }).success, false);
});

test("the contact schema ignores every key it does not own, so no actor or id can ride along", () => {
  assert.deepEqual(parse({ customerEmail: "a@example.com", customerId: "someone-else", status: "accepted" }), { customerEmail: "a@example.com" });
});

test("stage is derived: a booking decides everything from the offer onward, the inquiry status only before one exists", () => {
  assert.equal(deriveCateringCustomerInquiryStage("pending", null), "awaiting_provider");
  assert.equal(deriveCateringCustomerInquiryStage(null, null), "awaiting_provider");
  assert.equal(deriveCateringCustomerInquiryStage("accepted", null), "accepted_awaiting_offer");
  assert.equal(deriveCateringCustomerInquiryStage("declined", null), "declined");
  assert.equal(deriveCateringCustomerInquiryStage("cancelled", null), "withdrawn");
  assert.equal(deriveCateringCustomerInquiryStage("accepted", { status: "pending_confirmation" }), "offered");
  assert.equal(deriveCateringCustomerInquiryStage("accepted", { status: "confirmed" }), "booked");
  assert.equal(deriveCateringCustomerInquiryStage("accepted", { status: "completed" }), "completed");
  assert.equal(deriveCateringCustomerInquiryStage("accepted", { status: "cancelled" }), "booking_cancelled");
  for (const stage of CATERING_CUSTOMER_INQUIRY_STAGES) assert.equal(typeof stage, "string");
});

test("withdrawal is legal only before a booking exists and only while the inquiry is open", () => {
  assert.equal(canCustomerWithdrawCateringInquiry("pending", false), true);
  assert.equal(canCustomerWithdrawCateringInquiry("accepted", false), true);
  assert.equal(canCustomerWithdrawCateringInquiry("pending", true), false);
  assert.equal(canCustomerWithdrawCateringInquiry("accepted", true), false);
  assert.equal(canCustomerWithdrawCateringInquiry("declined", false), false);
  assert.equal(canCustomerWithdrawCateringInquiry("cancelled", false), false);
  assert.equal(canCustomerWithdrawCateringInquiry(null, false), true, "NULL defaults to pending");
});

test("notification destinations are real, actor-appropriate surfaces", () => {
  assert.equal(CATERING_CUSTOMER_REQUESTS_URL, "/services/catering#my-requests");
  assert.equal(CATERING_PROVIDER_INQUIRIES_URL, "/services/catering/provider#inquiries");
  const providerSection = CATERING_PROVIDER_INQUIRIES_URL.split("#")[1];
  assert.ok((CATERING_DASHBOARD_SECTIONS as readonly string[]).includes(providerSection));
});
