import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringCloseoutGuard } from "../services/catering-booking-closeout-policy";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { CATERING_BOOKING_STATUSES } from "@shared/catering-bookings";

/**
 * The Phase 2K authorization, privacy and lifecycle guarantees, at the route layer.
 *
 * There is no database harness in this suite, as in every other catering phase, so the route-level guarantees are
 * asserted STRUCTURALLY against the route source: which helper resolves the booking, where the acting identity
 * comes from, which reads are not issued at all for a customer, and which mutations take the authoritative lock.
 * The behavioural half -- what each resolution actually decides -- is exercised against the policy functions in
 * `catering-booking-closeout-policy.test.ts`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-closeout.ts"), "utf8");
const registry = fs.readFileSync(path.join(here, "index.ts"), "utf8");

const MARKERS = [
  'r.get("/bookings/:id/closeout"',
  'r.put("/bookings/:id/closeout/items/:itemKey"',
  'r.put("/bookings/:id/closeout/notes"',
  'r.post("/bookings/:id/closeout/complete"',
  'r.post("/bookings/:id/closeout/reopen"',
];
function handler(marker: string): string {
  const start = route.indexOf(marker);
  assert.notEqual(start, -1, `route not registered: ${marker}`);
  const next = MARKERS.map((other) => route.indexOf(other)).filter((at) => at > start).sort((a, b) => a - b)[0];
  return route.slice(start, next === undefined ? route.length : next);
}
/** Every mutation, i.e. everything but the cohesive read. */
const MUTATIONS = MARKERS.slice(1);

/* ----------------------------------------------------------------------------------------------------------- *
 * Surface
 * ----------------------------------------------------------------------------------------------------------- */

