import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_FILE_MAX_BYTES, CATERING_FILE_SIZE_MESSAGE, CATERING_FILE_TYPE_MESSAGE } from "@shared/catering-booking-files";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_FILES_READ_ONLY_BANNER, CATERING_FILE_ACCEPT, cateringFileDraftMatchesAttempt, completeCateringFileUpload, cateringFileDownloadPath, cateringFileSummary, cateringFileVisibilityBadge, cateringVisibilityChoices, chooseCateringVisibility, markCateringFileAttempted, combineCateringFilePages, emptyCateringFileDraft, initialCateringVisibility, isCateringFileReadOnly, mayUploadCateringFile, nextCateringFileCursor, selectCateringFile, validateCateringFileSelection } from "./catering-booking-files-state";

/** A described file rather than a browser `File`, which the draft is generic over precisely so this works. */
type TestFile = { name: string; type: string; size: number };
const file = (over: Partial<TestFile> = {}): TestFile => ({ name: "menu.pdf", type: "application/pdf", size: 2048, ...over });
const view = (id: string, over: Partial<{ visibility: "provider" | "shared" }> = {}) => ({ id, visibility: "shared" as const, filename: `${id}.pdf`, contentType: "application/pdf", byteSize: 1024, uploadedBy: "provider", uploadedByRole: "provider" as const, uploaderName: "Ada", createdAt: "2026-09-01T12:00:00.000Z", mine: true, mayDelete: true, ...over });

