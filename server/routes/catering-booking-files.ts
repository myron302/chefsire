import { Router } from "express";
import { randomUUID, createHash } from "crypto";
import multer from "multer";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { cateringBookingActivity, cateringBookingFiles, cateringBookingStorageOrphans, notifications, users, type CateringBookingFile } from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { CATERING_FILE_COUNT_CEILING, CATERING_FILE_LIMIT_CODE, CATERING_FILE_MAX_BYTES, CATERING_UPLOAD_MULTIPART, CATERING_UPLOAD_MULTIPART_MESSAGES, cateringFileLimitMessage, CATERING_FILE_NOTIFICATION, CATERING_FILE_NOT_FOUND_MESSAGE, CATERING_FILE_READ_ONLY_MESSAGE, CATERING_FILE_SIZE_MESSAGE, CATERING_FILE_TYPE_MESSAGE, cateringBookingFilePageSchema, cateringBookingFilePresenceSchema, cateringFileUploadFieldsSchema, mayMutateCateringFiles, type CateringFileVisibility } from "@shared/catering-booking-files";
import { CATERING_FILES_SECTION, cateringBookingSectionPath } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE, cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { serializeBookingFile } from "../serializers/catering-booking-file";
import { lockActiveCateringBooking, ownedCateringBooking } from "../services/catering-booking-access";
import { cateringCounterpart, cateringFilePageFrom, cateringPageQueryLimit, boundedCount } from "../services/catering-booking-communication-policy";
import { CATERING_FILE_DOWNLOAD_HEADERS, cateringFileActivity, cateringFileContentDisposition, cateringFileStorageKey, cateringFileVisibleTo, resolveCateringFileSlot, resolveCateringUpload, shouldNotifyCateringFileUpload } from "../services/catering-booking-file-policy";
import { validateCateringFileContent } from "../services/catering-booking-file-content";
import { CATERING_CLEANUP_MAX_ATTEMPTS, cateringCleanupChargesAttempt, cateringOrphanInitialAttempts, settleCateringFinalization, type CateringCleanupConclusion, type CateringOrphanOrigin } from "../services/catering-booking-storage-cleanup";
import { privateStorageProvider, readPrivateObject, removePrivateObject, writePrivateObject, type PrivateStorageProvider } from "../lib/private-storage";

const r = Router();
const fileIdSchema = z.string().uuid();
const NOT_FOUND = { message: CATERING_FILE_NOT_FOUND_MESSAGE } as const;
type Res = Parameters<Parameters<typeof r.get>[1]>[1];

/**
 * One file, held in memory, capped at the launch maximum. The generic /api/upload allowlist is deliberately not
 * reused: booking documents accept only PDF, JPEG, PNG and WebP, and the real decision is made by the content check
 * rather than here -- this filter only avoids buffering something that could never be accepted anyway.
 */
const bookingFileUpload = multer({
  storage: multer.memoryStorage(),
  // Every dimension of the multipart body is bounded, not just the file. Multer accumulates parts into memory
  // BEFORE `handleUpload` can load the booking and check ownership, so without field/part caps an authenticated
  // caller could spend process memory on a booking they do not own simply by naming a well-formed UUID. The values
  // come from the real contract -- one file, `visibility`, `clientRequestId` -- rather than being picked generously.
  limits: {
    fileSize: CATERING_FILE_MAX_BYTES,
    files: CATERING_UPLOAD_MULTIPART.files,
    fields: CATERING_UPLOAD_MULTIPART.fields,
    parts: CATERING_UPLOAD_MULTIPART.parts,
    fieldSize: CATERING_UPLOAD_MULTIPART.fieldSize,
    fieldNameSize: CATERING_UPLOAD_MULTIPART.fieldNameSize,
  },
}).single("file");

/** Each parser limit answers with its own bounded message. Nothing here reveals a limit's value or any internals. */
const MULTIPART_REFUSALS: Record<string, string> = {
  LIMIT_FILE_SIZE: CATERING_UPLOAD_MULTIPART_MESSAGES.size,
  LIMIT_FILE_COUNT: CATERING_UPLOAD_MULTIPART_MESSAGES.file,
  LIMIT_UNEXPECTED_FILE: CATERING_UPLOAD_MULTIPART_MESSAGES.file,
  LIMIT_FIELD_COUNT: CATERING_UPLOAD_MULTIPART_MESSAGES.fields,
  LIMIT_PART_COUNT: CATERING_UPLOAD_MULTIPART_MESSAGES.parts,
  LIMIT_FIELD_VALUE: CATERING_UPLOAD_MULTIPART_MESSAGES.fieldValue,
  LIMIT_FIELD_KEY: CATERING_UPLOAD_MULTIPART_MESSAGES.fieldName,
};

