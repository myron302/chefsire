import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringComposerFor, cateringComposerIsEmpty, completeCateringMessageSend, editCateringComposer, failCateringMessageSend, maySendCateringMessage, retryCateringMessageSend, startCateringMessageSend, updateCateringComposer } from "@/pages/services/catering-booking-communication-state";
import { cateringFileDraftFor, cateringFileDraftIsEmpty, chooseCateringVisibility, completeCateringFileUpload, markCateringFileAttempted, mayUploadCateringFile, selectCateringFile, updateCateringFileDrafts, type CateringSelectedFile } from "@/pages/services/catering-booking-files-state";
import { cateringMutationIsPending, cateringMutationOrigin, cateringMutationOutcomeFor, clearCateringMutationOutcome, enterCateringMutation, exitCateringMutation, recordCateringMutationOutcome } from "@/pages/services/catering-booking-mutation-origin";
import { createCateringSessionStore, updateCateringSessionField } from "@/pages/services/catering-booking-session-store";
import { EMPTY_CATERING_COMMUNICATION_SESSION, EMPTY_CATERING_FILE_SESSION, createCateringCommunicationSession, createCateringFileSession } from "@/pages/services/catering-booking-workspace-session";

/**
 * A request outlives the component that started it.
 *
 * The booking-keyed maps survived a booking CHANGING, because that is a prop change to a section that stays
 * mounted. They did not survive the section going away: following Back out of the workspace unmounts
 * BookingCommunication and BookingFiles, and component state -- `useState`, `useRef` alike -- dies with them.
 *
 * What died included the `clientRequestId` of a request still in flight. Coming back before it settled gave a fresh
 * instance that knew nothing of the attempt: the control was offered again, the next submission minted a NEW token,
 * and the server correctly stored a second message, or a second file with its own activity row, notification and
 * quota slot. The retained `File` went the same way, so an ambiguous failure had nothing left to retry with. Every
 * exactly-once guarantee in Phase 2I rests on that token surviving for as long as its request might.
 *
 * The authority is now a module-scoped session store that mounting and unmounting do not touch. There is no DOM or
 * React harness in this suite, so an unmount/remount cycle is modelled as what it actually is -- the component's
 * own values are discarded and rebuilt from the store -- and both components are asserted structurally to hold
 * nothing of their own that a request could outlive.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const comms = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingCommunication.tsx"), "utf8");
const files = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingFiles.tsx"), "utf8");

const A = cateringMutationOrigin("u1", "booking-a");
const B = cateringMutationOrigin("u1", "booking-b");
const OTHER = cateringMutationOrigin("u2", "booking-a");
const ROLE = "provider" as const;
const pdf = (name: string): CateringSelectedFile => ({ name, type: "application/pdf", size: 4096 });

// ---------------------------------------------------------------------------------------------------------------
// The store itself.
// ---------------------------------------------------------------------------------------------------------------

test("1. the store is the authority, notifies on real change only, and outlives any subscriber", () => {
  const store = createCateringSessionStore({ value: 0 });
  let notified = 0;
  const unsubscribe = store.subscribe(() => { notified += 1; });
  store.update((current) => ({ ...current, value: 1 }));
  assert.equal(store.read().value, 1, "read() is synchronous: no commit, no effect, no delay");
  assert.equal(notified, 1);
  store.update((current) => current);
  assert.equal(notified, 1, "an inert transition renders nothing");
  // The subscriber going away -- which is what unmounting is -- changes nothing about the value.
  unsubscribe();
  store.update((current) => ({ ...current, value: 2 }));
  assert.equal(store.read().value, 2, "the store does not observe unmounting at all");
  assert.equal(notified, 1);
});

test("2. a field update leaves the record alone when the field did not change", () => {
  const store = createCateringFileSession();
  const before = store.read();
  updateCateringSessionField(store, "drafts", (drafts) => drafts);
  assert.equal(store.read(), before, "no new record, so no rerender");
  updateCateringSessionField(store, "drafts", (drafts) => updateCateringFileDrafts(drafts, A.identity, ROLE, (draft) => selectCateringFile(draft, pdf("foo.pdf"), "TA")));
  assert.notEqual(store.read(), before);
  assert.equal(store.read().uploadInFlight, before.uploadInFlight, "and every other field is the same object");
});

// ---------------------------------------------------------------------------------------------------------------
// Messages.
// ---------------------------------------------------------------------------------------------------------------

/** One mounted BookingCommunication. Unmounting is simply dropping it; remounting is building another from the store. */
function communication(store = createCateringCommunicationSession()) {
  const set = <K extends keyof typeof EMPTY_CATERING_COMMUNICATION_SESSION>(field: K, apply: (value: (typeof EMPTY_CATERING_COMMUNICATION_SESSION)[K]) => (typeof EMPTY_CATERING_COMMUNICATION_SESSION)[K]) =>
    updateCateringSessionField(store, field, apply);
  let minted = 0;
  return {
    store,
    get minted() { return minted; },
    composerFor: (who: typeof A) => cateringComposerFor(store.read().composers, who.identity),
    outcomeFor: (who: typeof A) => cateringMutationOutcomeFor(store.read().sendOutcomes, who.identity),
    type: (who: typeof A, text: string) => set("composers", (current) => updateCateringComposer(current, who.identity, (state) => editCateringComposer(state, text))),
    maySend: (who: typeof A, canSend = true) => maySendCateringMessage(cateringComposerFor(store.read().composers, who.identity), canSend),
    submit(who: typeof A) {
      const current = cateringComposerFor(store.read().composers, who.identity);
      const started = startCateringMessageSend(current, `TOKEN-${(minted += 1)}`);
      assert.notEqual(started, null, "the section must be offering Send");
      set("composers", (composers) => updateCateringComposer(composers, who.identity, () => started!.next));
      set("sendOutcomes", (outcomes) => clearCateringMutationOutcome(outcomes, who));
      return started!.payload;
    },
    retry(who: typeof A) {
      const current = cateringComposerFor(store.read().composers, who.identity);
      const retried = retryCateringMessageSend(current);
      assert.notEqual(retried, null, "there must be a failed attempt to retry");
      set("composers", (composers) => updateCateringComposer(composers, who.identity, () => retried!.next));
      return retried!.payload;
    },
    succeed: (who: typeof A, clientRequestId: string) => {
      set("composers", (current) => updateCateringComposer(current, who.identity, (state) => completeCateringMessageSend(state, clientRequestId)));
      set("sendOutcomes", (current) => recordCateringMutationOutcome(current, who, "succeeded"));
    },
    fail: (who: typeof A, clientRequestId: string, message: string) => {
      set("composers", (current) => updateCateringComposer(current, who.identity, (state) => failCateringMessageSend(state, clientRequestId, message)));
      set("sendOutcomes", (current) => recordCateringMutationOutcome(current, who, "failed", message));
    },
  };
}
/** A route change that unmounts the section entirely, and a later return to it. */
const remount = (section: ReturnType<typeof communication>) => communication(section.store);

