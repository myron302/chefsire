import { Router } from "express";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  cateringBookingActivity,
  cateringBookingCloseout,
  cateringBookingCloseoutItems,
  cateringBookingEquipment,
  cateringBookingFiles,
  cateringBookingTasks,
  cateringReviews,
  notifications,
  users,
  type CateringBookingCloseoutItem,
  type CateringBookingCloseoutRecord,
} from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import {
  CATERING_CLOSEOUT_DOCUMENT_LIMIT,
  CATERING_CLOSEOUT_ITEM_KEYS,
  CATERING_CLOSEOUT_NOTIFICATION,
  cateringCloseoutCommunicationPath,
  cateringCloseoutCompleteSchema,
  cateringCloseoutItemSaveSchema,
  cateringCloseoutNotesSaveSchema,
  cateringCloseoutReopenSchema,
  cateringCloseoutSectionPath,
  cateringProviderProfilePath,
  type CateringBookingCloseoutView,
  type CateringCloseoutDocumentView,
} from "@shared/catering-booking-closeout";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { lockServedCateringBooking, ownedCateringBooking } from "../services/catering-booking-access";
import { cateringCounterpart } from "../services/catering-booking-communication-policy";
import { reviewEligibility } from "../services/catering-review-policy";
import {
  CATERING_CLOSEOUT_BLOCKED_REFUSAL,
  CATERING_CLOSEOUT_CLOSED_REFUSAL,
  CATERING_CLOSEOUT_CONFLICT_REFUSAL,
  CATERING_CLOSEOUT_FORBIDDEN_MESSAGE,
  CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL,
  CATERING_CLOSEOUT_NOT_FOUND_REFUSAL,
  cateringCloseoutFacts,
  cateringCloseoutGuard,
  cateringCloseoutIsClosed,
  cateringEventServiceOccurred,
  deriveCateringCloseout,
  resolveCateringCloseoutComplete,
  resolveCateringCloseoutItemSave,
  resolveCateringCloseoutNotesSave,
  resolveCateringCloseoutReopen,
} from "../services/catering-booking-closeout-policy";
import {
  serializeCloseoutChecklist,
  serializeCloseoutRecord,
  serializeCustomerCloseoutReview,
  serializeProviderCloseoutReview,
} from "../serializers/catering-booking-closeout";

/**
 * Phase 2K closeout routes, inside the existing catering booking namespace.
 *
 * ONE cohesive read (`GET /bookings/:id/closeout`) plus four narrow, named mutations -- not a generic CRUD surface.
 * The read is what the workspace renders; each mutation does exactly one thing and states its own preconditions.
 *
 * AUTHORIZATION, identically on every route in this file:
 *
 *  1. the acting user is `req.user.id` from the authenticated session, and nothing else;
 *  2. the booking is resolved by `ownedCateringBooking`, which restricts to the persisted provider or customer, so
 *     a body naming a providerId, customerId, closedOutBy, completedBy, owner or actor contributes nothing and a
 *     stranger simply gets no row;
 *  3. the role is derived from the resolved booking with `cateringWorkspaceRole`, never read from the request;
 *  4. every mutation is provider-only AND requires a booking whose event was actually served, checked by
 *     `cateringCloseoutGuard` before any transaction opens and again against the LOCKED booking inside it;
 *  5. an unresolvable booking answers 404 with one message, so a guessed id, another provider's booking and another
 *     customer's booking are indistinguishable -- exactly as Phases 2H, 2I and 2J already answer them.
 *
 * WHAT THIS FILE WRITES, in full: the two Phase 2K tables, two shared activity rows, and one notification. It reads
 * Phase 2J equipment, Phase 2H shared tasks, Phase 2I shared files and Phase 2E reviews, and modifies none of them.
 * It touches `catering_bookings` only to read it and to take its row lock; no closeout action moves a booking's
 * Phase 2G status, and none of them invents a payment, invoice, deposit, balance, charge or refund, because no such
 * system exists for catering to read one from.
 */
const r = Router();
type Res = Parameters<Parameters<typeof r.get>[1]>[1];
const itemKeySchema = z.enum(CATERING_CLOSEOUT_ITEM_KEYS);

function invalid(error: unknown, res: Res, next: (error: unknown) => void) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
  next(error);
}
/**
 * Answers a refused early guard. A booking whose lifecycle does not permit closeout always gets the canonical coded
 * refusal, so the client refetches; a wrong actor keeps its own truthful message and stays uncoded, because no
 * refetch would change it.
 */
