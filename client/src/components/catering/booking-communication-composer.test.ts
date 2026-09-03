import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Composer regressions for the booking Communication section.
 *
 * The state machine itself is covered by `catering-booking-communication-state.test.ts`; what is asserted here is
 * that the component wires that machine up the way the machine assumes -- above all that the composer stays a live,
 * editable value distinct from the immutable attempt, and that a resolving attempt is never allowed to clear it
 * unconditionally. There is no DOM harness in this suite, so these are structural assertions against the component
 * source: a regression that re-disables the box, or reintroduces an unconditional clear, fails here.
 */
const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "BookingCommunication.tsx"), "utf8");
const composerForm = source.slice(source.indexOf("<form className=\"space-y-2\" onSubmit={submit}>"));

test("the composer stays editable while a send is in flight and after one fails", () => {
  const textarea = composerForm.slice(composerForm.indexOf("<Textarea id=\"catering-message\""));
  // No disabled binding at all: with the attempt held separately, editing during a send is safe rather than lossy.
  assert.equal(textarea.slice(0, textarea.indexOf("/>")).includes("disabled"), false, "the composer must not be disabled during a send");
  assert.equal(composerForm.includes("value={composer.text}"), true);
  assert.equal(composerForm.includes("editCateringComposer(current, event.target.value)"), true);
});

