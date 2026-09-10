import { Router } from "express";
import { and, asc, count, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import {
  cateringBookingAccessDetails,
  cateringBookingActivity,
  cateringBookingEquipment,
  cateringBookingExecutionCreateRequests,
  cateringBookingExecutionMilestones,
  cateringBookingExecutionTimeline,
  cateringBookingStaffAssignments,
  cateringBookingTasks,
  notifications,
  type CateringBookingAccessDetail,
  type CateringBookingEquipmentItem,
  type CateringBookingExecutionCreateRequest,
  type CateringBookingExecutionTimelineItem,
  type CateringBookingStaffAssignment,
} from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { CATERING_WORKSPACE_READ_ONLY_CODE, cateringWorkspaceRole } from "@shared/catering-booking-operations";
import {
  CATERING_EXECUTION_ACCESS_NOTIFICATION,
  CATERING_EXECUTION_CREATE_CONSUMED_CODE,
  CATERING_EXECUTION_CREATE_CONSUMED_MESSAGE,
  CATERING_EXECUTION_MILESTONE_KEYS,
  CATERING_EXECUTION_TIMELINE_NOTIFICATION,
  cateringAccessSaveSchema,
  cateringEquipmentCreateSchema,
  cateringEquipmentDeleteSchema,
  cateringEquipmentUpdateSchema,
  cateringExecutionSectionPath,
  cateringMilestoneToggleSchema,
  cateringStaffCreateSchema,
  cateringStaffDeleteSchema,
  cateringStaffUpdateSchema,
  cateringTimelineCreateSchema,
  cateringTimelineDeleteSchema,
  cateringTimelineReorderSchema,
  cateringTimelineUpdateSchema,
  type CateringBookingExecutionView,
  type CateringExecutionCreateType,
} from "@shared/catering-booking-execution";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { lockActiveCateringBooking, ownedCateringBooking } from "../services/catering-booking-access";
import { cateringCounterpart } from "../services/catering-booking-communication-policy";
import {
  CATERING_EXECUTION_CONFLICT_REFUSAL,
  CATERING_EXECUTION_LIMIT_MESSAGES,
  CATERING_EXECUTION_NOT_FOUND_REFUSAL,
  CATERING_EXECUTION_READ_ONLY_REFUSAL,
  CATERING_EXECUTION_SET_CHANGED_REFUSAL,
  CATERING_ACCESS_SAVE_REFUSALS,
  CATERING_STAFF_PATCH_REFUSALS,
  CATERING_TIMELINE_PATCH_REFUSALS,
  cateringExecutionActivityVisibility,
  cateringExecutionGuard,
  cateringReadinessFacts,
  deriveCateringReadiness,
  nextCateringExecutionSortOrder,
  resolveCateringAccessSave,
  resolveCateringEquipmentCreate,
  resolveCateringEquipmentDelete,
  resolveCateringEquipmentPatch,
  resolveCateringMilestoneToggle,
  resolveCateringStaffCreate,
  resolveCateringStaffDelete,
  resolveCateringStaffPatch,
  resolveCateringTimelineCreate,
  resolveCateringTimelineDelete,
  resolveCateringTimelinePatch,
  resolveCateringTimelineReorder,
  type CateringExecutionCollection,
} from "../services/catering-booking-execution-policy";
import {
  serializeExecutionAccess,
  serializeExecutionEquipment,
  serializeExecutionMilestones,
  serializeExecutionStaffAssignment,
  serializeExecutionTimelineItem,
} from "../serializers/catering-booking-execution";

/**
 * Phase 2J execution routes, inside the existing catering booking namespace.
 *
 * ONE cohesive read (`GET /bookings/:id/execution`) plus narrow, named mutations -- not a generic CRUD surface. The
 * read is what the workspace renders; each mutation does exactly one thing and states its own preconditions.
 *
 * AUTHORIZATION, identically on every route in this file:
 *
 *  1. the acting user is `req.user.id` from the authenticated session, and nothing else;
 *  2. the booking is resolved by `ownedCateringBooking`, which restricts to the persisted provider or customer, so a
 *     body naming a providerId, customerId, owner or actor contributes nothing and a stranger simply gets no row;
 *  3. the role is derived from the resolved booking with `cateringWorkspaceRole`, never read from the request;
 *  4. every mutation is provider-only, checked by `cateringExecutionGuard` before any transaction opens and again
 *     against the LOCKED booking inside it;
 *  5. an unresolvable booking answers 404 with one message, so a guessed id, another provider's booking and another
 *     customer's booking are indistinguishable -- exactly as Phase 2H and Phase 2I already answer them.
 */
const r = Router();
const recordIdSchema = z.string().uuid();
const milestoneKeySchema = z.enum(CATERING_EXECUTION_MILESTONE_KEYS);
type Res = Parameters<Parameters<typeof r.get>[1]>[1];

function invalid(error: unknown, res: Res, next: (error: unknown) => void) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
  next(error);
}
/**
 * Answers a refused early guard. A terminal booking always gets the canonical coded read-only refusal, so the client
 * refetches; a wrong actor keeps its own truthful message and stays uncoded, because no refetch would change it.
 */
function refuseGuard(res: Res, guard: "read_only" | "forbidden") {
  if (guard === "read_only") return res.status(CATERING_EXECUTION_READ_ONLY_REFUSAL.status).json({ message: CATERING_EXECUTION_READ_ONLY_REFUSAL.message, code: CATERING_EXECUTION_READ_ONLY_REFUSAL.code });
  return res.status(403).json({ message: "Only the booking provider may change event execution details" });
}
function refuse(res: Res, refusal: { status: number; message: string; code: string }) {
  return res.status(refusal.status).json({ message: refusal.message, code: refusal.code });
}
function readOnlyRace(res: Res, what: string) {
  return res.status(409).json({ message: `Booking became read-only before the ${what} could be saved`, code: CATERING_WORKSPACE_READ_ONLY_CODE });
}

