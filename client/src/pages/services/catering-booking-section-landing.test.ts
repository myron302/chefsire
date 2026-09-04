import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_COMMUNICATION_SECTION, CATERING_FILES_SECTION, cateringBookingSectionPath } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_SECTION_IDS, EMPTY_CATERING_SECTION_LANDING, cateringWorkspaceSectionFromHash, recordCateringSectionLanding, shouldLandOnCateringSection } from "./catering-booking-workspace-state";

/**
 * Notification deep links must actually land, including on a cold load.
 *
 * A booking notification links to `.../bookings/<id>#communication` or `#files`. On a cold load the browser resolves
 * that fragment while the workspace is still rendering its loading state -- the target element does not exist yet,
 * and nothing resolves it a second time once the data arrives. The participant is told they have a new message and
 * dropped at the top of the page.
 *
 * The state machine is exercised behaviourally here; there is no DOM harness in this suite, so the effect that
 * consumes it is asserted structurally against the page source, as elsewhere in Phase 2I.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(here, "catering-booking-workspace.tsx"), "utf8");
const landingEffect = page.slice(page.indexOf("// Deep-linked sections, resolved once the workspace actually exists."), page.indexOf("const request = async ("));

test("1 & 2. the sections notifications link to are exactly the sections that can be landed on", () => {
  // The link the server builds and the fragment the page resolves are the same contract, not two spellings of it.
  const files = cateringBookingSectionPath("customer", "booking-1", CATERING_FILES_SECTION);
  const communication = cateringBookingSectionPath("provider", "booking-1", CATERING_COMMUNICATION_SECTION);
  assert.equal(cateringWorkspaceSectionFromHash(new URL(files, "https://chefsire.test").hash), "files");
  assert.equal(cateringWorkspaceSectionFromHash(new URL(communication, "https://chefsire.test").hash), "communication");
  assert.equal(CATERING_WORKSPACE_SECTION_IDS.includes(CATERING_FILES_SECTION as never), true);
  assert.equal(CATERING_WORKSPACE_SECTION_IDS.includes(CATERING_COMMUNICATION_SECTION as never), true);
  // And those ids are the ones the sections actually render with.
  const files_ = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");
  const comms = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingCommunication.tsx"), "utf8");
  assert.equal(files_.includes(`<Card id="files">`), true);
  assert.equal(comms.includes(`<Card id="communication">`), true);
});

test("3. a hash present before the data resolves is honoured afterwards", () => {
  // The effect is gated on the workspace existing, so it runs on the first render that HAS one -- reading the
  // fragment that is still sitting in the address bar from the cold navigation.
  assert.equal(landingEffect.includes("if (!workspace || typeof window === \"undefined\") return;"), true);
  assert.equal(landingEffect.includes("cateringWorkspaceSectionFromHash(window.location.hash)"), true);
  assert.equal(landingEffect.includes("}, [Boolean(workspace)]);"), true);
  // Nothing has been landed on before that first run, so the fragment is still pending and is acted on.
  assert.equal(shouldLandOnCateringSection(EMPTY_CATERING_SECTION_LANDING, "communication"), true);
  assert.equal(shouldLandOnCateringSection(EMPTY_CATERING_SECTION_LANDING, "files"), true);
});

test("4. an unknown or absent fragment resolves to nothing and never lands", () => {
  for (const hash of ["", "#", "#nonsense", "#Communication", "#files/../secret", "#activity-log", "#/files"]) {
    assert.equal(cateringWorkspaceSectionFromHash(hash), null, hash);
    assert.equal(shouldLandOnCateringSection(EMPTY_CATERING_SECTION_LANDING, cateringWorkspaceSectionFromHash(hash)), false, hash);
  }
  // An allowlist, not a lookup of whatever the fragment says, so a stale or hostile link cannot name an arbitrary
  // element for the page to scroll to and focus.
  assert.equal(landingEffect.includes("document.getElementById(section!)"), true);
  assert.equal(landingEffect.includes("if (!element) return;"), true, "a known id that is not rendered must not throw");
});

test("5. rerenders never scroll or focus again", () => {
  // Recording is what bounds it, and it is held in a ref so recording causes no render of its own.
  let landing = EMPTY_CATERING_SECTION_LANDING;
  assert.equal(shouldLandOnCateringSection(landing, "files"), true);
  landing = recordCateringSectionLanding(landing, "files");
  for (let i = 0; i < 5; i += 1) {
    assert.equal(shouldLandOnCateringSection(landing, "files"), false, "a rerender must not re-land");
    landing = recordCateringSectionLanding(landing, "files");
  }
  // Same object back, so nothing downstream sees a change either.
  assert.equal(recordCateringSectionLanding(landing, "files"), landing);
  assert.equal(landingEffect.includes("const landingRef = useRef<CateringSectionLanding>(EMPTY_CATERING_SECTION_LANDING);"), true);
  assert.equal(landingEffect.includes("landingRef.current = recordCateringSectionLanding(landingRef.current, section);"), true);
  // The record is written BEFORE the scroll, so a scroll that itself triggers a re-run cannot loop.
  assert.equal(landingEffect.indexOf("landingRef.current = recordCateringSectionLanding") < landingEffect.indexOf("scrollIntoView"), true);
  assert.equal(landingEffect.includes("setLanding"), false, "landing state must not live in React state");
});

test("6. an ordinary no-hash workspace load is completely unaffected", () => {
  assert.equal(cateringWorkspaceSectionFromHash(""), null);
  assert.equal(shouldLandOnCateringSection(EMPTY_CATERING_SECTION_LANDING, null), false);
  // Nothing is recorded either, so a fragment arriving later is still honoured.
  assert.equal(recordCateringSectionLanding(EMPTY_CATERING_SECTION_LANDING, null), EMPTY_CATERING_SECTION_LANDING);
  assert.equal(shouldLandOnCateringSection(EMPTY_CATERING_SECTION_LANDING, "files"), true);
});

test("back and forward keep working, because only the LAST fragment acted on is remembered", () => {
  let landing = recordCateringSectionLanding(EMPTY_CATERING_SECTION_LANDING, "files");
  // Navigating to another section lands, and returning to the first one lands again.
  assert.equal(shouldLandOnCateringSection(landing, "communication"), true);
  landing = recordCateringSectionLanding(landing, "communication");
  assert.equal(shouldLandOnCateringSection(landing, "files"), true);
  // The listener is what delivers those in-page navigations, and it is removed on cleanup.
  assert.equal(landingEffect.includes(`window.addEventListener("hashchange", land);`), true);
  assert.equal(landingEffect.includes(`return () => window.removeEventListener("hashchange", land);`), true);
});

test("the landing is accessible and needs no mouse", () => {
  // The real section element is scrolled to and focused, so keyboard and screen-reader users continue from the
  // section rather than the top of the document.
  assert.equal(landingEffect.includes(`element.scrollIntoView({ behavior: "smooth", block: "start" });`), true);
  assert.equal(landingEffect.includes(`element.setAttribute("tabindex", "-1")`), true);
  assert.equal(landingEffect.includes("element.focus({ preventScroll: true });"), true);
  // `-1` keeps it programmatically focusable without inserting a new tab stop, and an element that already declares
  // its own tabindex is left alone.
  assert.equal(landingEffect.includes(`if (!element.hasAttribute("tabindex"))`), true);
});


/**
 * The landing record must describe the CURRENT navigation state, not merely the last section landed on.
 *
 * Returning early on a cleared hash left the old value stranded, so Back or Forward to that very same fragment
 * found it already "landed" and did nothing at all -- browser history navigation silently stopped working for the
 * section the user had most recently visited.
 */
