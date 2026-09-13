import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_CLOSEOUT_CONVERSATION_ACTION,
  CATERING_CLOSEOUT_CONVERSATION_NOTE,
  CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT,
  CATERING_CLOSEOUT_PROVIDER_REVIEW_PRESENT,
  CATERING_CLOSEOUT_TERMINAL_BOOKING_STATUSES,
  cateringCloseoutCanStillChange,
} from "@shared/catering-booking-closeout";
import { CATERING_BOOKING_STATUSES } from "@shared/catering-bookings";
import { CATERING_WORKSPACE_POLL_MS, cateringWorkspacePollInterval, mayEditCateringWorkspace } from "@shared/catering-booking-operations";
import { mayPostCateringBookingMessage } from "@shared/catering-booking-communication";

/**
 * Two ways the closeout section told a participant something that was no longer -- or never was -- true.
 *
 * FRESHNESS. Polling was gated on "the event is served AND closeout is not closed", which switched the query off
 * inside exactly the two windows where somebody else was about to change the answer. Both are reachable with the
 * tab simply left open, which is why `refetchOnWindowFocus` rescued neither: a participant who never leaves the
 * tab never produces a focus transition.
 *
 * TRUTHFULNESS. The provider was told they could ask their customer for a review "in the booking conversation",
 * on a completed booking, where Phase 2I's composer is closed for both participants.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");

/**
 * The refetch interval the component computes, modelled exactly: the shared workspace helper, asked whether this
 * booking can still produce a Phase 2K change. `undefined` is "no page has arrived yet".
 */
const pollFor = (bookingStatus: typeof CATERING_BOOKING_STATUSES[number] | undefined) =>
  cateringWorkspacePollInterval(cateringCloseoutCanStillChange(bookingStatus));

/* ----------------------------------------------------------------------------------------------------------- *
 * Failure A: a pre-service participant must be able to observe completion
 * ----------------------------------------------------------------------------------------------------------- */

test("polling stays on while the booking has not been completed yet", () => {
  // The customer opens the workspace before service. Under the old rule `eventServiceOccurred === false` switched
  // polling off, so the provider's later completion never reached them.
  assert.equal(pollFor("pending_confirmation"), CATERING_WORKSPACE_POLL_MS);
  assert.equal(pollFor("confirmed"), CATERING_WORKSPACE_POLL_MS);
});

