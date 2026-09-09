import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringWorkspacePollInterval, effectiveCateringEditable } from "@shared/catering-booking-operations";
import { CATERING_EXECUTION_MILESTONE_KEYS } from "@shared/catering-booking-execution";

/**
 * The execution section as an EVENT-DAY interface.
 *
 * This is the surface a provider actually operates from, on a phone, standing in a loading bay. So the properties
 * asserted here are the ones that decide whether that is possible at all: touch targets big enough to hit, every
 * icon-only control named for a screen reader, controls that disable themselves while a request is in flight,
 * confirmation before anything destructive, and a layout that wraps rather than scrolling sideways.
 *
 * There is no DOM or React Query harness in this suite, as elsewhere in the catering phases, so the component's
 * wiring is asserted structurally against its source and the rules it obeys are exercised behaviourally in
 * `catering-booking-execution-state.test.ts`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingExecution.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(here, "..", "..", "pages", "services", "catering-booking-workspace.tsx"), "utf8");
const workspaceState = fs.readFileSync(path.join(here, "..", "..", "pages", "services", "catering-booking-workspace-state.ts"), "utf8");

test("the execution section lives inside the existing workspace, not a new routing hierarchy", () => {
  assert.equal(workspace.includes('import BookingExecution from "@/components/catering/BookingExecution";'), true);
  assert.equal(workspace.includes("<BookingExecution bookingId={params.bookingId} userId={user.id} role={workspace.role} editable={workspace.editable} />"), true);
  // It is another card in the same page, addressed by the same section-fragment mechanism the other sections use.
  assert.equal(component.includes('<Card id="execution">'), true);
  assert.equal(workspaceState.includes('"execution"'), true, "the section fragment is on the workspace allowlist");
  // No router, no route registration, no separate dashboard.
  assert.equal(/\bRoute\b|useLocation|wouter/.test(component), false);
});

test("it uses the same React Query patterns and the same polling policy as its sibling sections", () => {
  assert.equal(component.includes("useQuery({"), true);
  assert.equal(component.includes("useMutation({"), true);
  assert.equal(component.includes("cateringWorkspacePollInterval(effectiveCateringEditable(editable, polled.state.data?.editable))"), true);
  assert.equal(component.includes("refetchIntervalInBackground: false"), true);
  assert.equal(component.includes("refetchOnWindowFocus: true"), true);
  // A terminal booking stops the recurring poll and keeps reading, exactly as the files section does.
  assert.equal(cateringWorkspacePollInterval(effectiveCateringEditable(true, false)), false);
  assert.equal(cateringWorkspacePollInterval(effectiveCateringEditable(true, true)), 15_000);
  assert.equal(effectiveCateringEditable(false, true), false, "a terminal parent is authoritative too");
});

test("loading, error and empty states are all handled, and the error offers a retry", () => {
  assert.equal(component.includes('<p role="status">Loading the event execution plan…</p>'), true);
  assert.equal(component.includes('role="alert"'), true);
  assert.equal(component.includes("Retry loading the execution plan"), true);
  assert.equal(component.includes("query.refetch()"), true);
  assert.equal(component.includes("CATERING_EXECUTION_CUSTOMER_EMPTY"), true);
  assert.equal(component.includes("CATERING_EXECUTION_PROVIDER_EMPTY"), true);
});

test("every interactive control meets the touch-target minimum", () => {
  // Buttons, selects and the file-style inputs all carry the 44px minimum height; icon-only ones carry both.
  const controls = component.match(/<(Button|button|select|Input|input)\b[^>]*/g) ?? [];
  const unsized = controls.filter((control) => !control.includes("min-h-11") && !control.includes("h-5 w-5"));
  assert.equal(controls.length > 25, true, "the section really does have many controls");
  assert.deepEqual(unsized, [], "every control carries either the 44px minimum or the enlarged checkbox size");
  // Every icon-only button is square at the minimum, so it is hittable rather than merely tall.
  for (const iconButton of component.match(/<Button[^>]*size="icon"[^>]*/g) ?? []) {
    assert.equal(iconButton.includes("min-h-11 min-w-11"), true, iconButton);
  }
  for (const toggle of component.match(/<button[^>]*/g) ?? []) {
    assert.equal(toggle.includes("min-h-11 min-w-11"), true, toggle);
  }
});

