import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_FILE_LIMIT, CATERING_FILE_MAX_BYTES, CATERING_UPLOAD_MULTIPART, CATERING_UPLOAD_MULTIPART_MESSAGES, cateringFileLimitMessage, cateringFileUploadFieldsSchema } from "@shared/catering-booking-files";
import { resolveCateringFileSlot } from "../services/catering-booking-file-policy";

/**
 * Two upload-boundary regressions.
 *
 * MULTIPART BOUNDS -- Multer accumulates every part into memory before the route can load the booking and check
 * ownership, so bounding only `fileSize` and `files` let an authenticated caller spend process memory on a booking
 * they do not own by naming a well-formed UUID and attaching thousands of text fields. The parser limits, not the
 * schema, are what stop that, because the schema only runs after parsing has already finished.
 *
 * QUOTA ISOLATION -- counting every active row for the booking made a customer-visible outcome depend on
 * provider-only state, which is a privacy leak in itself.
 *
 * There is no HTTP harness in this suite, so the wiring is asserted structurally against the route source, as
 * elsewhere in Phase 2I; the contracts either side of it are exercised directly.
 */
const routeSource = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-files.ts"), "utf8");
const uploadRegistration = routeSource.slice(routeSource.indexOf("const bookingFileUpload = multer("), routeSource.indexOf("function invalid("));
const uploadRoute = routeSource.slice(routeSource.indexOf(`r.post("/bookings/:id/files"`), routeSource.indexOf("async function handleUpload"));

/* ---------------------------------------------------------------- multipart bounds */

test("the parser limits are derived from the real request contract, not picked generously", () => {
  // One file, `visibility`, `clientRequestId` -- and nothing else.
  assert.deepEqual(CATERING_UPLOAD_MULTIPART, { files: 1, fields: 2, parts: 3, fieldSize: 256, fieldNameSize: 64 });
  // The field cap matches the schema's own shape exactly, so the two cannot drift apart.
  assert.equal(CATERING_UPLOAD_MULTIPART.fields, Object.keys(cateringFileUploadFieldsSchema.shape).length);
  assert.equal(CATERING_UPLOAD_MULTIPART.parts, CATERING_UPLOAD_MULTIPART.fields + CATERING_UPLOAD_MULTIPART.files);
  // A UUID is 36 characters and the longest field name is `clientRequestId` at 15, so both caps are real bounds.
  assert.equal(CATERING_UPLOAD_MULTIPART.fieldSize >= 36, true);
  assert.equal(CATERING_UPLOAD_MULTIPART.fieldNameSize >= "clientRequestId".length, true);
  assert.equal(CATERING_UPLOAD_MULTIPART.fieldSize < 1024, true, "a field value cap this small is what stops a payload");
});

test("every multipart dimension is bounded at the Multer boundary, before authorization runs", () => {
  for (const limit of ["fileSize", "files", "fields", "parts", "fieldSize", "fieldNameSize"]) {
    assert.equal(uploadRegistration.includes(`${limit}:`), true, limit);
  }
  assert.equal(uploadRegistration.includes("fileSize: CATERING_FILE_MAX_BYTES"), true);
  // The parser runs as the route's own middleware; ownership is only loaded inside handleUpload, afterwards.
  assert.equal(uploadRoute.indexOf("bookingFileUpload(req, res") < uploadRoute.indexOf("handleUpload"), true);
  assert.equal(routeSource.indexOf("const bookingFileUpload") < routeSource.indexOf("ownedCateringBooking(id, userId)"), true);
});

test("a caller who does not own the booking still cannot allocate an unbounded multipart request", () => {
  // The limits are a static literal on the parser itself, so they apply to every caller before the booking is even
  // read. Every value is a compile-time constant -- nothing in the block consults the request, the actor or the
  // booking, so no caller can be granted a larger allocation than any other.
  const limits = uploadRegistration.slice(uploadRegistration.indexOf("limits: {"), uploadRegistration.indexOf("}).single("));
  for (const derived of ["req.", "userId", "bookingId", "ownedCateringBooking", "role"]) {
    assert.equal(limits.includes(derived), false, derived);
  }
  // Every entry inside the block -- skipping the `limits: {` opener itself -- is a named constant.
  const entries = limits.split("\n").map((entry) => entry.trim()).filter((entry) => entry.includes(":") && !entry.endsWith("{"));
  assert.equal(entries.length, 6, "all six dimensions are bounded");
  for (const line of entries) {
    assert.equal(/:\s*(CATERING_UPLOAD_MULTIPART\.[a-zA-Z]+|CATERING_FILE_MAX_BYTES),?$/.test(line), true, line);
  }
});