function invalid(error: unknown, res: Res, next: (error: unknown) => void) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
  next(error);
}
async function uploaderNames(ids: readonly string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((row: { id: string; displayName: string | null; username: string | null }) => [row.id, row.displayName || row.username || null] as const));
}
/** The advisory lock the per-booking file collection limit is counted under, so concurrent uploads cannot exceed it. */
async function lockFileCollection(tx: typeof db, bookingId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-files:${bookingId}`}))`);
}
/** The visibilities one actor may ever observe, applied as a SQL filter so nothing else is even selected. */
function visibilityFilter(role: "provider" | "customer") {
  return role === "provider" ? undefined : eq(cateringBookingFiles.visibility, "shared");
}

r.get("/bookings/:id/files", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = (req.user as { id: string }).id;
  const page = cateringBookingFilePageSchema.parse(req.query);
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) return res.status(404).json(NOT_FOUND);
  const role = cateringWorkspaceRole(booking, userId)!;
  // The cursor is validated against exactly the rows this actor may see, so a provider-private file's id is not a
  // usable boundary for a customer and probing one is indistinguishable from probing an id that does not exist.
  const scope = and(eq(cateringBookingFiles.bookingId, id), isNull(cateringBookingFiles.deletedAt), visibilityFilter(role));
  if (page.cursor) {
    const [cursorRow] = await db.select({ id: cateringBookingFiles.id }).from(cateringBookingFiles).where(and(scope, eq(cateringBookingFiles.id, page.cursor))).limit(1);
    if (!cursorRow) return res.status(400).json({ message: "Unknown file cursor" });
  }
  // The boundary compares the stored (created_at, id) pair at full precision rather than a client round-tripped
  // timestamp, so files sharing a created_at page deterministically with no row skipped or repeated.
  const boundary = page.cursor
    ? sql`(${cateringBookingFiles.createdAt}, ${cateringBookingFiles.id}) < (SELECT f.created_at, f.id FROM catering_booking_files f WHERE f.id = ${page.cursor})`
    : undefined;
  // `db` is untyped at this repo's boundary, so the row shape is stated here rather than inferred as `any`.
  const rows: CateringBookingFile[] = await db.select().from(cateringBookingFiles)
    .where(and(scope, boundary))
    .orderBy(desc(cateringBookingFiles.createdAt), desc(cateringBookingFiles.id))
    // One row more than the page: the lookahead is what proves an older file exists. `cateringFilePageFrom` drops
    // it, so it is never serialized -- the client sees at most `page.limit` files either way.
    .limit(cateringPageQueryLimit(page.limit));
  const { rows: ordered, nextCursor } = cateringFilePageFrom(rows, page.limit);
  const names = await uploaderNames(ordered.map((row) => row.uploadedBy));
  res.json({ files: ordered.map((row) => serializeBookingFile(row, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, status: booking.status as never, names })), nextCursor, editable: mayMutateCateringFiles(booking.status as never) });
} catch (error) { invalid(error, res, next); } });

/**
 * Which of these files this actor may still see.
 *
 * The list endpoint serves a newest-first window, and a client that has paged into older history keeps those rows
 * locally so a shifted page boundary does not make them vanish. That leaves one thing the window can never answer:
 * whether a file below it has since been removed. Nothing newer will ever mention it again, so without this it
 * would render forever with a download that answers 404.
 *
 * The question is asked about ids the caller already holds and the answer is a SUBSET of them, so it discloses
 * nothing new. Exactly the same visibility filter the list uses is applied, so a provider-private id supplied by a
 * customer is simply absent from the answer -- indistinguishable from a removed file and from an id that never
 * existed, which is what stops this from becoming a probe. Only ids are read: no storage key, no filename, no
 * count of anything hidden, and no timestamp that could date a private file's removal.
 */
r.get("/bookings/:id/files/active", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = (req.user as { id: string }).id;
  const asked = cateringBookingFilePresenceSchema.parse(req.query);
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) return res.status(404).json(NOT_FOUND);
  const role = cateringWorkspaceRole(booking, userId)!;
  // Scoped to this booking, to rows that are not tombstoned, and to the visibilities this actor may observe. A
  // bounded `IN` over the primary key, so this stays a cheap indexed lookup however deep the history is.
  const rows: { id: string }[] = await db.select({ id: cateringBookingFiles.id }).from(cateringBookingFiles)
    .where(and(
      eq(cateringBookingFiles.bookingId, id),
      isNull(cateringBookingFiles.deletedAt),
      visibilityFilter(role),
      inArray(cateringBookingFiles.id, asked.ids),
    ));
  const visible = new Set(rows.map((row) => row.id));
  res.json({ requested: asked.ids, active: asked.ids.filter((candidate) => visible.has(candidate)) });
} catch (error) { invalid(error, res, next); } });

