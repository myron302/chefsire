import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  serializeExecutionAccess,
  serializeExecutionEquipment,
  serializeExecutionMilestones,
  serializeExecutionStaffAssignment,
  serializeExecutionTimelineItem,
} from "./catering-booking-execution";
import { CATERING_EXECUTION_MILESTONE_KEYS } from "@shared/catering-booking-execution";

/**
 * The Phase 2J serializers.
 *
 * The privacy boundary this phase promises is enforced in two independent places: the route never SELECTS a
 * provider-private record for a customer, and these projections never emit a provider-only field. This suite is
 * about the second: what actually leaves the server, field by field, for each actor.
 */

const NOW = new Date("2026-09-08T12:00:00.000Z");
const EARLIER = new Date("2026-09-08T11:00:00.000Z");

const timelineRow = {
  id: "item-1", bookingId: "booking-1", title: "Load in", description: "Through the rear dock",
  category: "load_in", scheduledTime: "07:30", endTime: "08:30", visibility: "shared", sortOrder: 0,
  isBlocker: true, completedAt: NOW, completedBy: "provider-1", createdBy: "provider-1",
  clientRequestId: "11111111-1111-4111-8111-111111111111", createdAt: EARLIER, updatedAt: NOW,
};
const staffRow = {
  id: "staff-1", bookingId: "booking-1", workerName: "Ada", role: "chef", customRole: null,
  contactNote: "On the crew channel", arrivalTime: "07:00", departureTime: "15:00",
  responsibilityNote: "Runs the hot line", createdBy: "provider-1",
  clientRequestId: null, createdAt: EARLIER, updatedAt: NOW,
};
const equipmentRow = {
  id: "equipment-1", bookingId: "booking-1", name: "Chafer", quantity: 6, sourceType: "rental",
  sourceName: "Ace Rentals", pickupDate: "2026-09-07", pickupTime: "16:00", returnDate: "2026-09-09",
  returnTime: "10:00", status: "confirmed", isBlocker: false, notes: "Collect from the depot",
  visibility: "provider_private", createdBy: "provider-1", clientRequestId: null, createdAt: EARLIER, updatedAt: NOW,
};
const accessRow = {
  bookingId: "booking-1", loadInEntrance: "Rear dock", loadingDockNotes: "Ring the bell",
  elevatorNotes: null, kitchenAccessNotes: null, parkingInstructions: "Two bays reserved",
  securityCheckInNotes: null, accessWindowStart: "06:00", accessWindowEnd: "23:00",
  venueContactName: "Sam", venueContactPhone: "555-0100", venueContactSource: "customer",
  powerWaterNotes: null, trashRemovalNotes: null, specialRestrictions: null,
  providerPrivateNotes: "The site manager is unreliable", accessConfirmed: true,
  updatedBy: "provider-1", updatedAt: NOW,
};

/** Server ownership metadata and caller retry tokens, which no participant's interface needs. */
const NEVER_SERIALIZED = ["bookingId", "createdBy", "completedBy", "updatedBy", "clientRequestId"];

test("a timeline item never carries ownership metadata or the caller's retry token, for either actor", () => {
  for (const role of ["provider", "customer"] as const) {
    const view = serializeExecutionTimelineItem(timelineRow as never, role);
    for (const field of NEVER_SERIALIZED) assert.equal(field in view, false, `${role}: ${field}`);
  }
  const view = serializeExecutionTimelineItem(timelineRow as never, "provider");
  assert.deepEqual(Object.keys(view).sort(), [
    "category", "completed", "completedAt", "createdAt", "description", "endTime", "id", "isBlocker",
    "scheduledTime", "sortOrder", "title", "updatedAt", "visibility",
  ]);
  // Completion is exposed as the fact plus its instant, derived from the timestamp rather than trusted separately.
  assert.equal(view.completed, true);
  assert.equal(view.completedAt, NOW.toISOString());
  assert.equal(serializeExecutionTimelineItem({ ...timelineRow, completedAt: null } as never, "provider").completed, false);
  assert.equal(serializeExecutionTimelineItem({ ...timelineRow, completedAt: null } as never, "provider").completedAt, null);
  // The version the client sends back as its optimistic-concurrency precondition.
  assert.equal(view.updatedAt, NOW.toISOString());
});