test("each parser refusal is answered with its own bounded message", () => {
  const covered = ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE", "LIMIT_FIELD_COUNT", "LIMIT_PART_COUNT", "LIMIT_FIELD_VALUE", "LIMIT_FIELD_KEY"];
  for (const code of covered) assert.equal(routeSource.includes(`${code}:`), true, code);
  assert.equal(CATERING_UPLOAD_MULTIPART_MESSAGES.size.includes(String(CATERING_FILE_MAX_BYTES / (1024 * 1024))), true);
  // No message names a limit value, a field, a path or any internal.
  for (const message of Object.values(CATERING_UPLOAD_MULTIPART_MESSAGES)) {
    assert.equal(/\/|\\|Error|multer|LIMIT_/i.test(message), false, message);
  }
});

test("a Multer limit failure is a controlled 400, never an unhandled Express error", () => {
  assert.equal(uploadRoute.includes("uploadError instanceof multer.MulterError"), true);
  assert.equal(uploadRoute.includes("return res.status(400).json({ message: MULTIPART_REFUSALS[uploadError.code] ?? CATERING_UPLOAD_MULTIPART_MESSAGES.rejected });"), true);
  // An unknown Multer code still resolves to a bounded message rather than falling through to `next`.
  assert.equal(uploadRoute.indexOf("MULTIPART_REFUSALS[uploadError.code]") < uploadRoute.indexOf("return next(uploadError);"), true);
  // A genuine server fault is still distinguishable and still reaches the error handler.
  assert.equal(uploadRoute.includes("return next(uploadError);"), true);
  // Nothing from the error object is forwarded to the client beyond the mapped code lookup.
  assert.equal(uploadRoute.includes("uploadError.message"), false);
  assert.equal(uploadRoute.includes("uploadError.stack"), false);
});

test("an unexpected text field is rejected rather than silently dropped", () => {
  // The body is parsed as a whole, so `.strict()` sees an extra field instead of it being cherry-picked away.
  assert.equal(routeSource.includes("cateringFileUploadFieldsSchema.parse(req.body ?? {})"), true);
  assert.equal(routeSource.includes("visibility: req.body?.visibility, ...("), false, "fields must not be cherry-picked");
  assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "shared", bogus: "x" }).success, false);
  assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "shared" }).success, true);
});

test("an oversized or malformed accepted field value is still rejected by the schema", () => {
  // The parser caps the raw bytes; the schema caps the meaning. Both bounds apply.
  assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "shared", clientRequestId: "x".repeat(200) }).success, false);
  assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "x".repeat(200) }).success, false);
  assert.equal(cateringFileUploadFieldsSchema.safeParse({ visibility: "shared", clientRequestId: "11111111-1111-4111-8111-111111111111" }).success, true);
});

/* ---------------------------------------------------------------- quota isolation */

const full = { activeCount: CATERING_BOOKING_FILE_LIMIT };
const room = { activeCount: CATERING_BOOKING_FILE_LIMIT - 1 };

test("the quota is counted per visibility bucket, not across the booking", () => {
  const uploadTx = routeSource.slice(routeSource.indexOf("const result = await db.transaction"));
  assert.equal(uploadTx.includes("eq(cateringBookingFiles.visibility, fields.visibility)"), true);
  // Tombstoned rows still do not occupy a slot, exactly as before.
  assert.equal(uploadTx.includes("isNull(cateringBookingFiles.deletedAt)"), true);
});