/**
 * Uploads one booking file.
 *
 * The object is written to private storage before the metadata row exists, so the only failure that can strand bytes
 * is a database failure after a successful write. That case is compensated immediately: the object is deleted, and
 * only if that delete ALSO fails is a `catering_booking_storage_orphans` row recorded so the bytes can be reconciled.
 * The client is told the truth in every branch -- a failed upload is never reported as a success.
 */
r.post("/bookings/:id/files", requireAuth, (req, res, next) => {
  bookingFileUpload(req, res, (uploadError: unknown) => {
    if (uploadError) {
      // A parser refusal is a client validation failure, answered with a bounded message and never forwarded to the
      // Express error handler -- a Multer limit must not surface as a 500 or carry a stack trace. Anything that is
      // NOT a Multer error is a genuine server fault and still goes to `next`, so the two stay distinguishable.
      if (uploadError instanceof multer.MulterError) {
        return res.status(400).json({ message: MULTIPART_REFUSALS[uploadError.code] ?? CATERING_UPLOAD_MULTIPART_MESSAGES.rejected });
      }
      return next(uploadError);
    }
    void handleUpload(req, res, next);
  });
});

async function handleUpload(req: Parameters<Parameters<typeof r.post>[1]>[0], res: Res, next: (error: unknown) => void) {
  let stored: { provider: PrivateStorageProvider; storageKey: string; bookingId: string; fileId: string; uploadedBy: string; reason: string } | null = null;
  try {
    const id = cateringBookingIdSchema.parse(req.params.id);
    const userId = (req.user as { id: string }).id;
    // Parsed from the body itself rather than cherry-picked, so `.strict()` REJECTS an unexpected field instead of
    // silently dropping it. Multer's field cap already refuses a flood; this refuses a wrong shape.
    const fields = cateringFileUploadFieldsSchema.parse(req.body ?? {});
    const file = (req as { file?: Express.Multer.File }).file;
    if (!file) return res.status(400).json({ message: "A file is required" });
    const booking = await ownedCateringBooking(id, userId);
    if (!booking) return res.status(404).json(NOT_FOUND);
    const role = cateringWorkspaceRole(booking, userId)!;
    // A terminal booking refuses every upload, retry or not. This is deliberate and matches message idempotency
    // exactly: there too the read-only guard runs before the token is examined, so a retry that arrives after the
    // booking closed is refused rather than resolved historically. Nothing new is created either way, and the file
    // the original request did persist is still in the (read-only) list, so refreshing shows the truth.
    if (!mayMutateCateringFiles(booking.status as never)) return res.status(409).json({ message: CATERING_FILE_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE });

    // An already-accepted token is resolved HERE, before a single byte is written.
    //
    // This is the situation a retry exists for: the first upload committed its object and its metadata row, the
    // response was lost, and the client resent the same token. Writing another object first made recovery depend on
    // storage being healthy at exactly the moment it is most likely not to be -- a full disk or an unreachable
    // bucket failed the retry even though the file was already safely persisted, which is precisely what the token
    // was meant to prevent. Nothing about this request's bytes can change an outcome that already happened, so the
    // token is resolved before the write rather than after it.
    //
    // Resolving early creates no object, no metadata row, no activity event, no notification and consumes no quota
    // slot -- it returns the persisted file and stops. The lookup inside the transaction stays exactly as it was:
    // it is the concurrency backstop for two simultaneous FIRST attempts, which this uncommitted-at-read-time check
    // cannot see, and the unique index is the backstop behind that. The terminal-state guard above still runs
    // first, so a retry arriving after the booking closed is refused rather than resolved historically.
    if (fields.clientRequestId) {
      const accepted = await duplicateFile(id, userId, fields.clientRequestId);
      if (accepted) return respondWithAcceptedUpload(res, booking, userId, accepted);
    }

    // Extension, declared MIME and the actor's allowed visibilities are resolved first; each refusal is distinct, so
    // a customer asking for provider visibility is never reported as a rejected file type.
    const upload = resolveCateringUpload({ role, visibility: fields.visibility, originalName: file.originalname ?? "", declaredMimeType: file.mimetype ?? "", byteSize: file.size });
    if (upload.kind === "forbidden_visibility") return res.status(403).json({ message: "You may not upload a file with that visibility" });
    if (upload.kind === "too_large") return res.status(400).json({ message: CATERING_FILE_SIZE_MESSAGE });
    if (upload.kind === "empty") return res.status(400).json({ message: "An empty file cannot be uploaded" });
    if (upload.kind === "unsupported_type") return res.status(400).json({ message: CATERING_FILE_TYPE_MESSAGE });

    // The bytes must actually be what the extension and MIME claimed. Images are decoded and re-encoded, so the
    // stored object is Sharp's own output rather than whatever the client sent.
    const content = await validateCateringFileContent(file.buffer, upload.type.kind, upload.type.format);
    if (content.kind === "rejected") {
      // Each rejection says which problem it actually was: an oversized image, an unreadable one, and a file whose
      // bytes are not the type it claimed are three different things to tell the participant.
      if (content.reason === "too_large" || content.reason === "image_too_large") return res.status(400).json({ message: CATERING_FILE_SIZE_MESSAGE });
      if (content.reason === "unreadable_image") return res.status(400).json({ message: "This image could not be read. It may be damaged or incomplete." });
      return res.status(400).json({ message: CATERING_FILE_TYPE_MESSAGE });
    }

    // Identity and storage key are generated entirely server-side from UUIDs. The original filename survives only as
    // sanitized display metadata and contributes nothing to where the bytes land.
    const fileId = randomUUID();
    const storageKey = cateringFileStorageKey(id, fileId, upload.type.extension);
    const provider = privateStorageProvider();
    const sha256 = createHash("sha256").update(content.body).digest("hex");
    // The compensation identity is established BEFORE the write, not after it. A PUT that reports a timeout or a
    // network failure may still have committed the object remotely, and recording the key only on a successful
    // return would leave those bytes with nothing that knows they might exist. Assigning first means every outcome
    // -- committed, uncertain, or never written -- resolves to the same known key, and the compensating delete is
    // idempotent, so attempting it for a write that truly failed costs nothing and is never an error.
    stored = { provider, storageKey, bookingId: id, fileId, uploadedBy: userId, reason: "orphaned_upload" };
    try {
      await writePrivateObject(provider, storageKey, content.body, upload.type.contentType);
    } catch (writeError) {
      // Uncertain rather than known-failed: the object may exist. Compensate for the key we know, record it if that
      // cannot be confirmed, and answer with a failure -- never a success, and never a fresh key that abandons this
      // one. Rethrown so the outer handler answers the request; the compensation has already happened here.
      stored.reason = "uncertain_upload";
      await compensateStoredObject(stored);
      stored = null;
      throw writeError;
    }

    const result = await db.transaction(async (tx: typeof db) => {
      // Both the terminal-state check and the collection limit are authoritative here, under the booking row lock
      // and the file collection advisory lock, so concurrent uploads cannot together exceed the launch maximum and a
      // booking that closed mid-upload refuses instead of gaining a file.
      const active = await lockActiveCateringBooking(tx, id);
      if (!active) return { kind: "read_only" } as const;
      await lockFileCollection(tx, id);
      // Idempotency is resolved BEFORE the collection limit, under the same lock. A booking sitting at the maximum
      // is the exact situation a lost response is most likely to be retried in -- the successful upload is what
      // filled the last slot -- and counting first would answer that retry with "booking full" for a file it had
      // already accepted. Resolving first means a retry is never mistaken for a new upload.
      const alreadyPersisted = fields.clientRequestId ? await duplicateFile(id, userId, fields.clientRequestId, tx) : undefined;
      if (alreadyPersisted) return { kind: "duplicate", file: alreadyPersisted } as const;
      // The quota is counted PER VISIBILITY BUCKET, not across the booking. Counting every active row made a
      // customer-visible outcome depend on provider-only state: with 90 shared and 10 provider-private files a
      // customer who can enumerate the 90 would be refused their next shared upload, and could infer from that
      // refusal alone that undisclosed provider files exist. Scoping the count to the bucket being uploaded into
      // means a customer's result is identical whether or not any private file exists.
      const [{ value }] = await tx.select({ value: count() }).from(cateringBookingFiles)
        .where(and(eq(cateringBookingFiles.bookingId, id), isNull(cateringBookingFiles.deletedAt), eq(cateringBookingFiles.visibility, fields.visibility)));
      const slot = resolveCateringFileSlot({ activeCount: Number(value) });
      if (slot.kind !== "accepted") return slot;
      // The unique index is the backstop for the one case the lookup above cannot see: a concurrent request with the
      // same token that has not committed yet. That insert claims no row, the whole transaction is abandoned --
      // including the activity row -- and the object this attempt wrote is compensated below.
      const inserted = await tx.insert(cateringBookingFiles).values({
        id: fileId, bookingId: id, uploadedBy: userId, visibility: fields.visibility, storageProvider: provider, storageKey,
        originalFilename: upload.filename, contentType: upload.type.contentType, byteSize: content.byteSize, sha256,
        clientRequestId: fields.clientRequestId ?? null,
      }).onConflictDoNothing().returning();
      if (inserted.length === 0) return { kind: "duplicate", file: undefined } as const;
      const [row] = inserted;
      const activity = cateringFileActivity(fields.visibility, "uploaded");
      // Truthful operational history, with a display filename snapshot only -- never a storage key or a URL. A
      // provider-private file records provider-visibility activity, which the customer's workspace never receives.
      await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: userId, eventType: activity.eventType, visibility: activity.visibility, metadata: { fileName: upload.filename } });
      return { kind: "stored", file: row } as const;
    });

    if (result.kind !== "stored") {
      // The metadata never persisted, so the object that was written has no owning row and must not survive.
      await compensateStoredObject(stored);
      stored = null;
      // Worded for the bucket that is actually full. A customer only ever uploads shared files, so the message they
      // can provoke never mentions -- and never depends on -- provider-only storage.
      if (result.kind === "limit") return res.status(409).json({ message: cateringFileLimitMessage(fields.visibility), code: CATERING_FILE_LIMIT_CODE });
      if (result.kind === "duplicate") {
        // The retry is answered with the file the first attempt already persisted -- never a second copy, and never
        // an invented success for a token that names no accepted upload. `result.file` is set when the lookup inside
        // the lock found it; it is absent only when a concurrent same-token request won the insert, so that one is
        // read back now that it has committed.
        const existing = result.file ?? await duplicateFile(id, userId, fields.clientRequestId!);
        if (!existing) return res.status(409).json({ message: "This upload could not be resolved. Reload the file list." });
        return respondWithAcceptedUpload(res, booking, userId, existing);
      }
      return res.status(409).json({ message: CATERING_FILE_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE });
    }
    stored = null;

    // Only a new shared file notifies the counterpart. A provider-private upload is silent in every channel: no
    // notification, no customer-visible activity, and nothing in the customer's file list or counts.
    const counterpartId = cateringCounterpart(booking, userId);
    if (counterpartId && shouldNotifyCateringFileUpload(fields.visibility)) {
      await db.insert(notifications).values({
        userId: counterpartId, type: CATERING_FILE_NOTIFICATION.type, title: CATERING_FILE_NOTIFICATION.title, message: CATERING_FILE_NOTIFICATION.message,
        linkUrl: cateringBookingSectionPath(role === "provider" ? "customer" : "provider", id, CATERING_FILES_SECTION),
      }).catch(() => undefined);
    }
    const names = await uploaderNames([result.file.uploadedBy]);
    res.status(201).json({ file: serializeBookingFile(result.file, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, status: booking.status as never, names }) });
  } catch (error) {
    // A throw after the object landed is the orphan case the compensating delete exists for -- but ONLY once it is
    // established that the metadata did not commit. A transaction whose COMMIT succeeded and whose connection then
    // dropped rejects here exactly like one that rolled back, and deleting the object in that case would strand a
    // committed, active file row pointing at bytes that no longer exist.
    if (stored) await compensateUncertainUpload(stored);
    invalid(error, res, next);
  }
}