test("a crew assignment has exactly one view, and it carries no user id at all", () => {
  const view = serializeExecutionStaffAssignment(staffRow as never);
  for (const field of NEVER_SERIALIZED) assert.equal(field in view, false, field);
  assert.deepEqual(Object.keys(view).sort(), [
    "arrivalTime", "contactNote", "createdAt", "customRole", "departureTime", "id", "responsibilityNote",
    "role", "updatedAt", "workerName",
  ]);
  // The worker is a LABEL. Nothing here links a crew member to a ChefSire account.
  assert.equal(view.workerName, "Ada");
  assert.equal(JSON.stringify(view).includes("provider-1"), false);
});

test("the crew serializer takes no role argument, so it cannot be called with the wrong one", () => {
  // A customer variant would be a filter that could be invoked incorrectly; there is no customer variant at all, and
  // the route simply never reaches this code for a customer.
  assert.equal(serializeExecutionStaffAssignment.length, 1);
});

test("equipment serializes its full operational record without ownership metadata", () => {
  const view = serializeExecutionEquipment(equipmentRow as never);
  for (const field of NEVER_SERIALIZED) assert.equal(field in view, false, field);
  assert.equal(view.quantity, 6);
  assert.equal(view.status, "confirmed");
  assert.equal(view.visibility, "provider_private");
  assert.equal(view.pickupDate, "2026-09-07");
  assert.equal(view.returnTime, "10:00");
  assert.equal(view.updatedAt, NOW.toISOString());
});

test("a customer's access object does not carry the provider-private key at all", () => {
  const provider = serializeExecutionAccess(accessRow as never, "provider");
  const customer = serializeExecutionAccess(accessRow as never, "customer");
  assert.equal(provider.providerPrivateNotes, "The site manager is unreliable");
  // Not null -- ABSENT. A null would still tell the customer the field exists and give an interface somewhere to
  // render it the moment a serializer changed.
  assert.equal("providerPrivateNotes" in customer, false);
  assert.equal(JSON.stringify(customer).includes("site manager"), false);
  assert.equal(JSON.stringify(customer).includes("provider-1"), false, "and no updatedBy either");
});

test("the access record restates no authoritative event location or date, for either actor", () => {
  for (const role of ["provider", "customer"] as const) {
    const view = serializeExecutionAccess(accessRow as never, role) as Record<string, unknown>;
    for (const field of ["venueAddress", "venueCity", "venueState", "venuePostalCode", "eventDate", "guestCount", "agreedPrice"]) {
      assert.equal(field in view, false, `${role}: ${field}`);
    }
  }
});

test("customer-supplied venue contact keeps its provenance visible to both participants", () => {
  assert.equal(serializeExecutionAccess(accessRow as never, "customer").venueContactSource, "customer");
  assert.equal(serializeExecutionAccess(accessRow as never, "provider").venueContactSource, "customer");
  assert.equal(serializeExecutionAccess({ ...accessRow, venueContactSource: null } as never, "provider").venueContactSource, null);
});

test("a booking with no access record still serializes a real empty record for each actor", () => {
  const provider = serializeExecutionAccess(undefined, "provider");
  const customer = serializeExecutionAccess(undefined, "customer");
  assert.equal(provider.accessConfirmed, false);
  assert.equal(provider.updatedAt, null, "which is the precondition meaning 'no record existed'");
  assert.equal(provider.providerPrivateNotes, null);
  assert.equal("providerPrivateNotes" in customer, false);
  assert.equal(customer.accessConfirmed, false);
});

test("the milestone board reports every allowlisted key, including untouched ones", () => {
  const rows = [{ bookingId: "booking-1", milestoneKey: "arrived", completedAt: NOW, completedBy: "provider-1", createdAt: EARLIER, updatedAt: NOW }];
  const view = serializeExecutionMilestones(rows as never);
  assert.equal(view.length, CATERING_EXECUTION_MILESTONE_KEYS.length);
  assert.deepEqual(view.map((entry) => entry.key), [...CATERING_EXECUTION_MILESTONE_KEYS]);
  const arrived = view.find((entry) => entry.key === "arrived")!;
  assert.equal(arrived.completed, true);
  assert.equal(arrived.completedAt, NOW.toISOString());
  assert.equal(arrived.updatedAt, NOW.toISOString());
  // An untouched key has no version, which is exactly the "expect no record" precondition the client sends back.
  const untouched = view.find((entry) => entry.key === "service_started")!;
  assert.equal(untouched.completed, false);
  assert.equal(untouched.updatedAt, null);
  // And no completer id reaches the client on any entry.
  assert.equal(JSON.stringify(view).includes("provider-1"), false);
});