/**
 * The advisory lock one execution collection is counted and reordered under.
 *
 * Named per collection AND per booking, so a reorder of one booking's run-of-show never serializes against another
 * booking's equipment. It is what makes the collection limits real under concurrency: two simultaneous creates
 * cannot both read a count below the maximum and both insert. It is also what the create routes hold while they
 * resolve a retry token, so the token decision and the limit decision see the same collection.
 *
 * The name is a closed union: the three limited collections plus the two single-row records that also serialize.
 */
type CateringExecutionLock = CateringExecutionCollection | "access" | "milestones";
async function lockCollection(tx: typeof db, collection: CateringExecutionLock, bookingId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-execution-${collection}:${bookingId}`}))`);
}
/**
 * The size of one collection, plus its highest sort order where the collection is ordered.
 *
 * These no longer take the collection lock themselves. The lock is acquired by the create route BEFORE it resolves
 * the retry token, because the token has to win over the limit: a retry of a request that already succeeded is not
 * a create, so a collection that filled up in the meantime -- possibly with the very row that token produced -- is
 * not its refusal. Counting under a lock the caller already holds is the same guarantee it always was.
 */
async function timelineCounts(tx: typeof db, bookingId: string) {
  const [{ value, maxSortOrder }] = await tx.select({ value: count(), maxSortOrder: max(cateringBookingExecutionTimeline.sortOrder) })
    .from(cateringBookingExecutionTimeline).where(eq(cateringBookingExecutionTimeline.bookingId, bookingId));
  return { itemCount: Number(value), maxSortOrder: maxSortOrder == null ? null : Number(maxSortOrder) };
}
/**
 * The size of one unordered collection. `maxSortOrder` is null because neither crew nor equipment is ordered: both
 * are read by creation time, so there is no position for a create to append to.
 */
async function collectionCount(tx: typeof db, bookingId: string, table: typeof cateringBookingStaffAssignments | typeof cateringBookingEquipment) {
  const [{ value }] = await tx.select({ value: count() }).from(table as never).where(eq(table.bookingId, bookingId));
  return { itemCount: Number(value), maxSortOrder: null };
}

/**
 * The visibility filter one actor's execution reads run under, applied in SQL.
 *
 * A provider-private record is not fetched and then dropped: it is never selected. That is what makes every
 * downstream count, readiness signal and serialized object privacy-safe by construction rather than by remembering
 * to filter in each of them.
 */
function timelineVisibility(role: "provider" | "customer") {
  return role === "provider" ? undefined : eq(cateringBookingExecutionTimeline.visibility, "shared");
}
function equipmentVisibility(role: "provider" | "customer") {
  return role === "provider" ? undefined : eq(cateringBookingEquipment.visibility, "shared");
}

/** The counterpart notification for a shared execution change. Best effort, and never for a private one. */
async function notifyCounterpart(booking: { providerId: string; customerId: string }, actorId: string, bookingId: string, notification: { type: string; title: string; message: string }) {
  const counterpartId = cateringCounterpart(booking, actorId);
  if (!counterpartId) return;
  await db.insert(notifications).values({
    userId: counterpartId, type: notification.type, title: notification.title, message: notification.message,
    // The counterpart of a provider action is always the customer, so the link is the customer-side workspace path.
    linkUrl: cateringExecutionSectionPath("customer", bookingId),
  }).catch(() => undefined);
}

/**
 * Resolves whether one creation retry token has already been spent, from the DURABLE ledger.
 *
 * The created row is not the idempotency record, because it can be deleted. Create an item with token T, lose the
 * response, watch it arrive by polling, delete it deliberately, and let the original request retry: a lookup over
 * the live rows finds nothing, T reads as unused, and the item the provider just removed comes back -- with a
 * second activity row and a second notification behind it. The ledger is a table nothing deletes, so a spent token
 * stays spent for the life of the booking.
 *
 * The scope is exactly (booking, creator, resource type, token), which is the ledger's primary key, so a token
 * belonging to another actor, replayed against another booking, or reused across two collections resolves to
 * nothing here and is treated as a new create rather than handed somebody else's record.
 *
 * Always called INSIDE the transaction and AFTER the collection lock, so what it reads cannot change underneath the
 * decision it feeds.
 */
async function consumedCreateRequest(tx: typeof db, bookingId: string, createdBy: string, resourceType: CateringExecutionCreateType, clientRequestId: string) {
  const [row] = await tx.select().from(cateringBookingExecutionCreateRequests).where(and(
    eq(cateringBookingExecutionCreateRequests.bookingId, bookingId),
    eq(cateringBookingExecutionCreateRequests.createdBy, createdBy),
    eq(cateringBookingExecutionCreateRequests.resourceType, resourceType),
    eq(cateringBookingExecutionCreateRequests.clientRequestId, clientRequestId),
  )).limit(1);
  return row as CateringBookingExecutionCreateRequest | undefined;
}
/**
 * Records the token as spent, in the SAME transaction as the insert it accompanies.
 *
 * That is the whole atomicity guarantee: a rolled-back create leaves no consumed token, and a committed create
 * cannot leave the token unconsumed. Under the collection lock the primary key can only be violated by a request
 * this same code would already have answered from the ledger, so a violation aborts the transaction rather than
 * producing a row whose token was never recorded.
 */
