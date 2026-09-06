import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringWorkspacePollInterval, effectiveCateringEditable, observedCateringEditable } from "@shared/catering-booking-operations";

/**
 * A booking-scoped section must obey its OWN endpoint about whether the booking can still be written to.
 *
 * The `editable` prop comes from the parent workspace summary, which is fetched once and does not poll. So when the
 * counterpart cancels the booking or the provider completes it, that prop stays `true` while the section's own
 * fifteen-second poll is already receiving `editable: false` from the server. Ignoring that returned field left the
 * composer enabled, the upload controls live and the poll running indefinitely -- the participant found out only by
 * attempting a send, refocusing the tab, or triggering some unrelated invalidation.
 *
 * Both list endpoints already return the flag, so nothing was added to the API. There is no React Query or DOM
 * harness in this suite, so the resolution rule is exercised behaviourally and the wiring asserted structurally.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const comms = fs.readFileSync(path.join(here, "BookingCommunication.tsx"), "utf8");
const files = fs.readFileSync(path.join(here, "BookingFiles.tsx"), "utf8");
const messageRoute = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-communication.ts"), "utf8");
const fileRoute = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-files.ts"), "utf8");
const page = (editable: boolean) => ({ editable });

test("both endpoints already report editable, so no API field was invented for this", () => {
  assert.equal(messageRoute.includes("const editable = mayPostCateringBookingMessage(booking.status as never);"), true);
  assert.equal(messageRoute.includes("nextCursor, editable, unreadStartId })"), true);
  assert.equal(fileRoute.includes("editable: mayMutateCateringFiles(booking.status as never)"), true);
  // Each is re-derived from the persisted booking status on every request, which is what makes it authoritative.
  for (const [label, route] of [["messages", messageRoute], ["files", fileRoute]] as const) {
    assert.equal(route.includes("ownedCateringBooking(id, userId)"), true, label);
  }
});

test("1. parent true and endpoint true: the section is editable and polls", () => {
  const observed = observedCateringEditable([page(true)]);
  assert.equal(observed, true);
  assert.equal(effectiveCateringEditable(true, observed), true);
  assert.equal(cateringWorkspacePollInterval(effectiveCateringEditable(true, observed)), 15_000);
});

/**
 * Closure is a conjunction, not a precedence.
 *
 * Preferring the endpoint with `observed ?? parentEditable` got the mirror case wrong: the parent workspace
 * refetches too -- on focus, after a mutation, or because a section told it the booking went terminal -- and when IT
 * reported the booking cancelled while a cached child page still said `true`, that stale `true` masked the closure
 * until the child's own next request happened to land. A booking never returns from cancelled or completed, so a
 * `false` from either side is permanent.
 */
test("the full truth table: editable only while NO known source says false", () => {
  assert.equal(effectiveCateringEditable(true, undefined), true);
  assert.equal(effectiveCateringEditable(true, true), true);
  assert.equal(effectiveCateringEditable(true, false), false);
  assert.equal(effectiveCateringEditable(false, undefined), false);
  assert.equal(effectiveCateringEditable(false, true), false, "a cached child true must not mask a terminal parent");
  assert.equal(effectiveCateringEditable(false, false), false);
});

test("a parent that flips to false wins even against a cached child page that still says true", () => {
  // The exact reported sequence: the child fetched editable=true, then the parent refetched and learned the
  // booking is cancelled. The stale cached page must not keep the section live.
  const cached = observedCateringEditable([page(true)]);
  assert.equal(cached, true);
  assert.equal(effectiveCateringEditable(false, cached), false);
  // And polling stops on that same evaluation rather than waiting for the child's next response.
  assert.equal(cateringWorkspacePollInterval(effectiveCateringEditable(false, cached)), false);
});

test("2 & 8. a later poll reporting false wins immediately, and a stale parent true cannot undo it", () => {
  // The decisive case: the parent summary still says true because it never refetched.
  const observed = observedCateringEditable([page(false)]);
  assert.equal(observed, false);
  assert.equal(effectiveCateringEditable(true, observed), false, "the endpoint's answer must override the stale prop");
  // Any page reporting false settles it -- pages refetch together and terminal state is irreversible server-side.
  assert.equal(observedCateringEditable([page(true), page(false)]), false);
  assert.equal(observedCateringEditable([page(false), page(true)]), false);
});