test("a customer is never offered a visibility choice, so nothing hints that private files exist", () => {
  assert.deepEqual(cateringVisibilityChoices("customer"), []);
  assert.equal(initialCateringVisibility("customer"), "shared");
  // Not one rendered label mentions the provider-only option for a customer.
  assert.equal(JSON.stringify(cateringVisibilityChoices("customer")).includes("Provider only"), false);
});
test("a provider must choose a visibility deliberately rather than inheriting a silent default", () => {
  assert.equal(initialCateringVisibility("provider"), null);
  assert.deepEqual(cateringVisibilityChoices("provider").map((choice) => choice.value), ["provider", "shared"]);
  assert.equal(emptyCateringFileDraft<TestFile>("provider").visibility, null);
  assert.equal(emptyCateringFileDraft<TestFile>("customer").visibility, "shared");
});
test("the file input accepts only the launch allowlist", () => {
  for (const token of [".pdf", ".jpg", ".jpeg", ".png", ".webp", "application/pdf", "image/jpeg", "image/png", "image/webp"]) {
    assert.equal(CATERING_FILE_ACCEPT.includes(token), true, token);
  }
  for (const token of [".gif", ".svg", ".zip", ".docx", ".mp4", "image/gif", "image/svg+xml", "text/html"]) {
    assert.equal(CATERING_FILE_ACCEPT.includes(token), false, token);
  }
});
test("a selection is validated before upload, and each refusal says which problem it is", () => {
  assert.equal(validateCateringFileSelection(file()), null);
  assert.equal(validateCateringFileSelection(file({ size: 0 })), "An empty file cannot be uploaded");
  assert.equal(validateCateringFileSelection(file({ size: CATERING_FILE_MAX_BYTES + 1 })), CATERING_FILE_SIZE_MESSAGE);
  assert.equal(validateCateringFileSelection(file({ size: CATERING_FILE_MAX_BYTES })), null);
  for (const rejected of [file({ name: "x.svg", type: "image/svg+xml" }), file({ name: "x.html", type: "text/html" }), file({ name: "x.zip", type: "application/zip" }), file({ name: "x.gif", type: "image/gif" }), file({ name: "payload.pdf", type: "application/x-msdownload" })]) {
    assert.equal(validateCateringFileSelection(rejected), CATERING_FILE_TYPE_MESSAGE, rejected.name);
  }
});
test("a path-like filename is validated on its own extension, never on a directory it names", () => {
  assert.equal(validateCateringFileSelection(file({ name: "../../etc/passwd.pdf" })), null);
  assert.equal(validateCateringFileSelection(file({ name: "../../etc/passwd", type: "application/pdf" })), CATERING_FILE_TYPE_MESSAGE);
});
test("upload is offered only with a valid file, an explicit visibility, and an editable booking", () => {
  const chosen = chooseCateringVisibility(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file()), "shared", mint);
  assert.equal(mayUploadCateringFile(chosen, true, false), true);
  assert.equal(mayUploadCateringFile(chosen, false, false), false);
  assert.equal(mayUploadCateringFile(chosen, true, true), false);
  // No visibility chosen yet, and an invalid file, are both refused.
  assert.equal(mayUploadCateringFile(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file()), true, false), false);
  assert.equal(mayUploadCateringFile(chooseCateringVisibility(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file({ name: "x.svg", type: "image/svg+xml" })), "shared", mint), true, false), false);
  assert.equal(mayUploadCateringFile(emptyCateringFileDraft<TestFile>("customer"), true, false), false);
});
test("a retry token is minted per selection and reused for every attempt at that selection", () => {
  const first = selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file(), "token-1");
  assert.equal(first.requestId, "token-1");
  // Choosing a visibility, or failing and pressing upload again, does not change the token.
  assert.equal(chooseCateringVisibility(first, "shared", mint).requestId, "token-1");
  // A different selection mints a different token, so two deliberate uploads stay two files.
  assert.equal(selectCateringFile(first, file({ name: "other.pdf" }), "token-2").requestId, "token-2");
  // Clearing the selection drops the token with it.
  assert.equal(selectCateringFile(first, null).requestId, null);
});
test("clearing the selection clears its error rather than stranding a stale one", () => {
  const bad = selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file({ name: "x.zip", type: "application/zip" }));
  assert.equal(bad.error, CATERING_FILE_TYPE_MESSAGE);
  assert.deepEqual(selectCateringFile(bad, null), { ...bad, file: null, error: null, requestId: null });
});
test("pages append newest-first with no file shown twice", () => {
  const first = { files: [view("d"), view("c")], nextCursor: "c", editable: true };
  const second = { files: [view("b"), view("a")], nextCursor: null, editable: true };
  assert.deepEqual(combineCateringFilePages([first, second]).map((f) => f.id), ["d", "c", "b", "a"]);
  const overlapping = { files: [view("c"), view("b")], nextCursor: null, editable: true };
  assert.deepEqual(combineCateringFilePages([first, overlapping]).map((f) => f.id), ["d", "c", "b"]);
  assert.equal(nextCateringFileCursor({ nextCursor: null }), undefined);
  assert.equal(nextCateringFileCursor({ nextCursor: "c" }), "c");
  assert.equal(nextCateringFileCursor(undefined), undefined);
});
test("only a provider sees a visibility badge, because every file a customer sees is shared", () => {
  assert.equal(cateringFileVisibilityBadge(view("a", { visibility: "provider" }), "provider"), "Provider only");
  assert.equal(cateringFileVisibilityBadge(view("a"), "provider"), "Shared with customer");
  assert.equal(cateringFileVisibilityBadge(view("a"), "customer"), null);
  assert.equal(cateringFileVisibilityBadge(view("a", { visibility: "provider" }), "customer"), null);
});
test("file metadata renders as type, human-readable size and date", () => {
  const summary = cateringFileSummary({ contentType: "application/pdf", byteSize: 2048, createdAt: "2026-09-01T12:00:00.000Z" });
  assert.equal(summary.startsWith("PDF · 2 KB · "), true);
  assert.equal(cateringFileSummary({ contentType: "image/png", byteSize: 1024, createdAt: "not-a-date" }), "PNG · 1 KB");
});
test("a download is a booking-scoped route re-authorized per request, never a stored address", () => {
  assert.equal(cateringFileDownloadPath("booking-1", "file-1"), "/api/catering/bookings/booking-1/files/file-1/download");
  assert.equal(cateringFileDownloadPath("b", "f").startsWith("http"), false);
});
test("a booking that closed mid-upload is classified so the section can refetch", () => {
  assert.equal(isCateringFileReadOnly({ code: CATERING_WORKSPACE_READ_ONLY_CODE }), true);
  assert.equal(isCateringFileReadOnly({ code: "other" }), false);
  assert.equal(isCateringFileReadOnly(undefined), false);
  assert.equal(CATERING_FILES_READ_ONLY_BANNER.includes("download"), true);
});

