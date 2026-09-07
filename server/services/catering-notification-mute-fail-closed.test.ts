import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_NOTIFICATION_FAILURE_ROLLS_BACK_SEND, cateringCounterpart, cateringMutePreference, shouldNotifyBookingMessage } from "./catering-booking-communication-policy";

/**
 * A notification preference that could not be read is not permission to notify.
 *
 * The counterpart's mute setting lives in their participant row, and the send path read it as
 * `counterpart?.notificationsMuted ?? false`. A transient failure of that lookup produced `undefined`, which the
 * `?? false` turned into "not muted" -- so a recipient who had explicitly switched this conversation off was
 * notified anyway, for as long as the database was unhappy. A missing participant row read the same way.
 *
 * Delivery now requires three separate things to be true, and an unanswerable read satisfies none of them: the
 * lookup returned a row, that row says `false`, and there is a counterpart to notify at all. The message itself is
 * unaffected -- it has already persisted and is readable in the workspace -- because a skipped notification is
 * recoverable and an unwanted one is not.
 *
 * There is no database harness in this suite, so the send path's wiring is asserted structurally and the decision
 * itself is asserted directly against the real policy functions.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-communication.ts"), "utf8");
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const send = route.slice(route.indexOf("const counterpartId = cateringCounterpart(booking, userId);"), route.indexOf("const names = await senderNames([result.message.senderId]);"));

test("1. a participant row that says notifications are on is notified", () => {
  assert.equal(cateringMutePreference({ notificationsMuted: false }), "enabled");
  assert.equal(shouldNotifyBookingMessage("customer-1", cateringMutePreference({ notificationsMuted: false })), true);
});

test("2. a participant row that says muted is not notified", () => {
  assert.equal(cateringMutePreference({ notificationsMuted: true }), "muted");
  assert.equal(shouldNotifyBookingMessage("customer-1", cateringMutePreference({ notificationsMuted: true })), false);
});

test("3. a lookup that threw is not notified, and the message is unaffected", () => {
  // The route's catch answers `undefined`, which is exactly "we do not know what they chose".
  const afterFailure = undefined;
  assert.equal(cateringMutePreference(afterFailure), "unknown");
  assert.equal(shouldNotifyBookingMessage("customer-1", cateringMutePreference(afterFailure)), false);
  // The send is already committed by this point and a notification never rolls it back.
  assert.equal(CATERING_NOTIFICATION_FAILURE_ROLLS_BACK_SEND, false);
  assert.equal(send.includes("await conversationParticipant(result.threadId, counterpartId).catch("), true);
  assert.equal(/catch[\s\S]*?return undefined;/.test(send), true, "a failed read must not become a value");
  assert.equal(stripComments(send).includes("throw"), false, "and must never fail the message that already persisted");
});

test("4. a thread with no participant row for the counterpart is not notified", () => {
  for (const missing of [undefined, null, {}]) {
    assert.equal(cateringMutePreference(missing as never), "unknown", String(missing));
    assert.equal(shouldNotifyBookingMessage("customer-1", cateringMutePreference(missing as never)), false);
  }
  // Nor is a column that is somehow not a boolean: only an explicit `false` is consent.
  for (const odd of [{ notificationsMuted: null }, { notificationsMuted: 0 }, { notificationsMuted: "false" }]) {
    assert.equal(cateringMutePreference(odd as never), "unknown", JSON.stringify(odd));
  }
});

test("5. the old fail-open reading is gone from the route entirely", () => {
  assert.equal(route.includes("counterpart?.notificationsMuted ?? false"), false);
  assert.equal(route.includes("?? false"), false, "no preference may be defaulted into consent");
  assert.equal(send.includes("shouldNotifyBookingMessage(counterpartId, cateringMutePreference(counterpart))"), true);
  // And there is no counterpart at all when a booking's two roles are the same account.
  assert.equal(cateringCounterpart({ providerId: "u1", customerId: "u1" }, "u1"), null);
  assert.equal(shouldNotifyBookingMessage(null, "enabled"), false);
});

test("6. a notification that fails to persist still leaves existing semantics untouched", () => {
  // Unchanged: the insert is best-effort, outside the transaction, and swallows its own failure.
  assert.equal(send.includes("await db.insert(notifications).values({"), true);
  assert.equal(send.includes(".catch(() => undefined);"), true);
  assert.equal(CATERING_NOTIFICATION_FAILURE_ROLLS_BACK_SEND, false);
});

test("7. an idempotent retry cannot produce a second notification", () => {
  // The notification block sits behind the send resolution, so a retry answered from the accepted-token lookup
  // returns before ever reaching it -- one accepted message, one notification.
  const resolved = route.indexOf("resolveCateringMessageSend");
  assert.equal(resolved !== -1 && resolved < route.indexOf("const counterpartId = cateringCounterpart(booking, userId);"), true);
  assert.equal((route.match(/type: CATERING_MESSAGE_NOTIFICATION\.type/g) ?? []).length, 1, "one notification insert in the whole route");
});

test("8. the preference is read from this booking's own thread, and nothing about it is disclosed", () => {
  // Scoped to the booking conversation's thread and the counterpart, so a generic DM thread's participant row is
  // never what decides this, and the sender learns nothing about the recipient's setting either way.
  assert.equal(send.includes("conversationParticipant(result.threadId, counterpartId)"), true);
  assert.equal(/res\.[a-z]+\([\s\S]{0,200}notificationsMuted/.test(route), false, "the preference is never serialized to anyone");
  assert.equal(/res\.[a-z]+\([\s\S]{0,200}cateringMutePreference/.test(route), false);
  // The operator log records that the read failed, never what the setting was.
  const logged = send.slice(send.indexOf("console.error"), send.indexOf("return undefined;"));
  assert.equal(logged.includes("notificationsMuted"), false);
  assert.equal(logged.includes("counterpartId"), false);
});