test("every serializer is an explicit projection rather than a spread of the row", () => {
  // Structural: a spread would let a column added to one of these tables start reaching a customer merely because
  // it exists. Each function names its fields, so a new column has to be added to a view deliberately.
  const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-execution.ts"), "utf8");
  assert.equal(/\.\.\.\s*row\b/.test(source), false, "no serializer spreads a database row");
  for (const field of ["storageKey", "createdBy:", "completedBy:", "updatedBy:", "clientRequestId:"]) {
    assert.equal(source.includes(field), false, `serializers must not emit ${field}`);
  }
});


/* ================================================================================================================ *
 * P1 -- a customer must not learn where the provider-private items sit
 * ================================================================================================================ */

/** A run-of-show whose private items sit BETWEEN the shared ones, which is what makes the gaps informative. */
const mixedTimeline = [
  { ...timelineRow, id: "shared-1", visibility: "shared", sortOrder: 0, title: "Guests arrive" },
  { ...timelineRow, id: "private-1", visibility: "provider_private", sortOrder: 1, title: "Crew briefing" },
  { ...timelineRow, id: "private-2", visibility: "provider_private", sortOrder: 2, title: "Sub swap" },
  { ...timelineRow, id: "shared-2", visibility: "shared", sortOrder: 3, title: "Service begins" },
];
/** What the route hands each actor: a customer's list is visibility-filtered in SQL before it reaches here. */
const asCustomer = () => mixedTimeline.filter((row) => row.visibility === "shared").map((row) => serializeExecutionTimelineItem(row as never, "customer"));
const asProvider = () => mixedTimeline.map((row) => serializeExecutionTimelineItem(row as never, "provider"));

test("P1: a customer's timeline item carries no persisted sort position at all", () => {
  for (const item of asCustomer()) {
    assert.equal("sortOrder" in item, false, `${item.title} leaked a position`);
    assert.equal(item.sortOrder, undefined);
  }
});

test("P1: the customer payload contains nothing from which two hidden records could be inferred", () => {
  const customer = asCustomer();
  // Only the shared records are present.
  assert.deepEqual(customer.map((item) => item.title), ["Guests arrive", "Service begins"]);
  // And nothing anywhere in the serialized payload carries the persisted positions 0 and 3, or the count between.
  const serialized = JSON.stringify(customer);
  assert.equal(serialized.includes("sortOrder"), false);
  assert.equal(serialized.includes("Crew briefing"), false);
  assert.equal(serialized.includes("Sub swap"), false);
  // Every remaining numeric field is either absent or intrinsic to the row itself -- there is no index, sequence or
  // count derived from the mixed collection.
  for (const item of customer) {
    for (const [field, value] of Object.entries(item)) {
      assert.equal(typeof value === "number", false, `${field} is a number a position could hide in`);
    }
  }
});

test("P1: the gap is genuinely what would have leaked -- the provider still sees 0 and 3", () => {
  const provider = asProvider();
  assert.deepEqual(provider.map((item) => item.sortOrder), [0, 1, 2, 3]);
  // The two shared items the customer receives sit at 0 and 3 for the provider, so serializing that to a customer
  // whose list holds only those two would have said "two records you cannot see are between them".
  const sharedPositions = provider.filter((item) => item.visibility === "shared").map((item) => item.sortOrder);
  assert.deepEqual(sharedPositions, [0, 3]);
});

test("P1: provider ordering is unchanged and still authoritative", () => {
  const provider = asProvider();
  // The persisted order is preserved exactly, private items included, so reordering still has real positions to
  // work from and the reorder response still carries them.
  assert.deepEqual(provider.map((item) => item.id), ["shared-1", "private-1", "private-2", "shared-2"]);
  assert.deepEqual(provider.map((item) => item.sortOrder), [0, 1, 2, 3]);
});

test("P1: the customer's shared items keep their relative order, which is what the client renders from", () => {
  // Array order survives the filter, so nothing about rendering depends on the position that was removed.
  assert.deepEqual(asCustomer().map((item) => item.id), ["shared-1", "shared-2"]);
  const reversedSource = [...mixedTimeline].reverse().filter((row) => row.visibility === "shared");
  assert.deepEqual(reversedSource.map((row) => serializeExecutionTimelineItem(row as never, "customer")).map((item) => item.id), ["shared-2", "shared-1"]);
});