async function consumeCreateRequest(tx: typeof db, bookingId: string, createdBy: string, resourceType: CateringExecutionCreateType, clientRequestId: string, resourceId: string) {
  await tx.insert(cateringBookingExecutionCreateRequests).values({ bookingId, createdBy, resourceType, clientRequestId, resourceId });
}
/** The one body a spent token whose record has since been deleted is answered with, for all three collections. */
function consumedCreate(res: Res) {
  return res.status(200).json({ duplicate: true, consumed: true, code: CATERING_EXECUTION_CREATE_CONSUMED_CODE, message: CATERING_EXECUTION_CREATE_CONSUMED_MESSAGE });
}

/**
 * Every execution route's opening move: resolve the booking for this authenticated user, derive their role, and --
 * for a mutation -- check the early guard. A null return means the response has already been sent.
 */
async function resolveExecutionRequest(req: { params: Record<string, string>; user?: unknown }, res: Res, mutation: boolean) {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = (req.user as { id: string }).id;
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) { res.status(404).json({ message: "Booking execution workspace not found" }); return null; }
  const role = cateringWorkspaceRole(booking, userId)!;
  if (mutation) {
    const guard = cateringExecutionGuard(booking.status as never, role);
    if (guard !== "allowed") { refuseGuard(res, guard); return null; }
  }
  return { id, userId, booking, role };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The cohesive execution read
 * ------------------------------------------------------------------------------------------------------------- */

r.get("/bookings/:id/execution", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, false);
  if (!resolved) return;
  const { id, booking, role } = resolved;
  const provider = role === "provider";
  const [timelineRows, equipmentRows, accessRows, staffRows, milestoneRows, requirementRows] = await Promise.all([
    db.select().from(cateringBookingExecutionTimeline)
      .where(and(eq(cateringBookingExecutionTimeline.bookingId, id), timelineVisibility(role)))
      .orderBy(asc(cateringBookingExecutionTimeline.sortOrder), asc(cateringBookingExecutionTimeline.id)),
    db.select().from(cateringBookingEquipment)
      .where(and(eq(cateringBookingEquipment.bookingId, id), equipmentVisibility(role)))
      .orderBy(asc(cateringBookingEquipment.createdAt), asc(cateringBookingEquipment.id)),
    db.select().from(cateringBookingAccessDetails).where(eq(cateringBookingAccessDetails.bookingId, id)).limit(1),
    // Crew and milestones are not merely filtered for a customer -- they are not QUERIED for one. Nothing about
    // them, including how many rows exist, is read on a customer's request.
    provider ? db.select().from(cateringBookingStaffAssignments).where(eq(cateringBookingStaffAssignments.bookingId, id)).orderBy(asc(cateringBookingStaffAssignments.createdAt), asc(cateringBookingStaffAssignments.id)) : Promise.resolve([]),
    provider ? db.select().from(cateringBookingExecutionMilestones).where(eq(cateringBookingExecutionMilestones.bookingId, id)) : Promise.resolve([]),
    // Phase 2H shared requirements still pending. Both participants already see these, so both readiness summaries
    // may count them; the Phase 2H task table is only READ here and is not modified by this phase at all.
    db.select({ value: count() }).from(cateringBookingTasks)
      .where(and(eq(cateringBookingTasks.bookingId, id), eq(cateringBookingTasks.visibility, "shared"), eq(cateringBookingTasks.status, "pending"))),
  ]);
  const access = accessRows[0] as CateringBookingAccessDetail | undefined;
  const facts = cateringReadinessFacts({
    timeline: timelineRows as CateringBookingExecutionTimelineItem[],
    equipment: equipmentRows as CateringBookingEquipmentItem[],
    staffCount: (staffRows as CateringBookingStaffAssignment[]).length,
    access,
    outstandingSharedRequirementCount: Number(requirementRows[0]?.value ?? 0),
    // Read from the authoritative booking record, never from execution data.
    guestCount: booking.guestCount ?? null,
  }, role);
  const readiness = deriveCateringReadiness(facts, role);
  const view: CateringBookingExecutionView = {
    role,
    editable: booking.status === "pending_confirmation" || booking.status === "confirmed",
    timeline: (timelineRows as CateringBookingExecutionTimelineItem[]).map((item) => serializeExecutionTimelineItem(item, role)),
    equipment: (equipmentRows as CateringBookingEquipmentItem[]).map(serializeExecutionEquipment),
    access: serializeExecutionAccess(access, role),
    readiness: provider ? { ...readiness, milestones: milestoneCounts(milestoneRows as { completedAt: Date | null }[]) } : readiness,
    // Absent keys rather than empty arrays: a customer's payload has no provider-only field at all.
    ...(provider ? { staff: (staffRows as CateringBookingStaffAssignment[]).map(serializeExecutionStaffAssignment), milestones: serializeExecutionMilestones(milestoneRows as never) } : {}),
  };
  res.json(view);
} catch (error) { invalid(error, res, next); } });

