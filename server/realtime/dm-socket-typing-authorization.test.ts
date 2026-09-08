import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_THREAD_CODE } from "@shared/catering-booking-communication";

/**
 * Membership must be proven BEFORE a thread is classified as booking-linked.
 *
 * `typing` used to classify first. An authenticated non-participant who guessed a thread id therefore got two
 * distinguishable answers: the distinctive `catering_booking_thread` refusal for a booking thread, and silence for
 * an ordinary one. That difference is an oracle -- it tells an outsider which threads belong to catering bookings,
 * which is exactly what the uniform refusal on join/send/read exists to prevent. Classifying first also let a
 * non-participant broadcast a typing indicator into a room they were never in.
 *
 * The ordering is exercised behaviourally against a fake socket, mirroring the handler's control flow, and the
 * handler itself is asserted structurally, as everywhere in this suite -- there is no Socket.IO harness here.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const socketSource = fs.readFileSync(path.join(here, "dmSocket.ts"), "utf8");

function fakeSocket() {
  const emitted: { event: string; payload: unknown }[] = [];
  const broadcast: unknown[] = [];
  return {
    emitted, broadcast,
    emit: (event: string, payload: unknown) => { emitted.push({ event, payload }); },
    to: () => ({ emit: (_event: string, payload: unknown) => { broadcast.push(payload); } }),
  };
}

/** The handler's exact ordering: authorize, then classify, then act. */
async function typingHandler(socket: ReturnType<typeof fakeSocket>, opts: { isMember: boolean; isBookingLinked: boolean }): Promise<void> {
  if (!opts.isMember) {
    socket.emit("error", { error: "forbidden" });
    return;
  }
  if (opts.isBookingLinked) {
    socket.emit("error", { error: CATERING_BOOKING_THREAD_CODE, code: CATERING_BOOKING_THREAD_CODE, message: "…" });
    return;
  }
  socket.to().emit("typing", { typing: true });
}

test("1 & 2. an outsider gets the identical generic refusal for an ordinary and a booking thread", async () => {
  const ordinary = fakeSocket();
  await typingHandler(ordinary, { isMember: false, isBookingLinked: false });
  const booking = fakeSocket();
  await typingHandler(booking, { isMember: false, isBookingLinked: true });
  // Byte-identical responses: the outsider cannot tell the two threads apart.
  assert.deepEqual(ordinary.emitted, booking.emitted);
  assert.deepEqual(ordinary.emitted, [{ event: "error", payload: { error: "forbidden" } }]);
  // And neither broadcast anything into a room they are not in.
  assert.deepEqual(ordinary.broadcast, []);
  assert.deepEqual(booking.broadcast, []);
});

test("3. nothing in an outsider's response mentions catering, bookings, or the classification code", async () => {
  const socket = fakeSocket();
  await typingHandler(socket, { isMember: false, isBookingLinked: true });
  const serialized = JSON.stringify(socket.emitted);
  for (const leak of [CATERING_BOOKING_THREAD_CODE, "catering", "booking", "workspace"]) {
    assert.equal(serialized.toLowerCase().includes(leak.toLowerCase()), false, leak);
  }
});

test("4. a genuine participant on a booking thread still gets the booking-specific refusal", async () => {
  const socket = fakeSocket();
  await typingHandler(socket, { isMember: true, isBookingLinked: true });
  assert.equal((socket.emitted[0].payload as { code: string }).code, CATERING_BOOKING_THREAD_CODE);
  // The generic behaviour is still refused: no typing indicator reaches the booking room.
  assert.deepEqual(socket.broadcast, []);
});

test("5. a genuine participant on an ordinary thread types normally", async () => {
  const socket = fakeSocket();
  await typingHandler(socket, { isMember: true, isBookingLinked: false });
  assert.deepEqual(socket.emitted, []);
  assert.deepEqual(socket.broadcast, [{ typing: true }]);
});

/** Each listener as event name plus body, recognising both registration shapes used in this module. */
const REGISTRATION = /(?:socket\.on\(\s*"([a-z]+)"|onAsyncSocketEvent(?:<[^>]*>)?\(\s*socket,\s*"([a-z]+)")/g;
function socketHandlers(): { event: string; body: string }[] {
  const starts: { event: string; start: number }[] = [];
  for (const match of socketSource.matchAll(REGISTRATION)) starts.push({ event: match[1] ?? match[2], start: match.index! });
  return starts.map((entry, index) => ({ event: entry.event, body: socketSource.slice(entry.start, starts[index + 1]?.start) }));
}

test("6. EVERY handler that classifies a thread authorizes first -- typing included", () => {
  const handlers = socketHandlers();
  // The audit is over every listener, not a hardcoded list, so a new one cannot quietly skip this rule.
  let classifying = 0;
  for (const handler of handlers) {
    const classifyAt = handler.body.indexOf("refuseBookingLinkedThread(socket, threadId)");
    if (classifyAt === -1) continue;
    classifying += 1;
    const membershipAt = handler.body.indexOf("if (member.length === 0) {");
    assert.notEqual(membershipAt, -1, `socket "${handler.event}" classifies without any membership check`);
    assert.equal(membershipAt < classifyAt, true, `socket "${handler.event}" classifies before authorizing`);
  }
  assert.equal(classifying, 4, "join, send, read and typing all classify");
  // `leave` and `disconnect` only tear down local room membership and write nothing, so they classify nothing.
  for (const event of ["leave", "disconnect"]) {
    assert.equal(socketHandlers().find((handler) => handler.event === event)?.body.includes("refuseBookingLinkedThread"), false, event);
  }
});

test("the typing handler now looks up membership exactly as the other handlers do", () => {
  const typing = socketHandlers().find((handler) => handler.event === "typing")!;
  assert.equal(typing.body.includes("eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)"), true);
  assert.equal(typing.body.includes(`socket.emit("error", { error: "forbidden" });`), true);
  // The refusal an outsider receives is the same string the other handlers use, not a typing-specific one.
  for (const event of ["join", "send", "read"]) {
    const handler = socketHandlers().find((entry) => entry.event === event)!;
    assert.equal(handler.body.includes(`socket.emit("error", { error: "forbidden" });`), true, event);
  }
  // And the broadcast happens only after both checks.
  assert.equal(typing.body.indexOf("refuseBookingLinkedThread") < typing.body.indexOf(`socket.to(threadId).emit("typing"`), true);
});

test("the identity a handler authorizes against is the connection's, never the event payload", () => {
  const typing = socketHandlers().find((handler) => handler.event === "typing")!;
  // `userId` is resolved once per connection; the payload carries only threadId and the typing flag.
  assert.equal(typing.body.includes("eq(dmParticipants.userId, userId)"), true);
  assert.equal(/\{\s*threadId,\s*typing\s*\}/.test(typing.body), true);
  assert.equal(typing.body.includes("payload.userId"), false);
});

test("the async error boundary and its bounded error shape are unchanged", () => {
  assert.equal(socketSource.includes(`onAsyncSocketEvent<{ threadId: string; typing: boolean }>(socket, "typing", "typing failed"`), true);
  const boundary = socketSource.slice(socketSource.indexOf("function onAsyncSocketEvent"), socketSource.indexOf("function userIdFromSocket"));
  assert.equal(boundary.includes(".catch(() =>"), true);
  assert.equal(boundary.includes("error.message"), false);
  // The added database lookup is inside that boundary, so its failure cannot become an unhandled rejection.
  assert.equal(/socket\.on\(\s*"typing"/.test(socketSource), false, "typing must not be a raw async listener");
});
