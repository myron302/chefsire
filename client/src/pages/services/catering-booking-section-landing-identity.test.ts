import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_COMMUNICATION_SECTION, CATERING_FILES_SECTION, cateringBookingSectionPath } from "@shared/catering-booking-communication";
import { EMPTY_CATERING_SECTION_LANDING, cateringSectionLandingIdentity, cateringWorkspaceSectionFromHash, recordCateringSectionLanding, shouldLandOnCateringSection, type CateringSectionLanding } from "./catering-booking-workspace-state";

/**
 * A deep link must land on the booking it names, not merely on the section.
 *
 * The router keeps one workspace component mounted across `/bookings/A#files` -> `/bookings/B#files`: only the route
 * parameter changes. The fragment is identical, so `hashchange` never fires, and a landing record keyed by fragment
 * alone still says "#files has been landed on". Booking B's participant follows a notification about B's files and
 * is left at the top of B's page -- the exact cold-load failure the landing effect exists to prevent, reintroduced
 * one navigation later.
 *
 * So a landing is identified by BOOKING plus fragment, and the effect re-runs on the booking id rather than only on
 * whether some workspace exists. There is no DOM harness in this suite, so the state machine is exercised
 * behaviourally and the effect that drives it is asserted structurally against the page source, as elsewhere in
 * Phase 2I.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(here, "catering-booking-workspace.tsx"), "utf8");
const landingEffect = page.slice(page.indexOf("// Deep-linked sections, resolved once the workspace actually exists."), page.indexOf("const request = async ("));

/** One run of the effect's `land()`, for a workspace that exists and a section element that is present. */
function land(state: CateringSectionLanding, bookingId: string, hash: string): { state: CateringSectionLanding; landed: boolean } {
  const section = cateringWorkspaceSectionFromHash(hash);
  const identity = cateringSectionLandingIdentity(bookingId, section);
  const landed = shouldLandOnCateringSection(state, identity);
  // The component records on both branches, so the simulation does too.
  return { state: recordCateringSectionLanding(state, identity), landed };
}

test("1. a landing identity is the booking and the fragment together, and null when nothing is named", () => {
  assert.equal(cateringSectionLandingIdentity("booking-a", "files"), "booking-a:files");
  assert.equal(cateringSectionLandingIdentity("booking-b", "files"), "booking-b:files");
  assert.notEqual(cateringSectionLandingIdentity("booking-a", "files"), cateringSectionLandingIdentity("booking-b", "files"));
  // A fragment naming nothing has no landing to identify, on any booking.
  assert.equal(cateringSectionLandingIdentity("booking-a", null), null);
  assert.equal(cateringSectionLandingIdentity("booking-b", cateringWorkspaceSectionFromHash("#nonsense")), null);
});

test("2. the effect derives the identity from the route booking and re-runs when that booking changes", () => {
  assert.equal(landingEffect.includes("const identity = cateringSectionLandingIdentity(params.bookingId, section);"), true);
  assert.equal(landingEffect.includes("shouldLandOnCateringSection(landingRef.current, identity)"), true);
  assert.equal(landingEffect.includes("landingRef.current = recordCateringSectionLanding(landingRef.current, identity);"), true);
  // The dependency is the booking id itself: `Boolean(workspace)` alone does not change when only the route does.
  assert.equal(landingEffect.includes("}, [params.bookingId, Boolean(workspace)]);"), true);
  assert.equal(landingEffect.includes("}, [Boolean(workspace)]);"), false);
});

test("3. following #files on one booking then #files on another lands on both", () => {
  let state = EMPTY_CATERING_SECTION_LANDING;
  const first = land(state, "booking-a", "#files");
  assert.equal(first.landed, true);
  state = first.state;
  const second = land(state, "booking-b", "#files");
  assert.equal(second.landed, true, "the second booking's files section must still be landed on");
  state = second.state;
  assert.equal(state.landedOn, "booking-b:files");
});

test("4. the same holds for #communication, which is the link a new-message notification builds", () => {
  const files = cateringBookingSectionPath("customer", "booking-a", CATERING_FILES_SECTION);
  const comms = cateringBookingSectionPath("provider", "booking-b", CATERING_COMMUNICATION_SECTION);
  assert.equal(cateringWorkspaceSectionFromHash(new URL(files, "https://chefsire.test").hash), "files");
  assert.equal(cateringWorkspaceSectionFromHash(new URL(comms, "https://chefsire.test").hash), "communication");
  let state = land(EMPTY_CATERING_SECTION_LANDING, "booking-a", "#communication").state;
  const second = land(state, "booking-b", "#communication");
  assert.equal(second.landed, true);
  state = second.state;
  // And a third booking linking to the same section is a third identity again.
  assert.equal(land(state, "booking-c", "#communication").landed, true);
});

