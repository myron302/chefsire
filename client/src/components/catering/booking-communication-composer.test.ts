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
