import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_CLOSEOUT_NOTIFICATION,
  cateringCloseoutSectionPath,
} from "@shared/catering-booking-closeout";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "@shared/catering-booking-activity-events";
import {
  resolveCateringCloseoutComplete,
  resolveCateringCloseoutItemSave,
  resolveCateringCloseoutReopen,
  cateringCloseoutFacts,
} from "../services/catering-booking-closeout-policy";

/**
 * The SIDE EFFECTS of Phase 2K: what enters the shared activity feed, what produces a notification, and what a
 * retried request can and cannot duplicate.
 *
 * The behavioural half is asserted against the resolvers, which decide whether anything is written at all; the
 * structural half is asserted against the route, which is where "written in the same transaction" and "notified
 * only on a genuine first write" actually live.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-closeout.ts"), "utf8");

const SERVED = { status: "completed" as const, completedAt: new Date("2026-09-01T18:00:00.000Z") };
const NOW = new Date("2026-09-05T10:00:00.000Z");
const LATER = new Date("2026-09-05T11:00:00.000Z");

const answeredFacts = cateringCloseoutFacts({
  booking: SERVED, record: undefined, equipment: [],
  items: [
    { itemKey: "equipment_return_confirmed", state: "completed" },
    { itemKey: "final_documents_delivered", state: "not_applicable" },
    { itemKey: "incident_follow_up_resolved", state: "not_applicable" },
    { itemKey: "final_admin_review_completed", state: "completed" },
  ],
  outstandingSharedRequirementCount: 0, sharedDocumentCount: 0, customerReviewExists: false,
}, "provider");

/* ----------------------------------------------------------------------------------------------------------- *
 * Activity
 * ----------------------------------------------------------------------------------------------------------- */

test("exactly two closeout activity events exist, both shared, and both are in the allowlist", () => {
  const written = Array.from(route.matchAll(/eventType: "([a-z_]+)"/g)).map((match) => match[1]);
  assert.deepEqual(Array.from(new Set(written)).sort(), ["booking_closed_out", "booking_closeout_reopened"]);
  for (const event of written) assert.ok((CATERING_BOOKING_ACTIVITY_EVENT_TYPES as readonly string[]).includes(event), event);
  // Both describe a customer-visible closeout change, so both are written with shared visibility.
  const visibilities = Array.from(route.matchAll(/eventType: "[a-z_]+", visibility: "(\w+)"/g)).map((match) => match[1]);
  assert.deepEqual(Array.from(new Set(visibilities)), ["shared"]);
});

test("checklist and note writes produce no activity at all", () => {
  const itemHandler = route.slice(route.indexOf('r.put("/bookings/:id/closeout/items/:itemKey"'), route.indexOf('r.put("/bookings/:id/closeout/notes"'));
  const notesHandler = route.slice(route.indexOf('r.put("/bookings/:id/closeout/notes"'), route.indexOf("async function notifyCloseout"));
  for (const body of [itemHandler, notesHandler]) {
    assert.equal(body.includes("cateringBookingActivity"), false, "provider-private churn must not reach any feed");
    assert.equal(body.includes("notifications"), false);
  }
});

test("no activity is written for a shared document, because Phase 2I already records one", () => {
  // A final document arriving is `shared_file_uploaded`, written by the Phase 2I upload route. Recording it again
  // here would put the same event in the feed twice.
  assert.equal(route.includes("shared_file_uploaded"), false);
  assert.equal(route.includes("document_delivered"), false);
});