/** Whether the metadata for one upload is known to have committed, known not to have, or could not be determined. */
type UploadCommitState = "committed" | "absent" | "unknown";

/**
 * Asks the database, on a fresh operation outside the failed transaction, whether this upload's row committed.
 *
 * The match is on the server-generated identity assigned before the write -- the file id, the booking, the uploader
 * and the exact storage provider and key -- so it can only ever resolve to THIS upload. A filename is never part of
 * it, another booking's or another actor's row cannot satisfy it, and a row whose storage key differs is not this
 * object's owner however similar it looks.
 *
 * A query that itself fails answers "unknown" rather than "absent": the difference between "no row" and "no answer"
 * is the whole point, and collapsing them is what would destroy committed bytes during an outage.
 */
async function uploadCommitState(stored: { provider: PrivateStorageProvider; storageKey: string; bookingId: string; fileId: string; uploadedBy: string }): Promise<UploadCommitState> {
  try {
    const [row] = await db.select({ id: cateringBookingFiles.id }).from(cateringBookingFiles)
      .where(and(
        eq(cateringBookingFiles.id, stored.fileId),
        eq(cateringBookingFiles.bookingId, stored.bookingId),
        eq(cateringBookingFiles.uploadedBy, stored.uploadedBy),
        eq(cateringBookingFiles.storageProvider, stored.provider),
        eq(cateringBookingFiles.storageKey, stored.storageKey),
      ))
      .limit(1);
    return row ? "committed" : "absent";
  } catch {
    return "unknown";
  }
}