function refuseGuard(res: Res, guard: "not_available" | "forbidden") {
  if (guard === "not_available") return refuse(res, CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL);
  return res.status(403).json({ message: CATERING_CLOSEOUT_FORBIDDEN_MESSAGE });
}
function refuse(res: Res, refusal: { status: number; message: string; code: string }) {
  return res.status(refusal.status).json({ message: refusal.message, code: refusal.code });
}

/**
 * The advisory lock one booking's closeout is serialized under.
 *
 * Named per booking, so one booking's closeout never serializes against another's. It is what makes the completion
 * gate real under concurrency: without it, a provider resolving the last required item and a second tab completing
 * closeout could interleave such that the completion counted a checklist it had already stopped describing.
 */
async function lockCloseout(tx: typeof db, bookingId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-closeout:${bookingId}`}))`);
}

/**
 * Uploader display names for the bounded document list.
 *
 * A local four-line lookup rather than a shared extraction, deliberately: pulling the equivalent helper out of the
 * Phase 2I files route would edit that file, and this phase promises to leave Phase 2I exactly as it is. The FILE
 * PROJECTION itself is not duplicated -- the shared document view below is built from the same row columns the
 * Phase 2I list serializes and carries strictly fewer of them.
 */
async function uploaderNames(ids: readonly string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((row: { id: string; displayName: string | null; username: string | null }) => [row.id, row.displayName || row.username || null] as const));
}

/**
 * The bounded list of SHARED documents on this booking.
 *
 * Reads the EXISTING Phase 2I file rows. There is no second upload path, no second download path and no second
 * storage model in this phase: the bytes are still served only by the Phase 2I authorized download endpoint, which
 * re-derives the booking, the participant and the visibility on every request, and no storage key, provider or URL
 * appears here for either actor.
 *
 * `visibility = 'shared'` is applied in SQL for BOTH actors, not just for the customer. A provider-private file is
 * therefore never selected into this list at all -- so it cannot reach a count, an ordering, a length or a
 * customer, and the two actors' document lists are identical by construction rather than by a filter that has to
 * be remembered. Tombstoned rows are excluded by `deleted_at IS NULL`, so a removed document does not linger.
 *
 * NOTHING IS INFERRED ABOUT WHAT THESE FILES ARE. A "final invoice" is a real file a participant actually uploaded
 * with that name; this list reports real filenames and real sizes and categorises nothing, because the Phase 2I
 * contract carries no document category to categorise by.
 */