/**
 * An upload in flight and the live draft are separate values. The controls stay usable while a request runs, so a
 * completing older upload must never clear a replacement the participant has already chosen.
 */
const submitted = (draft: ReturnType<typeof emptyCateringFileDraft<TestFile>>) => ({ requestId: draft.requestId!, visibility: draft.visibility! });
/**
 * A deterministic stand-in for `crypto.randomUUID`. The component passes the real one; minting is injected rather
 * than called inside the reducer so these assertions can name the token that comes out, and so that resolving an
 * upload stays a pure function of its inputs.
 */
let minted = 0;
const mint = () => `minted-${++minted}`;
const readyDraft = (over: { name?: string; token?: string; visibility?: "provider" | "shared" } = {}) =>
  chooseCateringVisibility(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file({ name: over.name ?? "menu.pdf" }), over.token ?? "token-1"), over.visibility ?? "shared");

test("a normal upload success clears a draft that is still the submitted one", () => {
  const draft = readyDraft();
  const resolved = completeCateringFileUpload(draft, submitted(draft), "provider", mint);
  assert.equal(resolved.cleared, true);
  assert.equal(resolved.next.file, null);
  assert.equal(resolved.next.requestId, null);
  // A provider is asked to choose again deliberately rather than inheriting the last upload's visibility.
  assert.equal(resolved.next.visibility, null);
});
test("selecting a replacement file during a pending upload survives that upload succeeding", () => {
  const first = readyDraft({ name: "invoice-a.pdf", token: "token-1" });
  const attempt = submitted(first);
  // File B chosen while A is still uploading: a new selection mints a new token.
  const replacement = chooseCateringVisibility(selectCateringFile(first, file({ name: "invoice-b.pdf" }), "token-2"), "shared", mint);
  const resolved = completeCateringFileUpload(replacement, attempt, "provider", mint);
  assert.equal(resolved.cleared, false);
  assert.equal(resolved.next, replacement);
  assert.equal(resolved.next.file?.name, "invoice-b.pdf");
  assert.equal(resolved.next.requestId, "token-2");
});
test("changing visibility during a pending upload is not overwritten when that upload succeeds", () => {
  const first = readyDraft({ visibility: "shared" });
  const attempt = submitted(first);
  // Same file and token, but the participant switched the visibility for their next upload.
  const changed = chooseCateringVisibility(first, "provider", mint);
  const resolved = completeCateringFileUpload(changed, attempt, "provider", mint);
  assert.equal(resolved.cleared, false);
  assert.equal(resolved.next.visibility, "provider");
});
test("the DOM input is only reset when the draft was actually cleared", () => {
  const draft = readyDraft();
  assert.equal(completeCateringFileUpload(draft, submitted(draft), "provider", mint).cleared, true);
  const replacement = selectCateringFile(draft, file({ name: "other.pdf" }), "token-2");
  // `cleared` is what the component keys the input reset on, so a preserved selection stays in the control.
  assert.equal(completeCateringFileUpload(replacement, submitted(draft), "provider", mint).cleared, false);
});
test("a stale success for an attempt that is no longer the draft changes nothing", () => {
  const draft = readyDraft({ token: "token-2" });
  const resolved = completeCateringFileUpload(draft, { requestId: "token-1", visibility: "shared" }, "provider", mint);
  assert.equal(resolved.cleared, false);
  assert.equal(resolved.next, draft);
});
test("the attempt match requires both the selection token and the chosen visibility", () => {
  const draft = readyDraft({ token: "token-1", visibility: "shared" });
  assert.equal(cateringFileDraftMatchesAttempt(draft, { requestId: "token-1", visibility: "shared" }), true);
  assert.equal(cateringFileDraftMatchesAttempt(draft, { requestId: "token-1", visibility: "provider" }), false);
  assert.equal(cateringFileDraftMatchesAttempt(draft, { requestId: "token-2", visibility: "shared" }), false);
});
test("idempotency is unaffected: one selection keeps one token across repeated upload attempts", () => {
  const draft = readyDraft({ token: "token-1" });
  // Pressing upload again on the same selection resends the same token, so the server resolves it to one file.
  assert.equal(submitted(draft).requestId, "token-1");
  assert.equal(submitted(chooseCateringVisibility(draft, "provider", mint)).requestId, "token-1");
  // Only a new selection is a new upload.
  assert.equal(selectCateringFile(draft, file({ name: "next.pdf" }), "token-2").requestId, "token-2");
});


