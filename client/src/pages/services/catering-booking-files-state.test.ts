import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_FILE_MAX_BYTES, CATERING_FILE_SIZE_MESSAGE, CATERING_FILE_TYPE_MESSAGE } from "@shared/catering-booking-files";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_FILES_READ_ONLY_BANNER, CATERING_FILE_ACCEPT, cateringFileDraftMatchesAttempt, completeCateringFileUpload, cateringFileDownloadPath, cateringFileSummary, cateringFileVisibilityBadge, cateringVisibilityChoices, chooseCateringVisibility, combineCateringFilePages, emptyCateringFileDraft, initialCateringVisibility, isCateringFileReadOnly, mayUploadCateringFile, nextCateringFileCursor, selectCateringFile, validateCateringFileSelection } from "./catering-booking-files-state";

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
  const chosen = chooseCateringVisibility(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file()), "shared");
  assert.equal(mayUploadCateringFile(chosen, true, false), true);
  assert.equal(mayUploadCateringFile(chosen, false, false), false);
  assert.equal(mayUploadCateringFile(chosen, true, true), false);
  // No visibility chosen yet, and an invalid file, are both refused.
  assert.equal(mayUploadCateringFile(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file()), true, false), false);
  assert.equal(mayUploadCateringFile(chooseCateringVisibility(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file({ name: "x.svg", type: "image/svg+xml" })), "shared"), true, false), false);
  assert.equal(mayUploadCateringFile(emptyCateringFileDraft<TestFile>("customer"), true, false), false);
});
test("a retry token is minted per selection and reused for every attempt at that selection", () => {
  const first = selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file(), "token-1");
  assert.equal(first.requestId, "token-1");
  // Choosing a visibility, or failing and pressing upload again, does not change the token.
  assert.equal(chooseCateringVisibility(first, "shared").requestId, "token-1");
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
const readyDraft = (over: { name?: string; token?: string; visibility?: "provider" | "shared" } = {}) =>
  chooseCateringVisibility(selectCateringFile(emptyCateringFileDraft<TestFile>("provider"), file({ name: over.name ?? "menu.pdf" }), over.token ?? "token-1"), over.visibility ?? "shared");

test("a normal upload success clears a draft that is still the submitted one", () => {
  const draft = readyDraft();
  const resolved = completeCateringFileUpload(draft, submitted(draft), "provider");
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
  const replacement = chooseCateringVisibility(selectCateringFile(first, file({ name: "invoice-b.pdf" }), "token-2"), "shared");
  const resolved = completeCateringFileUpload(replacement, attempt, "provider");
  assert.equal(resolved.cleared, false);
  assert.equal(resolved.next, replacement);
  assert.equal(resolved.next.file?.name, "invoice-b.pdf");
  assert.equal(resolved.next.requestId, "token-2");
});
test("changing visibility during a pending upload is not overwritten when that upload succeeds", () => {
  const first = readyDraft({ visibility: "shared" });
  const attempt = submitted(first);
  // Same file and token, but the participant switched the visibility for their next upload.
  const changed = chooseCateringVisibility(first, "provider");
  const resolved = completeCateringFileUpload(changed, attempt, "provider");
  assert.equal(resolved.cleared, false);
  assert.equal(resolved.next.visibility, "provider");
});
test("the DOM input is only reset when the draft was actually cleared", () => {
  const draft = readyDraft();
  assert.equal(completeCateringFileUpload(draft, submitted(draft), "provider").cleared, true);
  const replacement = selectCateringFile(draft, file({ name: "other.pdf" }), "token-2");
  // `cleared` is what the component keys the input reset on, so a preserved selection stays in the control.
  assert.equal(completeCateringFileUpload(replacement, submitted(draft), "provider").cleared, false);
});
test("a stale success for an attempt that is no longer the draft changes nothing", () => {
  const draft = readyDraft({ token: "token-2" });
  const resolved = completeCateringFileUpload(draft, { requestId: "token-1", visibility: "shared" }, "provider");
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
  assert.equal(submitted(chooseCateringVisibility(draft, "provider")).requestId, "token-1");
  // Only a new selection is a new upload.
  assert.equal(selectCateringFile(draft, file({ name: "next.pdf" }), "token-2").requestId, "token-2");
});