async function sharedDocuments(bookingId: string, providerId: string): Promise<CateringCloseoutDocumentView[]> {
  const rows = await db.select({
    id: cateringBookingFiles.id,
    originalFilename: cateringBookingFiles.originalFilename,
    contentType: cateringBookingFiles.contentType,
    byteSize: cateringBookingFiles.byteSize,
    uploadedBy: cateringBookingFiles.uploadedBy,
    createdAt: cateringBookingFiles.createdAt,
  }).from(cateringBookingFiles)
    .where(and(eq(cateringBookingFiles.bookingId, bookingId), eq(cateringBookingFiles.visibility, "shared"), isNull(cateringBookingFiles.deletedAt)))
    .orderBy(desc(cateringBookingFiles.createdAt), desc(cateringBookingFiles.id))
    .limit(CATERING_CLOSEOUT_DOCUMENT_LIMIT);
  const names = await uploaderNames(rows.map((row: { uploadedBy: string }) => row.uploadedBy));
  return rows.map((row: typeof rows[number]) => ({
    id: row.id,
    filename: row.originalFilename,
    contentType: row.contentType,
    byteSize: Number(row.byteSize),
    // Derived from the persisted booking's provider, never from a request field, so a shared document a customer
    // uploaded is attributed to the customer and one the provider uploaded to the provider.
    uploadedByRole: row.uploadedBy === providerId ? "provider" as const : "customer" as const,
    uploaderName: names.get(row.uploadedBy) ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Every closeout route's opening move: resolve the booking for this authenticated user, derive their role, and --
 * for a mutation -- check the early guard. A null return means the response has already been sent.
 */
async function resolveCloseoutRequest(req: { params: Record<string, string>; user?: unknown }, res: Res, mutation: boolean) {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = (req.user as { id: string }).id;
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) { res.status(404).json({ message: "Booking closeout not found" }); return null; }
  const role = cateringWorkspaceRole(booking, userId)!;
  if (mutation) {
    const guard = cateringCloseoutGuard(booking as never, role);
    if (guard !== "allowed") { refuseGuard(res, guard); return null; }
  }
  return { id, userId, booking, role };
}

/** Reads the closeout record for one booking. Absent until the provider's first closeout write creates it. */
async function closeoutRecord(tx: typeof db, bookingId: string): Promise<CateringBookingCloseoutRecord | undefined> {
  const [row] = await tx.select().from(cateringBookingCloseout).where(eq(cateringBookingCloseout.bookingId, bookingId)).limit(1);
  return row as CateringBookingCloseoutRecord | undefined;
}
async function closeoutItems(tx: typeof db, bookingId: string): Promise<CateringBookingCloseoutItem[]> {
  return await tx.select().from(cateringBookingCloseoutItems).where(eq(cateringBookingCloseoutItems.bookingId, bookingId)) as CateringBookingCloseoutItem[];
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The cohesive closeout read
 * ------------------------------------------------------------------------------------------------------------- */

r.get("/bookings/:id/closeout", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveCloseoutRequest(req as never, res, false);
  if (!resolved) return;
  const { id, userId, booking, role } = resolved;
  const provider = role === "provider";
  const served = cateringEventServiceOccurred(booking as never);
  const [record, itemRows, equipmentRows, requirementRows, documents, reviewRows, providerRows] = await Promise.all([
    closeoutRecord(db, id),
    // The checklist is not merely filtered for a customer -- it is not QUERIED for one. Nothing about it, including
    // how many rows exist, is read on a customer's request.
    provider ? closeoutItems(db, id) : Promise.resolve([] as CateringBookingCloseoutItem[]),
    // Visibility is NOT filtered in SQL here, because a provider legitimately counts every record and the filter
    // that decides a customer's facts lives in one place instead of two. The projection below emits no equipment
    // object to either actor -- only derived counts reach the payload, and a customer's counts are built by
    // `cateringCloseoutFacts` from shared rows alone.
    db.select({ visibility: cateringBookingEquipment.visibility, status: cateringBookingEquipment.status })
      .from(cateringBookingEquipment).where(eq(cateringBookingEquipment.bookingId, id)),
    // Phase 2H shared requirements still pending. Both participants already see these, so both facts count them;
    // the Phase 2H task table is only READ here and is not modified by this phase at all.
    db.select({ value: count() }).from(cateringBookingTasks)
      .where(and(eq(cateringBookingTasks.bookingId, id), eq(cateringBookingTasks.visibility, "shared"), eq(cateringBookingTasks.status, "pending"))),
    sharedDocuments(id, booking.providerId),
    // The EXISTING Phase 2E review row for this booking's exact (customer, provider) pair, read and never written.
    db.select({ id: cateringReviews.id }).from(cateringReviews)
      .where(and(eq(cateringReviews.reviewerId, booking.customerId), eq(cateringReviews.providerId, booking.providerId))).limit(1),
    // Only a customer needs the provider's listing state, because only a customer's payload reports eligibility and
    // offers a way back to the provider's page. A provider's own payload has neither.
    provider ? Promise.resolve([]) : db.select({ enabled: users.cateringEnabled }).from(users).where(eq(users.id, booking.providerId)).limit(1),
  ]);
  const customerReviewExists = reviewRows.length > 0;
  /**
   * Whether this provider still has a catering listing, read from the authoritative user row.
   *
   * The same fact the existing Phase 2E eligibility rule already consults, used here for the second thing that
   * depends on it: whether there is anywhere for a customer to go. A provider who has since switched their listing
   * off answers 410 PROVIDER_UNAVAILABLE on their public page, so a rebooking link would be a control that cannot
   * work. Always false on a provider's own request, where the listing state is not queried and no rebooking key
   * exists to gate.
   */
  const providerListed = !provider && Boolean(providerRows[0]?.enabled);
  const facts = cateringCloseoutFacts({
    booking: booking as never,
    record,
    equipment: equipmentRows as { visibility: string; status: string }[],
    items: itemRows,
    outstandingSharedRequirementCount: Number(requirementRows[0]?.value ?? 0),
    sharedDocumentCount: documents.length,
    customerReviewExists,
  }, role);
  const view: CateringBookingCloseoutView = {
    role,
    // Derived from the authoritative booking, never from a client date computation, and false for a customer under
    // every circumstance because no customer closeout mutation exists at all.
    actionable: provider && served,
    bookingStatus: booking.status as never,
    eventServiceOccurred: served,
    closeout: serializeCloseoutRecord(record, role),
    readiness: deriveCateringCloseout(facts, role),
    documents,
    communicationPath: cateringCloseoutCommunicationPath(role, id),
    // Absent keys rather than empty values: a customer's payload has no provider-only field at all, and a
    // provider's has no rebooking key -- rebooking is the customer's action, not theirs.
    ...(provider
      ? { checklist: serializeCloseoutChecklist(itemRows), providerReview: serializeProviderCloseoutReview(customerReviewExists) }
      : {
        customerReview: serializeCustomerCloseoutReview({
          // Exactly the existing Phase 2E eligibility rule, evaluated rather than re-invented, plus the one
          // closeout condition that an event actually happened.
          mayReview: served && reviewEligibility({ reviewerId: userId, providerId: booking.providerId, providerEnabled: Boolean(providerRows[0]?.enabled) }).allowed,
          alreadyReviewed: customerReviewExists,
          providerId: booking.providerId,
        }),
        // The existing public provider page and nothing else. No date, guest count, price, menu, package,
        // acceptance, booking status or payment state travels with it, because nothing travels with it at all.
        //
        // OFFERED ONLY WHILE THAT PAGE EXISTS. A provider who has switched their catering listing off answers 410
        // there, so advertising the path would render a control that lands on an error -- and the truthful place
        // to decide that is here, against the listing state already in hand, rather than in an interface guessing
        // at it. The key is OMITTED rather than nulled, exactly as every other unavailable Phase 2K key is, so the
        // customer payload contract is unchanged and the client's existing guard hides the action with no
        // knowledge of why. Nothing about the completed booking is cloned, reopened or carried either way.
        ...(providerListed ? { rebookPath: cateringProviderProfilePath(booking.providerId) } : {}),
      }),
  };
  res.json(view);
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Checklist
 * ------------------------------------------------------------------------------------------------------------- */

r.put("/bookings/:id/closeout/items/:itemKey", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveCloseoutRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId } = resolved;
  const itemKey = itemKeySchema.parse(req.params.itemKey);
  const input = cateringCloseoutItemSaveSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockServedCateringBooking(tx, id)) return { kind: "not_available" } as const;
    await lockCloseout(tx, id);
    const [current] = await tx.select().from(cateringBookingCloseoutItems)
      .where(and(eq(cateringBookingCloseoutItems.bookingId, id), eq(cateringBookingCloseoutItems.itemKey, itemKey))).limit(1);
    const row = current as CateringBookingCloseoutItem | undefined;
    // Resolved against the authoritative LOCKED row, never against anything read before the transaction: a stale
    // `expectedUpdatedAt` conflicts, a first touch that carries one conflicts, and an identical resubmission is
    // reported unchanged rather than rewriting a version another tab is holding.
    const outcome = resolveCateringCloseoutItemSave(row, input, new Date());
    // A request that asks for the state already stored writes NOTHING, so it is answered before any boundary it
    // could not violate. That keeps a lost-response retry idempotent even when it arrives after the provider has
    // since closed out -- refusing it would turn a request that already succeeded into an error.
    if (outcome.kind === "unchanged") return { kind: "saved", item: row!, checklist: await closeoutItems(tx, id), changed: false } as const;
    // THE CLOSED-OUT BOUNDARY, read from the authoritative record under this same advisory lock.
    //
    // Everything below here would change the checklist that decided the closeout, so it is refused while that
    // closeout stands. Without this, a required item could slide back to `pending` behind a record still marked
    // closed: `closed_out` dominates the derived state, so both participants kept seeing a finished wrap-up while
    // required work was outstanding, a repeated completion answered `already_closed`, and no reopen was recorded.
    //
    // The refusal names the remedy rather than performing it. Reopening as a side effect of a checklist save would
    // have silently discarded the audited, customer-visible boundary the explicit reopen action exists to be.
    if (cateringCloseoutIsClosed(await closeoutRecord(tx, id))) return { kind: "closed" } as const;
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    const values = {
      state: outcome.state,
      providerNote: outcome.providerNote,
      // Decided by the policy from the resulting state, so the paired database CHECK cannot be violated by a write
      // path that set one of the two and forgot the other.
      resolvedAt: outcome.resolvedAt,
      resolvedBy: outcome.clearsResolution ? null : outcome.resolvedIsNew ? userId : row?.resolvedBy ?? userId,
      updatedAt: outcome.updatedAt,
    };
    const [saved] = row
      ? await tx.update(cateringBookingCloseoutItems).set(values)
          .where(and(eq(cateringBookingCloseoutItems.bookingId, id), eq(cateringBookingCloseoutItems.itemKey, itemKey))).returning()
      : await tx.insert(cateringBookingCloseoutItems).values({ bookingId: id, itemKey, ...values, createdAt: outcome.updatedAt }).returning();
    // No activity row and no notification. A checklist item is provider-private internal progress: writing shared
    // history for it would disclose the checklist, and writing provider-visibility history for it would flood the
    // feed with movement nobody reads. Phase 2J made the same call about milestone churn.
    //
    // The response snapshot is taken HERE, inside the transaction and while the collection lock is still held, so
    // it is the state this request produced and observed. Re-reading it after the commit let another tab's write
    // land in between and be returned as if it were this request's own result -- and because the client adopts the
    // versions a mutation returns, this tab would then hold a row version it never saw, and its next save on that
    // row would overwrite the other tab's change instead of being refused as stale.
    return { kind: "saved", item: saved as CateringBookingCloseoutItem, checklist: await closeoutItems(tx, id), changed: true } as const;
  });
  if (result.kind === "not_available") return refuse(res, CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "closed") return refuse(res, CATERING_CLOSEOUT_CLOSED_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_CLOSEOUT_CONFLICT_REFUSAL);
  res.json({ checklist: serializeCloseoutChecklist(result.checklist) });
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Provider-private post-event notes
 * ------------------------------------------------------------------------------------------------------------- */

r.put("/bookings/:id/closeout/notes", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveCloseoutRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId } = resolved;
  const input = cateringCloseoutNotesSaveSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockServedCateringBooking(tx, id)) return { kind: "not_available" } as const;
    await lockCloseout(tx, id);
    const current = await closeoutRecord(tx, id);
    const outcome = resolveCateringCloseoutNotesSave(current, input, new Date());
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    if (outcome.kind === "unchanged") return { kind: "saved", record: current! } as const;
    const [saved] = current
      ? await tx.update(cateringBookingCloseout)
          .set({ providerNotes: outcome.providerNotes, updatedBy: userId, updatedAt: outcome.updatedAt })
          .where(eq(cateringBookingCloseout.bookingId, id)).returning()
      : await tx.insert(cateringBookingCloseout)
          .values({ bookingId: id, providerNotes: outcome.providerNotes, updatedBy: userId, createdAt: outcome.updatedAt, updatedAt: outcome.updatedAt }).returning();
    // Provider-private writing. No activity, no notification, and nothing a customer can observe: their projection
    // carries neither this text nor this record's version, so not one value they receive moves because of it.
    return { kind: "saved", record: saved as CateringBookingCloseoutRecord } as const;
  });
  if (result.kind === "not_available") return refuse(res, CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_CLOSEOUT_CONFLICT_REFUSAL);
  res.json({ closeout: serializeCloseoutRecord(result.record, "provider") });
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Completing and reopening operational closeout
 * ------------------------------------------------------------------------------------------------------------- */

