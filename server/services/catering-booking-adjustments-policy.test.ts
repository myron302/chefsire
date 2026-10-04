import assert from "node:assert/strict";
import test from "node:test";
import { billingForbidsAmendment, changesBillingSensitiveFields } from "./catering-booking-amendments";

test("once billing exists a currency change is always forbidden, whatever else it carries", () => {
  assert.equal(billingForbidsAmendment(["currency"], { priceCents: 100 }, undefined), true);
  assert.equal(billingForbidsAmendment(["price_cents", "currency"], { priceCents: 100 }, 200), true);
});

test("a price change between two stated amounts is NOT forbidden: it is reconciled into the ledger on acceptance", () => {
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, 290_000), false);
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, 0), false);
  assert.equal(billingForbidsAmendment(["price_cents", "guest_count"], { priceCents: 250_000 }, 230_000), false);
});

test("clearing the price, or setting one where there was none, has no stated difference to record, so it stays forbidden", () => {
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, null), true);
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: null }, 100), true);
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, undefined), true, "an absent proposed price is not a stated one");
});

test("terms that no invoice depends on are never forbidden by billing", () => {
  for (const field of ["event_date", "guest_count", "terms_note"]) {
    assert.equal(changesBillingSensitiveFields([field]), false, field);
    assert.equal(billingForbidsAmendment([field], { priceCents: 100 }, undefined), false, field);
  }
});