test("3. a send still in flight is fully known after the section unmounts and returns", () => {
  let section = communication();
  section.type(A, "the caterer needs to know");
  const attempt = section.submit(A);
  // Back out of the workspace and return.
  section = remount(section);
  const composer = section.composerFor(A);
  assert.equal(composer.pending?.clientRequestId, attempt.clientRequestId, "the idempotency token survives the unmount");
  assert.equal(composer.pending?.status, "sending");
  assert.equal(composer.pending?.text, "the caterer needs to know");
  assert.equal(section.minted, 0, "and the fresh instance mints nothing of its own merely by coming back");
});

test("4. Send is not offered again for an attempt that is still running", () => {
  let section = communication();
  section.type(A, "one message");
  section.submit(A);
  section = remount(section);
  assert.equal(section.maySend(A), false, "a fresh instance must not be able to start a second logical send");
});

test("5. an ambiguous failure that lands while unmounted is retried under the ORIGINAL token", () => {
  let section = communication();
  section.type(A, "one message");
  const attempt = section.submit(A);
  // The request settles into a fresh component-free world: the store is what its callback writes to.
  section.fail(A, attempt.clientRequestId, "Your message could not be sent");
  section = remount(section);
  const minted = section.minted;
  const retried = section.retry(A);
  assert.equal(retried.clientRequestId, attempt.clientRequestId, "a retry that mints a new token is a second message");
  assert.equal(retried.text, "one message");
  assert.equal(section.minted, minted);
});