/** The counterpart notification for a closeout completion. Best effort, and never for an internal change. */
async function notifyCloseout(booking: { providerId: string; customerId: string }, actorId: string, bookingId: string) {
  const counterpartId = cateringCounterpart(booking, actorId);
  if (!counterpartId) return;
  await db.insert(notifications).values({
    userId: counterpartId,
    type: CATERING_CLOSEOUT_NOTIFICATION.type,
    title: CATERING_CLOSEOUT_NOTIFICATION.title,
    message: CATERING_CLOSEOUT_NOTIFICATION.message,
    // The counterpart of a provider action is always the customer, so the link is the customer-side workspace path.
    linkUrl: cateringCloseoutSectionPath("customer", bookingId),
  }).catch(() => undefined);
}

r.post("/bookings/:id/closeout/complete", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveCloseoutRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId, booking } = resolved;
  const input = cateringCloseoutCompleteSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockServedCateringBooking(tx, id)) return { kind: "not_available" } as const;
    await lockCloseout(tx, id);
    const current = await closeoutRecord(tx, id);
    // The gate is re-derived from the LOCKED checklist, so a required item another tab reopened between the early
    // read and this transaction is seen as it actually is. Equipment is read here too, at full visibility, because
    // this is the provider's own gate.
    const [itemRows, equipmentRows] = await Promise.all([closeoutItems(tx, id), tx.select({ visibility: cateringBookingEquipment.visibility, status: cateringBookingEquipment.status }).from(cateringBookingEquipment).where(eq(cateringBookingEquipment.bookingId, id))]);
    const facts = cateringCloseoutFacts({
      booking: booking as never,
      record: current,
      equipment: equipmentRows as { visibility: string; status: string }[],
      items: itemRows,
      // Neither participates in the completion gate, so neither is queried again here: `cateringCloseoutMayComplete`
      // reads the served flag, the closed flag and the required-item count and nothing else.
      outstandingSharedRequirementCount: 0,
      sharedDocumentCount: 0,
      customerReviewExists: false,
    }, "provider");
    const outcome = resolveCateringCloseoutComplete(current, facts, input.expectedUpdatedAt, new Date());
    // Already closed: the request this retries succeeded. Nothing is written, so no second activity row and no
    // second notification can exist, whatever the network did to the first response.
    if (outcome.kind === "already_closed") return { kind: "settled", record: outcome.record as CateringBookingCloseoutRecord, notify: false } as const;
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    if (outcome.kind === "blocked") return { kind: "blocked" } as const;
    const [saved] = current
      ? await tx.update(cateringBookingCloseout)
          .set({ closedOutAt: outcome.closedOutAt, closedOutBy: userId, updatedBy: userId, updatedAt: outcome.updatedAt })
          .where(eq(cateringBookingCloseout.bookingId, id)).returning()
      : await tx.insert(cateringBookingCloseout)
          .values({ bookingId: id, closedOutAt: outcome.closedOutAt, closedOutBy: userId, updatedBy: userId, createdAt: outcome.updatedAt, updatedAt: outcome.updatedAt }).returning();
    // The one genuinely shared closeout event, written in the SAME transaction as the state it describes -- so a
    // rolled-back completion leaves no history, and a committed one cannot fail to record it.
    //
    // The booking's Phase 2G status is NOT touched here, by this statement or any other in this file. The booking
    // stays `completed`; what changed is that the operational wrap-up beneath it is finished.
    await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: "booking_closed_out", visibility: "shared", metadata: {},
    });
    return { kind: "settled", record: saved as CateringBookingCloseoutRecord, notify: true } as const;
  });
  if (result.kind === "not_available") return refuse(res, CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_CLOSEOUT_CONFLICT_REFUSAL);
  if (result.kind === "blocked") return refuse(res, CATERING_CLOSEOUT_BLOCKED_REFUSAL);
  if (result.notify) await notifyCloseout(booking, userId, id);
  res.json({ closeout: serializeCloseoutRecord(result.record, "provider"), duplicate: !result.notify });
} catch (error) { invalid(error, res, next); } });

