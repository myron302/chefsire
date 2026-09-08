import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CATERING_COMPOSERS, cateringComposerFor, cateringComposerIsEmpty, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, maySendCateringMessage, retryCateringMessageSend, startCateringMessageSend, updateCateringComposer, type CateringComposers } from "./catering-booking-communication-state";
import { EMPTY_CATERING_MUTATION_OUTCOMES, EMPTY_CATERING_UNSENT_MESSAGES, cateringMutationOrigin, cateringMutationOutcomeFor, cateringUnsentMessage, clearCateringMutationOutcome, clearCateringUnsentMessage, recordCateringMutationOutcome, recordCateringUnsentMessage, type CateringMutationOrigin, type CateringMutationOutcomes, type CateringUnsentMessages } from "./catering-booking-mutation-origin";

/**
 * A send outlives the booking that started it, so the composer cannot be a single slot.
 *
 * Sending on booking A and navigating to B and back before the request settled rehydrated that one slot for A and
 * threw away what it held: the text, the attempt, and -- worst -- the `clientRequestId`. Send was offered again,
 * and a second attempt carried a FRESH idempotency token. Two tokens are two logical messages, and the server is
 * right to store both. A failure that landed while B was displayed had nothing left to fail against either, so the
 * refused text disappeared with it.
 *
 * Each booking now keeps its own composer, keyed by the actor-and-booking identity the rest of the section already
 * uses, and a completion settles the composer belonging to its OWN attempt whatever is on screen. These tests drive
 * the real helpers through that navigation directly, rather than through rendered timing.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingCommunication.tsx"), "utf8");

const A = cateringMutationOrigin("user-1", "booking-a");
const B = cateringMutationOrigin("user-1", "booking-b");
type Attempt = { origin: CateringMutationOrigin; text: string; clientRequestId: string };

/** The component's send state, over the very helpers it calls. */
function session(start: CateringMutationOrigin = A) {
  let identity = start.identity;
  let origin = start;
  let composers: CateringComposers = EMPTY_CATERING_COMPOSERS;
  let outcomes: CateringMutationOutcomes = EMPTY_CATERING_MUTATION_OUTCOMES;
  let unsent: CateringUnsentMessages = EMPTY_CATERING_UNSENT_MESSAGES;
  const invalidated: string[] = [];
  let minted = 0;
  const api = {
    get composers() { return composers; },
    /** What the booking on screen renders. */
    get own() { return cateringComposerFor(composers, identity); },
    composerFor: (who: CateringMutationOrigin) => cateringComposerFor(composers, who.identity),
    outcomeFor: (who: CateringMutationOrigin) => cateringMutationOutcomeFor(outcomes, who.identity),
    unsentFor: (who: CateringMutationOrigin) => cateringUnsentMessage(unsent, who.identity),
    get invalidated() { return invalidated; },
    /** The route changes: props move, and nothing about another booking's composer is touched. */
    navigate(to: CateringMutationOrigin) { identity = to.identity; origin = to; },
    type(text: string) { composers = updateCateringComposer(composers, identity, (state) => editCateringComposer(state, text)); },
    maySend: (canSend = true) => maySendCateringMessage(cateringComposerFor(composers, identity), canSend),
    /** Submit, exactly as the component does: refuse unless allowed, then mint one token for this attempt. */
    submit(canSend = true): Attempt | null {
      if (!api.maySend(canSend)) return null;
      const started = startCateringMessageSend(cateringComposerFor(composers, identity), `uuid-${(minted += 1)}`);
      if (!started) return null;
      composers = updateCateringComposer(composers, identity, () => started.next);
      outcomes = clearCateringMutationOutcome(outcomes, origin);
      return { origin, ...started.payload };
    },
    retry(canSend = true): Attempt | null {
      if (!canSend) return null;
      const retried = retryCateringMessageSend(cateringComposerFor(composers, identity));
      if (!retried) return null;
      composers = updateCateringComposer(composers, identity, () => retried.next);
      outcomes = clearCateringMutationOutcome(outcomes, origin);
      return { origin, ...retried.payload };
    },
    discard() {
      composers = updateCateringComposer(composers, identity, discardCateringMessageSend);
      unsent = clearCateringUnsentMessage(unsent, origin);
    },
    /** Settles the ORIGINATING booking, whatever is on screen. */
    succeed(attempt: Attempt) {
      composers = updateCateringComposer(composers, attempt.origin.identity, (state) => completeCateringMessageSend(state, attempt.clientRequestId));
      unsent = clearCateringUnsentMessage(unsent, attempt.origin);
      outcomes = recordCateringMutationOutcome(outcomes, attempt.origin, "succeeded");
      invalidated.push(`messages:${attempt.origin.bookingId}`, `workspace:${attempt.origin.bookingId}`);
    },
    fail(attempt: Attempt, message: string) {
      composers = updateCateringComposer(composers, attempt.origin.identity, (state) => failCateringMessageSend(state, attempt.clientRequestId, message));
      unsent = recordCateringUnsentMessage(unsent, attempt.origin, attempt.text);
      outcomes = recordCateringMutationOutcome(outcomes, attempt.origin, "failed", message);
    },
  };
  return api;
}