/** Milestone progress as counts alone. The denominator is the fixed allowlist, not how many rows happen to exist. */
function milestoneCounts(rows: readonly { completedAt: Date | null }[]) {
  return { completed: rows.filter((row) => row.completedAt !== null).length, total: CATERING_EXECUTION_MILESTONE_KEYS.length };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Run-of-show timeline
 * ------------------------------------------------------------------------------------------------------------- */

r.post("/bookings/:id/execution/timeline", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId, booking } = resolved;
  const input = cateringTimelineCreateSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    // ORDER MATTERS, and this is the order: booking lock, collection lock, retry token, limit, insert.
    //
    // The token is resolved under the lock and BEFORE the limit is evaluated, because a retry of a request that
    // already succeeded is not a create at all. Two identical attempts can overlap on the last free slot: the first
    // fills the collection and commits, the second then acquires this lock and finds the collection full. Judging
    // the limit first refused that second attempt with 409 -- even though it is the retry of the request that made
    // the very row now filling the slot, and the right answer is that row.
    await lockCollection(tx, "timeline", id);
    if (input.clientRequestId) {
      const spent = await consumedCreateRequest(tx, id, userId, "timeline", input.clientRequestId);
      if (spent) {
        const [existing] = await tx.select().from(cateringBookingExecutionTimeline)
          .where(and(eq(cateringBookingExecutionTimeline.id, spent.resourceId), eq(cateringBookingExecutionTimeline.bookingId, id))).limit(1);
        // Still there: the retry converges on it. Gone: the provider deleted it deliberately after the create
        // succeeded, so the answer is that the token is spent -- never a second copy of what they removed.
        return existing ? { kind: "duplicate", item: existing as CateringBookingExecutionTimelineItem } as const : { kind: "consumed" } as const;
      }
    }
    const outcome = resolveCateringTimelineCreate(await timelineCounts(tx, id), input);
    if (outcome.kind !== "create") return outcome;
    const [row] = await tx.insert(cateringBookingExecutionTimeline).values({
      bookingId: id, createdBy: userId, sortOrder: outcome.sortOrder,
      title: input.title, description: input.description ?? null, category: input.category,
      scheduledTime: input.scheduledTime ?? null, endTime: input.endTime ?? null,
      visibility: input.visibility, isBlocker: input.isBlocker, clientRequestId: input.clientRequestId ?? null,
    }).returning();
    // Same transaction as the insert, so the token is consumed if and only if the row was created.
    if (input.clientRequestId) await consumeCreateRequest(tx, id, userId, "timeline", input.clientRequestId, (row as CateringBookingExecutionTimelineItem).id);
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: outcome.activity.eventType,
      visibility: cateringExecutionActivityVisibility(input.visibility), metadata: { title: outcome.activity.title },
    });
    return { kind: "created", item: row as CateringBookingExecutionTimelineItem, notify: outcome.notify } as const;
  });
  if (result.kind === "read_only") return readOnlyRace(res, "run-of-show item");
  if (result.kind === "limit") return res.status(409).json({ message: CATERING_EXECUTION_LIMIT_MESSAGES.timeline });
  // A retry is answered with the record the first attempt made, and notifies nobody: the notification for that
  // record was already sent when it was actually created.
  if (result.kind === "consumed") return consumedCreate(res);
  if (result.kind === "duplicate") return res.status(200).json({ item: serializeExecutionTimelineItem(result.item, "provider"), duplicate: true });
  if (result.notify) await notifyCounterpart(booking, userId, id, CATERING_EXECUTION_TIMELINE_NOTIFICATION);
  res.status(201).json({ item: serializeExecutionTimelineItem(result.item, "provider") });
} catch (error) { invalid(error, res, next); } });

r.patch("/bookings/:id/execution/timeline/:itemId", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId, booking } = resolved;
  const itemId = recordIdSchema.parse(req.params.itemId);
  const input = cateringTimelineUpdateSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "timeline", id);
    const [current] = await tx.select().from(cateringBookingExecutionTimeline)
      .where(and(eq(cateringBookingExecutionTimeline.id, itemId), eq(cateringBookingExecutionTimeline.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    const row = current as CateringBookingExecutionTimelineItem;
    // Resolved against the authoritative LOCKED row, never against anything read before the transaction: a stale
    // expectedUpdatedAt conflicts, and request-field presence alone is still not a change.
    const outcome = resolveCateringTimelinePatch({
      title: row.title, description: row.description, category: row.category,
      scheduledTime: row.scheduledTime, endTime: row.endTime, visibility: row.visibility,
      isBlocker: row.isBlocker, completed: row.completedAt !== null,
      updatedAt: row.updatedAt, completedAt: row.completedAt,
    }, input, new Date());
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    // Refused against the authoritative locked row, so the invalid merged range never reaches the UPDATE and the
    // database CHECK never has to be the one to say no.
    if (outcome.kind === "invalid_time_range") return { kind: "invalid_time_range" } as const;
    if (outcome.kind === "unchanged") return { kind: "updated", item: row, notify: false } as const;
    const [updated] = await tx.update(cateringBookingExecutionTimeline).set({
      title: outcome.next.title, description: outcome.next.description, category: outcome.next.category,
      scheduledTime: outcome.next.scheduledTime, endTime: outcome.next.endTime,
      visibility: outcome.next.visibility, isBlocker: outcome.next.isBlocker,
      completedAt: outcome.completedAt,
      // Persisted for audit and never serialized. A completion that is being undone clears it, so the pairing
      // constraint holds and no stale completer survives on an incomplete item.
      completedBy: outcome.completedAt === null ? null : row.completedAt === null ? userId : row.completedBy,
      updatedAt: outcome.updatedAt,
    }).where(and(eq(cateringBookingExecutionTimeline.id, itemId), eq(cateringBookingExecutionTimeline.bookingId, id))).returning();
    if (!updated) return { kind: "not_found" } as const;
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: outcome.activity.eventType,
      // A removal from the shared plan is still customer-visible history: it is what the item leaving their view
      // means. Derived from the event rather than from the row's new visibility, which by then is private.
      visibility: "shared", metadata: { title: outcome.activity.title },
    });
    return { kind: "updated", item: updated as CateringBookingExecutionTimelineItem, notify: outcome.notify } as const;
  });
  if (result.kind === "not_found") return refuse(res, CATERING_EXECUTION_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "invalid_time_range") return res.status(400).json({ message: CATERING_TIMELINE_PATCH_REFUSALS.invalid_time_range });
  if (result.kind === "read_only") return readOnlyRace(res, "run-of-show item");
  if (result.notify) await notifyCounterpart(booking, userId, id, CATERING_EXECUTION_TIMELINE_NOTIFICATION);
  res.json({ item: serializeExecutionTimelineItem(result.item, "provider") });
} catch (error) { invalid(error, res, next); } });