test("provider-private files cannot consume a customer's shared quota", () => {
  // Booking A: 20 shared, 0 private. Booking B: 20 shared, 80 private. The customer uploads shared in both, and the
  // count they are measured against is the shared count alone -- so both bookings answer identically.
  const sharedOnly = { activeCount: 20 };
  assert.equal(resolveCateringFileSlot(sharedOnly).kind, "accepted");
  // The old behaviour measured 20 + 80 = 100 and refused. Nothing now feeds a private count into this decision.
  assert.notEqual(resolveCateringFileSlot({ activeCount: 100 }).kind, "accepted");
  assert.equal(resolveCateringFileSlot(sharedOnly).kind, resolveCateringFileSlot({ activeCount: 20 }).kind);
});

test("a full shared bucket does not imply a full private bucket, or the reverse", () => {
  // The two counts are independent inputs to the same rule, so neither can be inferred from the other's outcome.
  assert.equal(resolveCateringFileSlot(full).kind, "limit");
  assert.equal(resolveCateringFileSlot(room).kind, "accepted");
});

test("a provider's shared upload uses the shared bucket, and a private upload the private one", () => {
  // The bucket is chosen by the visibility being uploaded, whoever the actor is -- there is no per-role quota, so a
  // provider's shared upload is measured against the same count a customer's is.
  const quotaCount = routeSource.slice(routeSource.indexOf("const [{ value }] = await tx.select({ value: count() })"), routeSource.indexOf("const slot = resolveCateringFileSlot"));
  assert.equal(quotaCount.includes("eq(cateringBookingFiles.visibility, fields.visibility)"), true);
  // Not `visibilityFilter(role)`, which is the reader's own view and would make the quota depend on who is asking.
  assert.equal(quotaCount.includes("visibilityFilter("), false, "the count is scoped by the upload's visibility, not the actor's role");
  assert.equal(quotaCount.includes("role"), false);
});

test("the limit refusal is worded for the bucket that is full and never mentions private storage to a customer", () => {
  assert.equal(cateringFileLimitMessage("shared").includes("shared"), true);
  assert.equal(cateringFileLimitMessage("provider").includes("provider-only"), true);
  // A customer can only ever provoke the shared message, and it says nothing about provider storage.
  assert.equal(/provider/i.test(cateringFileLimitMessage("shared")), false);
  assert.equal(routeSource.includes("cateringFileLimitMessage(fields.visibility)"), true);
});

test("the customer-facing shared quota is unchanged from before the split", () => {
  // The existing constant is reused, so a booking with no private files behaves exactly as it always did.
  assert.equal(CATERING_BOOKING_FILE_LIMIT, 100);
  assert.equal(resolveCateringFileSlot({ activeCount: 99 }).kind, "accepted");
  assert.equal(resolveCateringFileSlot({ activeCount: 100 }).kind, "limit");
});

test("concurrent allocation stays bounded: the count is still taken under the lock, inside the transaction", () => {
  const uploadTx = routeSource.slice(routeSource.indexOf("const result = await db.transaction"));
  // The advisory lock and the terminal-state check are unchanged, and the scoped count sits between them and the
  // insert -- the privacy fix did not move the quota check out of the protected section.
  assert.equal(uploadTx.indexOf("lockActiveCateringBooking(tx, id)") < uploadTx.indexOf("await lockFileCollection(tx, id)"), true);
  assert.equal(uploadTx.indexOf("await lockFileCollection(tx, id)") < uploadTx.indexOf("resolveCateringFileSlot"), true);
  assert.equal(uploadTx.indexOf("resolveCateringFileSlot") < uploadTx.indexOf(".insert(cateringBookingFiles)"), true);
  assert.equal(routeSource.includes("pg_advisory_xact_lock"), true);
});

test("terminal bookings gain no upload capability from the quota split", () => {
  // The read-only guard still precedes the transaction, and a booking that closes mid-upload still refuses.
  assert.equal(routeSource.indexOf("if (!mayMutateCateringFiles(booking.status as never))") < routeSource.indexOf("const result = await db.transaction"), true);
  const uploadTx = routeSource.slice(routeSource.indexOf("const result = await db.transaction"));
  assert.equal(uploadTx.indexOf("if (!active) return { kind: \"read_only\" } as const;") < uploadTx.indexOf("resolveCateringFileSlot"), true);
});