/**
 * Resolves an upload that failed AFTER its object was written, without ever destroying bytes that may be owned.
 *
 * Three outcomes, and they are deliberately different:
 *
 *  - `absent`: the database answered, and this upload's row is not there. Nothing owns the object, so it is
 *    compensated exactly as before.
 *  - `committed`: the COMMIT actually succeeded and the driver simply never got to say so. The row is live, the
 *    retry will resolve to it through the accepted-token lookup, and its bytes must still be there when the
 *    participant downloads it. The object is left untouched and nothing is recorded -- there is no orphan.
 *  - `unknown`: the verification could not run at all. Deleting is unrecoverable and leaving bytes is not, so the
 *    object survives and an `uncertain_commit` ledger row records enough identity for reconciliation to decide
 *    later. If even that write fails the object still survives; a stranded object is logged, never guessed at.
 */
async function compensateUncertainUpload(stored: { provider: PrivateStorageProvider; storageKey: string; bookingId: string; fileId: string; uploadedBy: string; reason: string }): Promise<void> {
  const state = await uploadCommitState(stored);
  if (state === "committed") return;
  if (state === "absent") return compensateStoredObject(stored);
  // Nothing was deleted here, and deliberately so: the bytes may belong to a row that committed after all. The
  // ledger row therefore starts with no storage attempt spent -- the ten are for retrying storage, not for asking
  // the database a question it could not answer.
  await recordStorageOrphan({ ...stored, reason: "uncertain_commit" }, "commit state could not be verified", "uncertain_commit");
}