r.delete("/bookings/:id/execution/timeline/:itemId", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId, booking } = resolved;
  const itemId = recordIdSchema.parse(req.params.itemId);
  const input = cateringTimelineDeleteSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "timeline", id);
    const [current] = await tx.select().from(cateringBookingExecutionTimeline)
      .where(and(eq(cateringBookingExecutionTimeline.id, itemId), eq(cateringBookingExecutionTimeline.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    const row = current as CateringBookingExecutionTimelineItem;
    const outcome = resolveCateringTimelineDelete(row, input.expectedUpdatedAt);
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    const [deleted] = await tx.delete(cateringBookingExecutionTimeline)
      .where(and(eq(cateringBookingExecutionTimeline.id, itemId), eq(cateringBookingExecutionTimeline.bookingId, id))).returning();
    if (!deleted) return { kind: "not_found" } as const;
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: outcome.activity.eventType, visibility: "shared", metadata: { title: outcome.activity.title },
    });
    return { kind: "deleted", notify: outcome.notify } as const;
  });
  if (result.kind === "not_found") return refuse(res, CATERING_EXECUTION_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "read_only") return readOnlyRace(res, "run-of-show item");
  if (result.notify) await notifyCounterpart(booking, userId, id, CATERING_EXECUTION_TIMELINE_NOTIFICATION);
  res.status(204).end();
} catch (error) { invalid(error, res, next); } });

r.post("/bookings/:id/execution/timeline/reorder", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id } = resolved;
  const input = cateringTimelineReorderSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "timeline", id);
    // `sortOrder` comes back too, so a reorder that is already applied is recognised as a no-op retry rather than
    // refused on the pre-commit versions it necessarily still carries.
    const rows = await tx.select({ id: cateringBookingExecutionTimeline.id, updatedAt: cateringBookingExecutionTimeline.updatedAt, sortOrder: cateringBookingExecutionTimeline.sortOrder })
      .from(cateringBookingExecutionTimeline).where(eq(cateringBookingExecutionTimeline.bookingId, id));
    // Membership first, then every submitted version, both against the authoritative locked rows. A booking that
    // went read-only, an incomplete set and a stale version are three different refusals, and none of them writes.
    const outcome = resolveCateringTimelineReorder(rows as { id: string; updatedAt: Date; sortOrder: number }[], input.items);
    if (outcome.kind === "unchanged") {
      // Already in the requested order: nothing is written, no version moves, and the client is handed the
      // authoritative collection exactly as it stands.
      const current = await tx.select().from(cateringBookingExecutionTimeline).where(eq(cateringBookingExecutionTimeline.bookingId, id))
        .orderBy(asc(cateringBookingExecutionTimeline.sortOrder), asc(cateringBookingExecutionTimeline.id));
      return { kind: "reordered", items: current as CateringBookingExecutionTimelineItem[] } as const;
    }
    if (outcome.kind !== "reorder") return outcome;
    const now = new Date();
    for (const { id: itemId, sortOrder } of outcome.updates) {
      await tx.update(cateringBookingExecutionTimeline).set({ sortOrder, updatedAt: now })
        .where(and(eq(cateringBookingExecutionTimeline.id, itemId), eq(cateringBookingExecutionTimeline.bookingId, id)));
    }
    // The reorder bumped every item's version, so the response hands back the fresh authoritative ones. Reordering
    // writes NO activity and NO notification: it is a provider's own working order, and a drag is not news.
    const reordered = await tx.select().from(cateringBookingExecutionTimeline).where(eq(cateringBookingExecutionTimeline.bookingId, id))
      .orderBy(asc(cateringBookingExecutionTimeline.sortOrder), asc(cateringBookingExecutionTimeline.id));
    return { kind: "reordered", items: reordered as CateringBookingExecutionTimelineItem[] } as const;
  });
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "membership") return refuse(res, CATERING_EXECUTION_SET_CHANGED_REFUSAL);
  if (result.kind === "read_only") return readOnlyRace(res, "run-of-show");
  // Provider-only route, so the authoritative persisted order travels back with the reordered collection.
  res.json({ timeline: result.items.map((item: CateringBookingExecutionTimelineItem) => serializeExecutionTimelineItem(item, "provider")) });
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Crew assignments -- provider-private in every channel
 * ------------------------------------------------------------------------------------------------------------- */