test("clearing the composer goes through the state machine, never an unconditional reset", () => {
  // The only clear is `completeCateringMessageSend`, which compares the composer against the submitted draft first.
  assert.equal(source.includes("completeCateringMessageSend(current, payload.clientRequestId)"), true);
  assert.equal(/setComposer\(\s*\{[^}]*text:\s*""/.test(source), false, "the composer must never be reset directly");
  assert.equal(source.includes('text: ""'), false, "clearing belongs to completeCateringMessageSend alone");
});

test("a retry resends the failed attempt rather than whatever is currently typed", () => {
  const retry = source.slice(source.indexOf("const retry = ()"), source.indexOf("const pending ="));
  assert.equal(retry.includes("retryCateringMessageSend(composer)"), true);
  // The payload comes from the state machine's attempt record, not from `composer.text`.
  assert.equal(retry.includes("send.mutate(retried.payload)"), true);
  assert.equal(retry.includes("composer.text"), false, "a retry must not read the live composer draft");
});

test("the failure notice names the unsent message and says the live draft is unaffected", () => {
  assert.equal(composerForm.includes("Try again resends this unsent message"), true);
  assert.equal(composerForm.includes("{pending.text}"), true);
  assert.equal(composerForm.includes("composer.text.trim() !== pending.text"), true);
  assert.equal(composerForm.includes("What you have typed above is kept separately"), true);
});

test("send, retry and discard controls remain reachable and accessible", () => {
  // A labelled composer, a live region for send outcomes, and an alert region for failures.
  assert.equal(composerForm.includes(`<Label htmlFor="catering-message">`), true);
  assert.equal(composerForm.includes(`role="status" aria-live="polite"`), true);
  assert.equal(composerForm.includes(`role="alert"`), true);
  // Every control keeps the 44px touch target the workspace uses.
  for (const control of ["Send message", "Try again", "Discard unsent message"]) {
    const at = composerForm.indexOf(control);
    assert.notEqual(at, -1, control);
    assert.equal(composerForm.slice(composerForm.lastIndexOf("<Button", at), at).includes("min-h-11"), true, control);
  }
});

test("duplicate-send protection is unchanged: the send control is gated by the state machine", () => {
  assert.equal(composerForm.includes("disabled={!maySendCateringMessage(composer, editable)}"), true);
  // A fresh token per composition, reused by the retry path through the attempt record.
  assert.equal(source.includes("startCateringMessageSend(composer, crypto.randomUUID())"), true);
});

/**
 * Automatic read marking must be bounded at the component level too: the effect has to record the attempted
 * boundary before issuing the request, or a failure re-fires it the instant the mutation returns to idle.
 */
const readEffect = source.slice(source.indexOf("// Marking read happens at most ONCE per boundary"), source.indexOf("// Restore the reading position"));

test("the mark-read effect records the attempted boundary before issuing the request", () => {
  assert.equal(readEffect.includes("shouldAutoMarkCateringConversationRead(readMark, viewedId, unreadCount)"), true);
  // The attempt is recorded first, so a second pass for the same boundary is refused before any request is made.
  assert.equal(readEffect.indexOf("startCateringReadMark(current, viewedId!)") < readEffect.indexOf("markRead.mutate(viewedId!)"), true);
  // The old unbounded predicate, which knew nothing about attempts, must not be what gates the effect.
  assert.equal(readEffect.includes("shouldMarkCateringConversationRead("), false, "the effect must gate on the attempted boundary, not only on unread state");
});

test("a failed mark-read is recorded rather than retried from the effect", () => {
  const mutation = source.slice(source.indexOf("const markRead = useMutation"), source.indexOf("// Watches the end of the thread"));
  assert.equal(mutation.includes("failCateringReadMark(current, attemptedId)"), true);
  // Success takes the server's authoritative marker, which is monotonic, rather than the requested id.
  assert.equal(mutation.includes("completeCateringReadMark(current, body?.lastReadMessageId ?? null)"), true);
  assert.equal(mutation.includes("setMarkedId("), false, "the old success-only marker state must be gone");
});

test("the read-marker retry is offered quietly and accessibly, and issues no request itself", () => {
  const retry = source.slice(source.indexOf("mayRetryCateringReadMark(readMark, viewedId, unreadCount)"));
  // A failed read receipt is not an error the user caused, so it is a status region rather than an alert.
  assert.equal(retry.slice(0, retry.indexOf("</div>")).includes(`role="status"`), true);
  const button = retry.slice(retry.indexOf("<Button"), retry.indexOf("</Button>"));
  assert.equal(button.includes("min-h-11"), true);
  assert.equal(button.includes("disabled={markRead.isPending}"), true);
  // The control only clears the recorded attempt; the effect then issues exactly one request.
  assert.equal(button.includes("setReadMark(retryCateringReadMark)"), true);
  assert.equal(button.includes("markRead.mutate"), false, "the retry control must not issue a request directly");
});

/**
 * Read state must reflect what was displayed, not what was fetched. A first page that overflows the viewport used
 * to be marked read the moment the component mounted.
 */
const viewEffect = source.slice(source.indexOf("// Watches the end of the thread"), source.indexOf("// Marking read happens at most ONCE per boundary"));

test("the read boundary comes from what was displayed, never from the newest fetched message", () => {
  assert.equal(source.includes("const viewedId = cateringReadableBoundary(viewed, identity);"), true);
  // Nothing in the mark path may reach for latestId any more.
  assert.equal(readEffect.includes("latestId"), false, "the mark effect must not use the fetched boundary");
  assert.equal(source.includes("mayRetryCateringReadMark(readMark, viewedId, unreadCount)"), true);
});

test("a sentinel at the end of the thread is what advances the viewed boundary", () => {
  assert.equal(viewEffect.includes("new IntersectionObserver"), true);
  assert.equal(viewEffect.includes("recordCateringViewedBoundary(current, latestId)"), true);
  // Rooted on the scroll container, so "visible" means visible inside the thread rather than merely in the page.
  assert.equal(viewEffect.includes("root: threadRef.current ?? null"), true);
  // Re-created as the thread changes so it never observes a detached node, and disconnected on cleanup.
  assert.equal(viewEffect.includes("}, [latestId, messages.length]);"), true);
  assert.equal(viewEffect.includes("observer.disconnect()"), true);
  // Environments without IntersectionObserver simply record nothing, which leaves messages unread rather than
  // falsely marking them read.
  assert.equal(viewEffect.includes(`typeof IntersectionObserver === "undefined"`), true);
});

test("the sentinel is presentational and adds no accessibility surface", () => {
  const sentinel = source.slice(source.indexOf("<div ref={sentinelRef}"));
  const tag = sentinel.slice(0, sentinel.indexOf("/>"));
  assert.equal(tag.includes(`aria-hidden="true"`), true);
  assert.equal(tag.includes("tabIndex"), false);
  assert.equal(tag.includes("role="), false);
  // It sits inside the scroll container, after the message list.
  assert.equal(source.indexOf("</ol>") < source.indexOf("<div ref={sentinelRef}"), true);
});

test("the viewed boundary is actor and booking scoped and resets with the conversation", () => {
  assert.equal(source.includes("setViewed((current) => hydrateCateringViewed(current, identity))"), true);
  assert.equal(source.includes("cateringReadableBoundary(viewed, identity)"), true);
});