/**
 * Answers a retry with the file its token already produced. Both resolution points -- the early lookup before any
 * storage write, and the in-transaction lookup under the collection lock -- answer through this, so a retry gets
 * the same response whichever one caught it.
 */
async function respondWithAcceptedUpload(res: Res, booking: { providerId: string; customerId: string; status: string }, userId: string, existing: CateringBookingFile) {
  // The original upload was accepted and its file has since been removed. Reporting it as an active file would be
  // untrue, and reporting the retry as a new upload would be worse, so it says exactly what happened.
  if (existing.deletedAt !== null) return res.status(409).json({ message: "This upload was already accepted, and that file has since been removed from the booking." });
  const names = await uploaderNames([existing.uploadedBy]);
  return res.status(200).json({ file: serializeBookingFile(existing, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, status: booking.status as never, names }), duplicate: true });
}

/**
 * Reads back the file an already-accepted upload retry token produced.
 *
 * The scope is exactly (booking, uploader, clientRequestId), matching the unique index, so a token belonging to
 * another actor or replayed against another booking resolves to nothing and is treated as a new upload rather than
 * handed someone else's file. Tombstoned rows are included deliberately: the token WAS accepted, and the caller
 * decides how to report a file that has since been removed.
 */
async function duplicateFile(bookingId: string, uploadedBy: string, clientRequestId: string, executor: typeof db = db): Promise<CateringBookingFile | undefined> {
  const [row] = await executor.select().from(cateringBookingFiles)
    .where(and(eq(cateringBookingFiles.bookingId, bookingId), eq(cateringBookingFiles.uploadedBy, uploadedBy), eq(cateringBookingFiles.clientRequestId, clientRequestId)))
    .limit(1);
  return row;
}

/**
 * Removes an object whose metadata never persisted. If the delete itself fails, the stranded bytes are recorded so
 * they can be reconciled later: silent permanent orphan accumulation is not an acceptable design, and neither is
 * pretending the compensation succeeded.
 */
async function compensateStoredObject(stored: { provider: PrivateStorageProvider; storageKey: string; bookingId: string; fileId: string; reason: string }): Promise<void> {
  try {
    await removePrivateObject(stored.provider, stored.storageKey);
  } catch (deleteError) {
    // The delete really was attempted and it really did fail, so that attempt is recorded as spent.
    await recordStorageOrphan(stored, deleteError instanceof Error ? deleteError.message : String(deleteError), "failed_delete");
  }
}