test("a pre-service participant observes completion on the next poll, with no focus change", () => {
  // Poll 1 answers "confirmed" -- not served, nothing actionable. Polling is still on...
  let status: typeof CATERING_BOOKING_STATUSES[number] = "confirmed";
  assert.equal(pollFor(status), CATERING_WORKSPACE_POLL_MS);
  // ...so the provider's completion is picked up by the next scheduled request, not by a focus transition that
  // a participant sitting in the tab never makes.
  status = "completed";
  assert.equal(pollFor(status), CATERING_WORKSPACE_POLL_MS, "and it keeps polling afterwards too");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Failure B: a closed-out participant must be able to observe a reopen
 * ----------------------------------------------------------------------------------------------------------- */

test("polling stays on for a completed booking whether closeout is open or closed", () => {
  // The status is what decides, and a completed booking's closeout can close and reopen any number of times.
  assert.equal(pollFor("completed"), CATERING_WORKSPACE_POLL_MS);
  // The old gate read the closeout flag as well; it does not any more.
  assert.equal(component.includes("closedOut"), true, "the flag still exists for rendering");
  assert.equal(component.includes("!polled.state.data?.closeout.closedOut"), false, "but no longer gates polling");
});

test("a reopen is observable even though it notifies nobody and invalidates no other user's cache", () => {
  // Reopening is deliberately silent -- it writes shared activity and nothing else -- so a poll is the only way
  // the customer's own view can stop contradicting the feed above it.
  const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-closeout.ts"), "utf8");
  const reopen = route.slice(route.indexOf('r.post("/bookings/:id/closeout/reopen"'));
  assert.equal(reopen.includes("notifyCloseout"), false, "still notifies nobody, by design");
  assert.equal(pollFor("completed"), CATERING_WORKSPACE_POLL_MS, "so the customer's query must keep asking");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Only a genuinely terminal status stops the polling
 * ----------------------------------------------------------------------------------------------------------- */

test("a cancelled booking is the one status that stops polling, and it is genuinely terminal", () => {
  assert.deepEqual([...CATERING_CLOSEOUT_TERMINAL_BOOKING_STATUSES], ["cancelled"]);
  assert.equal(pollFor("cancelled"), false);
  // Phase 2G cancellation is irreversible, so a cancelled booking can never become completed and its closeout
  // state is fixed at `not_applicable` forever. Nothing any actor does can change what this section would render.
  assert.equal(mayEditCateringWorkspace("cancelled"), false);
  assert.equal(cateringCloseoutCanStillChange("cancelled"), false);
});

test("every other booking status keeps polling", () => {
  for (const status of CATERING_BOOKING_STATUSES) {
    const expected = status === "cancelled" ? false : CATERING_WORKSPACE_POLL_MS;
    assert.equal(pollFor(status), expected, status);
  }
});

test("an unread query keeps polling: nothing is known to be terminal yet", () => {
  assert.equal(cateringCloseoutCanStillChange(undefined), true);
  assert.equal(pollFor(undefined), CATERING_WORKSPACE_POLL_MS);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * No polling leak
 * ----------------------------------------------------------------------------------------------------------- */

test("polling still goes through the established workspace helper and interval", () => {
  assert.ok(component.includes("cateringWorkspacePollInterval("));
  assert.equal(CATERING_WORKSPACE_POLL_MS, 15_000, "the shared cadence, unchanged");
  // No bespoke timer loop was introduced, and nothing here is a realtime transport.
  for (const forbidden of ["setInterval", "setTimeout", "WebSocket", "EventSource", "io("]) {
    assert.equal(component.includes(forbidden), false, `${forbidden} must not appear`);
  }
});

test("polling is still declared on the query, so unmount stops it through the query lifecycle", () => {
  const query = component.slice(component.indexOf("const query = useQuery({"), component.indexOf("const closeout = query.data;"));
  assert.ok(query.includes("refetchInterval:"), "declared on the query, not managed by hand");
  assert.ok(query.includes("refetchIntervalInBackground: false"), "a backgrounded tab still does not poll");
  // Focus refetching remains, as a complement rather than the mechanism.
  assert.ok(query.includes("refetchOnWindowFocus: true"));
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Truthful provider guidance
 * ----------------------------------------------------------------------------------------------------------- */

test("the booking conversation really is read-only wherever this section renders", () => {
  // The full section renders only when the event was served, which requires `status === "completed"` -- and
  // Phase 2I closes its composer with the Phase 2H edit window.
  assert.equal(mayPostCateringBookingMessage("completed"), false);
  assert.equal(mayPostCateringBookingMessage("cancelled"), false);
  // Unchanged by this correction: Phase 2K did not widen the boundary to make its own copy true.
  for (const status of CATERING_BOOKING_STATUSES) {
    assert.equal(mayPostCateringBookingMessage(status), mayEditCateringWorkspace(status), status);
  }
});

test("a provider with no customer review is told the fact and offered no unusable channel", () => {
  assert.equal(CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT, "This customer has not left a review yet.");
  for (const claim of ["booking conversation", "message", "ask them", "contact", "send"]) {
    assert.equal(CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT.toLowerCase().includes(claim), false, `must not claim: ${claim}`);
  }
  // The old sentence is gone from the component entirely.
  assert.equal(component.includes("You can ask them in the booking conversation"), false);
});

test("a provider whose customer HAS reviewed still gets the existing truthful line", () => {
  assert.equal(CATERING_CLOSEOUT_PROVIDER_REVIEW_PRESENT, "This customer has left a review on your profile.");
  assert.ok(component.includes("CATERING_CLOSEOUT_PROVIDER_REVIEW_PRESENT"));
  assert.ok(component.includes("CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT"));
});

test("the conversation link describes viewing history, not an actionable channel", () => {
  assert.equal(CATERING_CLOSEOUT_CONVERSATION_ACTION, "View the booking conversation");
  assert.ok(CATERING_CLOSEOUT_CONVERSATION_NOTE.includes("read-only"));
  assert.ok(component.includes("{CATERING_CLOSEOUT_CONVERSATION_ACTION}"));
  assert.ok(component.includes("{CATERING_CLOSEOUT_CONVERSATION_NOTE}"));
  // The old label implied opening something to act in.
  assert.equal(component.includes("Open the booking conversation"), false);
});

test("no new posting permission or contact mechanism is introduced anywhere in the component", () => {
  // Asserted against the CODE rather than the whole file, because the file's own comments explain in words why the
  // composer is closed here.
  const code = component.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");
  for (const forbidden of ["mayPostCateringBookingMessage", "/messages", "sendMessage", "composer", "mailto:", "tel:"]) {
    assert.equal(code.includes(forbidden), false, `${forbidden} must not appear`);
  }
  // The only outbound links remain the ones the server sanctioned.
  assert.ok(component.includes("href={closeout.communicationPath}"));
});

test("customer-facing closeout copy is unaffected by the provider wording change", () => {
  // The customer's own lines still say exactly what they said.
  assert.ok(component.includes("Reviews are not available for this provider right now."));
  assert.ok(component.includes("Work with this caterer again"));
  assert.ok(component.includes("Review this caterer"));
  assert.ok(component.includes("Update your review"));
  // And the read-only note is shared by both actors, because the thread is read-only for both.
  const follow = component.slice(component.indexOf('aria-labelledby="closeout-follow-up"'), component.indexOf('aria-labelledby="closeout-checklist"'));
  assert.ok(follow.includes("{CATERING_CLOSEOUT_CONVERSATION_NOTE}"));
  assert.equal(/\{provider &&[^}]*CONVERSATION_NOTE/.test(follow), false, "not gated to one actor");
});