test("1. a pending send survives A -> B -> A with the same body and the same token", () => {
  const s = session();
  s.type("the tasting menu is confirmed");
  const sent = s.submit()!;
  s.navigate(B);
  s.navigate(A);
  const own = s.own;
  assert.equal(own.pending?.status, "sending");
  assert.equal(own.pending?.text, "the tasting menu is confirmed");
  assert.equal(own.pending?.clientRequestId, sent.clientRequestId, "the idempotency token is the attempt's own");
});

test("2. returning to a pending booking cannot start a second independent send", () => {
  const s = session();
  s.type("confirming the headcount");
  const sent = s.submit()!;
  s.navigate(B);
  s.navigate(A);
  assert.equal(s.maySend(), false, "an attempt is already in flight for this booking");
  assert.equal(s.submit(), null, "so no second attempt, and no second token, can be created");
  assert.equal(s.own.pending?.clientRequestId, sent.clientRequestId);
});

test("3. a success that lands while another booking is displayed settles the right one", () => {
  const s = session();
  s.type("adding two more guests");
  const sent = s.submit()!;
  s.navigate(B);
  s.succeed(sent);
  // B is untouched by it.
  assert.equal(s.own.pending, null);
  assert.equal(s.own.text, "");
  assert.equal(s.outcomeFor(B), null);
  // And A reflects the send exactly once on return: cleared composer, one success, nothing left pending.
  s.navigate(A);
  assert.equal(s.own.pending, null, "no stale pending state");
  assert.equal(s.own.text, "", "the composer it was submitted from is cleared");
  assert.equal(s.outcomeFor(A)?.status, "succeeded");
  assert.deepEqual(s.invalidated, ["messages:booking-a", "workspace:booking-a"], "and only A's caches were refreshed");
  assert.equal(s.composers.has(A.identity), false, "an empty composer is not retained");
});

test("4. a failure that lands while another booking is displayed preserves the refused text and its retry", () => {
  const s = session();
  s.type("can we move the arrival time?");
  const sent = s.submit()!;
  s.navigate(B);
  s.fail(sent, "Your message could not be sent");
  assert.equal(s.own.pending, null, "B has no attempt of its own");
  assert.equal(s.unsentFor(B), null);
  s.navigate(A);
  const failed = s.own.pending;
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.text, "can we move the arrival time?", "nothing typed is lost");
  assert.equal(failed?.clientRequestId, sent.clientRequestId);
  assert.equal(s.outcomeFor(A)?.message, "Your message could not be sent");
  assert.equal(s.unsentFor(A), "can we move the arrival time?");
});

test("5. retrying after navigation resends the same logical message, not a new one", () => {
  const s = session();
  s.type("adding two more guests");
  const first = s.submit()!;
  s.navigate(B);
  s.fail(first, "Your message could not be sent");
  s.navigate(A);
  const retried = s.retry()!;
  assert.equal(retried.clientRequestId, first.clientRequestId, "one logical send keeps its idempotency token");
  assert.equal(retried.text, first.text);
  assert.equal(s.own.pending?.status, "sending");
  // And a success then closes it out; it can never be offered as retryable again.
  s.succeed(retried);
  assert.equal(s.own.pending, null);
  assert.equal(s.retry(), null, "a settled attempt is not retryable");
});