test("6. a send that succeeded while unmounted is settled, not resurrected as pending", () => {
  let section = communication();
  section.type(A, "one message");
  const attempt = section.submit(A);
  section.succeed(A, attempt.clientRequestId);
  section = remount(section);
  assert.equal(section.composerFor(A).pending, null, "no stale pending state comes back");
  assert.equal(section.composerFor(A).text, "", "and the delivered text is cleared exactly once");
  assert.equal(section.outcomeFor(A)?.status, "succeeded", "the result the section never saw live is still reported");
  assert.equal(section.store.read().composers.has(A.identity), false, "a settled composer holds nothing and is released");
});

test("7. a newer draft typed before leaving survives, and an older success does not erase it", () => {
  let section = communication();
  section.type(A, "first");
  const attempt = section.submit(A);
  section.type(A, "second, typed while the first was still going");
  section = remount(section);
  assert.equal(section.composerFor(A).text, "second, typed while the first was still going");
  section.succeed(A, attempt.clientRequestId);
  assert.equal(section.composerFor(A).text, "second, typed while the first was still going", "an older completion must not clear newer text");
  assert.equal(section.composerFor(A).pending, null);
});

test("8. booking and actor isolation are unchanged by the move out of the component", () => {
  let section = communication();
  section.type(A, "for A");
  const attempt = section.submit(A);
  section.type(B, "for B");
  section = remount(section);
  assert.equal(section.composerFor(B).text, "for B");
  assert.equal(section.composerFor(B).pending, null, "A's attempt is not reachable from B");
  assert.equal(section.composerFor(OTHER).text, "", "nor from the same booking under another actor");
  assert.equal(section.composerFor(A).pending?.clientRequestId, attempt.clientRequestId);
  section.fail(A, attempt.clientRequestId, "refused");
  assert.equal(section.outcomeFor(B), null, "and B announces nothing about A");
  assert.equal(section.outcomeFor(OTHER), null);
});

test("9. any number of route changes preserves the pending attempt, and settling releases it", () => {
  let section = communication();
  section.type(A, "one message");
  const attempt = section.submit(A);
  for (let route = 0; route < 5; route += 1) section = remount(section);
  assert.equal(section.composerFor(A).pending?.clientRequestId, attempt.clientRequestId);
  assert.equal(section.store.read().composers.has(A.identity), true, "a pending attempt is never a pruning candidate");
  section.succeed(A, attempt.clientRequestId);
  assert.equal(section.store.read().composers.has(A.identity), false, "settling is what releases it, not elapsed time");
  assert.equal(cateringComposerIsEmpty(section.composerFor(A)), true);
});

// ---------------------------------------------------------------------------------------------------------------
// File uploads.
// ---------------------------------------------------------------------------------------------------------------