test("1. a cleared or unrecognised fragment resets the landing record", () => {
  let landing = recordCateringSectionLanding(EMPTY_CATERING_SECTION_LANDING, "files");
  assert.equal(landing.landedOn, "files");
  // Same-document navigation clears the hash: the record follows it rather than keeping "files".
  landing = recordCateringSectionLanding(landing, cateringWorkspaceSectionFromHash(""));
  assert.equal(landing.landedOn, null);
  // An unrecognised fragment resolves to null too, and resets in exactly the same way.
  landing = recordCateringSectionLanding(recordCateringSectionLanding(landing, "communication"), cateringWorkspaceSectionFromHash("#nonsense"));
  assert.equal(landing.landedOn, null);
});

test("2 & 3. #files -> no hash -> #files lands again, and the same for #communication", () => {
  for (const section of ["files", "communication"]) {
    let landing = EMPTY_CATERING_SECTION_LANDING;
    assert.equal(shouldLandOnCateringSection(landing, section), true);
    landing = recordCateringSectionLanding(landing, section);
    // Hash cleared.
    assert.equal(shouldLandOnCateringSection(landing, null), false);
    landing = recordCateringSectionLanding(landing, null);
    // Back to the same fragment: it lands again, which it did not before this fix.
    assert.equal(shouldLandOnCateringSection(landing, section), true, section);
  }
});

