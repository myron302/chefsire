import assert from "node:assert/strict";
import test from "node:test";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { cateringBookingMessagePageSchema, cateringBookingMessageReadSchema, cateringBookingMessageSendSchema } from "@shared/catering-booking-communication";
import { cateringBookingFilePageSchema, cateringFileUploadFieldsSchema, mayDeleteCateringFile, mayReadCateringFile } from "@shared/catering-booking-files";
import { cateringConversationParticipants, cateringCounterpart, conversationMembershipMatchesBooking, resolveCateringMessageSend, resolveCateringReadMarker } from "./catering-booking-communication-policy";
import { cateringFileStorageKey, cateringFileVisibleTo, resolveCateringUpload } from "./catering-booking-file-policy";

/**
 * Phase 2I authorization regressions. Every guarantee here is about what the server refuses to derive from a
 * request: participants, threads, files and storage keys all come from persisted booking rows, never from a body.
 */

const BOOKING = { providerId: "provider", customerId: "customer" };
const UUID = "11111111-1111-4111-8111-111111111111";

test("both persisted booking participants are recognised, and nobody else is", () => {
  assert.equal(cateringWorkspaceRole(BOOKING, "provider"), "provider");
  assert.equal(cateringWorkspaceRole(BOOKING, "customer"), "customer");
  // An unrelated authenticated user, and an unauthenticated request that reaches here with no id, both resolve to
  // no role at all -- which is what makes the routes answer them the same not-found a guessed booking id gets.
  for (const stranger of ["stranger", "", "anonymous", "undefined", "null"]) assert.equal(cateringWorkspaceRole(BOOKING, stranger), null, stranger);
});
test("a guessed booking id grants nothing, because the role is derived from the booking that was actually loaded", () => {
  // The route loads a booking only when the actor is one of its persisted participants, so a booking a stranger
  // guessed simply never resolves. Modelled here as the empty booking the route would have failed to load.
  assert.equal(cateringWorkspaceRole({ providerId: "other-provider", customerId: "other-customer" }, "provider"), null);
});
test("participants and the notification counterpart derive only from persisted booking columns", () => {
  assert.deepEqual([...cateringConversationParticipants(BOOKING)], ["provider", "customer"]);
  assert.equal(cateringCounterpart(BOOKING, "stranger"), null);
});
test("a guessed thread does not grant booking access, because a drifted membership refuses the send", () => {
  // A thread whose members are not exactly this booking's participants is not this booking's conversation, so the
  // send stops rather than delivering into it -- a thread id is never booking authority.
  assert.equal(conversationMembershipMatchesBooking(["stranger", "other"], BOOKING), false);
  assert.equal(resolveCateringMessageSend({ active: true, memberIds: ["stranger", "other"] }, BOOKING).kind, "membership");
});
test("a message id from another thread never becomes this booking's read marker", () => {
  assert.deepEqual(resolveCateringReadMarker(UUID, { id: "own" }, false), { kind: "foreign_message" });
  assert.deepEqual(resolveCateringReadMarker(UUID, { id: "own" }, true), { kind: "mark", messageId: UUID });
});
test("every request body that names an owner, actor, thread or storage detail is rejected", () => {
  const forged = ["senderId", "providerId", "customerId", "ownerId", "actorId", "participantId", "uploaderId", "threadId", "bookingId", "storageKey", "visibilityOwner", "uploadedBy"];
  for (const field of forged) {
    assert.equal(cateringBookingMessageSendSchema.safeParse({ text: "hi", [field]: "forged" }).success, false, `send/${field}`);
    assert.equal(cateringBookingMessageReadSchema.safeParse({ [field]: "forged" }).success, false, `read/${field}`);
    assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "shared", [field]: "forged" }).success, false, `upload/${field}`);
    assert.equal(cateringBookingMessagePageSchema.safeParse({ [field]: "forged" }).success, false, `messagePage/${field}`);
    assert.equal(cateringBookingFilePageSchema.safeParse({ [field]: "forged" }).success, false, `filePage/${field}`);
  }
});
test("a customer cannot request provider visibility, in any casing or spelling", () => {
  for (const visibility of ["provider", "PROVIDER", "Provider", " provider"]) {
    assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility }).success, visibility === "provider", visibility);
  }
  assert.equal(resolveCateringUpload({ role: "customer", visibility: "provider", originalName: "menu.pdf", declaredMimeType: "application/pdf", byteSize: 10 }).kind, "forbidden_visibility");
});
test("a guessed file id grants no download, because visibility is re-derived per request", () => {
  const providerPrivate = { visibility: "provider", deletedAt: null };
  // For a customer, a provider-private file and a file that does not exist are literally the same answer.
  assert.equal(cateringFileVisibleTo(providerPrivate, "customer"), false);
  assert.equal(cateringFileVisibleTo(undefined, "customer"), false);
  assert.equal(mayReadCateringFile("customer", "provider"), false);
});
test("a customer observes no trace of a provider-private file through any read path", () => {
  const providerPrivate = { visibility: "provider", deletedAt: null };
  // List, download and delete all consult the same predicate, so none of them can disagree and leak existence.
  assert.equal(cateringFileVisibleTo(providerPrivate, "customer"), false);
  assert.equal(mayDeleteCateringFile("customer", { uploadedBy: "provider", deletedAt: null }, "confirmed"), false);
});
test("a storage key can never be steered by a request, whatever the filename claims", () => {
  const key = cateringFileStorageKey(UUID, "22222222-2222-4222-8222-222222222222", "pdf");
  assert.equal(key, `catering-bookings/${UUID}/22222222-2222-4222-8222-222222222222/22222222-2222-4222-8222-222222222222.pdf`);
  assert.equal(key.includes(".."), false);
  // A non-identifier in either position is refused rather than concatenated into a path.
  for (const bad of ["../../etc", "..", "", "a/b", "11111111-1111-4111-8111-111111111111/x"]) {
    assert.throws(() => cateringFileStorageKey(bad, UUID, "pdf"), bad);
    assert.throws(() => cateringFileStorageKey(UUID, bad, "pdf"), bad);
  }
});