test("the parent prop is used only until the endpoint has answered, and nothing is invented", () => {
  // Before the first page arrives there is no authoritative answer, so the prop stands -- either way.
  assert.equal(observedCateringEditable(undefined), undefined);
  assert.equal(observedCateringEditable([]), undefined);
  assert.equal(effectiveCateringEditable(true, undefined), true);
  assert.equal(effectiveCateringEditable(false, undefined), false);
  // A page that omits the field asserts nothing about closure; it is not read as terminal.
  assert.equal(observedCateringEditable([{}]), true);
  // An absent answer is not a false: it is the one case where the prop stands alone.
  assert.equal(effectiveCateringEditable(true, undefined), true);
});

test("3, 5 & 9-10. the composer goes read-only at once, history stays, drafts survive, no send can start", () => {
  // The form is replaced by the read-only banner, so the history above it stays rendered.
  assert.equal(comms.includes("{canSend\n      ? <form className=\"space-y-2\" onSubmit={submit}>"), true);
  assert.equal(comms.includes(': <div className="space-y-3">\n          <p className="font-medium">{CATERING_COMMUNICATION_READ_ONLY_BANNER}</p>'), true);
  assert.equal(comms.includes("disabled={!maySendCateringMessage(ownComposer, canSend)}"), true);
  // Both mutation entry points are guarded, so nothing can be initiated even if a control were reachable.
  assert.equal(comms.includes("if (!maySendCateringMessage(ownComposer, canSend)) return;"), true);
  assert.equal(comms.includes("if (!canSend) return;"), true);
  // The draft is component state and nothing on this path clears it: it is preserved for the participant to copy.
  const terminal = comms.slice(comms.indexOf("// The first time this section's own endpoint reports"), comms.indexOf("// Watches the end-of-thread sentinel"));
  assert.equal(terminal.includes("setComposer"), false, "going terminal must not destroy the draft");
  assert.equal(terminal.includes("discardCateringMessageSend"), false);
  // Reading a historical conversation is still allowed -- the read route is not gated on editability.
  assert.equal(comms.includes("`/api/catering/bookings/${attempt.origin.bookingId}/messages/read`"), true);
});

test("4 & 11-12. polling stops on that response, while load, focus refetch and pagination are untouched", () => {
  const options = comms.slice(comms.indexOf("const query = useInfiniteQuery({"), comms.indexOf("queryFn: async ({ pageParam })"));
  // The interval is a function of the polled query itself, so it re-decides on every response rather than from a
  // closure captured when the component last rendered.
  assert.equal(options.includes("refetchInterval: (polled:"), true);
  assert.equal(options.includes("cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages)))"), true);
  assert.equal(cateringWorkspacePollInterval(effectiveCateringEditable(true, observedCateringEditable([page(false)]))), false);
  // Only the recurring poll stops. The query is never disabled, focus refetch stays on, pagination is unchanged.
  assert.equal(options.includes("enabled:"), false);
  assert.equal(options.includes("refetchOnWindowFocus: true"), true);
  assert.equal(comms.includes("getNextPageParam: (lastPage) => nextCateringMessageCursor(lastPage)"), true);
  assert.equal(comms.includes("combineCateringMessagePages(loadedPages)"), true);
});

test("6 & 7. the workspace is refreshed once on the first terminal observation, never on the polls after", () => {
  for (const [label, source] of [["communication", comms], ["files", files]] as const) {
    const terminal = source.slice(source.indexOf("// The first time this section's own endpoint reports"));
    const effect = terminal.slice(0, terminal.indexOf("}, [observedEditable]);"));
    // Latched in a ref: fires on the transition, and the guard short-circuits every later render.
    assert.equal(effect.includes("if (observedEditable !== false || terminalSeenRef.current) return;"), true, label);
    assert.equal(effect.indexOf("terminalSeenRef.current = true;") < effect.indexOf("cache.invalidateQueries("), true, label);
    // Actor-scoped, so no other user's cache is touched.
    assert.equal(effect.includes("for (const queryKey of cateringOriginWorkspaceInvalidations(origin)) cache.invalidateQueries({ queryKey });"), true, label);
    assert.equal(source.includes("cache.clear()"), false, label);
    // It cannot loop: the workspace refetch changes the parent prop, never this endpoint's answer.
    assert.equal(terminal.includes("}, [observedEditable]);"), true, label);
    // A ref, so recording it renders nothing.
    assert.equal(source.includes("const terminalSeenRef = useRef(false);"), true, label);
    // And it resets with the booking, so a different booking is not silently treated as already reported.
    assert.equal(source.includes("terminalSeenRef.current = false;"), true, label);
  }
});

