import assert from "node:assert/strict";
import test from "node:test";
import { serializeBookingMessage, type SerializableBookingMessage } from "./catering-booking-message";

const NAMES = new Map([["provider", "Chef Ada"], ["customer", "Sam Rivera"]]);
const base: SerializableBookingMessage = { id: "m1", senderId: "provider", body: "Arriving at 15:00", createdAt: new Date("2026-09-01T12:00:00.000Z") };
const context = (actorId: string) => ({ providerId: "provider", customerId: "customer", actorId, names: NAMES });

test("a serialized message carries no thread identity, because a thread is never booking authority", () => {
  const keys = Object.keys(serializeBookingMessage(base, context("provider")));
  for (const forbidden of ["threadId", "thread_id", "bookingId", "attachments"]) assert.equal(keys.includes(forbidden), false, forbidden);
});
test("a message serializes its sender, role, text and timestamp", () => {
  assert.deepEqual(serializeBookingMessage(base, context("provider")), {
    id: "m1", senderId: "provider", senderRole: "provider", senderName: "Chef Ada",
    text: "Arriving at 15:00", createdAt: "2026-09-01T12:00:00.000Z", mine: true,
  });
});
test("the sender role derives from the persisted booking participants", () => {
  assert.equal(serializeBookingMessage({ ...base, senderId: "customer" }, context("provider")).senderRole, "customer");
  assert.equal(serializeBookingMessage({ ...base, senderId: "customer" }, context("customer")).mine, true);
  assert.equal(serializeBookingMessage(base, context("customer")).mine, false);
});
test("a sender with no display name serializes as null rather than leaking an identifier as a name", () => {
  assert.equal(serializeBookingMessage(base, { providerId: "provider", customerId: "customer", actorId: "provider", names: new Map() }).senderName, null);
});