test("4. Back and Forward across sections and an empty hash keep working", () => {
  // #files -> #communication -> (no hash) -> back to #communication -> back to #files.
  let landing = EMPTY_CATERING_SECTION_LANDING;
  for (const step of ["files", "communication", null, "communication", "files"]) {
    if (step !== null) assert.equal(shouldLandOnCateringSection(landing, step), true, String(step));
    landing = recordCateringSectionLanding(landing, step);
  }
  assert.equal(landing.landedOn, "files");
});

test("5. an unchanged fragment still does not land twice, so rerenders never re-scroll", () => {
  let landing = recordCateringSectionLanding(EMPTY_CATERING_SECTION_LANDING, "files");
  for (let i = 0; i < 5; i += 1) {
    assert.equal(shouldLandOnCateringSection(landing, "files"), false);
    // Recording an unchanged fragment returns the SAME object, so the reset path cannot churn state either.
    assert.equal(recordCateringSectionLanding(landing, "files"), landing);
    landing = recordCateringSectionLanding(landing, "files");
  }
});

test("6. an unknown hash neither crashes nor poisons a later valid navigation", () => {
  let landing = recordCateringSectionLanding(EMPTY_CATERING_SECTION_LANDING, "communication");
  for (const junk of ["#nonsense", "#Files", "#files/../secret", "#", ""]) {
    assert.equal(cateringWorkspaceSectionFromHash(junk), null, junk);
    landing = recordCateringSectionLanding(landing, cateringWorkspaceSectionFromHash(junk));
  }
  // A real fragment afterwards still lands.
  assert.equal(shouldLandOnCateringSection(landing, "files"), true);
  assert.equal(shouldLandOnCateringSection(landing, "communication"), true);
});

test("7. the reset happens before the early return, and cold-load handling is unchanged", () => {
  // The record is written on the not-landing path too -- that is the whole fix.
  const guard = landingEffect.slice(landingEffect.indexOf("if (!shouldLandOnCateringSection"), landingEffect.indexOf("const element ="));
  assert.equal(guard.includes("landingRef.current = recordCateringSectionLanding(landingRef.current, section);"), true);
  assert.equal(guard.indexOf("recordCateringSectionLanding") < guard.indexOf("return;"), true, "the record must be updated before returning");
  // Cold async load and the hashchange listener are both still there.
  assert.equal(landingEffect.includes("if (!workspace || typeof window === \"undefined\") return;"), true);
  assert.equal(landingEffect.includes("}, [Boolean(workspace)]);"), true);
  assert.equal(landingEffect.includes(`window.addEventListener("hashchange", land);`), true);
  // And a known section that simply is not rendered yet still leaves the record alone, so it can land later.
  assert.equal(landingEffect.includes("if (!element) return;"), true);
  assert.equal(landingEffect.indexOf("if (!element) return;") < landingEffect.indexOf("element.scrollIntoView"), true);
});