r.post("/bookings/:id/execution/staff", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId } = resolved;
  const input = cateringStaffCreateSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    // Same order as the run-of-show: collection lock, then the retry token, then the limit. A retry that overlaps
    // the attempt filling the last slot resolves to that attempt's record rather than being refused as a create.
    await lockCollection(tx, "staff", id);
    if (input.clientRequestId) {
      const spent = await consumedCreateRequest(tx, id, userId, "staff", input.clientRequestId);
      if (spent) {
        const [existing] = await tx.select().from(cateringBookingStaffAssignments)
          .where(and(eq(cateringBookingStaffAssignments.id, spent.resourceId), eq(cateringBookingStaffAssignments.bookingId, id))).limit(1);
        return existing ? { kind: "duplicate", assignment: existing as CateringBookingStaffAssignment } as const : { kind: "consumed" } as const;
      }
    }
    const outcome = resolveCateringStaffCreate(await collectionCount(tx, id, cateringBookingStaffAssignments));
    if (outcome.kind !== "create") return outcome;
    const [row] = await tx.insert(cateringBookingStaffAssignments).values({
      bookingId: id, createdBy: userId, workerName: input.workerName, role: input.role,
      customRole: input.customRole ?? null, contactNote: input.contactNote ?? null,
      arrivalTime: input.arrivalTime ?? null, departureTime: input.departureTime ?? null,
      responsibilityNote: input.responsibilityNote ?? null, clientRequestId: input.clientRequestId ?? null,
    }).returning();
    if (input.clientRequestId) await consumeCreateRequest(tx, id, userId, "staff", input.clientRequestId, (row as CateringBookingStaffAssignment).id);
    // No activity row and no notification, in any branch. Staffing is provider-private in every channel.
    return { kind: "created", assignment: row as CateringBookingStaffAssignment } as const;
  });
  if (result.kind === "read_only") return readOnlyRace(res, "crew assignment");
  if (result.kind === "limit") return res.status(409).json({ message: CATERING_EXECUTION_LIMIT_MESSAGES.staff });
  if (result.kind === "consumed") return consumedCreate(res);
  if (result.kind === "duplicate") return res.status(200).json({ assignment: serializeExecutionStaffAssignment(result.assignment), duplicate: true });
  res.status(201).json({ assignment: serializeExecutionStaffAssignment(result.assignment) });
} catch (error) { invalid(error, res, next); } });

r.patch("/bookings/:id/execution/staff/:staffId", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id } = resolved;
  const staffId = recordIdSchema.parse(req.params.staffId);
  const input = cateringStaffUpdateSchema.parse(req.body ?? {});
  // `db` is untyped at this repo's boundary, so the outcome union is stated rather than inferred as `any` -- which
  // is what keeps the refusal lookup below indexed by the two real reasons and nothing else.
  type StaffPatchResult =
    | { kind: "read_only" } | { kind: "not_found" } | { kind: "conflict" }
    | { kind: "invalid"; reason: "invalid_role" | "invalid_time_range" }
    | { kind: "updated"; assignment: CateringBookingStaffAssignment };
  const result: StaffPatchResult = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "staff", id);
    const [current] = await tx.select().from(cateringBookingStaffAssignments)
      .where(and(eq(cateringBookingStaffAssignments.id, staffId), eq(cateringBookingStaffAssignments.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    const row = current as CateringBookingStaffAssignment;
    const outcome = resolveCateringStaffPatch({
      workerName: row.workerName, role: row.role, customRole: row.customRole, contactNote: row.contactNote,
      arrivalTime: row.arrivalTime, departureTime: row.departureTime, responsibilityNote: row.responsibilityNote,
      updatedAt: row.updatedAt,
    }, input, new Date());
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    if (outcome.kind === "invalid_role" || outcome.kind === "invalid_time_range") return { kind: "invalid", reason: outcome.kind } as const;
    if (outcome.kind === "unchanged") return { kind: "updated", assignment: row } as const;
    const [updated] = await tx.update(cateringBookingStaffAssignments).set({ ...outcome.next, updatedAt: outcome.updatedAt })
      .where(and(eq(cateringBookingStaffAssignments.id, staffId), eq(cateringBookingStaffAssignments.bookingId, id))).returning();
    if (!updated) return { kind: "not_found" } as const;
    return { kind: "updated", assignment: updated as CateringBookingStaffAssignment } as const;
  });
  if (result.kind === "not_found") return refuse(res, CATERING_EXECUTION_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "invalid") return res.status(400).json({ message: CATERING_STAFF_PATCH_REFUSALS[result.reason] });
  if (result.kind === "read_only") return readOnlyRace(res, "crew assignment");
  res.json({ assignment: serializeExecutionStaffAssignment(result.assignment) });
} catch (error) { invalid(error, res, next); } });

