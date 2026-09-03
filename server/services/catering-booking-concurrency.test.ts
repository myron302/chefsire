import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_FILE_LIMIT } from "@shared/catering-booking-files";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_MESSAGE_SEND_REFUSALS, cateringFilePageFrom, cateringMessagePageFrom, resolveCateringMessageSend } from "./catering-booking-communication-policy";
import { cateringFileVisibleTo, resolveCateringFileSlot } from "./catering-booking-file-policy";

/**
 * Phase 2I concurrency regressions.
 *
 * The outcomes each race resolves to are pure functions and are exercised directly. The serialization those
 * outcomes depend on -- row locks, advisory locks, unique constraints -- lives in SQL and in the route modules, so
 * this suite also asserts structurally that each mutation actually takes its lock and re-checks terminal state
 * inside the transaction rather than only before it. No branch here ever reports a success that did not happen.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.join(here, relative), "utf8");
const conversationService = read("catering-booking-conversation.ts");
const accessService = read("catering-booking-access.ts");
const communicationRoute = read("../routes/catering-booking-communication.ts");
const filesRoute = read("../routes/catering-booking-files.ts");
const migration = read("../migrations/20260902_catering_booking_communication_files.sql");
const privateStorage = read("../lib/private-storage.ts");
const BOOKING = { providerId: "provider", customerId: "customer" };

test("two simultaneous first requests cannot create two conversations for one booking", () => {
  // The advisory lock serializes them, and the primary key refuses a duplicate even if a lock were ever bypassed.
  assert.equal(conversationService.includes("pg_advisory_xact_lock(hashtext("), true);
  assert.equal(conversationService.includes("catering-conversation:"), true);
  assert.equal(migration.includes("booking_id varchar PRIMARY KEY REFERENCES catering_bookings(id)"), true);
  assert.equal(migration.includes("thread_id varchar NOT NULL UNIQUE REFERENCES dm_threads(id)"), true);
  // The lock is taken before the existence check, so the second request observes the first one's committed link.
  assert.equal(conversationService.indexOf("await lockBookingConversation(tx, booking.id);") < conversationService.indexOf("cateringBookingConversations.bookingId, booking.id"), true);
});

test("a retried send is resolved by a uniqueness constraint rather than by hope", () => {
  // Uniqueness is (booking, sender, clientRequestId), so one actor's retry can never collapse onto another's message.
  assert.equal(migration.includes("PRIMARY KEY (booking_id, sender_id, client_request_id)"), true);
  // The losing transaction claims nothing and is abandoned, so no second message survives it.
  assert.equal(communicationRoute.includes(".onConflictDoNothing()"), true);
  // The conflict is signalled by THROWING, never by returning: returning would commit the message the transaction
  // had already inserted, and the retry would leave a second copy of a message that was already accepted.
  assert.equal(communicationRoute.includes("if (claimed.length === 0) throw new DuplicateBookingMessage();"), true);
  assert.equal(communicationRoute.includes('if (error instanceof DuplicateBookingMessage) return { kind: "duplicate" };'), true);
  assert.equal(/return \{ kind: "duplicate" \} as const;/.test(communicationRoute), false, "a duplicate must never be returned from inside the transaction");
  // A token that names no accepted send is refused rather than answered with a fabricated success.
  assert.equal(communicationRoute.includes("This message could not be resolved."), true);
});

test("a booking that goes terminal mid-send is refused inside the lock, not merely before it", () => {
  assert.equal(accessService.includes("FOR UPDATE"), true);
  // The send's own transaction re-checks liveness under the row lock before writing anything.
  const sendTx = communicationRoute.slice(communicationRoute.indexOf("async function persistBookingMessage"));
  assert.equal(sendTx.indexOf("lockActiveCateringBooking(tx, id)") < sendTx.indexOf(".insert(dmMessages)"), true);
  assert.equal(resolveCateringMessageSend({ active: false, memberIds: ["provider", "customer"] }, BOOKING).kind, "read_only");
  // It answers the same canonical code the early guard does, so both mean "refetch the workspace".
  assert.equal(CATERING_MESSAGE_SEND_REFUSALS.read_only.code, CATERING_WORKSPACE_READ_ONLY_CODE);
});

test("a retried upload resolves to the file it already created rather than a second copy", () => {
  // Uniqueness is (booking, uploader, clientRequestId), and only when a token was actually supplied.
  assert.equal(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS catering_booking_files_request_uidx ON catering_booking_files(booking_id, uploaded_by, client_request_id) WHERE client_request_id IS NOT NULL"), true);
  // The losing insert claims no row, so the whole transaction -- the file row and its activity -- is abandoned. This
  // is the backstop for a concurrent same-token request; a retry that arrives after the first one committed is
  // resolved by the lookup earlier in the transaction instead.
  assert.equal(filesRoute.includes(`if (inserted.length === 0) return { kind: "duplicate", file: undefined } as const;`), true);
  const uploadTx = filesRoute.slice(filesRoute.indexOf("const result = await db.transaction"));
  assert.equal(uploadTx.indexOf("if (inserted.length === 0)") < uploadTx.indexOf(".insert(cateringBookingActivity)"), true);
  // The object this attempt wrote is compensated, and the response is the original file, never an invented success.
  assert.equal(filesRoute.includes("const existing = result.file ?? await duplicateFile(id, userId, fields.clientRequestId!);"), true);
  assert.equal(filesRoute.includes("This upload could not be resolved."), true);
  const duplicateBranch = filesRoute.slice(filesRoute.indexOf(`if (result.kind !== "stored")`), filesRoute.indexOf("stored = null;\n\n    // Only a new shared file"));
  assert.equal(duplicateBranch.indexOf("await compensateStoredObject(stored);") < duplicateBranch.indexOf(`if (result.kind === "duplicate")`), true);
});

test("a retry is resolved BEFORE the file limit, so a full booking cannot reject an accepted upload", () => {
  const uploadTx = filesRoute.slice(filesRoute.indexOf("const result = await db.transaction"));
  // The exact failure this ordering prevents: the successful upload filled the last slot, so counting first would
  // answer its own lost-response retry with "booking full".
  const lookupAt = uploadTx.indexOf("duplicateFile(id, userId, fields.clientRequestId, tx)");
  const countAt = uploadTx.indexOf("resolveCateringFileSlot");
  assert.notEqual(lookupAt, -1);
  assert.equal(lookupAt < countAt, true, "idempotency must resolve before the collection limit");
  // Both happen under the same file collection lock, so a concurrent same-token upload is serialized against it.
  assert.equal(uploadTx.indexOf("await lockFileCollection(tx, id)") < lookupAt, true);
  assert.equal(uploadTx.includes(`if (alreadyPersisted) return { kind: "duplicate", file: alreadyPersisted } as const;`), true);
});

test("a resolved retry writes no second row, activity, notification or storage object", () => {
  const uploadTx = filesRoute.slice(filesRoute.indexOf("const result = await db.transaction"));
  // The duplicate return happens before the insert, so no row and no activity row are written.
  const duplicateAt = uploadTx.indexOf(`return { kind: "duplicate", file: alreadyPersisted }`);
  assert.equal(duplicateAt < uploadTx.indexOf(".insert(cateringBookingFiles)"), true);
  assert.equal(duplicateAt < uploadTx.indexOf(".insert(cateringBookingActivity)"), true);
  // The notification only ever runs on the "stored" path, which a duplicate never reaches.
  const notifyAt = filesRoute.indexOf("shouldNotifyCateringFileUpload(fields.visibility)");
  assert.equal(filesRoute.lastIndexOf("stored = null;", notifyAt) > filesRoute.indexOf(`if (result.kind !== "stored")`), true);
  // And the object this retry uploaded is compensated rather than left behind as a second copy.
  const duplicateBranch = filesRoute.slice(filesRoute.indexOf(`if (result.kind !== "stored")`), notifyAt);
  assert.equal(duplicateBranch.indexOf("await compensateStoredObject(stored);") < duplicateBranch.indexOf(`if (result.kind === "duplicate")`), true);
});

test("a retry token cannot resolve to another actor's or another booking's file", () => {
  const lookup = filesRoute.slice(filesRoute.indexOf("async function duplicateFile"));
  // Scoped to exactly the columns the unique index covers.
  assert.equal(lookup.includes("eq(cateringBookingFiles.bookingId, bookingId)"), true);
  assert.equal(lookup.includes("eq(cateringBookingFiles.uploadedBy, uploadedBy)"), true);
  assert.equal(lookup.includes("eq(cateringBookingFiles.clientRequestId, clientRequestId)"), true);
  // The route only ever passes the authenticated actor and the authorized booking into it.
  assert.equal(filesRoute.includes("duplicateFile(id, userId, fields.clientRequestId, tx)"), true);
});

test("a genuinely new token at the limit is still refused, and an under-limit upload is unchanged", () => {
  const uploadTx = filesRoute.slice(filesRoute.indexOf("const result = await db.transaction"));
  // Only a request whose token resolves to nothing reaches the count, and the limit still applies to it.
  assert.equal(uploadTx.includes("const slot = resolveCateringFileSlot({ activeCount: Number(value) });"), true);
  assert.equal(uploadTx.includes(`if (slot.kind !== "accepted") return slot;`), true);
  assert.equal(resolveCateringFileSlot({ activeCount: CATERING_BOOKING_FILE_LIMIT }).kind, "limit");
  assert.equal(resolveCateringFileSlot({ activeCount: CATERING_BOOKING_FILE_LIMIT - 1 }).kind, "accepted");
});

test("an upload retry after the booking goes terminal is refused, matching message idempotency", () => {
  // Both surfaces run the read-only guard before the token is examined, so neither resolves historically and
  // neither creates anything. The decision is stated in the route rather than left implicit.
  assert.equal(filesRoute.includes("matches message idempotency"), true);
  const guardAt = filesRoute.indexOf("if (!mayMutateCateringFiles(booking.status as never))");
  assert.equal(guardAt < filesRoute.indexOf("const result = await db.transaction"), true);
  assert.equal(communicationRoute.indexOf("if (!mayPostCateringBookingMessage(booking.status as never))") < communicationRoute.indexOf("await persistBookingMessage("), true);
});

test("a retry whose original file was since removed says so rather than inventing an active file", () => {
  assert.equal(filesRoute.includes("if (existing.deletedAt !== null) return res.status(409)"), true);
  assert.equal(filesRoute.includes("This upload was already accepted, and that file has since been removed"), true);
});

test("a booking that goes terminal mid-upload refuses and the already-stored object is removed", () => {
  const uploadTx = filesRoute.slice(filesRoute.indexOf("const result = await db.transaction"));
  assert.equal(uploadTx.indexOf("lockActiveCateringBooking(tx, id)") < uploadTx.indexOf(".insert(cateringBookingFiles)"), true);
  // The metadata never persisted, so the bytes that did must not survive as a file nobody owns.
  assert.equal(filesRoute.includes("await compensateStoredObject(stored);"), true);
  assert.equal(resolveCateringFileSlot(null).kind, "read_only");
});

test("concurrent uploads cannot together exceed the per-booking file limit", () => {
  // The count is taken under the file collection advisory lock, inside the same transaction that inserts.
  assert.equal(filesRoute.includes("catering-files:"), true);
  const uploadTx = filesRoute.slice(filesRoute.indexOf("const result = await db.transaction"));
  assert.equal(uploadTx.indexOf("await lockFileCollection(tx, id)") < uploadTx.indexOf("resolveCateringFileSlot"), true);
  assert.equal(uploadTx.indexOf("resolveCateringFileSlot") < uploadTx.indexOf(".insert(cateringBookingFiles)"), true);
  assert.equal(resolveCateringFileSlot({ activeCount: CATERING_BOOKING_FILE_LIMIT }).kind, "limit");
  assert.equal(resolveCateringFileSlot({ activeCount: CATERING_BOOKING_FILE_LIMIT - 1 }).kind, "accepted");
});

test("a delete that races a terminal transition is refused inside the lock", () => {
  const deleteTx = filesRoute.slice(filesRoute.indexOf("r.delete("));
  assert.equal(deleteTx.indexOf("lockActiveCateringBooking(tx, id)") < deleteTx.indexOf(".update(cateringBookingFiles)"), true);
  assert.equal(deleteTx.includes(`return { kind: "read_only" } as const;`), true);
});

test("a delete that races another delete tombstones nothing and says so, rather than reporting a second removal", () => {
  // The tombstone update is conditional on the row still being live, so the loser updates no rows.
  assert.equal(filesRoute.includes("isNull(cateringBookingFiles.deletedAt))).returning()"), true);
  assert.equal(filesRoute.includes(`if (!tombstoned) return { kind: "not_found" } as const;`), true);
  // Only the winner writes removal activity, so the history records one removal, not two.
  const deleteTx = filesRoute.slice(filesRoute.indexOf("r.delete("));
  assert.equal(deleteTx.indexOf("if (!tombstoned)") < deleteTx.indexOf(".insert(cateringBookingActivity)"), true);
});

test("a download that races a tombstone finds nothing, for either participant", () => {
  const tombstoned = { visibility: "shared", deletedAt: new Date() };
  assert.equal(cateringFileVisibleTo(tombstoned, "provider"), false);
  assert.equal(cateringFileVisibleTo(tombstoned, "customer"), false);
  // The download route resolves through the same predicate the list does, so they cannot disagree.
  assert.equal(filesRoute.includes("cateringFileVisibleTo(row, role) ? row : null"), true);
});

test("the compensation identity is established BEFORE the object write, not after it", () => {
  const upload = filesRoute.slice(filesRoute.indexOf("const fileId = randomUUID();"), filesRoute.indexOf("const result = await db.transaction"));
  // A PUT that reports a timeout may still have committed remotely. Recording the key only on a successful return
  // left those bytes with nothing that knew they might exist.
  assert.equal(upload.indexOf("stored = { provider, storageKey, bookingId: id") < upload.indexOf("await writePrivateObject("), true);
});

test("an uncertain write compensates for the key it knows rather than abandoning it", () => {
  const upload = filesRoute.slice(filesRoute.indexOf("const fileId = randomUUID();"), filesRoute.indexOf("const result = await db.transaction"));
  const writeCatch = upload.slice(upload.indexOf("} catch (writeError) {"));
  // The same key is compensated, recorded as uncertain, and the failure is rethrown -- never a fresh key, and never
  // a success.
  assert.equal(writeCatch.includes(`stored.reason = "uncertain_upload";`), true);
  assert.equal(writeCatch.includes("await compensateStoredObject(stored);"), true);
  assert.equal(writeCatch.includes("throw writeError;"), true);
  assert.equal(writeCatch.includes("cateringFileStorageKey("), false, "an uncertain write must not be retried under a new key");
  // The compensating delete is idempotent, so attempting it for a write that truly failed is never an error.
  assert.equal(privateStorage.includes("if ((error as NodeJS.ErrnoException).code !== \"ENOENT\") throw error;"), true);
});

test("all four storage outcomes are deterministic", () => {
  const handler = filesRoute.slice(filesRoute.indexOf("async function handleUpload"));
  // storage failure before commit, and storage uncertain: both compensate the known key and answer with a failure.
  assert.equal(handler.includes("} catch (writeError) {"), true);
  // storage success + DB failure: the transaction returns non-stored, and the object is compensated.
  assert.equal(handler.includes(`if (result.kind !== "stored")`), true);
  // storage uncertain + cleanup failure: the orphan ledger keeps the key for the reconciliation job.
  assert.equal(handler.includes("cateringBookingStorageOrphans"), true);
  // normal success: the compensation identity is cleared so nothing is deleted afterwards.
  assert.equal(handler.includes("stored = null;"), true);
});

test("an object stored with no owning metadata row is compensated, and an unreconcilable one is recorded", () => {
  assert.equal(filesRoute.includes("await removePrivateObject(stored.provider, stored.storageKey);"), true);
  // Only when the compensating delete ALSO fails is a ledger row written, so orphans never accumulate silently.
  assert.equal(filesRoute.includes("cateringBookingStorageOrphans"), true);
  // The reason travels with the compensation identity, so the ledger distinguishes an upload whose metadata failed
  // from one whose write outcome was never confirmed.
  assert.equal(filesRoute.includes(`reason: "orphaned_upload"`), true);
  assert.equal(filesRoute.includes(`stored.reason = "uncertain_upload";`), true);
  assert.equal(filesRoute.includes("const reason = stored.reason;"), true);
  assert.equal(migration.includes("CREATE TABLE IF NOT EXISTS catering_booking_storage_orphans"), true);
});

test("a storage cleanup that fails after the tombstone never restores the file", () => {
  const deleteTx = filesRoute.slice(filesRoute.indexOf("r.delete("));
  // The failure path only records cleanup state; it never clears deletedAt or deletedBy.
  const cleanupFailure = deleteTx.slice(deleteTx.indexOf("} catch (cleanupError) {"));
  assert.equal(cleanupFailure.includes("cleanupAttempts"), true);
  assert.equal(cleanupFailure.includes("cleanupError:"), true);
  assert.equal(cleanupFailure.includes("deletedAt: null"), false);
  assert.equal(cleanupFailure.includes("deletedBy: null"), false);
  // The database itself refuses a row that claims its object was cleaned up before the metadata was tombstoned.
  assert.equal(migration.includes("object_deleted_at IS NULL OR deleted_at IS NOT NULL"), true);
});

test("the read marker is written from the selected message's stored created_at, never a wall clock", () => {
  const readRoute = communicationRoute.slice(communicationRoute.indexOf(`r.post("/bookings/:id/messages/read"`));
  // The write copies the message's own created_at in SQL, keeping full precision a Date round-trip would truncate.
  assert.equal(communicationRoute.includes("SET last_read_message_id = m.id, last_read_at = m.created_at"), true);
  // No wall-clock instant is minted anywhere in the read path, so a concurrent message cannot be marked read by time.
  assert.equal(readRoute.includes("new Date()"), false, "the read marker must not be derived from the wall clock");
  // An empty conversation is answered without inventing a boundary.
  assert.equal(readRoute.includes(`if (marker.kind === "empty") return res.json({ lastReadMessageId: null, lastReadAt: null, unreadCount: 0 });`), true);
});

test("the read marker is advanced by one conditional statement, so it cannot race backward", () => {
  const advance = communicationRoute.slice(communicationRoute.indexOf("* Advances one participant's read marker"), communicationRoute.indexOf("type BookingMessageSendResult"));
  // A single UPDATE whose WHERE carries the comparison. Read-compare-write would let two tabs both decide they
  // advance and let the later writer win with the older message.
  assert.equal(advance.includes("UPDATE dm_participants AS p"), true);
  assert.equal(advance.includes("(m.created_at, m.id) > (SELECT b.created_at, b.id FROM dm_messages AS b WHERE b.id = p.last_read_message_id)"), true);
  // The three accepted cases: no marker, a marker that is not a message of this thread, or a strictly later pair.
  assert.equal(advance.includes("p.last_read_message_id IS NULL"), true);
  assert.equal(advance.includes("NOT EXISTS (SELECT 1 FROM dm_messages AS b WHERE b.id = p.last_read_message_id AND b.thread_id ="), true);
  // The marker is re-validated as a message of this thread inside the same statement.
  assert.equal(advance.includes("AND m.thread_id ="), true);
  // No read-then-write anywhere on either path.
  assert.equal(communicationRoute.includes(".update(dmParticipants)"), false, "the read marker must not be written unconditionally");
});

test("every path that writes a read marker goes through the forward-only update", () => {
  // Exactly one caller now: the explicit read route. Sending no longer touches the marker at all, so the forward-only
  // update is both the only way it moves and the only place the invariant has to hold.
  assert.equal((communicationRoute.match(/await advanceReadMarker\(/g) ?? []).length, 1);
  assert.equal(communicationRoute.includes("await advanceReadMarker(db, threadId, userId, marker.messageId)"), true);
  assert.equal(communicationRoute.includes("advanceReadMarker(tx,"), false, "the send transaction must not advance a read marker");
});

test("a stale mark answers with the authoritative marker rather than the one it asked for", () => {
  const readRoute = communicationRoute.slice(communicationRoute.indexOf(`r.post("/bookings/:id/messages/read"`));
  // Reporting back the requested marker would claim a write that did not happen.
  assert.equal(readRoute.includes("conversationParticipant(threadId, userId)"), true);
  assert.equal(readRoute.includes("lastReadMessageId: current?.lastReadMessageId ?? null"), true);
  assert.equal(readRoute.includes("lastReadAt: current?.lastReadAt?.toISOString() ?? null"), true);
  assert.equal(readRoute.includes("lastReadMessageId: marker.messageId,"), false);
});

test("the read marker update introduces no new lock ordering", () => {
  const advance = communicationRoute.slice(communicationRoute.indexOf("* Advances one participant's read marker"), communicationRoute.indexOf("type BookingMessageSendResult"));
  // One row lock, on dm_participants, held only for its own statement, and now outside the send transaction
  // entirely. It takes no booking row lock and no advisory lock, so it cannot form a cycle with the send flow.
  assert.equal(advance.includes("FOR UPDATE"), false);
  assert.equal(advance.includes("pg_advisory"), false);
  assert.equal(advance.includes("Lock ordering:"), true);
});

test("unread is counted against the (created_at, id) pair, so equal timestamps cannot collapse", () => {
  const unread = communicationRoute.slice(communicationRoute.indexOf("export async function unreadMessageCount"));
  // The same full-precision row comparison message pagination uses, against the marker's stored pair.
  assert.equal(unread.includes("(${dmMessages.createdAt}, ${dmMessages.id}) > (SELECT b.created_at, b.id FROM dm_messages b WHERE b.id = ${boundary.messageId})"), true);
  // The timestamp comparison survives only as the fallback for a row carrying no usable marker.
  assert.equal(unread.includes(`boundary.kind === "after_timestamp"`), true);
  assert.equal(unread.includes("cateringUnreadBoundary(participant, markerIsInThread)"), true);
});

test("generic DM unread computation is untouched by the booking read-boundary fix", () => {
  const dmSource = read("../routes/dm.ts");
  // Ordinary DMs keep their own approximate lastReadAt comparison; nothing here changed it, and booking threads
  // are excluded from that listing anyway.
  assert.equal(dmSource.includes("unreadByThread"), true);
  assert.equal(dmSource.includes("new Date(me.lastReadAt).getTime()"), true);
  assert.equal(dmSource.includes("unreadMessageCount"), false, "the booking unread helper must not leak into generic DMs");
});

test("message and file pages stay deterministic when rows share a created_at", () => {
  // The boundary is compared as the stored (created_at, id) pair, read back from the database at full precision,
  // so a client round-trip cannot truncate a timestamp into skipping or repeating a row at a page edge.
  assert.equal(communicationRoute.includes("(SELECT m.created_at, m.id FROM dm_messages m WHERE m.id = "), true);
  assert.equal(filesRoute.includes("(SELECT f.created_at, f.id FROM catering_booking_files f WHERE f.id = "), true);
  assert.equal(communicationRoute.includes("desc(dmMessages.createdAt), desc(dmMessages.id)"), true);
  assert.equal(filesRoute.includes("desc(cateringBookingFiles.createdAt), desc(cateringBookingFiles.id)"), true);
  // Three rows with one identical timestamp still page in a stable order and hand back the last id as the boundary.
  const sameInstant = ["c", "b", "a"].map((id) => ({ id, createdAt: "2026-09-01T12:00:00.000Z" }));
  assert.deepEqual(cateringMessagePageFrom(sameInstant, 3).rows.map((row) => row.id), ["a", "b", "c"]);
  assert.equal(cateringMessagePageFrom(sameInstant, 3).nextCursor, "a");
  assert.equal(cateringFilePageFrom(sameInstant, 3).nextCursor, "a");
});

test("a cursor is validated against what the actor may see, so a probe is not a usable boundary", () => {
  assert.equal(communicationRoute.includes(`return res.status(400).json({ message: "Unknown message cursor" });`), true);
  assert.equal(filesRoute.includes(`return res.status(400).json({ message: "Unknown file cursor" });`), true);
  // The file cursor is looked up within the same visibility-filtered scope the page itself uses.
  assert.equal(filesRoute.includes("and(scope, eq(cateringBookingFiles.id, page.cursor))"), true);
});

test("reading a conversation or a workspace never creates one, so viewing is not a write", () => {
  assert.equal(communicationRoute.includes("const threadId = await findBookingConversation(id);"), true);
  // Only the send path ensures a conversation exists; the list and read-marker paths look one up.
  assert.equal(communicationRoute.split("ensureBookingConversation").length - 1, 2, "only the send route may create a conversation");
});

test("Phase 2H task and activity pagination is untouched by Phase 2I", () => {
  const workspaceRoute = read("../routes/catering-booking-workspace.ts");
  // The activity page is still offset-paginated over the same bounded schema, and tasks still load bounded and sorted.
  assert.equal(workspaceRoute.includes("cateringBookingActivityPageSchema.parse(req.query)"), true);
  assert.equal(workspaceRoute.includes(".offset((page.page - 1) * page.limit)"), true);
  assert.equal(workspaceRoute.includes("limit(CATERING_BOOKING_TASK_LIMIT)"), true);
  // The Phase 2I summary is bounded too, and never inlines either collection into the workspace response.
  assert.equal(workspaceRoute.includes("unreadMessageCount"), true);
  assert.equal(workspaceRoute.includes("activeFileCount(id, role)"), true);
  assert.equal(/messages: .*\.map\(serializeBookingMessage/.test(workspaceRoute), false);
  assert.equal(/files: .*\.map\(serializeBookingFile/.test(workspaceRoute), false);
});