test("every closeout route lives inside the catering booking namespace and is mounted there", () => {
  for (const marker of MARKERS) assert.notEqual(route.indexOf(marker), -1, marker);
  assert.ok(registry.includes('import cateringBookingCloseoutRouter from "./catering-booking-closeout"'));
  assert.ok(registry.includes('r.use("/catering", cateringBookingCloseoutRouter)'));
  // No route in this phase lives outside `/bookings/:id/closeout`, so nothing here is a general-purpose CRUD API.
  for (const registration of route.match(/r\.(get|post|put|patch|delete)\("[^"]+"/g) ?? []) {
    assert.ok(registration.includes("/bookings/:id/closeout"), registration);
  }
});

test("every route requires authentication", () => {
  for (const marker of MARKERS) assert.ok(handler(marker).includes("requireAuth"), marker);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Identity and ownership
 * ----------------------------------------------------------------------------------------------------------- */

test("the acting user comes from the session and the booking from persisted ownership, on every route", () => {
  assert.ok(route.includes("const userId = (req.user as { id: string }).id"));
  assert.ok(route.includes("await ownedCateringBooking(id, userId)"));
  // `ownedCateringBooking` restricts to the persisted provider or customer, so a body naming a participant
  // contributes nothing and a stranger simply gets no row.
  for (const marker of MARKERS) assert.ok(handler(marker).includes("resolveCloseoutRequest"), marker);
});

test("the role is derived from the resolved booking, never read from the request", () => {
  assert.ok(route.includes("cateringWorkspaceRole(booking, userId)"));
  assert.equal(/req\.(body|query|params)[^;]*\brole\b/.test(route), false, "no role is ever read from a request");
  // And the derivation itself only ever answers from persisted ids.
  assert.equal(cateringWorkspaceRole({ providerId: "p", customerId: "c" }, "p"), "provider");
  assert.equal(cateringWorkspaceRole({ providerId: "p", customerId: "c" }, "c"), "customer");
  assert.equal(cateringWorkspaceRole({ providerId: "p", customerId: "c" }, "stranger"), null);
});

test("no closeout route trusts a client-supplied participant, actor or eligibility field", () => {
  for (const forged of ["providerId:", "customerId:", "closedOutBy", "completedBy", "resolvedBy:", "actorId", "eligib"]) {
    const uses = route.split("\n").filter((line) => line.includes(`req.body`) && line.includes(forged));
    assert.deepEqual(uses, [], `${forged} must never be read from a request body`);
  }
});

test("a guessed or foreign booking is an indistinguishable 404 with one message", () => {
  const notFounds = route.match(/res\.status\(404\)\.json\(\{ message: "[^"]+"/g) ?? [];
  assert.deepEqual(Array.from(new Set(notFounds)), ['res.status(404).json({ message: "Booking closeout not found"']);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Lifecycle and provider-only enforcement
 * ----------------------------------------------------------------------------------------------------------- */

test("every mutation checks the early guard, and the read does not", () => {
  for (const marker of MUTATIONS) assert.ok(handler(marker).includes("resolveCloseoutRequest(req as never, res, true)"), marker);
  assert.ok(handler(MARKERS[0]).includes("resolveCloseoutRequest(req as never, res, false)"), "reading never closes");
});

test("every mutation re-checks the lifecycle against the LOCKED booking inside its transaction", () => {
  for (const marker of MUTATIONS) {
    const body = handler(marker);
    assert.ok(body.includes("await db.transaction("), marker);
    assert.ok(body.includes("if (!await lockServedCateringBooking(tx, id)) return { kind: \"not_available\" }"), marker);
    // And serializes against any other closeout write on the same booking.
    assert.ok(body.includes("await lockCloseout(tx, id)"), marker);
  }
});

test("the guard refuses a customer on every served booking and refuses everyone on an unserved one", () => {
  for (const status of CATERING_BOOKING_STATUSES) {
    const booking = { status, completedAt: status === "completed" ? new Date() : null };
    const provider = cateringCloseoutGuard(booking, "provider");
    const customer = cateringCloseoutGuard(booking, "customer");
    if (status === "completed") {
      assert.equal(provider, "allowed");
      assert.equal(customer, "forbidden", "a customer may never write closeout");
    } else {
      assert.equal(provider, "not_available");
      assert.equal(customer, "not_available");
    }
  }
});

test("there is no customer closeout mutation route at all", () => {
  // The absence is the boundary: there is no code path that has to decide whether a particular customer write is
  // permitted, because no such route exists.
  assert.ok(route.includes("actionable: provider && served"));
  assert.equal(/role === "customer"[^\n]*mutate/i.test(route), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Privacy at the query layer
 * ----------------------------------------------------------------------------------------------------------- */

test("the checklist is not merely filtered for a customer -- it is not queried", () => {
  const read = handler(MARKERS[0]);
  assert.ok(read.includes("provider ? closeoutItems(db, id) : Promise.resolve([]"),
    "nothing about the checklist, including how many rows exist, is read on a customer's request");
});

test("a customer's payload carries no provider-only key and a provider's carries no rebooking key", () => {
  const read = handler(MARKERS[0]);
  // Absent keys rather than empty values, decided in one conditional spread.
  assert.ok(read.includes("...(provider"));
  assert.ok(read.includes("checklist: serializeCloseoutChecklist(itemRows), providerReview:"));
  assert.ok(read.includes("customerReview: serializeCustomerCloseoutReview"));
  assert.ok(read.includes("rebookPath: cateringProviderProfilePath(booking.providerId)"));
});

test("the document list filters to shared visibility in SQL for BOTH actors", () => {
  const documents = route.slice(route.indexOf("async function sharedDocuments"), route.indexOf("async function resolveCloseoutRequest"));
  assert.ok(documents.includes('eq(cateringBookingFiles.visibility, "shared")'));
  assert.ok(documents.includes("isNull(cateringBookingFiles.deletedAt)"));
  // A provider-private file is therefore never selected at all, so it cannot reach a count, an ordering or a length.
  assert.equal(documents.includes('"provider"') && documents.includes("visibility"), true);
  // No storage key, provider or URL appears in the projection for either actor.
  for (const forbidden of ["storageKey", "storageProvider", "sha256"]) {
    assert.equal(documents.includes(forbidden), false, `${forbidden} must not be serialized`);
  }
});

test("the equipment read selects only the two columns the derivation needs", () => {
  const read = handler(MARKERS[0]);
  assert.ok(read.includes("db.select({ visibility: cateringBookingEquipment.visibility, status: cateringBookingEquipment.status })"));
  // No equipment OBJECT reaches either payload; only derived counts do, and a customer's counts are built from
  // shared rows alone by `cateringCloseoutFacts`.
  assert.equal(read.includes("equipment:") && read.includes("serializeExecutionEquipment"), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * What this phase does not touch
 * ----------------------------------------------------------------------------------------------------------- */

test("no closeout route writes to the booking, the tasks, the files, the messages, the reviews or Phase 2J", () => {
  const forbiddenWrites = [
    "update(cateringBookings", "insert(cateringBookings",
    "update(cateringBookingTasks", "insert(cateringBookingTasks",
    "update(cateringBookingFiles", "insert(cateringBookingFiles", "delete(cateringBookingFiles",
    "update(cateringReviews", "insert(cateringReviews",
    "update(cateringBookingEquipment", "insert(cateringBookingEquipment",
    "update(cateringBookingExecutionTimeline", "insert(cateringBookingExecutionTimeline",
    "insert(cateringBookingExecutionMilestones", "update(cateringBookingAccessDetails",
  ];
  for (const write of forbiddenWrites) assert.equal(route.includes(write), false, `${write} must not appear`);
});

test("the only tables this phase writes are its own two, plus activity and notifications", () => {
  const inserts = Array.from(route.matchAll(/\.insert\((\w+)\)/g)).map((match) => match[1]);
  const updates = Array.from(route.matchAll(/\.update\((\w+)\)/g)).map((match) => match[1]);
  assert.deepEqual(Array.from(new Set([...inserts, ...updates])).sort(),
    ["cateringBookingActivity", "cateringBookingCloseout", "cateringBookingCloseoutItems", "notifications"]);
});

test("no closeout route fabricates payment, invoice, deposit or refund state", () => {
  for (const forbidden of ["invoice", "deposit", "refund", "balance", "amountDue", "charge"]) {
    assert.equal(new RegExp(`\\b${forbidden}`, "i").test(route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")), false, forbidden);
  }
});