function fileSection(store = createCateringFileSession()) {
  const set = <K extends keyof typeof EMPTY_CATERING_FILE_SESSION>(field: K, apply: (value: (typeof EMPTY_CATERING_FILE_SESSION)[K]) => (typeof EMPTY_CATERING_FILE_SESSION)[K]) =>
    updateCateringSessionField(store, field, apply);
  let minted = 0;
  const mint = () => `TOKEN-${(minted += 1)}`;
  const inputWrites: string[] = [];
  const applyDraft = (who: typeof A, role: "provider" | "customer", apply: Parameters<typeof updateCateringFileDrafts>[3]) => {
    const next = updateCateringFileDrafts(store.read().drafts as never, who.identity, role, apply as never);
    set("drafts", () => next as never);
  };
  return {
    store,
    inputWrites,
    get minted() { return minted; },
    draftFor: (who: typeof A, role: "provider" | "customer" = ROLE) => cateringFileDraftFor(store.read().drafts, who.identity, role),
    outcomeFor: (who: typeof A) => cateringMutationOutcomeFor(store.read().uploadOutcomes, who.identity),
    pending: (who: typeof A) => cateringMutationIsPending(store.read().uploadInFlight, who.identity),
    choose: (who: typeof A, name: string, role: "provider" | "customer" = ROLE) => applyDraft(who, role, (draft) => selectCateringFile(draft, pdf(name) as never, mint())),
    visibility: (who: typeof A, value: "provider" | "shared", role: "provider" | "customer" = ROLE) => applyDraft(who, role, (draft) => chooseCateringVisibility(draft, value, mint)),
    mayUpload(who: typeof A, canMutate = true) {
      return mayUploadCateringFile(cateringFileDraftFor(store.read().drafts, who.identity, ROLE), canMutate, cateringMutationIsPending(store.read().uploadInFlight, who.identity));
    },
    submit(who: typeof A, role: "provider" | "customer" = ROLE) {
      const current = cateringFileDraftFor(store.read().drafts, who.identity, role);
      assert.equal(this.mayUpload(who), true, "the section must be offering Upload");
      applyDraft(who, role, markCateringFileAttempted);
      set("uploadInFlight", (flight) => enterCateringMutation(flight, who));
      set("uploadOutcomes", (outcomes) => clearCateringMutationOutcome(outcomes, who));
      return { origin: who, role, file: current.file!, visibility: current.visibility!, requestId: current.requestId! };
    },
    succeed(attempt: { origin: typeof A; role: "provider" | "customer"; requestId: string; visibility: "provider" | "shared" }, displayed: typeof A | null) {
      const resolved = completeCateringFileUpload(cateringFileDraftFor(store.read().drafts, attempt.origin.identity, attempt.role), attempt, attempt.role, mint);
      applyDraft(attempt.origin, attempt.role, () => resolved.next as never);
      if (resolved.cleared && displayed?.identity === attempt.origin.identity) inputWrites.push("");
      set("uploadInFlight", (flight) => exitCateringMutation(flight, attempt.origin));
      set("uploadOutcomes", (outcomes) => recordCateringMutationOutcome(outcomes, attempt.origin, "succeeded"));
    },
    fail(attempt: { origin: typeof A }, message: string) {
      set("uploadInFlight", (flight) => exitCateringMutation(flight, attempt.origin));
      set("uploadOutcomes", (outcomes) => recordCateringMutationOutcome(outcomes, attempt.origin, "failed", message));
    },
  };
}
const remountFiles = (section: ReturnType<typeof fileSection>) => {
  const next = fileSection(section.store);
  // A remount gives a NEW DOM input node, empty, which is the one thing that cannot be restored.
  return next;
};

test("10. the File, the visibility and the token all survive the section unmounting", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  const attempt = section.submit(A);
  section = remountFiles(section);
  const draft = section.draftFor(A);
  assert.equal(draft.file?.name, "foo.pdf", "the retained File is still in memory");
  assert.equal(draft.file, attempt.file, "and it is the same object, not a reconstruction");
  assert.equal(draft.visibility, "shared");
  assert.equal(draft.requestId, attempt.requestId, "the idempotency token survives the unmount");
  assert.equal(draft.attempted, true);
  assert.equal(section.minted, 0, "the fresh instance mints nothing of its own merely by coming back");
});

test("11. Upload is refused for an attempt that is still running, after a remount", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  section.submit(A);
  section = remountFiles(section);
  assert.equal(section.pending(A), true, "the in-flight count outlives the hook that recorded it");
  assert.equal(section.mayUpload(A), false, "so no duplicate logical upload can be started");
});

test("12. an ambiguous failure while unmounted is retried with the same File, visibility and token", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  const attempt = section.submit(A);
  section.fail(attempt, "Your file could not be uploaded");
  section = remountFiles(section);
  assert.equal(section.pending(A), false, "the control is released");
  const minted = section.minted;
  const retry = section.submit(A);
  assert.equal(retry.requestId, attempt.requestId, "a retry that mints a new token is a second upload");
  assert.equal(retry.file, attempt.file);
  assert.equal(retry.visibility, attempt.visibility);
  assert.equal(section.minted, minted);
});

