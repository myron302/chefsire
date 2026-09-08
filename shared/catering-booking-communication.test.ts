import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_BOOKING_THREAD_CODE, CATERING_COMMUNICATION_SECTION, CATERING_FILES_SECTION, CATERING_MESSAGE_MAX_LENGTH, CATERING_MESSAGE_NOTIFICATION, CATERING_MESSAGE_PAGE_DEFAULT, CATERING_MESSAGE_PAGE_MAXIMUM, CATERING_UNREAD_COUNT_CEILING, cateringBookingMessagePageSchema, cateringBookingMessageReadSchema, cateringBookingMessageSendSchema, cateringBookingMessagesKey, cateringBookingSectionPath, mayPostCateringBookingMessage, mayReadCateringBookingMessages } from "./catering-booking-communication";

const UUID = "11111111-1111-4111-8111-111111111111";
const OTHER_UUID = "22222222-2222-4222-8222-222222222222";

test("a message send carries text and an optional retry token and nothing else", () => {
  assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "Loading dock is on Elm" }).success, true);
  assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "Hello", clientRequestId: UUID }).success, true);
});
test("every request-supplied ownership or routing identifier is rejected by the send schema", () => {
  for (const field of ["senderId", "threadId", "bookingId", "participantId", "providerId", "customerId", "actorId", "ownerId", "uploaderId"]) {
    assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "Hello", [field]: "forged" }).success, false, field);
  }
});
test("message text is trimmed, must survive the trim, and is bounded", () => {
  assert.equal(cateringBookingMessageSendSchema.parse({ text: "  spaced  " }).text, "spaced");
  for (const text of ["", "   ", "\n\t "]) assert.equal(cateringBookingMessageSendSchema.safeParse({ text }).success, false);
  assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "a".repeat(CATERING_MESSAGE_MAX_LENGTH) }).success, true);
  assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "a".repeat(CATERING_MESSAGE_MAX_LENGTH + 1) }).success, false);
});
test("a retry token must be a real identifier, so a malformed one is refused rather than treated as a retry", () => {
  assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "Hello", clientRequestId: "not-a-uuid" }).success, false);
  assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "Hello", clientRequestId: "" }).success, false);
});
test("message pagination is bounded and keyset-based", () => {
  assert.deepEqual(cateringBookingMessagePageSchema.parse({}), { limit: CATERING_MESSAGE_PAGE_DEFAULT });
  assert.equal(CATERING_MESSAGE_PAGE_DEFAULT, 30);
  assert.equal(CATERING_MESSAGE_PAGE_MAXIMUM, 50);
  assert.equal(cateringBookingMessagePageSchema.safeParse({ limit: CATERING_MESSAGE_PAGE_MAXIMUM }).success, true);
  assert.equal(cateringBookingMessagePageSchema.safeParse({ limit: CATERING_MESSAGE_PAGE_MAXIMUM + 1 }).success, false);
  assert.equal(cateringBookingMessagePageSchema.safeParse({ limit: 0 }).success, false);
  assert.equal(cateringBookingMessagePageSchema.safeParse({ cursor: UUID }).success, true);
  // A page never accepts an offset, a timestamp, or a thread: the cursor is the only boundary.
  for (const field of ["page", "offset", "before", "createdAt", "threadId"]) assert.equal(cateringBookingMessagePageSchema.safeParse({ [field]: "1" }).success, false, field);
});
test("read state names at most a message, never a thread or a participant", () => {
  assert.deepEqual(cateringBookingMessageReadSchema.parse({}), {});
  assert.equal(cateringBookingMessageReadSchema.safeParse({ lastReadMessageId: UUID }).success, true);
  for (const field of ["threadId", "participantId", "userId", "lastReadAt", "unreadCount"]) assert.equal(cateringBookingMessageReadSchema.safeParse({ [field]: UUID }).success, false, field);
});
test("sending closes exactly when the workspace closes, and reading never closes", () => {
  assert.equal(mayPostCateringBookingMessage("pending_confirmation"), true);
  assert.equal(mayPostCateringBookingMessage("confirmed"), true);
  assert.equal(mayPostCateringBookingMessage("cancelled"), false);
  assert.equal(mayPostCateringBookingMessage("completed"), false);
  assert.equal(mayReadCateringBookingMessages(), true);
});
test("notification copy is neutral and carries no message content", () => {
  assert.equal(CATERING_MESSAGE_NOTIFICATION.title, "New catering booking message");
  assert.equal(CATERING_MESSAGE_NOTIFICATION.message.includes("Loading dock"), false);
  for (const value of Object.values(CATERING_MESSAGE_NOTIFICATION)) assert.equal(typeof value, "string");
});
test("notifications deep-link to the booking workspace section, never to the generic inbox", () => {
  assert.equal(cateringBookingSectionPath("provider", "abc", CATERING_COMMUNICATION_SECTION), "/services/catering/provider/bookings/abc#communication");
  assert.equal(cateringBookingSectionPath("customer", "abc", CATERING_COMMUNICATION_SECTION), "/services/catering/bookings/abc#communication");
  assert.equal(cateringBookingSectionPath("customer", "abc", CATERING_FILES_SECTION), "/services/catering/bookings/abc#files");
  for (const role of ["provider", "customer"] as const) assert.equal(cateringBookingSectionPath(role, "abc", CATERING_FILES_SECTION).startsWith("/messages"), false);
});
test("message cache keys are actor and booking scoped", () => {
  assert.notDeepEqual(cateringBookingMessagesKey("provider", "booking"), cateringBookingMessagesKey("customer", "booking"));
  assert.notDeepEqual(cateringBookingMessagesKey("provider", "one"), cateringBookingMessagesKey("provider", "two"));
  assert.deepEqual(cateringBookingMessagesKey("provider", "one"), ["catering", "booking-messages", "provider", "one"]);
});
test("the generic-DM refusal carries a stable distinct code the client can route on", () => {
  assert.equal(CATERING_BOOKING_THREAD_CODE, "catering_booking_thread");
  assert.equal(CATERING_UNREAD_COUNT_CEILING, 99);
  assert.notEqual(UUID, OTHER_UUID);
});
