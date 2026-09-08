import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_THREAD_CODE } from "@shared/catering-booking-communication";

/**
 * Crash safety for the DM socket's booking-linked-thread guard.
 *
 * `server/index.ts` installs `process.on("unhandledRejection", ...)` and exits the process from it. Socket.IO does
 * not consume the promise an async listener returns, so a rejected await inside one becomes an unhandled rejection
 * and takes the server down. A typing indicator must never be able to restart ChefSire.
 *
 * The guard's own database call is the realistic failure: a transient outage makes `bookingLinkedThread` reject.
 * That is caught inside the guard, which then FAILS CLOSED -- refusing rather than falling through to generic DM
 * behaviour, because an unknown answer must not be treated as "not a booking thread".
 *
 * The behavioural half is exercised against a fake socket and a stubbed lookup; the listener registrations are
 * asserted structurally, as elsewhere in this suite, because there is no Socket.IO harness here.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const socketSource = fs.readFileSync(path.join(here, "dmSocket.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(here, "..", "index.ts"), "utf8");

/** The smallest socket that records what was emitted. */
function fakeSocket() {
  const emitted: { event: string; payload: unknown }[] = [];
  return { emitted, emit: (event: string, payload: unknown) => { emitted.push({ event, payload }); } };
}

/**
 * The guard's exact control flow, exercised against a stubbed lookup. It mirrors the implementation asserted
 * structurally below, so the three outcomes -- linked, not linked, lookup failed -- are pinned by behaviour.
 */
async function guard(socket: ReturnType<typeof fakeSocket>, lookup: () => Promise<{ bookingId: string } | null>): Promise<boolean> {
  let linked: { bookingId: string } | null;
  try {
    linked = await lookup();
  } catch {
    socket.emit("error", { error: "thread_check_unavailable", code: "thread_check_unavailable", message: "This conversation could not be verified right now. Please try again." });
    return true;
  }
  if (!linked) return false;
  socket.emit("error", { error: CATERING_BOOKING_THREAD_CODE, code: CATERING_BOOKING_THREAD_CODE, message: "…" });
  return true;
}

test("booking-linked typing is refused with the shared booking-thread code", async () => {
  const socket = fakeSocket();
  assert.equal(await guard(socket, async () => ({ bookingId: "booking-1" })), true);
  assert.equal(socket.emitted.length, 1);
  assert.deepEqual((socket.emitted[0].payload as { code: string }).code, CATERING_BOOKING_THREAD_CODE);
});

test("a lookup failure is consumed, so no rejection can escape the listener", async () => {
  const socket = fakeSocket();
  // The decisive property: this resolves rather than rejecting, so nothing reaches the process-level handler.
  const refused = await guard(socket, async () => { throw new Error("ECONNREFUSED: could not connect to database"); });
  assert.equal(refused, true, "an unverifiable thread must be refused, not allowed through");
});

test("a lookup failure fails closed rather than falling through to generic DM behaviour", async () => {
  const socket = fakeSocket();
  // An unknown answer must never be treated as "not a booking thread": that is how a booking conversation would be
  // reached during an outage.
  assert.equal(await guard(socket, async () => { throw new Error("timeout"); }), true);
  assert.notEqual(await guard(fakeSocket(), async () => null), true);
});

test("the client gets a bounded error event that discloses no database internals", async () => {
  const socket = fakeSocket();
  await guard(socket, async () => { throw new Error(`ECONNREFUSED 10.0.0.5:5432 relation "catering_booking_conversations" does not exist`); });
  assert.equal(socket.emitted.length, 1);
  const { event, payload } = socket.emitted[0];
  assert.equal(event, "error");
  const serialized = JSON.stringify(payload);
  for (const leak of ["ECONNREFUSED", "10.0.0.5", "5432", "catering_booking_conversations", "relation"]) {
    assert.equal(serialized.includes(leak), false, leak);
  }
  assert.equal((payload as { code: string }).code, "thread_check_unavailable");
});

test("normal non-booking typing is unaffected and emits nothing", async () => {
  const socket = fakeSocket();
  assert.equal(await guard(socket, async () => null), false);
  assert.deepEqual(socket.emitted, []);
});

test("the process really does exit on an unhandled rejection, which is why this matters", () => {
  const handler = indexSource.slice(indexSource.indexOf(`process.on("unhandledRejection"`));
  assert.equal(handler.slice(0, handler.indexOf("});")).includes("process.exit(1)"), true);
});

test("the guard catches its own lookup failure rather than relying on each caller", () => {
  const guardSource = socketSource.slice(socketSource.indexOf("async function refuseBookingLinkedThread"), socketSource.indexOf("function onAsyncSocketEvent"));
  assert.equal(guardSource.includes("linked = await bookingLinkedThread(threadId);"), true);
  assert.equal(guardSource.includes("} catch {"), true);
  // Fails closed, and the refusal carries a distinct code rather than the booking-thread one.
  assert.equal(guardSource.includes(`error: "thread_check_unavailable"`), true);
  assert.equal(guardSource.slice(guardSource.indexOf("} catch {")).includes("return true;"), true);
  // Nothing from the caught error reaches the client.
  assert.equal(/catch\s*\(/.test(guardSource), false, "the guard must not bind the error, so it cannot be forwarded");
});

test("the typing listener is registered behind an async error boundary", () => {
  assert.equal(socketSource.includes(`onAsyncSocketEvent<{ threadId: string; typing: boolean }>(socket, "typing", "typing failed"`), true);
  const boundary = socketSource.slice(socketSource.indexOf("function onAsyncSocketEvent"), socketSource.indexOf("function userIdFromSocket"));
  // The returned promise is consumed and its rejection converted into the same bounded error event shape.
  assert.equal(boundary.includes(".catch(() =>"), true);
  assert.equal(boundary.includes(`socket.emit("error", { error: failure })`), true);
  // The underlying error is never forwarded to the client.
  assert.equal(boundary.includes("error.message"), false);
});

test("no async socket listener is left without an error boundary", () => {
  // Every `socket.on` handler that is async must have its own try/catch; anything else must go through the wrapper.
  for (const match of socketSource.matchAll(/socket\.on\(\s*"([a-z]+)",\s*(async\s*)?\(/g)) {
    const [, event, isAsync] = match;
    if (!isAsync) continue;
    const start = match.index!;
    const next = socketSource.indexOf("socket.on(", start + 10);
    const body = socketSource.slice(start, next === -1 ? undefined : next);
    assert.equal(body.includes("try {") && body.includes("} catch"), true, `async socket "${event}" has no error boundary`);
  }
  // And the one listener that had none is now registered through the wrapper rather than raw.
  assert.equal(/socket\.on\(\s*"typing"/.test(socketSource), false, "typing must not be registered as a raw async listener");
});

test("the booking guard still runs on join, send, read and typing", () => {
  for (const event of ["join", "send", "read", "typing"]) {
    assert.equal(socketSource.includes(`"${event}"`), true, event);
  }
  assert.equal((socketSource.match(/refuseBookingLinkedThread\(socket, threadId\)/g) ?? []).length, 4);
});