test("P1 audit: no other customer-visible field is derived from the mixed collection", () => {
  // Equipment is filtered the same way and carries no position, index or sequence of any kind.
  const equipment = serializeExecutionEquipment({ ...equipmentRow, visibility: "shared" } as never);
  for (const field of ["sortOrder", "position", "index", "sequence", "rank"]) assert.equal(field in equipment, false, field);
  // Access is a single row per booking, so it has no collection to leak from.
  const access = serializeExecutionAccess(accessRow as never, "customer") as Record<string, unknown>;
  for (const field of ["sortOrder", "position", "index", "count"]) assert.equal(field in access, false, field);
  // And the serializer source names no count or index anywhere.
  const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-execution.ts"), "utf8");
  assert.equal(/\.length\b/.test(source.replace(/CATERING_EXECUTION_MILESTONE_KEYS/g, "")), false, "no length of a collection is serialized");
});


/* ================================================================================================================ *
 * P2 -- a customer must not be able to watch a provider's private edits through a version
 * ================================================================================================================ */

/**
 * The leak this section closes is a TIMESTAMP, not a value.
 *
 * The access record carries one provider-private column. A provider who edits only `providerPrivateNotes` changes
 * nothing a customer can read -- but the row's version moves, and a customer holding that version could compare it
 * across polls and learn that hidden activity happened, roughly when, and on a first private-only save that a
 * record had come into existence at all. So a customer's access object carries no version.
 *
 * The run-of-show has the same shape for a different reason: a reorder rewrites EVERY item's position and bumps
 * every version with it, so moving a provider-private item to the top bumps the shared items below it while the
 * customer's rendered order does not change at all.
 */

/** The same booking's access row after a provider edited ONLY their private note: one column, and the version. */
const LATER = new Date("2026-09-08T13:00:00.000Z");
const accessRowAfterPrivateEdit = { ...accessRow, providerPrivateNotes: "Escalated to the venue owner", updatedAt: LATER };
/** And a row where a private note is the ONLY thing ever written, which is a record's whole existence. */
const accessRowPrivateOnly = {
  bookingId: "booking-1", loadInEntrance: null, loadingDockNotes: null, elevatorNotes: null,
  kitchenAccessNotes: null, parkingInstructions: null, securityCheckInNotes: null,
  accessWindowStart: null, accessWindowEnd: null, venueContactName: null, venueContactPhone: null,
  venueContactSource: null, powerWaterNotes: null, trashRemovalNotes: null, specialRestrictions: null,
  providerPrivateNotes: "Do not let the client near the fryer", accessConfirmed: false,
  updatedBy: "provider-1", updatedAt: LATER,
};

test("P2: a customer's access object carries no version at all", () => {
  const customer = serializeExecutionAccess(accessRow as never, "customer");
  // Absent, not null. A null is still a key, and a key is still somewhere for a future serializer to put a value.
  assert.equal("updatedAt" in customer, false);
  assert.equal(customer.updatedAt, undefined);
  assert.equal(JSON.stringify(customer).includes("updatedAt"), false);
  assert.equal(JSON.stringify(customer).includes(NOW.toISOString()), false);
});

test("P2: a private-only edit changes NOTHING in the customer's access object", () => {
  const before = serializeExecutionAccess(accessRow as never, "customer");
  const after = serializeExecutionAccess(accessRowAfterPrivateEdit as never, "customer");
  // Byte for byte. Two polls either side of the private edit are indistinguishable, which is the whole point.
  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.deepEqual(after, before);
  // The provider, meanwhile, sees exactly what changed -- including the version their next save must assert.
  const provider = serializeExecutionAccess(accessRowAfterPrivateEdit as never, "provider");
  assert.equal(provider.providerPrivateNotes, "Escalated to the venue owner");
  assert.equal(provider.updatedAt, LATER.toISOString());
});

test("P2: a record that exists ONLY because of a private note is invisible to the customer", () => {
  const none = serializeExecutionAccess(undefined, "customer");
  const privateOnly = serializeExecutionAccess(accessRowPrivateOnly as never, "customer");
  // Indistinguishable from "no access record has ever been written", so the first private save does not announce
  // itself through a version appearing where there was none.
  assert.deepEqual(privateOnly, none);
  assert.equal(JSON.stringify(privateOnly), JSON.stringify(none));
  // The provider's two cases stay distinguishable, because the version IS the precondition their next save sends.
  assert.equal(serializeExecutionAccess(undefined, "provider").updatedAt, null);
  assert.equal(serializeExecutionAccess(accessRowPrivateOnly as never, "provider").updatedAt, LATER.toISOString());
});

test("P2: a customer-visible edit still reaches the customer, version or no version", () => {
  const changed = serializeExecutionAccess({ ...accessRow, parkingInstructions: "Bay 4 only", updatedAt: LATER } as never, "customer");
  const before = serializeExecutionAccess(accessRow as never, "customer");
  assert.equal(changed.parkingInstructions, "Bay 4 only");
  assert.notDeepEqual(changed, before);
  // Removing the version removed a signal, not information: every field the customer is entitled to still travels.
  assert.equal("updatedAt" in changed, false);
});