r.delete("/bookings/:id/execution/staff/:staffId", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id } = resolved;
  const staffId = recordIdSchema.parse(req.params.staffId);
  const input = cateringStaffDeleteSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "staff", id);
    const [current] = await tx.select().from(cateringBookingStaffAssignments)
      .where(and(eq(cateringBookingStaffAssignments.id, staffId), eq(cateringBookingStaffAssignments.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    if (resolveCateringStaffDelete(current as CateringBookingStaffAssignment, input.expectedUpdatedAt).kind === "conflict") return { kind: "conflict" } as const;
    const [deleted] = await tx.delete(cateringBookingStaffAssignments)
      .where(and(eq(cateringBookingStaffAssignments.id, staffId), eq(cateringBookingStaffAssignments.bookingId, id))).returning();
    return deleted ? { kind: "deleted" } as const : { kind: "not_found" } as const;
  });
  if (result.kind === "not_found") return refuse(res, CATERING_EXECUTION_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "read_only") return readOnlyRace(res, "crew assignment");
  res.status(204).end();
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Equipment
 * ------------------------------------------------------------------------------------------------------------- */

r.post("/bookings/:id/execution/equipment", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId } = resolved;
  const input = cateringEquipmentCreateSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    // Collection lock, then the retry token, then the limit -- identically to the other two creates.
    await lockCollection(tx, "equipment", id);
    if (input.clientRequestId) {
      const spent = await consumedCreateRequest(tx, id, userId, "equipment", input.clientRequestId);
      if (spent) {
        const [existing] = await tx.select().from(cateringBookingEquipment)
          .where(and(eq(cateringBookingEquipment.id, spent.resourceId), eq(cateringBookingEquipment.bookingId, id))).limit(1);
        return existing ? { kind: "duplicate", equipment: existing as CateringBookingEquipmentItem } as const : { kind: "consumed" } as const;
      }
    }
    const outcome = resolveCateringEquipmentCreate(await collectionCount(tx, id, cateringBookingEquipment), input);
    if (outcome.kind !== "create") return outcome;
    const [row] = await tx.insert(cateringBookingEquipment).values({
      bookingId: id, createdBy: userId, name: input.name, quantity: input.quantity,
      sourceType: input.sourceType, sourceName: input.sourceName ?? null,
      pickupDate: input.pickupDate ?? null, pickupTime: input.pickupTime ?? null,
      returnDate: input.returnDate ?? null, returnTime: input.returnTime ?? null,
      status: input.status, isBlocker: input.isBlocker, notes: input.notes ?? null,
      visibility: input.visibility, clientRequestId: input.clientRequestId ?? null,
    }).returning();
    if (input.clientRequestId) await consumeCreateRequest(tx, id, userId, "equipment", input.clientRequestId, (row as CateringBookingEquipmentItem).id);
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: outcome.activity.eventType,
      visibility: cateringExecutionActivityVisibility(input.visibility), metadata: { name: outcome.activity.name },
    });
    return { kind: "created", equipment: row as CateringBookingEquipmentItem } as const;
  });
  if (result.kind === "read_only") return readOnlyRace(res, "equipment record");
  if (result.kind === "limit") return res.status(409).json({ message: CATERING_EXECUTION_LIMIT_MESSAGES.equipment });
  if (result.kind === "consumed") return consumedCreate(res);
  if (result.kind === "duplicate") return res.status(200).json({ equipment: serializeExecutionEquipment(result.equipment), duplicate: true });
  // Equipment never notifies. It writes shared history where the record is shared, which the customer reads in the
  // workspace, but a chafer moving from planned to confirmed is not worth a push.
  res.status(201).json({ equipment: serializeExecutionEquipment(result.equipment) });
} catch (error) { invalid(error, res, next); } });

r.patch("/bookings/:id/execution/equipment/:equipmentId", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId } = resolved;
  const equipmentId = recordIdSchema.parse(req.params.equipmentId);
  const input = cateringEquipmentUpdateSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "equipment", id);
    const [current] = await tx.select().from(cateringBookingEquipment)
      .where(and(eq(cateringBookingEquipment.id, equipmentId), eq(cateringBookingEquipment.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    const row = current as CateringBookingEquipmentItem;
    const outcome = resolveCateringEquipmentPatch({
      name: row.name, quantity: row.quantity, sourceType: row.sourceType, sourceName: row.sourceName,
      pickupDate: row.pickupDate, pickupTime: row.pickupTime, returnDate: row.returnDate, returnTime: row.returnTime,
      status: row.status, isBlocker: row.isBlocker, notes: row.notes, visibility: row.visibility,
      updatedAt: row.updatedAt,
    }, input, new Date());
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    if (outcome.kind === "unchanged") return { kind: "updated", equipment: row } as const;
    const [updated] = await tx.update(cateringBookingEquipment).set({ ...outcome.next, updatedAt: outcome.updatedAt })
      .where(and(eq(cateringBookingEquipment.id, equipmentId), eq(cateringBookingEquipment.bookingId, id))).returning();
    if (!updated) return { kind: "not_found" } as const;
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: outcome.activity.eventType, visibility: "shared", metadata: { name: outcome.activity.name },
    });
    return { kind: "updated", equipment: updated as CateringBookingEquipmentItem } as const;
  });
  if (result.kind === "not_found") return refuse(res, CATERING_EXECUTION_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "read_only") return readOnlyRace(res, "equipment record");
  res.json({ equipment: serializeExecutionEquipment(result.equipment) });
} catch (error) { invalid(error, res, next); } });

