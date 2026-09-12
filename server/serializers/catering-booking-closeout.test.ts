import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  serializeCloseoutChecklist,
  serializeCloseoutRecord,
  serializeCustomerCloseoutReview,
  serializeProviderCloseoutReview,
} from "./catering-booking-closeout";
import { CATERING_CLOSEOUT_ITEM_KEYS, CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS } from "@shared/catering-booking-closeout";

/**
 * The Phase 2K serializers.
 *
 * The privacy boundary this phase promises is enforced in two independent places: the route never QUERIES the
 * checklist for a customer, and these projections never emit a provider-only field. This suite is the second of
 * those, so a route that one day read a row it should not would still not be able to serialize it.
 */
const NOW = new Date("2026-09-05T10:00:00.000Z");
const EARLIER = new Date("2026-09-04T09:00:00.000Z");

const item = (patch: Record<string, unknown> = {}) => ({
  bookingId: "b1", itemKey: "equipment_return_confirmed", state: "completed",
  providerNote: "back in the van", resolvedAt: NOW, resolvedBy: "provider-1",
  createdAt: EARLIER, updatedAt: NOW, ...patch,
}) as never;

const record = (patch: Record<string, unknown> = {}) => ({
  bookingId: "b1", providerNotes: "the kitchen was tiny", closedOutAt: NOW, closedOutBy: "provider-1",
  reopenCount: 1, lastReopenedAt: EARLIER, lastReopenedBy: "provider-1", updatedBy: "provider-1",
  createdAt: EARLIER, updatedAt: NOW, ...patch,
}) as never;

/* ----------------------------------------------------------------------------------------------------------- *
 * The checklist
 * ----------------------------------------------------------------------------------------------------------- */

test("every allowlisted key is reported, including ones with no row yet", () => {
  const view = serializeCloseoutChecklist([item()]);
  assert.deepEqual(view.map((entry) => entry.key), [...CATERING_CLOSEOUT_ITEM_KEYS]);
  const untouched = view.find((entry) => entry.key === "customer_follow_up_completed")!;
  assert.equal(untouched.state, "pending");
  assert.equal(untouched.providerNote, null);
  assert.equal(untouched.resolvedAt, null);
  // Null is exactly the precondition the client sends back to create the row for the first time.
  assert.equal(untouched.updatedAt, null);
});

test("required items are labelled from the contract, never from the row", () => {
  const view = serializeCloseoutChecklist([]);
  for (const entry of view) {
    assert.equal(entry.required, CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS.includes(entry.key));
  }
});

test("a checklist item never serializes who resolved it", () => {
  const [entry] = serializeCloseoutChecklist([item()]);
  assert.equal("resolvedBy" in entry, false);
  assert.equal("bookingId" in entry, false);
  assert.equal("createdAt" in entry, false);
  assert.equal(JSON.stringify(entry).includes("provider-1"), false);
});

test("an item's label and description are fixed wording, not anything a provider typed", () => {
  const [entry] = serializeCloseoutChecklist([item({ providerNote: "<script>alert(1)</script>" })]);
  assert.equal(entry.label.includes("script"), false);
  assert.equal(entry.description.includes("script"), false);
  // The note is still returned -- to the provider who wrote it, in their own provider-only payload.
  assert.equal(entry.providerNote, "<script>alert(1)</script>");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The record projection
 * ----------------------------------------------------------------------------------------------------------- */

test("a customer's record carries no providerNotes KEY and no version KEY", () => {
  const customer = serializeCloseoutRecord(record(), "customer");
  assert.equal("providerNotes" in customer, false, "not null -- absent");
  assert.equal("updatedAt" in customer, false, "a version would track the private edits it was invented to hide");
  assert.equal(JSON.stringify(customer).includes("kitchen"), false);
});

test("a provider's record carries both, because their optimistic concurrency is built on the version", () => {
  const provider = serializeCloseoutRecord(record(), "provider");
  assert.equal(provider.providerNotes, "the kitchen was tiny");
  assert.equal(provider.updatedAt, NOW.toISOString());
});

test("closed-out facts ARE customer-visible, so their own view can explain itself", () => {
  const customer = serializeCloseoutRecord(record(), "customer");
  assert.equal(customer.closedOut, true);
  assert.equal(customer.closedOutAt, NOW.toISOString());
  assert.equal(customer.reopenCount, 1);
  assert.equal(customer.lastReopenedAt, EARLIER.toISOString());
});

test("internal attribution is never serialized, to either actor", () => {
  for (const role of ["provider", "customer"] as const) {
    const view = JSON.stringify(serializeCloseoutRecord(record(), role));
    assert.equal(view.includes("closedOutBy"), false);
    assert.equal(view.includes("lastReopenedBy"), false);
    assert.equal(view.includes("updatedBy"), false);
    assert.equal(view.includes("provider-1"), false);
    assert.equal(view.includes("bookingId"), false);
  }
});

test("a booking with no closeout record yet serializes an honest empty record for both actors", () => {
  const customer = serializeCloseoutRecord(undefined, "customer");
  assert.deepEqual(customer, { closedOut: false, closedOutAt: null, reopenCount: 0, lastReopenedAt: null });
  const provider = serializeCloseoutRecord(undefined, "provider");
  assert.equal(provider.updatedAt, null, "which is exactly the precondition a first write sends");
  assert.equal(provider.providerNotes, null);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Review projections
 * ----------------------------------------------------------------------------------------------------------- */

test("a provider is told one boolean about review follow-up and nothing else", () => {
  assert.deepEqual(serializeProviderCloseoutReview(true), { customerReviewExists: true });
  assert.deepEqual(Object.keys(serializeProviderCloseoutReview(false)), ["customerReviewExists"]);
});

test("a customer's review view reports the existing eligibility and points at the existing flow", () => {
  const view = serializeCustomerCloseoutReview({ mayReview: true, alreadyReviewed: false, providerId: "provider-1" });
  assert.equal(view.reviewPath, "/services/catering/provider/provider-1");
  assert.equal(view.mayReview, true);
  assert.equal(view.alreadyReviewed, false);
  // No rating, no body, no review id, and nothing that could create or alter eligibility.
  assert.deepEqual(Object.keys(view).sort(), ["alreadyReviewed", "mayReview", "reviewPath"]);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Structural pins
 * ----------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "catering-booking-closeout.ts"), "utf8");

test("the serializers are explicit projections, never a spread of the row", () => {
  // A column added to one of these tables later must not start reaching a customer merely because it exists.
  assert.equal(/\.\.\.row\b/.test(source), false);
  assert.equal(/\.\.\.item\b/.test(source), false);
});

test("there is no customer variant of the checklist serializer at all", () => {
  // The absence is the privacy boundary -- not a filter that could be called with the wrong argument.
  assert.equal(/function serializeCloseoutChecklist\([^)]*role/.test(source), false);
});