/**
 * The idempotency token of a SUCCEEDED upload is spent. The server resolves a repeat of that token to the file it
 * already stored rather than performing the upload again -- which is exactly right for a retry, and exactly wrong
 * for a draft the participant edited while the first upload was in flight. A preserved draft therefore has to be
 * handed a new token, or pressing Upload reports success for a file that was never created.
 */
test("a draft preserved after a success is given a NEW token, so its upload is a real upload", () => {
  const first = readyDraft({ token: "token-1", visibility: "shared" });
  const attempt = submitted(first);
  // The provider switches to provider-only while the shared upload is still in flight.
  const changed = chooseCateringVisibility(first, "provider", mint);
  const resolved = completeCateringFileUpload(changed, attempt, "provider", mint);
  assert.equal(resolved.cleared, false);
  // The decisive assertion: the spent token is gone, so the next request cannot resolve to the stored file.
  assert.notEqual(resolved.next.requestId, "token-1");
  assert.equal(resolved.next.requestId, `minted-${minted}`);
  // And nothing else about the participant's draft is disturbed.
  assert.equal(resolved.next.visibility, "provider");
  assert.equal(resolved.next.file, changed.file);
  assert.equal(resolved.next.error, null);
});

test("without the new token the next upload would hit server idempotency on the spent one", () => {
  const first = readyDraft({ token: "token-1", visibility: "shared" });
  const changed = chooseCateringVisibility(first, "provider", mint);
  const resolved = completeCateringFileUpload(changed, submitted(first), "provider", mint);
  // What the component would submit next. Under the old behaviour this was still `token-1`: the server would answer
  // with the ALREADY SHARED file, the interface would report success, and no provider-only file would exist.
  const next = submitted(resolved.next as typeof changed);
  assert.notEqual(next.requestId, "token-1");
  assert.equal(next.visibility, "provider");
  // Two different intents now carry two different tokens, which is what makes them two files.
  assert.notEqual(next.requestId, submitted(first).requestId);
});

test("a token is minted only when the preserved draft is still carrying the completed one", () => {
  const before = minted;
  const first = readyDraft({ token: "token-1" });
  // A replacement selection already minted its own token when it was chosen; re-minting would discard it.
  const replacement = chooseCateringVisibility(selectCateringFile(first, file({ name: "b.pdf" }), "token-2"), "shared", mint);
  const resolved = completeCateringFileUpload(replacement, submitted(first), "provider", mint);
  assert.equal(resolved.next.requestId, "token-2");
  assert.equal(minted, before, "no token may be minted for a draft that already has a fresh one");
  // A draft that matched is cleared outright, and a cleared draft holds no token at all.
  const matching = completeCateringFileUpload(first, submitted(first), "provider", mint);
  assert.equal(matching.next.requestId, null);
  assert.equal(minted, before, "clearing needs no token either");
});

test("retry idempotency is untouched: a failure never re-mints, so Try again resolves to one file", () => {
  const draft = readyDraft({ token: "token-1" });
  // Resolution happens on success alone. A failed or unresolved attempt leaves the draft -- and its token -- exactly
  // as they were, so pressing Upload again resends `token-1` and an upload that actually succeeded is not doubled.
  assert.equal(draft.requestId, "token-1");
  assert.equal(submitted(draft).requestId, "token-1");
  assert.equal(submitted(chooseCateringVisibility(draft, "provider", mint)).requestId, "token-1");
  // Repeated attempts at the same unresolved selection stay one upload.
  assert.equal(submitted(draft).requestId, submitted(draft).requestId);
});