r.delete("/bookings/:id/execution/equipment/:equipmentId", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id } = resolved;
  const equipmentId = recordIdSchema.parse(req.params.equipmentId);
  const input = cateringEquipmentDeleteSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "equipment", id);
    const [current] = await tx.select().from(cateringBookingEquipment)
      .where(and(eq(cateringBookingEquipment.id, equipmentId), eq(cateringBookingEquipment.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    if (resolveCateringEquipmentDelete(current as CateringBookingEquipmentItem, input.expectedUpdatedAt).kind === "conflict") return { kind: "conflict" } as const;
    const [deleted] = await tx.delete(cateringBookingEquipment)
      .where(and(eq(cateringBookingEquipment.id, equipmentId), eq(cateringBookingEquipment.bookingId, id))).returning();
    return deleted ? { kind: "deleted" } as const : { kind: "not_found" } as const;
  });
  if (result.kind === "not_found") return refuse(res, CATERING_EXECUTION_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "read_only") return readOnlyRace(res, "equipment record");
  res.status(204).end();
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Venue access instructions
 * ------------------------------------------------------------------------------------------------------------- */

r.put("/bookings/:id/execution/access", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId, booking } = resolved;
  const input = cateringAccessSaveSchema.parse(req.body ?? {});
  const { expectedUpdatedAt: _precondition, ...fields } = input;
  const now = new Date();
  // `db` is untyped at this repo's boundary, so the outcome union is stated rather than inferred as `any`.
  type AccessSaveResult =
    | { kind: "read_only" } | { kind: "conflict" } | { kind: "invalid_time_range" }
    | { kind: "saved"; access: CateringBookingAccessDetail; notify: boolean };
  const result: AccessSaveResult = await db.transaction(async (tx: typeof db) => {
    const active = await lockActiveCateringBooking(tx, id);
    if (!active) return { kind: "read_only" } as const;
    await lockCollection(tx, "access", id);
    const [existing] = await tx.select().from(cateringBookingAccessDetails).where(eq(cateringBookingAccessDetails.bookingId, id)).limit(1);
    // Resolved against the authoritative row loaded INSIDE the transaction, under the access lock: the version
    // precondition and the merged-window validation are both decided from it, so neither a stale save nor an
    // invalid merged range reaches the upsert below.
    const outcome = resolveCateringAccessSave({ existing: existing as (CateringBookingAccessDetail & { updatedAt: Date }) | undefined }, input);
    // A save that would change nothing writes nothing -- no upsert, no version bump, no activity, no notification.
    if (outcome.kind === "unchanged") return { kind: "saved", access: existing as CateringBookingAccessDetail, notify: false } as const;
    if (outcome.kind !== "save") return outcome;
    // Upsert under the access lock, with the version precondition already satisfied above. The client never supplies
    // `updatedAt` or `updatedBy`: both are stamped here from the server clock and the authenticated session.
    //
    // A field the request omits keeps its persisted value rather than being cleared -- Drizzle drops `undefined` from
    // an update set, and an absent column on the insert takes its default. The section's form always submits the
    // complete record (an emptied input arrives as an explicit `null`), so this is a full save in practice; the
    // omission rule is simply the safer behaviour for anything that submits less.
    const [row] = await tx.insert(cateringBookingAccessDetails)
      .values({ bookingId: id, ...fields, updatedAt: now, updatedBy: userId })
      .onConflictDoUpdate({ target: cateringBookingAccessDetails.bookingId, set: { ...fields, updatedAt: now, updatedBy: userId } })
      .returning();
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: "execution_access_updated", visibility: "shared", metadata: {},
    });
    return { kind: "saved", access: row as CateringBookingAccessDetail, notify: outcome.notify } as const;
  });
  if (result.kind === "read_only") return readOnlyRace(res, "access instructions");
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "invalid_time_range") return res.status(400).json({ message: CATERING_ACCESS_SAVE_REFUSALS.invalid_time_range });
  if (result.notify) await notifyCounterpart(booking, userId, id, CATERING_EXECUTION_ACCESS_NOTIFICATION);
  res.json({ access: serializeExecutionAccess(result.access, "provider") });
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Milestones
 * ------------------------------------------------------------------------------------------------------------- */

r.put("/bookings/:id/execution/milestones/:key", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveExecutionRequest(req as never, res, true);
  if (!resolved) return;
  const { id, userId } = resolved;
  // The key comes from the allowlist enum, so an unknown milestone is a 400 rather than a row the CHECK rejects.
  const key = milestoneKeySchema.parse(req.params.key);
  const input = cateringMilestoneToggleSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveCateringBooking(tx, id)) return { kind: "read_only" } as const;
    await lockCollection(tx, "milestones", id);
    const [current] = await tx.select().from(cateringBookingExecutionMilestones)
      .where(and(eq(cateringBookingExecutionMilestones.bookingId, id), eq(cateringBookingExecutionMilestones.milestoneKey, key))).limit(1);
    const now = new Date();
    const outcome = resolveCateringMilestoneToggle(current as { completedAt: Date | null; updatedAt: Date } | undefined, input, now);
    if (outcome.kind === "conflict") return { kind: "conflict" } as const;
    // A repeated assertion of the state the row already holds writes nothing at all: no row, no timestamp, no
    // activity. That is what makes this mutation safe to retry with no idempotency token.
    if (outcome.kind === "unchanged") return { kind: "settled", row: current as { completedAt: Date | null; updatedAt: Date } } as const;
    const values = { completedAt: outcome.completedAt, completedBy: outcome.completedAt === null ? null : userId, updatedAt: now };
    const [row] = outcome.kind === "create"
      ? await tx.insert(cateringBookingExecutionMilestones).values({ bookingId: id, milestoneKey: key, ...values }).returning()
      : await tx.update(cateringBookingExecutionMilestones).set(values)
          .where(and(eq(cateringBookingExecutionMilestones.bookingId, id), eq(cateringBookingExecutionMilestones.milestoneKey, key))).returning();
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({
      // PROVIDER visibility, so a customer's activity feed never contains it and no customer notification exists
      // for it in any branch. Milestones are internal operational progress and stay that way.
      bookingId: id, actorUserId: userId, eventType: "provider_execution_milestone_completed", visibility: "provider", metadata: { milestone: key },
    });
    return { kind: "settled", row: row as { completedAt: Date | null; updatedAt: Date } } as const;
  });
  if (result.kind === "conflict") return refuse(res, CATERING_EXECUTION_CONFLICT_REFUSAL);
  if (result.kind === "read_only") return readOnlyRace(res, "milestone");
  res.json({ milestone: { key, completed: result.row.completedAt !== null, completedAt: result.row.completedAt?.toISOString() ?? null, updatedAt: result.row.updatedAt.toISOString() } });
} catch (error) { invalid(error, res, next); } });

export default r;
export { nextCateringExecutionSortOrder };
