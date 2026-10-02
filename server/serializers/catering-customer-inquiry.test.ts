import assert from "node:assert/strict";
import test from "node:test";
import type { CateringInquiry } from "@shared/schema";
import { serializeCateringCustomerInquiry, type CateringCustomerInquiryRow } from "./catering-customer-inquiry";

const inquiry = (overrides: Partial<CateringInquiry> = {}): CateringInquiry => ({
  id: "inq-1", customerId: "cust-1", chefId: "chef-1", packageId: null, eventDate: new Date("2027-05-20T00:00:00Z"),
  guestCount: 40, eventType: "wedding", cuisinePreferences: ["thai"], budget: "2500.00", message: "hello",
  customerEmail: "ann@example.com", customerPhone: "+1 555 010 2030", status: "pending", createdAt: new Date("2027-01-02T03:04:05Z"),
  ...overrides,
} as CateringInquiry);
const provider = { id: "chef-1", displayName: "Chef One", username: "chef1" };
const row = (overrides: Partial<CateringCustomerInquiryRow> = {}): CateringCustomerInquiryRow => ({ inquiry: inquiry(), booking: null, provider, packageTitle: null, ...overrides });

test("the customer projection is an explicit allowlist, so a new column is never exposed by accident", () => {
  const view = serializeCateringCustomerInquiry(row());
  assert.deepEqual(Object.keys(view).sort(), ["booking", "budget", "canWithdraw", "contactEmail", "contactPhone", "cuisinePreferences", "eventDate", "eventType", "guestCount", "id", "message", "packageTitle", "provider", "stage", "status", "submittedAt"]);
  assert.deepEqual(Object.keys(view.provider).sort(), ["displayName", "id"]);
  const leaked = JSON.stringify(view);
  assert.doesNotMatch(leaked, /customerId|chefId|cust-1|chef1/);
});

test("the event date is a calendar date and the submitted time an instant", () => {
  const view = serializeCateringCustomerInquiry(row());
  assert.equal(view.eventDate, "2027-05-20");
  assert.equal(view.submittedAt, "2027-01-02T03:04:05.000Z");
});

test("legacy rows with no structured contact, no cuisine list or no timestamp still serialize", () => {
  const view = serializeCateringCustomerInquiry(row({ inquiry: inquiry({ customerEmail: null, customerPhone: null, cuisinePreferences: null, createdAt: null, status: null }) }));
  assert.equal(view.contactEmail, null);
  assert.equal(view.contactPhone, null);
  assert.deepEqual(view.cuisinePreferences, []);
  assert.equal(view.submittedAt, null);
  assert.equal(view.status, "pending");
  assert.equal(view.stage, "awaiting_provider");
  assert.equal(view.canWithdraw, true);
});

test("a provider with no display name falls back to username and then to a neutral label", () => {
  assert.equal(serializeCateringCustomerInquiry(row({ provider: { id: "c", displayName: null, username: "chefuser" } })).provider.displayName, "chefuser");
  assert.equal(serializeCateringCustomerInquiry(row({ provider: { id: "c", displayName: null, username: null } })).provider.displayName, "Caterer");
});

test("a booked inquiry carries its booking linkage and can no longer be withdrawn", () => {
  const view = serializeCateringCustomerInquiry(row({
    inquiry: inquiry({ status: "accepted" }),
    booking: { id: "book-1", status: "pending_confirmation", agreedPrice: "1200.00", currency: "USD", providerConfirmedAt: new Date("2027-01-03T00:00:00Z"), customerConfirmedAt: null },
  }));
  assert.equal(view.stage, "offered");
  assert.equal(view.canWithdraw, false);
  assert.deepEqual(view.booking, { id: "book-1", status: "pending_confirmation", agreedPrice: "1200.00", currency: "USD", providerConfirmedAt: "2027-01-03T00:00:00.000Z", customerConfirmedAt: null });
});

test("declined and withdrawn inquiries are historical and offer no withdrawal", () => {
  for (const [status, stage] of [["declined", "declined"], ["cancelled", "withdrawn"]] as const) {
    const view = serializeCateringCustomerInquiry(row({ inquiry: inquiry({ status }) }));
    assert.equal(view.stage, stage);
    assert.equal(view.canWithdraw, false);
  }
});
