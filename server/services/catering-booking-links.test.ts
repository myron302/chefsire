import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_CUSTOMER_BOOKINGS_URL, CATERING_PROVIDER_BOOKINGS_URL } from "./catering-booking-links";

test("booking notifications target mounted provider and customer booking surfaces", () => {
  assert.equal(CATERING_PROVIDER_BOOKINGS_URL, "/services/catering/provider#bookings");
  assert.equal(CATERING_CUSTOMER_BOOKINGS_URL, "/services/catering#my-bookings");
});