/**
 * Records one object for later reconciliation, carrying the file id the upload generated so the cleanup pass can
 * tell an object nothing owns from one whose metadata turned out to have committed after all.
 *
 * `origin` decides how many storage attempts the row starts with, and it is passed explicitly rather than left to
 * the column default: the counter bounds retries against STORAGE, so it may only count deletes that were actually
 * attempted. See `cateringOrphanInitialAttempts`.
 */
async function recordStorageOrphan(stored: { provider: PrivateStorageProvider; storageKey: string; bookingId: string; fileId: string; reason: string }, cleanupError: string, origin: CateringOrphanOrigin): Promise<void> {
  try {
    await db.insert(cateringBookingStorageOrphans).values({ bookingId: stored.bookingId, storageProvider: stored.provider, storageKey: stored.storageKey, fileId: stored.fileId, reason: stored.reason, cleanupError, cleanupAttempts: cateringOrphanInitialAttempts(origin) });
  } catch (ledgerError) {
    // The ledger is the last place this can be recorded, so a failure there is logged rather than swallowed. The
    // object is still on disk either way: nothing is deleted on a path that could not establish ownership.
    console.error("catering booking file orphan could not be recorded", { bookingId: stored.bookingId, storageProvider: stored.provider, reason: stored.reason, cleanupError, ledgerError });
  }
}

/**
 * Resolves one file for one actor, or nothing.
 *
 * A file belonging to another booking, a tombstoned file, and a provider-private file requested by the customer all
 * resolve identically to "not found", so a customer receives no evidence that a provider-private file exists: not
 * its id, filename, type, size, uploader, or even the fact that the id resolves to anything at all.
 */
async function authorizedFile(bookingId: string, fileId: string, role: "provider" | "customer"): Promise<CateringBookingFile | null> {
  const [row] = await db.select().from(cateringBookingFiles).where(and(eq(cateringBookingFiles.bookingId, bookingId), eq(cateringBookingFiles.id, fileId))).limit(1);
  return cateringFileVisibleTo(row, role) ? row : null;
}

r.get("/bookings/:id/files/:fileId/download", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const fileId = fileIdSchema.parse(req.params.fileId);
  const userId = (req.user as { id: string }).id;
  // Every request re-derives booking, participant, file-belongs-to-booking and visibility. A file id alone is never
  // authority, and no reusable or permanent download address is ever handed out.
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) return res.status(404).json(NOT_FOUND);
  const role = cateringWorkspaceRole(booking, userId)!;
  const file = await authorizedFile(id, fileId, role);
  if (!file) return res.status(404).json(NOT_FOUND);
  let body: Buffer;
  try {
    body = await readPrivateObject(file.storageProvider as PrivateStorageProvider, file.storageKey);
  } catch {
    // The metadata is authoritative but the object could not be read. That is a failure, never a partial success.
    return res.status(502).json({ message: "This file could not be retrieved from storage" });
  }
  for (const [header, value] of Object.entries(CATERING_FILE_DOWNLOAD_HEADERS)) res.setHeader(header, value);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Length", String(body.length));
  // Attachment for every type at launch: nothing a participant uploaded is rendered inline in the app's origin.
  res.setHeader("Content-Disposition", cateringFileContentDisposition(file.originalFilename));
  res.end(body);
} catch (error) { invalid(error, res, next); } });