test("every editable draft field is covered, not visibility alone", () => {
  // The rule is "same token but no longer the submitted draft", so it does not enumerate fields. Both of the ways a
  // draft can currently be edited are checked here, and a field added later is covered without amending anything.
  const first = readyDraft({ token: "token-1", visibility: "shared" });
  const attempt = submitted(first);
  // Visibility edited in place: same token, so it is re-minted.
  assert.notEqual(completeCateringFileUpload(chooseCateringVisibility(first, "provider", mint), attempt, "provider", mint).next.requestId, "token-1");
  // File replaced: `selectCateringFile` mints on selection, so that token is kept rather than replaced again.
  const replaced = chooseCateringVisibility(selectCateringFile(first, file({ name: "c.pdf" }), "token-9"), "shared", mint);
  assert.equal(completeCateringFileUpload(replaced, attempt, "provider", mint).next.requestId, "token-9");
  // Clearing the selection drops the token, and a draft with no token is not the submitted one either.
  const cleared = selectCateringFile(first, null);
  assert.equal(cleared.requestId, null);
  assert.equal(completeCateringFileUpload(cleared, attempt, "provider", mint).next.requestId, null);
});

test("two deliberate uploads of the same document remain two files", () => {
  const first = readyDraft({ token: "token-1", visibility: "shared" });
  const changed = chooseCateringVisibility(first, "provider", mint);
  const second = completeCateringFileUpload(changed, submitted(first), "provider", mint).next;
  const third = completeCateringFileUpload(second as typeof changed, submitted(second as typeof changed), "provider", mint).next;
  // The second upload cleared, so it holds no token; the three intents never shared one.
  assert.equal(third.requestId, null);
  assert.notEqual(second.requestId, first.requestId);
});

test("a stale success for a token nobody is holding still changes nothing and mints nothing", () => {
  const before = minted;
  const draft = readyDraft({ token: "token-3" });
  const resolved = completeCateringFileUpload(draft, { requestId: "token-1", visibility: "shared" }, "provider", mint);
  assert.equal(resolved.next, draft, "the draft object itself is preserved, not rebuilt");
  assert.equal(resolved.cleared, false);
  assert.equal(minted, before);
});

test("minting is injected rather than reached for, so resolving an upload stays pure", () => {
  // Called exactly once, and only on the re-mint path: the reducer never reaches for global crypto itself, which is
  // what lets the component keep the DOM reset and the token mint outside React's state updater.
  let calls = 0;
  const counted = () => { calls += 1; return "fresh"; };
  const first = readyDraft({ token: "token-1", visibility: "shared" });
  assert.equal(completeCateringFileUpload(chooseCateringVisibility(first, "provider", mint), submitted(first), "provider", counted).next.requestId, "fresh");
  assert.equal(calls, 1);
  completeCateringFileUpload(first, submitted(first), "provider", counted);
  completeCateringFileUpload(readyDraft({ token: "other" }), submitted(first), "provider", counted);
  assert.equal(calls, 1, "no token is minted on the clear or stale paths");
});


/**
 * A submitted token may already be spent.
 *
 * An AMBIGUOUS upload failure -- a timeout, a dropped connection -- is precisely a request whose outcome the client
 * cannot know: the server may well have accepted it. Visibility is part of the upload INTENT, not a detail of it,
 * so changing it and pressing Upload with that same token would hit the server's early accepted-token lookup,
 * which answers with the ORIGINAL upload at the ORIGINAL visibility. The interface would clear the draft and report
 * success for a provider-only file that does not exist and never will.
 */
const attemptedDraft = (over: { visibility?: "provider" | "shared"; token?: string } = {}) => markCateringFileAttempted(readyDraft(over));

test("1. an exact retry of the same failed attempt keeps the original token", () => {
  const failed = attemptedDraft({ token: "token-1", visibility: "shared" });
  // Same file, same visibility, same intent: the token is reused so the retry resolves to the file the server may
  // already have stored rather than adding a second copy.
  assert.equal(failed.requestId, "token-1");
  assert.equal(submitted(failed).requestId, "token-1");
  // Re-choosing the visibility it already has is not a change and mints nothing.
  const before = minted;
  assert.equal(chooseCateringVisibility(failed, "shared", mint), failed, "an unchanged visibility returns the same object");
  assert.equal(minted, before);
});