test("no icon-only control is unlabelled", () => {
  for (const control of component.match(/<(Button|button)[^>]*size="icon"[^>]*|<button[^>]*/g) ?? []) {
    assert.equal(/aria-label=/.test(control), true, control);
  }
  // And every label names the record it acts on, so it is distinguishable in a list of twenty.
  const labels = component.match(/aria-label=\{`[^`]+`\}/g) ?? [];
  assert.equal(labels.length >= 6, true, `expected per-record labels, found ${labels.length}`);
  for (const label of labels) assert.equal(label.includes("${"), true, label);
  // Decorative icons are hidden from assistive technology rather than read out beside their label.
  const icons = component.match(/<(ArrowUp|ArrowDown|Check|Trash2)[^>]*/g) ?? [];
  for (const icon of icons) assert.equal(icon.includes('aria-hidden="true"'), true, icon);
});

test("every form field has a label, and every section a heading it is described by", () => {
  const ids = Array.from(component.matchAll(/<(?:Input|Textarea|select|input)[^>]*\bid="([^"]+)"/g)).map((match) => match[1]);
  const templateIds = Array.from(component.matchAll(/<(?:Input|Textarea|select)[^>]*\bid=\{`([^`]+)`\}/g)).map((match) => match[1]);
  assert.equal(ids.length + templateIds.length > 20, true, "the section really does have many fields");
  for (const id of ids) assert.equal(component.includes(`htmlFor="${id}"`), true, `no label for ${id}`);
  for (const id of templateIds) assert.equal(component.includes(`htmlFor={\`${id}\`}`), true, `no label for ${id}`);
  // Grouped controls that are not fields still carry a visible label association.
  for (const section of ["execution-readiness", "execution-timeline", "execution-equipment", "execution-access"]) {
    assert.equal(component.includes(`aria-labelledby="${section}"`), true, section);
    assert.equal(component.includes(`id="${section}"`), true, section);
  }
  // A select rendered without a visible label still has one, hidden from sight but not from assistive technology.
  assert.equal(component.includes('<Label className="sr-only"'), true);
});

test("every control that can start a request is disabled while one is in flight", () => {
  // The submit rules take `pending` and are the only thing that enables a submit.
  for (const rule of ["maySubmitCateringTimelineDraft(timelineDraft, canMutate, pending)", "maySubmitCateringStaffDraft(staffDraft, canMutate, pending)", "maySubmitCateringEquipmentDraft(equipmentDraft, canMutate, pending)"]) {
    assert.equal(component.includes(`disabled={!${rule}}`), true, rule);
  }
  // And every remaining button, toggle and status select is disabled on `pending` too, so a double tap cannot fire
  // two mutations.
  const disabled = component.match(/disabled=\{[^}]*\}/g) ?? [];
  const pendingAware = disabled.filter((clause) => /pending|reorder\.|query\./.test(clause));
  assert.equal(pendingAware.length, disabled.length, `${disabled.filter((clause) => !/pending|reorder\.|query\./.test(clause)).join(" | ")}`);
  // The reorder controls close over `pending` in their own rule rather than in the markup.
  assert.equal(component.includes("editorOpen: editor !== null, pending }"), true);
  assert.equal(component.includes('<p role="status" aria-live="polite"'), true, "and progress is announced");
});