test("13. an upload that succeeded while unmounted is settled, and its File released", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  const attempt = section.submit(A);
  section.succeed(attempt, null);
  section = remountFiles(section);
  assert.equal(section.draftFor(A).file, null, "no stale pending selection comes back");
  assert.equal(section.draftFor(A).requestId, null);
  assert.equal(section.pending(A), false);
  assert.equal(section.outcomeFor(A)?.status, "succeeded", "the result the section never saw live is still reported");
  assert.equal(section.store.read().drafts.has(A.identity), false, "the settled entry leaves the map, releasing the File");
  assert.deepEqual(section.inputWrites, [], "and the DOM input of a section that was not displayed is never touched");
});

test("14. a newer selection made before leaving survives an older completion", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  const attempt = section.submit(A);
  section.choose(A, "bar.pdf");
  section = remountFiles(section);
  assert.equal(section.draftFor(A).file?.name, "bar.pdf");
  section.succeed(attempt, A);
  assert.equal(section.draftFor(A).file?.name, "bar.pdf", "an older completion must not clear the newer selection");
  assert.deepEqual(section.inputWrites, [], "nor blank the new input node that is holding it");
});

test("15. a newer visibility made before leaving survives, and re-mints rather than reusing a spent token", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  const attempt = section.submit(A);
  section = remountFiles(section);
  section.visibility(A, "provider");
  assert.equal(section.draftFor(A).visibility, "provider");
  section.succeed(attempt, A);
  assert.equal(section.draftFor(A).file?.name, "foo.pdf", "the provider-private draft stands");
  assert.equal(section.draftFor(A).visibility, "provider");
  assert.notEqual(section.draftFor(A).requestId, attempt.requestId, "the succeeded token is spent and never sent again");
  assert.deepEqual(section.inputWrites, []);
});

test("16. one booking's pending upload is invisible to another, and to another actor", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  const attempt = section.submit(A);
  section.choose(B, "invoice.pdf");
  section = remountFiles(section);
  assert.equal(section.draftFor(B).file?.name, "invoice.pdf");
  assert.equal(section.draftFor(B).attempted, false, "A's attempt is not reachable from B");
  assert.equal(section.pending(B), false);
  assert.equal(section.draftFor(OTHER).file, null, "nor from the same booking under another actor");
  // A customer's absent draft is their own role's empty draft, not the provider's.
  assert.equal(section.draftFor(OTHER, "customer").visibility, "shared");
  assert.equal(section.draftFor(OTHER, "provider").visibility, null);
  section.succeed(attempt, B);
  assert.equal(section.draftFor(B).file?.name, "invoice.pdf", "and A's completion settles A alone");
  assert.deepEqual(section.inputWrites, [], "B's input is not blanked by A's completion");
});

test("17. any number of route changes preserves the pending upload; settling is what releases it", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  const attempt = section.submit(A);
  for (let route = 0; route < 5; route += 1) section = remountFiles(section);
  assert.equal(section.draftFor(A).requestId, attempt.requestId);
  assert.equal(section.pending(A), true, "leaving the workspace is not a reason to abandon an in-flight upload");
  assert.equal(section.store.read().drafts.has(A.identity), true, "a pending draft is never a pruning candidate");
  section.succeed(attempt, A);
  assert.equal(section.store.read().drafts.has(A.identity), false);
  assert.equal(cateringFileDraftIsEmpty(section.draftFor(A), ROLE), true);
  assert.equal(section.store.read().uploadInFlight.has(A.identity), false, "and the in-flight count is released too");
});

test("18. an upload cannot be started on a terminal booking, remount or not", () => {
  let section = fileSection();
  section.choose(A, "foo.pdf");
  section.visibility(A, "shared");
  section = remountFiles(section);
  assert.equal(section.mayUpload(A, true), true);
  assert.equal(section.mayUpload(A, false), false, "a closed booking accepts no upload, whatever survived");
});

// ---------------------------------------------------------------------------------------------------------------
// The components' own wiring.
// ---------------------------------------------------------------------------------------------------------------

