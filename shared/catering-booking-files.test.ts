import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_BOOKING_FILE_LIMIT, CATERING_FILE_TYPES, CATERING_FILE_COUNT_CEILING, CATERING_FILE_EXTENSIONS, CATERING_FILE_MAX_BYTES, CATERING_FILE_MIME_TYPES, CATERING_FILE_NOTIFICATION, CATERING_FILE_PAGE_DEFAULT, CATERING_FILE_PAGE_MAXIMUM, CATERING_FILE_VISIBILITIES, cateringBookingFilePageSchema, cateringBookingFilesKey, cateringFileTypeForExtension, cateringFileTypeForUpload, cateringFileUploadFieldsSchema, cateringFileVisibilitiesFor, cateringFileVisibilitiesVisibleTo, formatCateringBoundedCount, formatCateringFileSize, mayDeleteCateringFile, mayMutateCateringFiles, mayReadCateringFile, mayUploadCateringFileVisibility } from "./catering-booking-files";

const UUID = "11111111-1111-4111-8111-111111111111";

test("the launch allowlist is exactly PDF, JPEG, PNG and WebP", () => {
  assert.deepEqual([...CATERING_FILE_EXTENSIONS].sort(), ["jpeg", "jpg", "pdf", "png", "webp"]);
  assert.deepEqual([...CATERING_FILE_MIME_TYPES].sort(), ["application/pdf", "image/jpeg", "image/png", "image/webp"]);
});
test("every excluded launch type is refused by extension and by declared MIME", () => {
  const excluded = ["gif", "svg", "html", "htm", "xml", "js", "zip", "epub", "mp4", "mov", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "docm", "xlsm", "exe", "sh", "bin", "bat"];
  for (const extension of excluded) assert.equal(cateringFileTypeForExtension(extension), null, extension);
  const excludedMimes = ["image/gif", "image/svg+xml", "text/html", "application/xml", "text/javascript", "application/zip", "application/epub+zip", "video/mp4", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream", "application/x-msdownload"];
  for (const mime of excludedMimes) assert.equal(cateringFileTypeForUpload("pdf", mime), null, mime);
});
test("each allowlisted type names the content signature its bytes must carry, explicitly", () => {
  assert.deepEqual(CATERING_FILE_TYPES.map((type) => [type.extension, type.format]), [["pdf", "pdf"], ["jpg", "jpeg"], ["jpeg", "jpeg"], ["png", "png"], ["webp", "webp"]]);
  // The format is declared, never parsed out of the MIME string, so .jpg and .jpeg both mean the JPEG signature.
  assert.equal(cateringFileTypeForExtension("jpg")?.format, cateringFileTypeForExtension("jpeg")?.format);
});
test("extension and declared MIME must name the same allowlisted type", () => {
  assert.equal(cateringFileTypeForUpload("pdf", "application/pdf")?.contentType, "application/pdf");
  assert.equal(cateringFileTypeForUpload("JPG", "image/jpeg")?.contentType, "image/jpeg");
  assert.equal(cateringFileTypeForUpload("png", "image/png; charset=binary")?.contentType, "image/png");
  // A PDF extension with an image MIME, and an image extension with a PDF MIME, are both mismatches.
  assert.equal(cateringFileTypeForUpload("pdf", "image/png"), null);
  assert.equal(cateringFileTypeForUpload("png", "application/pdf"), null);
  assert.equal(cateringFileTypeForUpload("", "application/pdf"), null);
  assert.equal(cateringFileTypeForUpload("pdf", ""), null);
});
test("the file size and collection limits are explicit and bounded", () => {
  assert.equal(CATERING_FILE_MAX_BYTES, 15 * 1024 * 1024);
  assert.equal(CATERING_BOOKING_FILE_LIMIT, 100);
  assert.equal(CATERING_FILE_PAGE_DEFAULT, 20);
  assert.equal(CATERING_FILE_PAGE_MAXIMUM, 50);
});
test("file pagination is bounded and keyset-based", () => {
  assert.deepEqual(cateringBookingFilePageSchema.parse({}), { limit: CATERING_FILE_PAGE_DEFAULT });
  assert.equal(cateringBookingFilePageSchema.safeParse({ limit: CATERING_FILE_PAGE_MAXIMUM + 1 }).success, false);
  assert.equal(cateringBookingFilePageSchema.safeParse({ limit: 0 }).success, false);
  assert.equal(cateringBookingFilePageSchema.safeParse({ cursor: UUID }).success, true);
  for (const field of ["page", "offset", "createdAt", "visibility"]) assert.equal(cateringBookingFilePageSchema.safeParse({ [field]: "1" }).success, false, field);
});
test("an upload names a visibility and an optional retry token, and no ownership or storage field", () => {
  assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "shared" }).success, true);
  assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "provider", clientRequestId: UUID }).success, true);
  for (const field of ["storageKey", "storageProvider", "uploadedBy", "uploaderId", "bookingId", "byteSize", "sha256", "contentType", "id"]) {
    assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "shared", [field]: "forged" }).success, false, field);
  }
  // There is no customer-private visibility at launch, and no arbitrary visibility either.
  for (const visibility of ["customer", "private", "public", "", "SHARED"]) assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility }).success, false, visibility);
});
test("a customer may only ever create shared files and is never offered provider visibility", () => {
  assert.deepEqual([...cateringFileVisibilitiesFor("customer")], ["shared"]);
  assert.deepEqual([...cateringFileVisibilitiesFor("provider")], [...CATERING_FILE_VISIBILITIES]);
  assert.equal(mayUploadCateringFileVisibility("customer", "provider"), false);
  assert.equal(mayUploadCateringFileVisibility("customer", "shared"), true);
  assert.equal(mayUploadCateringFileVisibility("provider", "provider"), true);
  assert.equal(mayUploadCateringFileVisibility("provider", "shared"), true);
});
test("a customer may never observe a provider-private file", () => {
  assert.deepEqual([...cateringFileVisibilitiesVisibleTo("customer")], ["shared"]);
  assert.equal(mayReadCateringFile("customer", "provider"), false);
  assert.equal(mayReadCateringFile("customer", "shared"), true);
  assert.equal(mayReadCateringFile("provider", "provider"), true);
  assert.equal(mayReadCateringFile("provider", "shared"), true);
});
test("file uploads and deletions close on a terminal booking, in both directions", () => {
  assert.equal(mayMutateCateringFiles("pending_confirmation"), true);
  assert.equal(mayMutateCateringFiles("confirmed"), true);
  assert.equal(mayMutateCateringFiles("cancelled"), false);
  assert.equal(mayMutateCateringFiles("completed"), false);
});
test("only the uploader deletes their own file, and only while the booking is editable", () => {
  const providerFile = { uploadedBy: "provider", deletedAt: null };
  const customerFile = { uploadedBy: "customer", deletedAt: null };
  assert.equal(mayDeleteCateringFile("provider", providerFile, "confirmed"), true);
  assert.equal(mayDeleteCateringFile("customer", customerFile, "confirmed"), true);
  // Neither participant may remove the other's file, whichever direction.
  assert.equal(mayDeleteCateringFile("customer", providerFile, "confirmed"), false);
  assert.equal(mayDeleteCateringFile("provider", customerFile, "confirmed"), false);
  // A terminal booking refuses every deletion, including the uploader's own.
  for (const status of ["cancelled", "completed"] as const) {
    assert.equal(mayDeleteCateringFile("provider", providerFile, status), false, status);
    assert.equal(mayDeleteCateringFile("customer", customerFile, status), false, status);
  }
  // An already-tombstoned file is never deleted twice.
  assert.equal(mayDeleteCateringFile("provider", { uploadedBy: "provider", deletedAt: "2026-09-01T00:00:00.000Z" }, "confirmed"), false);
});
test("file notification copy is neutral and carries no filename, size or address", () => {
  assert.equal(CATERING_FILE_NOTIFICATION.message, "A new file was added to your catering booking.");
  for (const value of Object.values(CATERING_FILE_NOTIFICATION)) {
    assert.equal(value.includes("http"), false);
    assert.equal(value.includes("catering-bookings/"), false);
  }
});
test("human-readable sizes and bounded counts render truthfully", () => {
  assert.equal(formatCateringFileSize(512), "512 B");
  assert.equal(formatCateringFileSize(2048), "2 KB");
  assert.equal(formatCateringFileSize(1024 * 1024 * 3), "3.0 MB");
  assert.equal(formatCateringBoundedCount(5, CATERING_FILE_COUNT_CEILING), "5");
  assert.equal(formatCateringBoundedCount(CATERING_FILE_COUNT_CEILING + 1, CATERING_FILE_COUNT_CEILING), `${CATERING_FILE_COUNT_CEILING}+`);
  assert.equal(formatCateringBoundedCount(100, 99), "99+");
});
test("file cache keys are actor and booking scoped and distinct from message keys", () => {
  assert.notDeepEqual(cateringBookingFilesKey("provider", "booking"), cateringBookingFilesKey("customer", "booking"));
  assert.notDeepEqual(cateringBookingFilesKey("provider", "one"), cateringBookingFilesKey("provider", "two"));
  assert.deepEqual(cateringBookingFilesKey("provider", "one"), ["catering", "booking-files", "provider", "one"]);
});