test("5. an unchanged fragment across a booking change is exactly the case `hashchange` cannot report", () => {
  // Nothing about the URL fragment differs between these two navigations, so the only thing that can distinguish
  // them is the booking in the identity plus the effect re-running on the booking id.
  let state = land(EMPTY_CATERING_SECTION_LANDING, "booking-a", "#files").state;
  assert.equal(state.landedOn, "booking-a:files");
  assert.equal(shouldLandOnCateringSection(state, cateringSectionLandingIdentity("booking-b", "files")), true);
  assert.equal(shouldLandOnCateringSection(state, cateringSectionLandingIdentity("booking-a", "files")), false);
});

test("6. a rerender or refetch on the same booking never lands twice", () => {
  let state = land(EMPTY_CATERING_SECTION_LANDING, "booking-a", "#files").state;
  for (let rerender = 0; rerender < 5; rerender += 1) {
    const again = land(state, "booking-a", "#files");
    assert.equal(again.landed, false, "a rerender must not re-scroll or re-steal focus");
    assert.equal(again.state, state, "an unchanged identity must not allocate a new record");
    state = again.state;
  }
});

test("7. a booking change that arrives while the workspace is still loading lands once the data does", () => {
  // The effect returns early while there is no workspace, so nothing is recorded; the run that has one lands.
  let state = land(EMPTY_CATERING_SECTION_LANDING, "booking-a", "#files").state;
  // Route changes to booking B: the effect re-runs, but `workspace` is undefined for B and it returns before
  // reading the hash at all. The record therefore still belongs to A.
  assert.equal(state.landedOn, "booking-a:files");
  // B's data arrives, the effect runs again, and the identity is new.
  const landedOnB = land(state, "booking-b", "#files");
  assert.equal(landedOnB.landed, true);
  assert.equal(landedOnB.state.landedOn, "booking-b:files");
  assert.equal(landingEffect.includes("if (!workspace || typeof window === \"undefined\") return;"), true);
});

test("8. back-navigation between sections still re-lands, on one booking and across two", () => {
  let state = EMPTY_CATERING_SECTION_LANDING;
  for (const [bookingId, hash] of [["booking-a", "#files"], ["booking-a", "#communication"], ["booking-a", "#files"]] as const) {
    const step = land(state, bookingId, hash);
    assert.equal(step.landed, true, `${bookingId}${hash}`);
    state = step.state;
  }
  // Back to booking B and forward again to A's files: both are genuine navigations and both land.
  const onB = land(state, "booking-b", "#files");
  assert.equal(onB.landed, true);
  assert.equal(land(onB.state, "booking-a", "#files").landed, true);
});

test("9. clearing the fragment lands on nothing and does not strand the previous booking's record", () => {
  let state = land(EMPTY_CATERING_SECTION_LANDING, "booking-a", "#files").state;
  const cleared = land(state, "booking-a", "");
  assert.equal(cleared.landed, false, "no fragment is nothing to land on");
  assert.equal(cleared.state.landedOn, null);
  state = cleared.state;
  // Returning to the very same link lands again, because the record in between was cleared rather than kept.
  assert.equal(land(state, "booking-a", "#files").landed, true);
  // The same is true of a fragment this workspace does not recognise.
  const junk = land(state, "booking-b", "#not-a-section");
  assert.equal(junk.landed, false);
  assert.equal(junk.state.landedOn, null);
});

test("10. paging through many bookings never suppresses a landing", () => {
  let state = EMPTY_CATERING_SECTION_LANDING;
  for (const section of ["files", "communication", "activity"] as const) {
    for (let index = 0; index < 6; index += 1) {
      const step = land(state, `booking-${index}`, `#${section}`);
      assert.equal(step.landed, true, `booking-${index}#${section}`);
      state = step.state;
      // Immediately re-running on the same booking is still a no-op, so the guard has not simply been removed.
      const repeat = land(state, `booking-${index}`, `#${section}`);
      assert.equal(repeat.landed, false);
      state = repeat.state;
    }
  }
});