test("every destructive action confirms first, and nothing else does", () => {
  const confirms = component.match(/window\.confirm\(`[^`]+`\)/g) ?? [];
  assert.equal(confirms.length, 3, "the three deletes: a run-of-show item, a crew assignment and an equipment record");
  for (const confirm of confirms) assert.equal(confirm.includes("${"), true, `${confirm} does not name the record`);
  // Completing an item, ticking a milestone and moving equipment along are one tap with no dialog in the way.
  const toggleRegion = component.slice(component.indexOf("function MilestoneRow"));
  assert.equal(toggleRegion.includes("window.confirm"), false);
});

test("a customer is never rendered a provider-only control or section", () => {
  // Crew and milestones are gated on BOTH the role and the payload actually carrying them, and a customer's payload
  // carries neither key.
  assert.equal(component.includes("{provider && execution.staff && <section"), true);
  assert.equal(component.includes("{provider && execution.milestones && <section"), true);
  // Every create form is provider-gated as well as editability-gated.
  assert.equal((component.match(/\{provider && canMutate &&/g) ?? []).length >= 2, true);
  assert.equal(component.includes("provider && canMutate && accessForm.value"), true, "the access form is provider-gated too");
  // The visibility control is offered from the role-aware helper, which hands a customer an empty list.
  assert.equal(component.includes("cateringExecutionVisibilityChoices(role)"), true);
  // A visibility badge is shown to the provider only: on a customer's list every row would say the same thing and
  // imply the existence of the rows they cannot see.
  assert.equal((component.match(/\{provider && <Badge variant="outline">\{item\.visibility === "shared"/g) ?? []).length, 2);
});

test("the read-only banner replaces the controls rather than merely greying them", () => {
  assert.equal(component.includes("{!canMutate && <p className=\"mt-3 font-medium\">{CATERING_EXECUTION_READ_ONLY_BANNER}</p>}"), true);
  // `canMutate` is the section's own authoritative reading, not the parent prop alone.
  assert.equal(component.includes("const canMutate = effectiveCateringEditable(editable, execution?.editable);"), true);
  // And it gates every form and every editable control in the section.
  assert.equal((component.match(/canMutate/g) ?? []).length >= 8, true);
});

test("a failed save keeps the participant's work and says plainly that nothing was saved", () => {
  assert.equal(component.includes("cateringExecutionFailureNotice(error)"), true);
  // A refused access save is preserved, and a STALE one is additionally marked for rebasing so the form is not
  // deadlocked on a version it can never satisfy.
  assert.equal(component.includes("markCateringAccessConflict : preserveCateringAccessForm"), true);
  assert.equal(component.includes("markCateringTimelineEditorConflict(current, variables.itemId!)"), true);
  // A draft is settled ONLY in the success handler, and even there only against the exact submitted attempt -- so a
  // failure never discards a half-typed record, and neither does a success that landed after newer edits.
  const success = component.slice(component.indexOf("onSuccess: (value"), component.indexOf("onError: (error"));
  const failure = component.slice(component.indexOf("onError: (error"), component.indexOf("const pending = mutation.isPending"));
  assert.equal(success.includes("settleCateringCreateDraft(live, variables."), true);
  assert.equal(failure.includes("settleCateringCreateDraft"), false);
  assert.equal(failure.includes("EMPTY_CATERING_TIMELINE_DRAFT"), false);
});

test("a transport failure is reported as a transport failure, not as a server refusal", () => {
  // The fetch is wrapped so a connection that never answered is flagged, which is what produces the "not saved"
  // wording and keeps the retry on the same idempotency token.
  assert.equal(component.includes("} catch (transportError) {"), true);
  assert.equal(component.includes("{ offline: true }"), true);
});

test("the idempotency token is bound to its material payload and survives an exact retry", () => {
  for (const [draft, build] of [["timelineDraft", "cateringTimelineCreatePayload"], ["staffDraft", "cateringStaffCreatePayload"], ["equipmentDraft", "cateringEquipmentCreatePayload"]]) {
    assert.equal(component.includes(`prepareCateringCreate(${draft}, ${build}, () => crypto.randomUUID())`), true, draft);
  }
  // The prepared attempt is written back into state BEFORE the request, so an exact retry carries the same token --
  // and a materially changed payload carries a new one, which is what stops an old idempotent response from being
  // read as the newer record having been saved.
  assert.equal((component.match(/setTimelineDraft\(attempt\.draft\);|setStaffDraft\(attempt\.draft\);|setEquipmentDraft\(attempt\.draft\);/g) ?? []).length, 3);
  assert.equal((component.match(/body: attempt\.body/g) ?? []).length, 3, "the body sent is the one built from the stored attempt");
});

test("layout wraps and content breaks rather than scrolling the page sideways", () => {
  assert.equal(component.includes("flex-wrap"), true);
  assert.equal(component.includes("min-w-0"), true);
  assert.equal(component.includes("break-words"), true);
  // Grids are single-column until the small breakpoint, so nothing is a desktop-only table.
  assert.equal(/grid gap-3 sm:grid-cols-2/.test(component), true);
  assert.equal(/<table|overflow-x-scroll/.test(component), false, "no wide tables to operate an event from");
});

test("the whole event-day milestone board is rendered, and marking one does not touch the booking", () => {
  assert.equal(component.includes("execution.milestones.map((milestone) =>"), true);
  assert.equal(component.includes("CATERING_EXECUTION_MILESTONE_LABELS[milestone.key]"), true);
  assert.equal(CATERING_EXECUTION_MILESTONE_KEYS.length, 11);
  // The interface says so explicitly, because a provider ticking "service complete" must not believe they have
  // completed the booking.
  assert.equal(component.includes("Marking these does not change the booking status"), true);
  // The toggle is a pressed-state button, which is what a screen reader needs to hear its state.
  assert.equal(component.includes("aria-pressed={milestone.completed}"), true);
});

test("a mutation refreshes the workspace activity the shared change wrote", () => {
  assert.equal(component.includes('cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", userId, bookingId] })'), true);
  assert.equal(component.includes("cache.invalidateQueries({ queryKey: key })"), true);
});

test("drafts belong to the booking on screen and do not follow the participant to another", () => {
  assert.equal(component.includes("if (identityRef.current === identity) return;"), true);
  // Every draft, the editor and the notice are reset together, so no spent token or half-typed crew assignment
  // crosses into a different booking.
  const reset = component.slice(component.indexOf("identityRef.current = identity;"), component.indexOf("}, [identity]);"));
  for (const setter of ["setTimelineDraft(EMPTY_CATERING_TIMELINE_DRAFT)", "setStaffDraft(EMPTY_CATERING_STAFF_DRAFT)", "setEquipmentDraft(EMPTY_CATERING_EQUIPMENT_DRAFT)", "setEditor(null)"]) {
    assert.equal(reset.includes(setter), true, setter);
  }
});
