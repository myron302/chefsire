import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_BOOKING_FILE_LIMIT, CATERING_FILE_MAX_BYTES } from "@shared/catering-booking-files";
import { CATERING_FILE_DISPLAY_NAME_MAX, CATERING_FILE_DOWNLOAD_HEADERS, cateringFileActivity, cateringFileContentDisposition, cateringFileExtension, cateringFileStorageKey, cateringFileVisibleTo, resolveCateringFileSlot, resolveCateringUpload, sanitizeCateringFilename, shouldNotifyCateringFileUpload } from "./catering-booking-file-policy";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const upload = (over: Partial<Parameters<typeof resolveCateringUpload>[0]> = {}) => resolveCateringUpload({ role: "provider", visibility: "shared", originalName: "menu.pdf", declaredMimeType: "application/pdf", byteSize: 1024, ...over });

test("a filename that carries a path is reduced to display metadata and can address nothing", () => {
  for (const name of ["../../etc/passwd.pdf", "..\\..\\windows\\system32\\config.pdf", "/absolute/menu.pdf", "C:\\Users\\me\\menu.pdf"]) {
    const safe = sanitizeCateringFilename(name, "pdf");
    assert.equal(safe.includes("/"), false, name);
    assert.equal(safe.includes("\\"), false, name);
    assert.equal(safe.includes(".."), false, name);
  }
  assert.equal(sanitizeCateringFilename("../../etc/passwd.pdf", "pdf"), "passwd.pdf");
});
test("control characters, NUL bytes and runaway length never survive into a display filename", () => {
  assert.equal(sanitizeCateringFilename("me\u0000nu\u0007.pdf", "pdf").includes("\u0000"), false);
  assert.equal(sanitizeCateringFilename("a\nb\tc.pdf", "pdf"), "a b c.pdf");
  assert.equal(sanitizeCateringFilename("me\u0000nu.pdf", "pdf"), "me nu.pdf");
  const long = sanitizeCateringFilename(`${"x".repeat(500)}.pdf`, "pdf");
  assert.equal(long.length <= CATERING_FILE_DISPLAY_NAME_MAX, true);
  assert.equal(long.endsWith(".pdf"), true);
});
test("a filename that carries no usable name still yields a truthful, extension-correct one", () => {
  for (const name of ["", ".pdf", "..", ".", "   ", "/", "///"]) {
    const safe = sanitizeCateringFilename(name, "pdf");
    assert.equal(safe, "file.pdf", name);
  }
});
test("the stored extension is the validated type's, never the one the client claimed", () => {
  // A file whose content validated as PNG keeps a .png display name even if the client named it something else.
  assert.equal(sanitizeCateringFilename("invoice.pdf.exe", "png").endsWith(".png"), true);
  assert.equal(cateringFileExtension("Menu.PDF"), "pdf");
  assert.equal(cateringFileExtension("../x/photo.JPEG"), "jpeg");
  assert.equal(cateringFileExtension("noextension"), "");
});
test("a storage key is built only from server-generated identifiers and an allowlisted extension", () => {
  assert.equal(cateringFileStorageKey(BOOKING_ID, FILE_ID, "pdf"), `catering-bookings/${BOOKING_ID}/${FILE_ID}/${FILE_ID}.pdf`);
  // The client-supplied filename contributes nothing, so no upload can steer where its bytes land.
  assert.equal(cateringFileStorageKey(BOOKING_ID, FILE_ID, "png").includes("menu"), false);
  assert.throws(() => cateringFileStorageKey(BOOKING_ID, FILE_ID, "svg"));
  assert.throws(() => cateringFileStorageKey(BOOKING_ID, FILE_ID, "exe"));
  assert.throws(() => cateringFileStorageKey("../../etc", FILE_ID, "pdf"));
  assert.throws(() => cateringFileStorageKey(BOOKING_ID, "../../etc/passwd", "pdf"));
});
test("an upload is accepted only when the actor, the size, the extension and the declared MIME all agree", () => {
  const accepted = upload();
  assert.equal(accepted.kind, "accepted");
  assert.equal(accepted.kind === "accepted" && accepted.filename, "menu.pdf");
  assert.equal(accepted.kind === "accepted" && accepted.type.contentType, "application/pdf");
});
test("each upload refusal is distinct, so a wrong visibility is never reported as a bad file type", () => {
  assert.equal(upload({ role: "customer", visibility: "provider" }).kind, "forbidden_visibility");
  assert.equal(upload({ byteSize: CATERING_FILE_MAX_BYTES + 1 }).kind, "too_large");
  assert.equal(upload({ byteSize: 0 }).kind, "empty");
  assert.equal(upload({ originalName: "payload.exe", declaredMimeType: "application/octet-stream" }).kind, "unsupported_type");
  // An executable renamed .pdf is refused here on MIME, and again by content detection.
  assert.equal(upload({ originalName: "payload.pdf", declaredMimeType: "application/x-msdownload" }).kind, "unsupported_type");
  for (const [name, mime] of [["x.svg", "image/svg+xml"], ["x.html", "text/html"], ["x.htm", "text/html"], ["x.xml", "application/xml"], ["x.zip", "application/zip"], ["x.gif", "image/gif"], ["x.js", "text/javascript"], ["x.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]] as const) {
    assert.equal(upload({ originalName: name, declaredMimeType: mime }).kind, "unsupported_type", name);
  }
  assert.equal(upload({ byteSize: CATERING_FILE_MAX_BYTES }).kind, "accepted");
});
test("a traversal filename that is otherwise valid is accepted but sanitized, never resolved", () => {
  const result = upload({ originalName: "../../../etc/passwd.pdf" });
  assert.equal(result.kind, "accepted");
  assert.equal(result.kind === "accepted" && result.filename, "passwd.pdf");
});
test("the locked file slot tells a closed booking from a full booking", () => {
  assert.equal(resolveCateringFileSlot(null).kind, "read_only");
  assert.equal(resolveCateringFileSlot({ activeCount: 0 }).kind, "accepted");
  assert.equal(resolveCateringFileSlot({ activeCount: CATERING_BOOKING_FILE_LIMIT - 1 }).kind, "accepted");
  assert.equal(resolveCateringFileSlot({ activeCount: CATERING_BOOKING_FILE_LIMIT }).kind, "limit");
  assert.equal(resolveCateringFileSlot({ activeCount: CATERING_BOOKING_FILE_LIMIT + 5 }).kind, "limit");
});
test("a customer cannot observe a provider-private or tombstoned file at all", () => {
  const shared = { visibility: "shared", deletedAt: null };
  const priv = { visibility: "provider", deletedAt: null };
  assert.equal(cateringFileVisibleTo(shared, "customer"), true);
  assert.equal(cateringFileVisibleTo(priv, "customer"), false);
  assert.equal(cateringFileVisibleTo(priv, "provider"), true);
  // A missing file and a provider-private file answer identically for a customer.
  assert.equal(cateringFileVisibleTo(undefined, "customer"), cateringFileVisibleTo(priv, "customer"));
  assert.equal(cateringFileVisibleTo({ visibility: "shared", deletedAt: new Date() }, "provider"), false);
  assert.equal(cateringFileVisibleTo({ visibility: "shared", deletedAt: new Date() }, "customer"), false);
});
test("file activity is recorded at the file's own visibility, so private history stays provider-only", () => {
  assert.deepEqual(cateringFileActivity("shared", "uploaded"), { eventType: "shared_file_uploaded", visibility: "shared" });
  assert.deepEqual(cateringFileActivity("shared", "removed"), { eventType: "shared_file_removed", visibility: "shared" });
  assert.deepEqual(cateringFileActivity("provider", "uploaded"), { eventType: "provider_file_uploaded", visibility: "provider" });
  assert.deepEqual(cateringFileActivity("provider", "removed"), { eventType: "provider_file_removed", visibility: "provider" });
});
test("only a new shared file notifies the counterpart", () => {
  assert.equal(shouldNotifyCateringFileUpload("shared"), true);
  assert.equal(shouldNotifyCateringFileUpload("provider"), false);
});
test("a download is always an attachment, and a hostile filename cannot break out of the header", () => {
  assert.equal(cateringFileContentDisposition("menu.pdf"), `attachment; filename="menu.pdf"; filename*=UTF-8''menu.pdf`);
  const hostile = cateringFileContentDisposition('a"; drop=1\r\nX-Evil: 1.pdf');
  assert.equal(hostile.includes("\r"), false);
  assert.equal(hostile.includes("\n"), false);
  assert.equal(hostile.split(";")[0], "attachment");
  // The quoted fallback is ASCII-only, and the UTF-8 form carries the real name percent-encoded.
  const unicode = cateringFileContentDisposition("メニュー.pdf");
  assert.equal(/filename="[\x20-\x7e]*"/.test(unicode), true);
  assert.equal(unicode.includes(encodeURIComponent("メニュー.pdf")), true);
});
test("download responses are private, uncached and never sniffed into another type", () => {
  assert.equal(CATERING_FILE_DOWNLOAD_HEADERS["X-Content-Type-Options"], "nosniff");
  assert.equal(CATERING_FILE_DOWNLOAD_HEADERS["Cache-Control"], "private, no-store");
});