test("each activity row is written inside the SAME transaction as the state it describes", () => {
  for (const marker of ['r.post("/bookings/:id/closeout/complete"', 'r.post("/bookings/:id/closeout/reopen"']) {
    const start = route.indexOf(marker);
    const body = route.slice(start, route.indexOf("});", route.indexOf("const result = await db.transaction", start)));
    assert.ok(body.includes("await tx.insert(cateringBookingActivity)"), marker);
    // A rolled-back write therefore leaves no history, and a committed one cannot fail to record it.
    assert.equal(body.includes("await db.insert(cateringBookingActivity)"), false, marker);
  }
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Notifications
 * ----------------------------------------------------------------------------------------------------------- */

test("exactly one notification exists in this phase, and it is the closeout completion", () => {
  const inserts = route.match(/db\.insert\(notifications\)/g) ?? [];
  assert.equal(inserts.length, 1);
  assert.ok(route.includes("CATERING_CLOSEOUT_NOTIFICATION.type"));
  assert.ok(route.includes("await notifyCloseout(booking, userId, id)"));
});

test("the notification carries fixed wording and no provider-private content", () => {
  assert.deepEqual(Object.keys(CATERING_CLOSEOUT_NOTIFICATION).sort(), ["message", "title", "type"]);
  const text = `${CATERING_CLOSEOUT_NOTIFICATION.title} ${CATERING_CLOSEOUT_NOTIFICATION.message}`;
  for (const forbidden of ["note", "incident", "checklist", "crew", "equipment", "damage"]) {
    assert.equal(text.toLowerCase().includes(forbidden), false, `${forbidden} must not appear in notification text`);
  }
  // The link is the CUSTOMER's own workspace section, because the counterpart of a provider action is the customer.
  assert.ok(route.includes('cateringCloseoutSectionPath("customer", bookingId)'));
  assert.equal(cateringCloseoutSectionPath("customer", "b1"), "/services/catering/bookings/b1#closeout");
});

test("reopening notifies nobody: it is the provider correcting their own record", () => {
  const reopen = route.slice(route.indexOf('r.post("/bookings/:id/closeout/reopen"'));
  assert.equal(reopen.includes("notifyCloseout"), false);
  assert.equal(reopen.includes("notifications"), false);
});

test("the notification is sent only on a genuine first close, never on a retry", () => {
  const complete = route.slice(route.indexOf('r.post("/bookings/:id/closeout/complete"'), route.indexOf('r.post("/bookings/:id/closeout/reopen"'));
  // The already-closed branch carries `notify: false`, and the send is guarded on that flag.
  assert.ok(complete.includes('{ kind: "settled", record: outcome.record as CateringBookingCloseoutRecord, notify: false }'));
  assert.ok(complete.includes("if (result.notify) await notifyCloseout"));
});

test("the notification is best effort and never fails the request that produced it", () => {
  assert.ok(route.includes(".catch(() => undefined)"));
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Idempotency
 * ----------------------------------------------------------------------------------------------------------- */

test("a retried completion creates no second row, no second activity event and no second notification", () => {
  const first = resolveCateringCloseoutComplete(undefined, answeredFacts, undefined, NOW);
  assert.equal(first.kind, "close");
  // The first attempt committed and moved the version. The retry carries the version it was built with.
  const closed = { closedOutAt: NOW, reopenCount: 0, updatedAt: NOW };
  const retry = resolveCateringCloseoutComplete(closed, answeredFacts, undefined, LATER);
  assert.equal(retry.kind, "already_closed", "the retry resolves to the settled record rather than writing again");
});

test("a retried reopen creates no second activity event", () => {
  const closed = { closedOutAt: NOW, reopenCount: 0, updatedAt: NOW };
  const first = resolveCateringCloseoutReopen(closed, NOW.toISOString(), LATER);
  assert.equal(first.kind, "reopen");
  const retry = resolveCateringCloseoutReopen({ closedOutAt: null, reopenCount: 1, updatedAt: LATER }, NOW.toISOString(), LATER);
  assert.equal(retry.kind, "already_open");
});

test("a retried checklist save is unchanged, so it cannot even disturb the concurrency version", () => {
  const row = { state: "completed", providerNote: "done", resolvedAt: NOW, updatedAt: NOW };
  const retry = resolveCateringCloseoutItemSave(row, { state: "completed", providerNote: "done", expectedUpdatedAt: NOW.toISOString() }, LATER);
  assert.equal(retry.kind, "unchanged");
});

test("a checklist item needs no idempotency token, because it is state keyed by (booking, key)", () => {
  // Asking for the same state twice leaves one row in one state -- which is what makes a retry from a phone on a
  // bad connection harmless with nothing to replay.
  assert.equal(route.includes("clientRequestId"), false);
  assert.equal(route.includes("CreateRequests"), false);
});

test("the completion gate is re-derived from the LOCKED checklist inside the transaction", () => {
  const complete = route.slice(route.indexOf('r.post("/bookings/:id/closeout/complete"'), route.indexOf('r.post("/bookings/:id/closeout/reopen"'));
  assert.ok(complete.includes("await Promise.all([closeoutItems(tx, id)"), "the checklist is read under the lock");
  assert.ok(complete.includes("cateringCloseoutFacts("));
  assert.ok(complete.includes("resolveCateringCloseoutComplete(current, facts, input.expectedUpdatedAt"));
});
