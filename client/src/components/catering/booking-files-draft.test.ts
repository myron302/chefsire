import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Draft-preservation regressions for the booking Files section.
 *
 * The upload controls stay usable while a request is in flight, so a completing older upload must never clear a
 * replacement the participant has already chosen -- the same class of draft loss already fixed in the message
 * composer. The state machine is covered by `catering-booking-files-state.test.ts`; asserted here is that the
 * component wires it up the way the machine assumes. There is no DOM harness in this suite, so these are structural
 * assertions against the component source.
 */
const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "BookingFiles.tsx"), "utf8");
const uploadMutation = source.slice(source.indexOf("const upload = useMutation"), source.indexOf("const remove = useMutation"));

test("an upload success clears the draft only through the attempt comparison", () => {
  assert.equal(uploadMutation.includes("completeCateringFileUpload(draftRef.current, attempt, role, () => crypto.randomUUID())"), true);
  // The old unconditional reset is gone: it is what deleted a replacement selection.
  assert.equal(uploadMutation.includes("onSuccess: () => { setDraft(emptyCateringFileDraft(role));"), false);
  assert.equal(/onSuccess:[^}]*setDraft\(emptyCateringFileDraft\(role\)\)/.test(uploadMutation), false, "success must not reset the draft unconditionally");
});

test("the file input's DOM value is reset only when the draft was actually cleared", () => {
  assert.equal(uploadMutation.includes(`if (resolved.cleared && inputRef.current) inputRef.current.value = "";`), true);
  // A preserved replacement must stay in the control, so the reset is never unconditional either.
  assert.equal(/onSuccess:[\s\S]*?if \(inputRef\.current\) inputRef\.current\.value = "";/.test(uploadMutation), false);
});

test("the completion is resolved outside the state updater, so a double-invoked updater cannot touch the DOM", () => {
  // React may call a state updater twice; a DOM write inside one would run twice too.
  assert.equal(uploadMutation.includes("setDraft(resolved.next)"), true);
  assert.equal(/setDraft\(\(current\)[\s\S]*inputRef\.current\.value/.test(uploadMutation), false);
  // The draft is mirrored in a ref so the callback sees the participant's current selection, not a stale closure.
  assert.equal(source.includes("const draftRef = useRef(draft);"), true);
  assert.equal(source.includes("useEffect(() => { draftRef.current = draft; }, [draft]);"), true);
});

test("a failed upload leaves the draft entirely alone", () => {
  const onError = uploadMutation.slice(uploadMutation.indexOf("onError:"));
  assert.equal(onError.includes("setDraft"), false, "a failure must not touch the live draft");
  assert.equal(onError.includes("invalidate()"), true);
});

test("the submitted attempt carries the identity the completion is matched on", () => {
  // requestId plus visibility: a replacement file mints a new token, and a visibility change differs on its own.
  assert.equal(uploadMutation.includes("CateringFileAttempt"), true);
  assert.equal(source.includes("upload.mutate({ file: draft.file, visibility: draft.visibility, requestId: draft.requestId })"), true);
});

test("idempotency is unchanged: one token per selection, sent with every attempt at it", () => {
  assert.equal(uploadMutation.includes(`form.append("clientRequestId", requestId)`), true);
  assert.equal(source.includes("selectCateringFile(current, chosen, chosen ? crypto.randomUUID() : null)"), true);
});

test("upload and pending controls remain accessible", () => {
  const form = source.slice(source.indexOf(`<form className="space-y-3 border-t pt-4"`));
  assert.equal(form.includes(`<Label htmlFor="catering-file">`), true);
  assert.equal(form.includes(`aria-describedby="catering-file-help"`), true);
  // Pending state is announced politely rather than only shown as a disabled button.
  assert.equal(form.includes(`role="status" aria-live="polite"`), true);
  assert.equal(form.includes("Uploading your file…"), true);
  const uploadButton = form.slice(form.indexOf("<Button type=\"submit\""), form.indexOf("Upload file"));
  assert.equal(uploadButton.includes("min-h-11"), true);
  assert.equal(uploadButton.includes("disabled={!mayUploadCateringFile(draft, editable, upload.isPending)}"), true);
});

test("no duplicate upload can be caused by the draft/attempt split", () => {
  // The submit guard still refuses while a request is pending, so the split introduces no second request.
  assert.equal(source.includes("if (!mayUploadCateringFile(draft, editable, upload.isPending) || !draft.file || !draft.visibility || !draft.requestId) return;"), true);
});

test("a preserved draft is handed a fresh idempotency token by the component", () => {
  // The mint is injected as a callback rather than being reached for inside the reducer, and it is the real UUID
  // source -- the same one a new file selection uses, so a re-minted draft is indistinguishable from a fresh one.
  assert.equal(uploadMutation.includes("() => crypto.randomUUID()"), true);
  assert.equal(source.includes("crypto.randomUUID()"), true);
  // Minting happens outside the state updater for the same reason the DOM reset does: React may invoke an updater
  // twice, and a token minted in there would differ between the two invocations.
  assert.equal(/setDraft\(\(current\)[\s\S]*crypto\.randomUUID/.test(uploadMutation), false);
  // The submit path reads the token off the live draft, so the re-minted one is what the next upload carries.
  const submit = source.slice(source.indexOf("const submit = (event: FormEvent)"), source.indexOf("return <Card id=\"files\""));
  assert.equal(submit.includes("requestId: draft.requestId"), true);
});

test("a failed upload still leaves the draft and its token untouched, so Try again stays idempotent", () => {
  // Only onSuccess resolves the draft. onError does nothing but refresh the list, which is what keeps a retry of an
  // unresolved attempt carrying the same token.
  const onError = uploadMutation.slice(uploadMutation.indexOf("onError:"));
  assert.equal(onError.includes("setDraft"), false, "a failure must not rewrite the draft");
  assert.equal(onError.includes("randomUUID"), false, "a failure must not mint a new token");
  assert.equal(onError.includes("invalidate()"), true);
});