test("13. the files section had the same stale-parent bug and now reads the same authoritative answer", () => {
  assert.equal(files.includes("const canMutate = effectiveCateringEditable(editable, observedEditable);"), true);
  // Every editable-driven surface obeys it: the upload form, the upload control, and each row's delete control.
  assert.equal(files.includes("{canMutate\n"), true);
  assert.equal(files.includes("disabled={!mayUploadCateringFile(draft, canMutate, uploading)}"), true);
  assert.equal(files.includes("if (!mayUploadCateringFile(draft, canMutate, uploading)"), true);
  assert.equal(files.includes("editable={canMutate}"), true);
  // The bare prop no longer drives any decision in either component.
  for (const [label, source] of [["communication", comms], ["files", files]] as const) {
    assert.equal(/\(draft, editable,|composer, editable\)|editable=\{editable\}|\{editable\n/.test(source), false, label);
  }
  // Terminal files stay readable and the read-only banner explains why.
  assert.equal(files.includes("CATERING_FILES_READ_ONLY_BANNER"), true);
  assert.equal(files.includes("combineCateringFilePages(loadedPages)"), true);
  // Row-level delete still additionally requires the server's own per-file permission.
  assert.equal(files.includes("{editable && file.mayDelete &&"), true);
});

test("the server remains the final authority whatever the client believes", () => {
  // The client's effective state only decides what to render and whether to poll. Both write paths re-check the
  // persisted booking status under a lock, and neither trusts anything the client sends about editability.
  assert.equal(messageRoute.includes("lockActiveCateringBooking(tx, bookingId)"), true);
  assert.equal(fileRoute.includes("mayMutateCateringFiles(booking.status as never)"), true);
  assert.equal(fileRoute.includes("lockActiveCateringBooking(tx, id)"), true);
  for (const [label, source] of [["communication", comms], ["files", files]] as const) {
    assert.equal(source.includes("editable: true"), false, label);
    assert.equal(source.includes("editable: false"), false, label);
  }
});


test("both sections disable every mutation control the moment either source reports terminal", () => {
  // Neither component re-derives closure; both hand the two authoritative inputs to the one shared rule, so the
  // conjunction applies identically to the composer, the upload form and each row's delete control.
  assert.equal(comms.includes("const canSend = effectiveCateringEditable(editable, observedEditable);"), true);
  assert.equal(files.includes("const canMutate = effectiveCateringEditable(editable, observedEditable);"), true);
  for (const [label, source, gate] of [["communication", comms, "canSend"], ["files", files, "canMutate"]] as const) {
    // The polling decision uses the same rule, so it stops on whichever source reports terminal first.
    assert.equal(source.includes(`cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages)))`), true, label);
    assert.equal(source.includes(`{${gate}\n`), true, label);
  }
  // Terminal history and files stay readable, and drafts survive: neither terminal path clears them.
  assert.equal(comms.includes("CATERING_COMMUNICATION_READ_ONLY_BANNER"), true);
  assert.equal(files.includes("CATERING_FILES_READ_ONLY_BANNER"), true);
  const commsTerminal = comms.slice(comms.indexOf("// The first time this section's own endpoint reports"), comms.indexOf("// Watches the end-of-thread sentinel"));
  assert.equal(commsTerminal.includes("setComposer"), false);
  const filesTerminal = files.slice(files.indexOf("// The first time this section's own endpoint reports"), files.indexOf("const submit = (event: FormEvent)"));
  assert.equal(filesTerminal.includes("setDraft"), false);
});
