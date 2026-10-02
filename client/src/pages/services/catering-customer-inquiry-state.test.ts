import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_CUSTOMER_INQUIRY_STAGES, type CateringCustomerInquiryView } from "@shared/catering-inquiries";
import { cateringBookingWorkspacePath } from "@shared/catering-booking-operations";
import {
  CATERING_CUSTOMER_INQUIRY_PAGE_SIZE, cateringCustomerInquiriesKey, cateringInquiryWithdrawalInvalidationKeys,
  customerInquiryActions, customerInquiryPageLabel, customerInquiryPresentation, settleWithdrawalDialog,
} from "./catering-customer-inquiry-state";
import { cateringBookingMutationInvalidationKeys, cateringProviderInquiryKey } from "./catering-inquiry-booking-state";

const view = (overrides: Partial<CateringCustomerInquiryView> = {}): Pick<CateringCustomerInquiryView, "canWithdraw" | "booking"> => ({ canWithdraw: true, booking: null, ...overrides });
const booking = { id: "booking-9", status: "pending_confirmation", agreedPrice: "100.00", currency: "USD", providerConfirmedAt: null, customerConfirmedAt: null } as const;

test("query keys are scoped to the signed-in customer and cannot collide with the provider's inquiry cache", () => {
  assert.deepEqual(cateringCustomerInquiriesKey("customer-1"), ["catering", "inquiries", "customer", "customer-1"]);
  assert.notDeepEqual(cateringCustomerInquiriesKey("a"), cateringCustomerInquiriesKey("b"));
  const providerKey = cateringProviderInquiryKey("customer");
  assert.notEqual(providerKey.join("/"), cateringCustomerInquiriesKey("customer").join("/"));
  assert.equal(CATERING_CUSTOMER_INQUIRY_PAGE_SIZE <= 50, true);
});

test("a withdrawal invalidates only this customer's list, the affected provider's inquiries and dashboard", () => {
  const keys = cateringInquiryWithdrawalInvalidationKeys({ customerId: "customer-1", providerId: "provider-1" });
  assert.deepEqual(keys.map((key) => key.join("/")), ["catering/inquiries/customer/customer-1", "catering/inquiries/provider-1", "catering/dashboard/provider-1"]);
  for (const key of keys) assert.ok(key.length >= 3, "no broad prefix is ever cleared");
});

test("a booking action on the customer surface also refreshes that customer's request list", () => {
  for (const action of ["customer-confirm", "cancel"] as const) {
    const keys = cateringBookingMutationInvalidationKeys({ surfaceUserId: "customer-1", providerId: "provider-1", action }).map((key) => key.join("/"));
    assert.ok(keys.includes("catering/inquiries/customer/customer-1"), action);
    assert.ok(keys.includes("catering/bookings/customer-1"), action);
    assert.ok(!keys.includes("catering/inquiries/customer/provider-1"), action);
  }
});

test("every stage has a readable label and description, and terminal stages say they are closed history", () => {
  for (const stage of CATERING_CUSTOMER_INQUIRY_STAGES) {
    const presentation = customerInquiryPresentation(stage);
    assert.ok(presentation.label.length > 3, stage);
    assert.ok(presentation.description.endsWith("."), stage);
  }
  for (const stage of ["declined", "withdrawn", "completed", "booking_cancelled"] as const) assert.equal(customerInquiryPresentation(stage).terminal, true, stage);
  for (const stage of ["awaiting_provider", "accepted_awaiting_offer", "offered", "booked"] as const) assert.equal(customerInquiryPresentation(stage).terminal, false, stage);
});

test("copy never claims a booking, a payment or a confirmation that does not exist", () => {
  assert.doesNotMatch(customerInquiryPresentation("awaiting_provider").description + customerInquiryPresentation("accepted_awaiting_offer").label, /confirmed|paid|booked\b/i);
  assert.match(customerInquiryPresentation("accepted_awaiting_offer").description, /Nothing is booked/);
  assert.match(customerInquiryPresentation("offered").description, /Nothing is booked until you confirm/);
  assert.doesNotMatch(Object.values(CATERING_CUSTOMER_INQUIRY_STAGES).map((stage) => customerInquiryPresentation(stage).description).join(" "), /payment|deposit|invoice|refund/i);
});

test("only the stages that are managed as bookings point the customer to the booking", () => {
  for (const stage of ["offered", "booked", "completed", "booking_cancelled"] as const) assert.equal(customerInquiryPresentation(stage).managedAsBooking, true, stage);
  for (const stage of ["awaiting_provider", "accepted_awaiting_offer", "declined", "withdrawn"] as const) assert.equal(customerInquiryPresentation(stage).managedAsBooking, false, stage);
});

test("withdraw is offered only where the server allowed it and no booking exists", () => {
  assert.deepEqual(customerInquiryActions(view()), { withdraw: true, viewBookingId: null });
  assert.deepEqual(customerInquiryActions(view({ canWithdraw: false })), { withdraw: false, viewBookingId: null });
  assert.deepEqual(customerInquiryActions(view({ canWithdraw: true, booking })), { withdraw: false, viewBookingId: "booking-9" }, "a booked inquiry can never offer withdrawal, even if a stale flag said so");
});

test("terminal inquiries expose no action at all", () => {
  for (const terminal of [view({ canWithdraw: false })]) assert.deepEqual(customerInquiryActions(terminal), { withdraw: false, viewBookingId: null });
});

test("a booked inquiry deep-links to the existing customer booking workspace", () => {
  const { viewBookingId } = customerInquiryActions(view({ canWithdraw: false, booking }));
  assert.equal(cateringBookingWorkspacePath("customer", viewBookingId as string), "/services/catering/bookings/booking-9");
});

test("an accepted withdrawal closes only the dialog it was submitted for", () => {
  const open = { customerId: "customer-1", inquiryId: "inq-1", providerId: "p", label: "x" };
  assert.equal(settleWithdrawalDialog(open, { customerId: "customer-1", inquiryId: "inq-1" }), null);
  assert.equal(settleWithdrawalDialog(open, { customerId: "customer-1", inquiryId: "inq-2" }), open, "another request's response leaves this dialog open");
  assert.equal(settleWithdrawalDialog(open, { customerId: "customer-2", inquiryId: "inq-1" }), open, "another account's response leaves this dialog open");
  assert.equal(settleWithdrawalDialog(null, { customerId: "customer-1", inquiryId: "inq-1" }), null);
});

test("the page label never reads Page 1 of 0", () => {
  assert.equal(customerInquiryPageLabel(1, 0), "Page 1 of 1");
  assert.equal(customerInquiryPageLabel(2, 5), "Page 2 of 5");
});