test("2. an ambiguous failure followed by a visibility change mints a new token", () => {
  const failed = attemptedDraft({ token: "token-1", visibility: "shared" });
  const changed = chooseCateringVisibility(failed, "provider", mint);
  assert.equal(changed.visibility, "provider");
  // The decisive assertion: the possibly-spent token is gone, so the server's early lookup cannot answer this.
  assert.notEqual(changed.requestId, "token-1");
  assert.equal(changed.requestId, `minted-${minted}`);
  // The file selection is untouched, and the new token has not been submitted.
  assert.equal(changed.file, failed.file);
  assert.equal(changed.attempted, false);
});

test("3. an ambiguous failure followed by a file change mints a new token", () => {
  const failed = attemptedDraft({ token: "token-1" });
  const replaced = selectCateringFile(failed, file({ name: "different.pdf" }), "token-2");
  assert.equal(replaced.requestId, "token-2");
  assert.equal(replaced.attempted, false);
  // Clearing the selection drops the token entirely.
  assert.equal(selectCateringFile(failed, null).requestId, null);
  assert.equal(selectCateringFile(failed, null).attempted, false);
});

test("4. the original token cannot satisfy a changed-visibility intent", () => {
  const failed = attemptedDraft({ token: "token-1", visibility: "shared" });
  const changed = chooseCateringVisibility(failed, "provider", mint);
  // What the component would submit. The token differs from the one the server may hold, so the early duplicate
  // lookup finds nothing and a real provider-only upload is performed.
  const next = submitted(changed);
  assert.notEqual(next.requestId, submitted(failed).requestId);
  assert.equal(next.visibility, "provider");
  // And the old attempt no longer matches the draft, so a late success for it cannot clear this one.
  assert.equal(cateringFileDraftMatchesAttempt(changed, submitted(failed)), false);
});

test("5. a successful changed-visibility upload clears only the draft that matches it", () => {
  const changed = chooseCateringVisibility(attemptedDraft({ token: "token-1", visibility: "shared" }), "provider", mint);
  const attempt = submitted(markCateringFileAttempted(changed));
  const resolved = completeCateringFileUpload(markCateringFileAttempted(changed), attempt, "provider", mint);
  assert.equal(resolved.cleared, true);
  assert.equal(resolved.next.file, null);
  assert.equal(resolved.next.requestId, null);
  assert.equal(resolved.next.attempted, false);
});

test("6. a success from an older attempt cannot clear a newer edited draft", () => {
  const first = attemptedDraft({ token: "token-1", visibility: "shared" });
  const older = submitted(first);
  // The participant changed visibility while the first upload was still in flight; it then succeeds.
  const newer = chooseCateringVisibility(first, "provider", mint);
  const resolved = completeCateringFileUpload(newer, older, "provider", mint);
  assert.equal(resolved.cleared, false);
  assert.equal(resolved.next.visibility, "provider");
  assert.equal(resolved.next.file, newer.file);
  // The change already minted a fresh token, so the success path finds nothing of its own to re-mint.
  assert.equal(resolved.next.requestId, newer.requestId);
});

test("an unsubmitted token is unspent, so ordinary editing before the first Upload mints nothing", () => {
  const before = minted;
  const fresh = readyDraft({ token: "token-1", visibility: "shared" });
  assert.equal(fresh.attempted, false);
  // Flipping between the radio buttons before ever pressing Upload keeps the one token the selection minted.
  let draft = chooseCateringVisibility(fresh, "provider", mint);
  assert.equal(draft.requestId, "token-1");
  draft = chooseCateringVisibility(draft, "shared", mint);
  assert.equal(draft.requestId, "token-1");
  assert.equal(minted, before, "no token may be minted for a draft that was never submitted");
});

test("marking a draft attempted is idempotent and changes nothing else", () => {
  const draft = readyDraft({ token: "token-1" });
  const attempted = markCateringFileAttempted(draft);
  assert.equal(attempted.attempted, true);
  assert.equal(attempted.requestId, "token-1");
  assert.equal(attempted.file, draft.file);
  // Submitting the same draft again returns the same object, so a repeated Upload press churns no state.
  assert.equal(markCateringFileAttempted(attempted), attempted);
});
