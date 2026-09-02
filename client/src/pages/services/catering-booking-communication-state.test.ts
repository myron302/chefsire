import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_MESSAGE_MAX_LENGTH } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_COMMUNICATION_READ_ONLY_BANNER, EMPTY_CATERING_COMPOSER, cateringMessageIsSendable, combineCateringMessagePages, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, formatCateringMessageTimestamp, hydrateCateringComposer, isCateringCommunicationReadOnly, latestCateringMessageId, maySendCateringMessage, nextCateringMessageCursor, retryCateringMessageSend, shouldMarkCateringConversationRead, startCateringMessageSend } from "./catering-booking-communication-state";

const TOKEN = "11111111-1111-4111-8111-111111111111";
const OTHER_TOKEN = "22222222-2222-4222-8222-222222222222";
const composer = (text: string) => editCateringComposer(hydrateCateringComposer(EMPTY_CATERING_COMPOSER, "actor:booking"), text);
const message = (id: string) => ({ id, senderId: "provider", senderRole: "provider" as const, senderName: "Ada", text: id, createdAt: "2026-09-01T12:00:00.000Z", mine: true });

test("the composer is reset when the actor or booking changes, and kept otherwise", () => {
  const typed = composer("half typed");
  assert.equal(hydrateCateringComposer(typed, "actor:booking"), typed);
  assert.deepEqual(hydrateCateringComposer(typed, "other:booking"), { identity: "other:booking", text: "", pending: null });
});
test("a message must survive trimming and stay within the server's own bound", () => {
  assert.equal(cateringMessageIsSendable("hello"), true);
  for (const text of ["", "   ", "\n\t"]) assert.equal(cateringMessageIsSendable(text), false);
  assert.equal(cateringMessageIsSendable("a".repeat(CATERING_MESSAGE_MAX_LENGTH)), true);
  assert.equal(cateringMessageIsSendable("a".repeat(CATERING_MESSAGE_MAX_LENGTH + 1)), false);
});
test("a read-only booking and an empty composer both refuse to send", () => {
  assert.equal(maySendCateringMessage(composer("hi"), true), true);
  assert.equal(maySendCateringMessage(composer("hi"), false), false);
  assert.equal(maySendCateringMessage(composer("   "), true), false);
  assert.equal(maySendCateringMessage(composer("hi"), true, true), false);
});
test("a second press while a send is in flight is refused, which is what a double tap hits", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  assert.equal(maySendCateringMessage(started.next, true), false);
  // And starting another send from that state is refused outright rather than producing a second request.
  assert.equal(startCateringMessageSend(started.next, OTHER_TOKEN), null);
});
test("a send carries the trimmed text and its own retry token", () => {
  const started = startCateringMessageSend(composer("  hello  "), TOKEN)!;
  assert.deepEqual(started.payload, { text: "hello", clientRequestId: TOKEN });
  assert.deepEqual(started.next.pending, { clientRequestId: TOKEN, text: "hello", status: "sending", error: null });
  // The text stays in the composer until the server accepts it, so a failure never loses it.
  assert.equal(started.next.text, "  hello  ");
});
test("only the send actually in flight clears the composer", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  assert.deepEqual(completeCateringMessageSend(started.next, TOKEN), { identity: "actor:booking", text: "", pending: null });
  // A response for a send that is no longer the current one changes nothing.
  assert.equal(completeCateringMessageSend(started.next, OTHER_TOKEN), started.next);
});
test("a normal successful send clears a composer that still holds the submitted draft", () => {
  // Surrounding whitespace still counts as the same draft, because that is what was actually submitted.
  const started = startCateringMessageSend(composer("  hello  "), TOKEN)!;
  assert.equal(completeCateringMessageSend(started.next, TOKEN).text, "");
  assert.equal(completeCateringMessageSend(started.next, TOKEN).pending, null);
});
test("a send that succeeds while the participant has typed something new keeps the newer text", () => {
  const started = startCateringMessageSend(composer("hello"), TOKEN)!;
  const edited = editCateringComposer(started.next, "New draft");
  const done = completeCateringMessageSend(edited, TOKEN);
  assert.equal(done.text, "New draft");
  // The attempt is finished either way, so the composer is free to send the newer draft next.
  assert.equal(done.pending, null);
});
test("editing the composer after a failure never mutates the failed attempt's text", () => {
  const failed = failCateringMessageSend(startCateringMessageSend(composer("Original message"), TOKEN)!.next, TOKEN, "Network error");
  const edited = editCateringComposer(failed, "New draft");
  // Two separate values: the live draft moved on, the attempt kept exactly what it was started with.
  assert.equal(edited.text, "New draft");
  assert.equal(edited.pending?.text, "Original message");
  assert.equal(edited.pending?.status, "failed");
});
test("a successful retry sends the original text and does not destroy the newer composer edits", () => {
  const failed = failCateringMessageSend(startCateringMessageSend(composer("Original message"), TOKEN)!.next, TOKEN, "Network error");
  const edited = editCateringComposer(failed, "New draft");
  const retried = retryCateringMessageSend(edited)!;
  // The retry carries the original attempt, token and all -- not what is currently typed.
  assert.deepEqual(retried.payload, { text: "Original message", clientRequestId: TOKEN });
  assert.equal(retried.next.text, "New draft");
  // And when it succeeds, "New draft" survives and can be sent separately afterwards.
  const done = completeCateringMessageSend(retried.next, TOKEN);
  assert.equal(done.text, "New draft");
  assert.equal(done.pending, null);
  assert.equal(maySendCateringMessage(done, true), true);
});
test("a send that succeeds after the participant cleared the box does not resurrect the submitted text", () => {
  const started = startCateringMessageSend(composer("hello"), TOKEN)!;
  const cleared = editCateringComposer(started.next, "");
  assert.equal(completeCateringMessageSend(cleared, TOKEN).text, "");
});
test("a retry reuses the failed send's own token, which is what makes it idempotent on the server", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  const failed = failCateringMessageSend(started.next, TOKEN, "Network error");
  assert.deepEqual(failed.pending, { clientRequestId: TOKEN, text: "hi", status: "failed", error: "Network error" });
  const retried = retryCateringMessageSend(failed)!;
  assert.equal(retried.payload.clientRequestId, TOKEN);
  assert.equal(retried.payload.text, "hi");
  assert.equal(retried.next.pending?.status, "sending");
  assert.equal(retried.next.pending?.error, null);
});
test("a stale failure never marks a newer send as failed, and a send in flight cannot be retried", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  assert.equal(failCateringMessageSend(started.next, OTHER_TOKEN, "Network error"), started.next);
  assert.equal(retryCateringMessageSend(started.next), null);
  assert.equal(retryCateringMessageSend(EMPTY_CATERING_COMPOSER), null);
});
test("abandoning a failed send returns its text rather than throwing it away", () => {
  const failed = failCateringMessageSend(startCateringMessageSend(composer("hi"), TOKEN)!.next, TOKEN, "Network error");
  const discarded = discardCateringMessageSend({ ...failed, text: "" });
  assert.equal(discarded.text, "hi");
  assert.equal(discarded.pending, null);
  // A composer the participant has since typed into keeps what they typed instead.
  assert.equal(discardCateringMessageSend({ ...failed, text: "something else" }).text, "something else");
});
test("pages flatten into one chronological thread with no message shown twice", () => {
  const newest = { messages: [message("c"), message("d")], nextCursor: "c", editable: true };
  const older = { messages: [message("a"), message("b")], nextCursor: null, editable: true };
  assert.deepEqual(combineCateringMessagePages([newest, older]).map((m) => m.id), ["a", "b", "c", "d"]);
  // An overlapping refetch, or a send landing while an older page loads, still shows each message once.
  const overlapping = { messages: [message("b"), message("c")], nextCursor: null, editable: true };
  assert.deepEqual(combineCateringMessagePages([newest, overlapping]).map((m) => m.id), ["b", "c", "d"]);
  assert.deepEqual(combineCateringMessagePages([]), []);
});
test("the older-page boundary stops at the beginning of the conversation", () => {
  assert.equal(nextCateringMessageCursor({ nextCursor: "abc" }), "abc");
  assert.equal(nextCateringMessageCursor({ nextCursor: null }), undefined);
  assert.equal(nextCateringMessageCursor(undefined), undefined);
});
test("the read marker moves to the newest message shown, and only when there is something to mark", () => {
  assert.equal(latestCateringMessageId([message("a"), message("b")]), "b");
  assert.equal(latestCateringMessageId([]), null);
  assert.equal(shouldMarkCateringConversationRead("b", null, 2), true);
  // Nothing unread, nothing new, or an empty conversation all skip the request: looking does not write.
  assert.equal(shouldMarkCateringConversationRead("b", "b", 2), false);
  assert.equal(shouldMarkCateringConversationRead("b", null, 0), false);
  assert.equal(shouldMarkCateringConversationRead(null, null, 3), false);
});
test("a booking that closed mid-composition is classified so the section can refetch", () => {
  assert.equal(isCateringCommunicationReadOnly({ code: CATERING_WORKSPACE_READ_ONLY_CODE }), true);
  assert.equal(isCateringCommunicationReadOnly({ code: "something_else" }), false);
  assert.equal(isCateringCommunicationReadOnly(new Error("boom")), false);
  assert.equal(isCateringCommunicationReadOnly(null), false);
  assert.equal(CATERING_COMMUNICATION_READ_ONLY_BANNER.includes("readable"), true);
});
test("a message timestamp renders in the reader's locale and never throws on bad input", () => {
  assert.equal(formatCateringMessageTimestamp("not-a-date"), "");
  assert.equal(formatCateringMessageTimestamp("2026-09-01T12:00:00.000Z").length > 0, true);
});
