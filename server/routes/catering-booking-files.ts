import { Router } from "express";
import { randomUUID, createHash } from "crypto";
import multer from "multer";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { cateringBookingActivity, cateringBookingFiles, cateringBookingStorageOrphans, notifications, users, type CateringBookingFile } from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { CATERING_FILE_COUNT_CEILING, CATERING_FILE_LIMIT_CODE, CATERING_FILE_LIMIT_MESSAGE, CATERING_FILE_MAX_BYTES, CATERING_FILE_NOTIFICATION, CATERING_FILE_NOT_FOUND_MESSAGE, CATERING_FILE_READ_ONLY_MESSAGE, CATERING_FILE_SIZE_MESSAGE, CATERING_FILE_TYPE_MESSAGE, cateringBookingFilePageSchema, cateringFileUploadFieldsSchema, mayMutateCateringFiles, type CateringFileVisibility } from "@shared/catering-booking-files";
import { CATERING_FILES_SECTION, cateringBookingSectionPath } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE, cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { serializeBookingFile } from "../serializers/catering-booking-file";
import { lockActiveCateringBooking, ownedCateringBooking } from "../services/catering-booking-access";
import { cateringCounterpart, cateringFilePageFrom, boundedCount } from "../services/catering-booking-communication-policy";
import { CATERING_FILE_DOWNLOAD_HEADERS, cateringFileActivity, cateringFileContentDisposition, cateringFileStorageKey, cateringFileVisibleTo, resolveCateringFileSlot, resolveCateringUpload, shouldNotifyCateringFileUpload } from "../services/catering-booking-file-policy";
import { validateCateringFileContent } from "../services/catering-booking-file-content";
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
  limits: { fileSize: CATERING_FILE_MAX_BYTES, files: 1 },
}).single("file");

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
    .limit(page.limit);
  const { rows: ordered, nextCursor } = cateringFilePageFrom(rows, page.limit);
  const names = await uploaderNames(ordered.map((row) => row.uploadedBy));
  res.json({ files: ordered.map((row) => serializeBookingFile(row, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, status: booking.status as never, names })), nextCursor, editable: mayMutateCateringFiles(booking.status as never) });
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
      const code = (uploadError as { code?: string }).code;
      if (code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: CATERING_FILE_SIZE_MESSAGE });
      if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ message: "Upload exactly one file" });
      return next(uploadError);
    }
    void handleUpload(req, res, next);
  });
});

async function handleUpload(req: Parameters<Parameters<typeof r.post>[1]>[0], res: Res, next: (error: unknown) => void) {
  let stored: { provider: PrivateStorageProvider; storageKey: string; bookingId: string } | null = null;
  try {
    const id = cateringBookingIdSchema.parse(req.params.id);
    const userId = (req.user as { id: string }).id;
    const fields = cateringFileUploadFieldsSchema.parse({ visibility: req.body?.visibility, ...(req.body?.clientRequestId ? { clientRequestId: req.body.clientRequestId } : {}) });
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
    await writePrivateObject(provider, storageKey, content.body, upload.type.contentType);
    stored = { provider, storageKey, bookingId: id };

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
      const [{ value }] = await tx.select({ value: count() }).from(cateringBookingFiles).where(and(eq(cateringBookingFiles.bookingId, id), isNull(cateringBookingFiles.deletedAt)));
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
      if (result.kind === "limit") return res.status(409).json({ message: CATERING_FILE_LIMIT_MESSAGE, code: CATERING_FILE_LIMIT_CODE });
      if (result.kind === "duplicate") {
        // The retry is answered with the file the first attempt already persisted -- never a second copy, and never
        // an invented success for a token that names no accepted upload. `result.file` is set when the lookup inside
        // the lock found it; it is absent only when a concurrent same-token request won the insert, so that one is
        // read back now that it has committed.
        const existing = result.file ?? await duplicateFile(id, userId, fields.clientRequestId!);
        if (!existing) return res.status(409).json({ message: "This upload could not be resolved. Reload the file list." });
        // The original upload was accepted and its file has since been removed. Reporting it as an active file would
        // be untrue, and reporting the retry as a new upload would be worse, so it says exactly what happened.
        if (existing.deletedAt !== null) return res.status(409).json({ message: "This upload was already accepted, and that file has since been removed from the booking." });
        const names = await uploaderNames([existing.uploadedBy]);
        return res.status(200).json({ file: serializeBookingFile(existing, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, status: booking.status as never, names }), duplicate: true });
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
    // A throw after the object landed is the orphan case the compensating delete exists for.
    if (stored) await compensateStoredObject(stored);
    invalid(error, res, next);
  }
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
async function compensateStoredObject(stored: { provider: PrivateStorageProvider; storageKey: string; bookingId: string }): Promise<void> {
  try {
    await removePrivateObject(stored.provider, stored.storageKey);
  } catch (deleteError) {
    const reason = "orphaned_upload";
    const message = deleteError instanceof Error ? deleteError.message : String(deleteError);
    try {
      await db.insert(cateringBookingStorageOrphans).values({ bookingId: stored.bookingId, storageProvider: stored.provider, storageKey: stored.storageKey, reason, cleanupError: message });
    } catch (ledgerError) {
      // The ledger is the last place this can be recorded, so a failure there is logged rather than swallowed.
      console.error("catering booking file orphan could not be recorded", { bookingId: stored.bookingId, storageProvider: stored.provider, reason, cleanupError: message, ledgerError });
    }
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
  try {
    await removePrivateObject(result.file.storageProvider as PrivateStorageProvider, result.file.storageKey);
    await db.update(cateringBookingFiles).set({ objectDeletedAt: new Date(), cleanupError: null }).where(eq(cateringBookingFiles.id, result.file.id));
  } catch (cleanupError) {
    await db.update(cateringBookingFiles)
      .set({ cleanupAttempts: sql`${cateringBookingFiles.cleanupAttempts} + 1`, cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) })
      .where(eq(cateringBookingFiles.id, result.file.id))
      .catch(() => undefined);
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