test("6. two bookings can each hold their own attempt without colliding", () => {
  const s = session();
  s.type("A's message");
  const onA = s.submit()!;
  s.navigate(B);
  s.type("B's message");
  const onB = s.submit()!;
  assert.notEqual(onA.clientRequestId, onB.clientRequestId);
  assert.equal(s.composerFor(A).pending?.text, "A's message");
  assert.equal(s.composerFor(B).pending?.text, "B's message");
  assert.equal(s.composerFor(A).pending?.clientRequestId, onA.clientRequestId);
  assert.equal(s.composerFor(B).pending?.clientRequestId, onB.clientRequestId);
});

test("7. settling one booking leaves the other's composer exactly as it was", () => {
  const s = session();
  s.type("A's message");
  const onA = s.submit()!;
  s.navigate(B);
  s.type("B's message");
  const onB = s.submit()!;
  const beforeB = s.composerFor(B);
  s.succeed(onA);
  assert.equal(s.composerFor(B), beforeB, "B's composer is not even re-allocated");
  assert.equal(s.composerFor(B).pending?.clientRequestId, onB.clientRequestId);
  assert.equal(s.outcomeFor(B), null);
  assert.equal(s.outcomeFor(A)?.status, "succeeded");
});

test("8. a failure on one booking leaves the other's composer alone too", () => {
  const s = session();
  s.type("A's message");
  const onA = s.submit()!;
  s.navigate(B);
  s.type("B's message");
  const onB = s.submit()!;
  const beforeB = s.composerFor(B);
  s.fail(onA, "Your message could not be sent");
  assert.equal(s.composerFor(B), beforeB);
  assert.equal(s.unsentFor(B), null, "and B keeps no unsent record of A's refusal");
  assert.equal(s.unsentFor(A), "A's message");
  // B's own settlement is likewise its own.
  s.succeed(onB);
  assert.equal(s.composerFor(A).pending?.status, "failed", "A's failure survives B's success");
  assert.equal(s.composerFor(A).pending?.clientRequestId, onA.clientRequestId);
});

test("9. text typed after a send begins survives that send settling", () => {
  const s = session();
  s.type("the first message");
  const sent = s.submit()!;
  s.type("something else entirely");
  s.navigate(B);
  s.navigate(A);
  assert.equal(s.own.text, "something else entirely", "the newer draft is still there after navigating");
  s.succeed(sent);
  assert.equal(s.own.text, "something else entirely", "and a completing older attempt does not erase it");
  assert.equal(s.own.pending, null);
});

test("10. navigating back and forth mints no new token for an attempt already in flight", () => {
  const s = session();
  s.type("A's message");
  const onA = s.submit()!;
  s.navigate(B);
  s.type("B's message");
  const onB = s.submit()!;
  for (let round = 0; round < 4; round += 1) {
    s.navigate(A);
    assert.equal(s.submit(), null, `round ${round}: A already has one`);
    assert.equal(s.own.pending?.clientRequestId, onA.clientRequestId);
    s.navigate(B);
    assert.equal(s.submit(), null, `round ${round}: B already has one`);
    assert.equal(s.own.pending?.clientRequestId, onB.clientRequestId);
  }
  // Both still resolve to their own booking afterwards.
  s.succeed(onA);
  s.fail(onB, "Your message could not be sent");
  assert.equal(s.composerFor(A).pending, null);
  assert.equal(s.composerFor(B).pending?.status, "failed");
});