r.post("/bookings/:id/closeout/reopen", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveCloseoutRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId } = resolved;
  const input = cateringCloseoutReopenSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockServedCateringBooking(tx, id)) return { kind: "not_available" } as const;
    await lockCloseout(tx, id);
    const current = await closeoutRecord(tx, id);
    const outcome = resolveCateringCloseoutReopen(current, input.expectedUpdatedAt, new Date());
    if (outcome.kind === "not_found") return { kind: "not_found" } as const;
    // Already open: the request this retries succeeded, so nothing is written and no second activity row exists.
    if (outcome.kind === "already_open") return { kind: "settled", record: outcome.record as CateringBookingCloseoutRecord } as const;
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    const [saved] = await tx.update(cateringBookingCloseout).set({
      closedOutAt: null,
      // Cleared with the instant, so the paired CHECK holds and no stale closer survives on an open record.
      closedOutBy: null,
      reopenCount: outcome.reopenCount,
      lastReopenedAt: outcome.reopenedAt,
      lastReopenedBy: userId,
      updatedBy: userId,
      updatedAt: outcome.updatedAt,
    }).where(eq(cateringBookingCloseout.bookingId, id)).returning();
    // Shared history, because the completion it undoes was shared history: a customer who was told their caterer
    // had finished wrapping up would otherwise watch their own closeout state contradict the feed above it. No
    // notification, though -- reopening is the provider correcting their own record, not news for the customer.
    await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: "booking_closeout_reopened", visibility: "shared", metadata: {},
    });
    return { kind: "settled", record: saved as CateringBookingCloseoutRecord } as const;
  });
  if (result.kind === "not_available") return refuse(res, CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "not_found") return refuse(res, CATERING_CLOSEOUT_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_CLOSEOUT_CONFLICT_REFUSAL);
  res.json({ closeout: serializeCloseoutRecord(result.record, "provider") });
} catch (error) { invalid(error, res, next); } });

export default r;