test("P2: the customer's access values are otherwise exactly the provider's", () => {
  const provider = serializeExecutionAccess(accessRow as never, "provider") as Record<string, unknown>;
  const customer = serializeExecutionAccess(accessRow as never, "customer") as Record<string, unknown>;
  // Only two keys separate them, and both are the provider's alone.
  assert.deepEqual(Object.keys(provider).filter((key) => !(key in customer)).sort(), ["providerPrivateNotes", "updatedAt"]);
  assert.deepEqual(Object.keys(customer).filter((key) => !(key in provider)), []);
  for (const key of Object.keys(customer)) assert.deepEqual(customer[key], provider[key], key);
});

test("P2 audit: a customer's run-of-show item carries no version either", () => {
  for (const item of asCustomer()) {
    assert.equal("updatedAt" in item, false, `${item.title} leaked a version`);
    assert.equal(item.updatedAt, undefined);
  }
  // `createdAt` stays. It belongs to the record the customer is being shown, and no provider-private write can move
  // it -- a reorder rewrites positions and versions, never creation instants.
  for (const item of asCustomer()) assert.equal(item.createdAt, EARLIER.toISOString());
  // The provider keeps it, because every run-of-show mutation asserts it.
  for (const item of asProvider()) assert.equal(item.updatedAt, NOW.toISOString());
});

test("P2 audit: reordering around a private item leaves the customer's payload identical", () => {
  // The provider drags the private "Sub swap" to the top. Positions are rewritten across the WHOLE collection and
  // every version is bumped with them, so both shared rows are rewritten -- while the customer's two items stay in
  // the same relative order and every field they can read is unchanged.
  const reordered = [
    { ...timelineRow, id: "private-2", visibility: "provider_private", sortOrder: 0, title: "Sub swap", updatedAt: LATER },
    { ...timelineRow, id: "shared-1", visibility: "shared", sortOrder: 1, title: "Guests arrive", updatedAt: LATER },
    { ...timelineRow, id: "private-1", visibility: "provider_private", sortOrder: 2, title: "Crew briefing", updatedAt: LATER },
    { ...timelineRow, id: "shared-2", visibility: "shared", sortOrder: 3, title: "Service begins", updatedAt: LATER },
  ];
  const after = reordered.filter((row) => row.visibility === "shared").map((row) => serializeExecutionTimelineItem(row as never, "customer"));
  assert.equal(JSON.stringify(after), JSON.stringify(asCustomer()), "a private drag is not customer-visible news");
  // And the provider does see the move, on both the position and the version their next request asserts.
  const provider = reordered.map((row) => serializeExecutionTimelineItem(row as never, "provider"));
  assert.deepEqual(provider.map((item) => item.sortOrder), [0, 1, 2, 3]);
  for (const item of provider) assert.equal(item.updatedAt, LATER.toISOString());
});

test("P2 audit: no other customer-visible record can be moved by a provider-private-only write", () => {
  // Equipment: every column this serializer emits is customer-visible, so there is no private-only write that could
  // move an equipment row's version without also moving something the customer can read. Its version stays.
  const equipment = serializeExecutionEquipment({ ...equipmentRow, visibility: "shared" } as never);
  assert.equal(equipment.updatedAt, NOW.toISOString());
  const equipmentKeys = Object.keys(equipment);
  assert.equal(equipmentKeys.includes("providerPrivateNotes"), false);
  assert.equal(equipmentKeys.some((key) => key.toLowerCase().includes("private")), false);
  // Crew and milestones are provider-only COLLECTIONS: a customer's payload has no such key, so there is no row of
  // theirs whose version a customer could hold in the first place.
  assert.equal(serializeExecutionStaffAssignment.length, 1);
  assert.equal(serializeExecutionMilestones.length, 1);
  // Which leaves the two records that mix visibilities in one row or one collection, and both are handled above.
  const customerAccess = serializeExecutionAccess(accessRow as never, "customer") as Record<string, unknown>;
  const customerItem = asCustomer()[0] as unknown as Record<string, unknown>;
  for (const view of [customerAccess, customerItem]) {
    for (const key of Object.keys(view)) {
      assert.equal(/^(updatedAt|version|revision|etag|lastModified)$/i.test(key), false, `${key} is a version a private write could move`);
    }
  }
});