test("19. neither component holds pending-mutation state that a request could outlive", () => {
  for (const [label, source, store] of [["communication", comms, "cateringCommunicationSession"], ["files", files, "cateringFileSession"]] as const) {
    assert.equal(source.includes(`const session = useCateringSession(${store});`), true, label);
    assert.equal(source.includes("updateCateringSessionField("), true, label);
    // The store is module-scoped, so it is not created, reset or cleared by anything the component does.
    assert.equal(source.includes("createCateringSessionStore("), false, label);
    // Nothing a request can outlive is component state any more.
    assert.equal(/useState<Catering(Composers|FileDrafts|MutationOutcomes|UnsentMessages)>/.test(source), false, label);
    assert.equal(source.includes("useRef<CateringFileDrafts>"), false, label);
  }
  // The files section's in-flight counts moved too, because they are what refuses a duplicate upload.
  assert.equal(/useState<CateringInFlight>/.test(files), false);
  assert.equal(files.includes(`setSession("uploadInFlight"`), true);
  assert.equal(files.includes(`setSession("removeInFlight"`), true);
  // The conversation's READ-marker request stays component-local, deliberately: it carries no idempotency token,
  // it is monotonic and idempotent server-side, and its whole input is re-derived from the thread on the next
  // render. Losing it on unmount loses nothing, and a stale copy of it would be worse than none.
  assert.equal(comms.includes("const [readInFlight, setReadInFlight] = useState<CateringInFlight>(EMPTY_CATERING_IN_FLIGHT);"), true);
  assert.equal(comms.includes("clientRequestId") && comms.includes("readInFlight"), true);
  const readMutation = comms.slice(comms.indexOf("const markRead = useMutation"), comms.indexOf("// A poll that finds"));
  assert.equal(readMutation.includes("clientRequestId"), false, "a read marker has no token to lose");
  // Nothing is serialized: a File cannot be, and booking text should not be.
  for (const [label, source] of [["communication", comms], ["files", files]] as const) {
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "document.cookie"]) {
      assert.equal(source.includes(forbidden), false, `${label}: ${forbidden}`);
    }
  }
  const store = fs.readFileSync(path.join(here, "catering-booking-session-store.ts"), "utf8");
  const storeCode = store.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "JSON.stringify", "setTimeout", "setInterval"]) {
    assert.equal(storeCode.includes(forbidden), false, forbidden);
  }
});

test("20. the DOM file input is still never fake-restored, and a remount does not invite one", () => {
  // A new input node comes back empty and cannot be repopulated; the retained File is what the section names.
  const writes = [...files.matchAll(/inputRef\.current\.value = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(writes, [`""`, `""`], "a file input can only ever be blanked, never refilled");
  assert.equal(/inputRef\.current\.files\s*=/.test(files), false);
  assert.equal(/inputRef\.current\.value = [^;]*draft/.test(files), false);
  assert.equal(files.includes("Ready to upload: {draft.file.name}"), true);
  // And the blank on a completion still requires that completion to have cleared THIS booking's draft.
  assert.equal(files.includes(`if (resolved.cleared && attempt.origin.identity === identityRef.current && inputRef.current) inputRef.current.value = "";`), true);
});

test("21. both sections share one persistence mechanism rather than two ad-hoc globals", () => {
  const session = fs.readFileSync(path.join(here, "catering-booking-workspace-session.ts"), "utf8");
  assert.equal(session.includes("export const cateringCommunicationSession = createCateringCommunicationSession();"), true);
  assert.equal(session.includes("export const cateringFileSession = createCateringFileSession();"), true);
  assert.equal((session.match(/createCateringSessionStore\(/g) ?? []).length, 2, "both go through the one factory");
  // No package was added and nothing app-wide was redesigned: the store is one closure over one value.
  const store = fs.readFileSync(path.join(here, "catering-booking-session-store.ts"), "utf8");
  assert.equal(store.includes('from "react"'), true);
  assert.equal((store.match(/^import /gm) ?? []).length, 1, "one import, and it is React's own hook");
  assert.equal(store.includes("useSyncExternalStore(store.subscribe, store.read, store.read)"), true);
  // The empty records are the empty maps the rest of Phase 2I already uses, so identity keying is unchanged.
  assert.equal(EMPTY_CATERING_COMMUNICATION_SESSION.composers.size, 0);
  assert.equal(EMPTY_CATERING_FILE_SESSION.drafts.size, 0);
  assert.equal(EMPTY_CATERING_FILE_SESSION.uploadInFlight.size, 0);
});