test("11. another actor never inherits a booking's composer", () => {
  const otherActor = cateringMutationOrigin("user-2", "booking-a");
  const s = session();
  s.type("private to user one");
  const sent = s.submit()!;
  // The same booking, a different signed-in actor: a different identity, and therefore a different composer.
  s.navigate(otherActor);
  assert.equal(s.own.text, "");
  assert.equal(s.own.pending, null);
  assert.equal(s.maySend(), false, "there is nothing sendable to send");
  // The first actor's attempt settles against the first actor's composer, not the one on screen.
  s.fail(sent, "Your message could not be sent");
  assert.equal(s.composerFor(otherActor).pending, null);
  assert.equal(s.unsentFor(otherActor), null);
  assert.equal(s.composerFor(A).pending?.text, "private to user one");
  assert.notEqual(A.identity, otherActor.identity);
});

test("12. a booking that went terminal still refuses to send, and still shows what was never delivered", () => {
  const s = session();
  s.type("adding two more guests");
  const sent = s.submit()!;
  s.navigate(B);
  s.fail(sent, "This booking is closed and can no longer be messaged");
  s.navigate(A);
  // Read-only wins over everything the composer holds.
  assert.equal(s.maySend(false), false);
  assert.equal(s.submit(false), null);
  assert.equal(s.retry(false), null, "and no retry may be issued either");
  // The refused text is still recoverable, from the attempt and from the per-booking record alike.
  assert.equal(s.own.pending?.text, "adding two more guests");
  assert.equal(s.unsentFor(A), "adding two more guests");
  // Discarding is the one thing that clears both, and only for this booking.
  s.discard();
  assert.equal(s.unsentFor(A), null);
  assert.equal(s.own.pending, null);
  assert.equal(s.own.text, "adding two more guests", "discard returns the text to the composer rather than deleting it");
});

test("13. the map holds only what is worth holding, and the component is wired to it", () => {
  // An entry appears when there is something to keep and drops out when there is not, so the map is bounded by the
  // bookings actually being composed on rather than by every booking ever visited.
  assert.equal(cateringComposerIsEmpty(cateringComposerFor(EMPTY_CATERING_COMPOSERS, A.identity)), true);
  let composers = updateCateringComposer(EMPTY_CATERING_COMPOSERS, A.identity, (state) => editCateringComposer(state, "draft"));
  assert.equal(composers.has(A.identity), true);
  composers = updateCateringComposer(composers, A.identity, (state) => editCateringComposer(state, ""));
  assert.equal(composers.has(A.identity), false, "an empty composer is not retained");
  // A pending or failed attempt is never dropped, whatever the text is.
  const started = startCateringMessageSend(cateringComposerFor(EMPTY_CATERING_COMPOSERS, A.identity), "uuid-keep");
  assert.equal(started, null, "an empty composer has nothing to send");
  let held = updateCateringComposer(EMPTY_CATERING_COMPOSERS, A.identity, (state) => editCateringComposer(state, "keep me"));
  const attempt = startCateringMessageSend(cateringComposerFor(held, A.identity), "uuid-keep")!;
  held = updateCateringComposer(held, A.identity, () => attempt.next);
  held = updateCateringComposer(held, A.identity, (state) => editCateringComposer(state, ""));
  assert.equal(held.has(A.identity), true, "an attempt in flight keeps the entry even with an empty box");
  // The component holds one composer per booking and no longer rehydrates a single slot on navigation.
  // Held in the module-scoped session store rather than in component state, so it survives the section unmounting
  // as well as the booking changing -- an in-flight send's token outlives both.
  assert.equal(component.includes("const session = useCateringSession(cateringCommunicationSession);"), true);
  assert.equal(component.includes("const ownComposer = cateringComposerFor(session.composers, identity);"), true);
  assert.equal(component.includes("useState<CateringComposers>"), false, "component state dies with the component");
  assert.equal(/useEffect\(\(\) => \{ setComposer\(/.test(component), false, "the single-slot rehydrate is gone");
  assert.equal(component.includes("updateCateringComposer(current, attempt.origin.identity"), true, "completions settle the originating booking");
  assert.equal((component.match(/setSession\("composers"/g) ?? []).length, 6, "success, failure, submit, retry, typing, discard");
  assert.equal((component.match(/updateCateringComposer\(current, attempt\.origin\.identity/g) ?? []).length, 2, "success and failure both");
});