r.delete("/bookings/:id/files/:fileId", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const fileId = fileIdSchema.parse(req.params.fileId);
  const userId = (req.user as { id: string }).id;
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) return res.status(404).json(NOT_FOUND);
  const role = cateringWorkspaceRole(booking, userId)!;
  if (!mayMutateCateringFiles(booking.status as never)) return res.status(409).json({ message: CATERING_FILE_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE });

  const result = await db.transaction(async (tx: typeof db) => {
    const active = await lockActiveCateringBooking(tx, id);
    if (!active) return { kind: "read_only" } as const;
    await lockFileCollection(tx, id);
    const [row] = await tx.select().from(cateringBookingFiles).where(and(eq(cateringBookingFiles.bookingId, id), eq(cateringBookingFiles.id, fileId))).limit(1);
    // Visibility first, so a customer probing a provider-private id gets exactly the "not found" a missing file gets.
    if (!cateringFileVisibleTo(row, role)) return { kind: "not_found" } as const;
    // Phase 2I ownership rule: the uploader deletes their own file and nobody else's.
    if (row.uploadedBy !== userId) return { kind: "forbidden" } as const;
    // A tombstone, not a hard delete: the upload and removal activity rows stay truthfully attributable to a real
    // persisted file rather than pointing at a row that no longer exists.
    const now = new Date();
    const [tombstoned] = await tx.update(cateringBookingFiles).set({ deletedAt: now, deletedBy: userId })
      .where(and(eq(cateringBookingFiles.id, fileId), eq(cateringBookingFiles.bookingId, id), isNull(cateringBookingFiles.deletedAt))).returning();
    // A concurrent delete that won the race already tombstoned the row; this one deletes nothing and says so.
    if (!tombstoned) return { kind: "not_found" } as const;
    const activity = cateringFileActivity(row.visibility as CateringFileVisibility, "removed");
    await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: userId, eventType: activity.eventType, visibility: activity.visibility, metadata: { fileName: row.originalFilename } });
    return { kind: "deleted", file: tombstoned } as const;
  });

  if (result.kind === "not_found") return res.status(404).json(NOT_FOUND);
  if (result.kind === "forbidden") return res.status(403).json({ message: "Only the participant who uploaded a file may remove it" });
  if (result.kind === "read_only") return res.status(409).json({ message: CATERING_FILE_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE });

  // The metadata tombstone is what makes the file gone. Storage cleanup happens afterwards and its outcome is
  // recorded, but a cleanup failure NEVER restores visibility: the file stays deleted and inaccessible to everyone,
  // and the row keeps enough state for the removal to be retried.
  //
  // The two steps below are kept apart because they are not the same kind of failure. Deleting the object either
  // happened or it did not, and if it did not the bytes are still there and the cleanup queue owes another attempt.
  // Writing down THAT it happened is bookkeeping about an operation already complete: once the object is gone,
  // failing to record it changes nothing in the world. Charging the retry ceiling for that would spend attempts
  // meant for a broken storage backend on a database hiccup, and could exhaust a row whose bytes are already gone
  // into a cleanup record no pass will ever finish.
  //
  // One recorder for both, so which conclusion charges the ceiling is stated once, by the cleanup service that owns
  // the ceiling. Both writes are guarded on `object_deleted_at` still being null, so neither can overwrite a
  // concurrent cleanup pass that already finished this row, and both are best effort: the delete has committed.
  const recordCleanup = (conclusion: CateringCleanupConclusion, error: unknown) => db.update(cateringBookingFiles)
    .set({
      ...(cateringCleanupChargesAttempt(conclusion) ? { cleanupAttempts: sql`LEAST(${cateringBookingFiles.cleanupAttempts} + 1, ${CATERING_CLEANUP_MAX_ATTEMPTS})` } : {}),
      cleanupError: error instanceof Error ? error.message : String(error),
    })
    .where(and(eq(cateringBookingFiles.id, result.file.id), isNull(cateringBookingFiles.objectDeletedAt)))
    .catch(() => undefined);

  const storage = await settleCateringFinalization(() => removePrivateObject(result.file.storageProvider as PrivateStorageProvider, result.file.storageKey));
  if (!storage.ok) {
    // The object is still there. This IS a storage attempt and it failed, so it is charged: `object_deleted_at`
    // stays null and the tombstone queue retries it.
    await recordCleanup("storage_failed", storage.error);
    return res.status(204).end();
  }
  // The bytes are gone. Marking them gone is best effort from here: a failure leaves `object_deleted_at` null, which
  // is exactly the signal the cleanup queue selects on, so the row is discovered naturally and the delete it retries
  // finds nothing and succeeds. Nothing about it is charged as a storage attempt, and nothing about it is reported
  // to the participant, whose deletion is complete and cannot be repeated or undone by retrying.
  const finalized = await settleCateringFinalization(() => db.update(cateringBookingFiles).set({ objectDeletedAt: new Date(), cleanupError: null }).where(eq(cateringBookingFiles.id, result.file.id)));
  if (!finalized.ok) {
    console.error("catering booking file cleanup marker could not be recorded", { bookingId: id, fileId: result.file.id, error: finalized.error });
    await recordCleanup("unfinalized", finalized.error);
  }
  res.status(204).end();
} catch (error) { invalid(error, res, next); } });

/**
 * The bounded active file count for one actor's workspace summary. It is scoped by the same visibility filter the
 * list uses, so a customer's count never includes -- and never hints at -- a provider-private file.
 */
export async function activeFileCount(bookingId: string, role: "provider" | "customer"): Promise<{ count: number; capped: boolean }> {
  const rows = await db.select({ id: cateringBookingFiles.id }).from(cateringBookingFiles)
    .where(and(eq(cateringBookingFiles.bookingId, bookingId), isNull(cateringBookingFiles.deletedAt), visibilityFilter(role)))
    .limit(CATERING_FILE_COUNT_CEILING + 1);
  return boundedCount(rows.length, CATERING_FILE_COUNT_CEILING);
}

export default r;
