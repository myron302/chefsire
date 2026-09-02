import { Router } from "express";
import { and, asc, count, desc, eq, max, or, sql } from "drizzle-orm";
import { z } from "zod";
import { cateringBookingActivity, cateringBookingDetails, cateringBookings, cateringBookingTasks, notifications, type CateringBookingDetails, type CateringBookingTask } from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { CATERING_BOOKING_TASK_LIMIT, CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_TASK_VERSION_CONFLICT_MESSAGE, CATERING_WORKSPACE_READ_ONLY_CODE, cateringBookingActivityPageSchema, cateringBookingCustomerDetailsSchema, cateringBookingProviderDetailsSchema, cateringBookingTaskCreateSchema, cateringBookingTaskDeleteSchema, cateringBookingTaskReorderSchema, cateringBookingTaskUpdateSchema, cateringBookingWorkspacePath, cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { serializeCateringBooking } from "../serializers/catering-booking";
import { serializeBookingActivity, serializeBookingDetails, serializeBookingTask } from "../serializers/catering-booking-workspace";
import { CATERING_DETAILS_SAVE_REFUSALS, CATERING_TASK_CREATE_MESSAGES, CATERING_TASK_NOT_FOUND_REFUSAL, CATERING_TASK_REORDER_REFUSALS, CATERING_WORKSPACE_READ_ONLY_REFUSAL, cateringWorkspaceGuard, resolveCateringDetailsSave, resolveCateringTaskCreate, resolveCateringTaskDelete, resolveCateringTaskPatch, resolveCateringTaskReorder } from "../services/catering-booking-workspace-policy";

const r = Router();
const taskIdSchema = z.string().uuid();
type DetailsSaveResult = { kind: "read_only" } | { kind: "invalid_time_range" } | { kind: "updated"; details: CateringBookingDetails };
/** The reorder's four outcomes, named here so a refusal is narrowed to its own message rather than indexed loosely. */
type TaskReorderResult = { kind: "read_only" } | { kind: "membership" } | { kind: "conflict" } | { kind: "reordered"; tasks: CateringBookingTask[] };
async function ownedBooking(id: string, userId: string) {
  const [booking] = await db.select().from(cateringBookings).where(and(eq(cateringBookings.id, id), or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId)))).limit(1);
  return booking;
}
async function lockActiveBooking(tx: typeof db, id: string) {
  await tx.execute(sql`SELECT id FROM catering_bookings WHERE id = ${id} FOR UPDATE`);
  const [booking] = await tx.select({ status: cateringBookings.status }).from(cateringBookings).where(eq(cateringBookings.id, id)).limit(1);
  return booking?.status === "pending_confirmation" || booking?.status === "confirmed";
}
async function lockTaskCollection(tx: typeof db, id: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-tasks:${id}`}))`);
}
async function lockedTaskCounts(tx: typeof db, id: string) {
  await lockTaskCollection(tx, id);
  const [{ value, maxSortOrder }] = await tx.select({ value: count(), maxSortOrder: max(cateringBookingTasks.sortOrder) }).from(cateringBookingTasks).where(eq(cateringBookingTasks.bookingId, id));
  return { taskCount: Number(value), maxSortOrder: maxSortOrder == null ? null : Number(maxSortOrder) };
}
type WorkspaceResponse = Parameters<Parameters<typeof r.get>[1]>[1];
/**
 * Answers a refused early guard. A terminal booking always gets the canonical coded read-only refusal, so the client
 * refetches; a wrong actor keeps its own truthful message and stays uncoded, because no refetch would change it.
 */
function refuseWorkspaceGuard(res: WorkspaceResponse, guard: "read_only" | "forbidden", forbidden: string) {
  if (guard === "read_only") return res.status(CATERING_WORKSPACE_READ_ONLY_REFUSAL.status).json({ message: CATERING_WORKSPACE_READ_ONLY_REFUSAL.message, code: CATERING_WORKSPACE_READ_ONLY_REFUSAL.code });
  return res.status(409).json({ message: forbidden });
}
function invalid(error: unknown, res: Parameters<Parameters<typeof r.get>[1]>[1], next: (error: unknown) => void) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
  next(error);
}

r.get("/bookings/:id/workspace", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const userId = (req.user as { id: string }).id; const page = cateringBookingActivityPageSchema.parse(req.query);
  const booking = await ownedBooking(id, userId); if (!booking) return res.status(404).json({ message: "Booking workspace not found" });
  const role = cateringWorkspaceRole(booking, userId)!; const activityVisibility = role === "provider" ? undefined : eq(cateringBookingActivity.visibility, "shared");
  const activityWhere = activityVisibility ? and(eq(cateringBookingActivity.bookingId, id), activityVisibility) : eq(cateringBookingActivity.bookingId, id);
  const [detailsRows, taskRows, activityRows, totals] = await Promise.all([
    db.select().from(cateringBookingDetails).where(eq(cateringBookingDetails.bookingId, id)).limit(1),
    db.select().from(cateringBookingTasks).where(and(eq(cateringBookingTasks.bookingId, id), role === "customer" ? eq(cateringBookingTasks.visibility, "shared") : undefined)).orderBy(asc(cateringBookingTasks.sortOrder), asc(cateringBookingTasks.id)).limit(CATERING_BOOKING_TASK_LIMIT),
    db.select().from(cateringBookingActivity).where(activityWhere).orderBy(desc(cateringBookingActivity.createdAt), desc(cateringBookingActivity.id)).limit(page.limit).offset((page.page - 1) * page.limit),
    db.select({ value: count() }).from(cateringBookingActivity).where(activityWhere),
  ]);
  const total = Number(totals[0]?.value ?? 0);
  res.json({ role, editable: booking.status === "pending_confirmation" || booking.status === "confirmed", booking: serializeCateringBooking(booking), details: serializeBookingDetails(detailsRows[0], role), tasks: taskRows.map(serializeBookingTask), activity: activityRows.map(serializeBookingActivity), activityPagination: { ...page, total, totalPages: Math.ceil(total / page.limit) } });
} catch (error) { invalid(error, res, next); } });

r.put("/bookings/:id/details", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const userId = (req.user as { id: string }).id; const booking = await ownedBooking(id, userId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, userId)!;
  const input = role === "provider" ? cateringBookingProviderDetailsSchema.parse(req.body ?? {}) : cateringBookingCustomerDetailsSchema.parse(req.body ?? {});
  const guard = cateringWorkspaceGuard(booking.status as never, role, role === "provider" ? "provider-details" : "customer-notes");
  if (guard !== "allowed") return refuseWorkspaceGuard(res, guard, "Only a booking participant may save these event details");
  const now = new Date();
  const result: DetailsSaveResult = await db.transaction(async (tx: typeof db) => {
    const active = await lockActiveBooking(tx, id);
    const [existing] = active ? await tx.select().from(cateringBookingDetails).where(eq(cateringBookingDetails.bookingId, id)).limit(1) : [];
    // A booking that went read-only under the lock and an invalid resulting service range are different refusals.
    const outcome = resolveCateringDetailsSave(active ? { existing } : null, input, role);
    if (outcome.kind !== "save") return outcome;
    const [row] = await tx.insert(cateringBookingDetails).values({ bookingId: id, ...input, updatedAt: now }).onConflictDoUpdate({ target: cateringBookingDetails.bookingId, set: { ...input, updatedAt: now } }).returning();
    if (outcome.activityVisibility) await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: userId, eventType: "details_updated", visibility: outcome.activityVisibility, metadata: {} });
    return { kind: "updated", details: row } as const;
  });
  if (result.kind !== "updated") { const refusal = CATERING_DETAILS_SAVE_REFUSALS[result.kind]; return res.status(409).json({ message: refusal.message, code: refusal.code }); }
  res.json({ details: serializeBookingDetails(result.details, role) });
} catch (error) { invalid(error, res, next); } });

r.post("/bookings/:id/tasks", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const providerId = (req.user as { id: string }).id; const input = cateringBookingTaskCreateSchema.parse(req.body ?? {}); const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  const guard = cateringWorkspaceGuard(booking.status as never, role, "tasks");
  if (guard !== "allowed") return refuseWorkspaceGuard(res, guard, "Only the provider may edit tasks on an active workspace");
  const result = await db.transaction(async (tx: typeof db) => {
    // A booking that went read-only under the lock and a full task collection are different refusals, never the same one.
    const outcome = resolveCateringTaskCreate(await lockActiveBooking(tx, id) ? await lockedTaskCounts(tx, id) : null, input);
    if (outcome.kind !== "create") return outcome;
    const [row] = await tx.insert(cateringBookingTasks).values({ bookingId: id, createdBy: providerId, sortOrder: outcome.sortOrder, ...input }).returning();
    if (outcome.activity) await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: providerId, eventType: outcome.activity.eventType, visibility: "shared", metadata: { taskTitle: outcome.activity.taskTitle } });
    return { kind: "created", task: row } as const;
  });
  if (result.kind === "read_only") return res.status(409).json({ message: CATERING_TASK_CREATE_MESSAGES.read_only, code: CATERING_WORKSPACE_READ_ONLY_CODE });
  if (result.kind === "limit") return res.status(409).json({ message: CATERING_TASK_CREATE_MESSAGES.limit });
  if (input.visibility === "shared") await db.insert(notifications).values({ userId: booking.customerId, type: "catering_booking_requirement", title: "New catering event requirement", message: "Your caterer added a preparation requirement.", linkUrl: cateringBookingWorkspacePath("customer", id) }).catch(() => undefined);
  res.status(201).json({ task: serializeBookingTask(result.task) });
} catch (error) { invalid(error, res, next); } });

r.patch("/bookings/:id/tasks/:taskId", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const taskId = taskIdSchema.parse(req.params.taskId); const providerId = (req.user as { id: string }).id; const input = cateringBookingTaskUpdateSchema.parse(req.body ?? {}); const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  const guard = cateringWorkspaceGuard(booking.status as never, role, "tasks");
  if (guard !== "allowed") return refuseWorkspaceGuard(res, guard, "Only the provider may edit tasks on an active workspace");
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveBooking(tx, id)) return { kind: "read_only" } as const;
    await lockTaskCollection(tx, id);
    const [current] = await tx.select().from(cateringBookingTasks).where(and(eq(cateringBookingTasks.id, taskId), eq(cateringBookingTasks.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    // Resolved against the authoritative locked row, never against anything read before the transaction: a stale
    // expectedUpdatedAt conflicts, and request-field presence alone is still not a change.
    const resolution = resolveCateringTaskPatch(current, input, new Date());
    if (resolution.kind === "conflict") return { kind: "conflict" } as const;
    if (resolution.kind === "unchanged") return { kind: "updated", task: current } as const;
    const [task] = await tx.update(cateringBookingTasks).set({ ...resolution.next, completedAt: resolution.completedAt, updatedAt: resolution.updatedAt }).where(and(eq(cateringBookingTasks.id, taskId), eq(cateringBookingTasks.bookingId, id))).returning();
    if (!task) return { kind: "not_found" } as const;
    if (resolution.activity) await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: providerId, eventType: resolution.activity.eventType, visibility: "shared", metadata: { taskTitle: resolution.activity.taskTitle } });
    return { kind: "updated", task } as const;
  });
  if (result.kind === "not_found") return res.status(CATERING_TASK_NOT_FOUND_REFUSAL.status).json({ message: CATERING_TASK_NOT_FOUND_REFUSAL.message, code: CATERING_TASK_NOT_FOUND_REFUSAL.code });
  if (result.kind === "conflict") return res.status(409).json({ message: CATERING_TASK_VERSION_CONFLICT_MESSAGE, code: CATERING_TASK_VERSION_CONFLICT_CODE });
  if (result.kind === "read_only") return res.status(409).json({ message: "Booking became read-only before the task update completed", code: CATERING_WORKSPACE_READ_ONLY_CODE });
  res.json({ task: serializeBookingTask(result.task) });
} catch (error) { invalid(error, res, next); } });

r.delete("/bookings/:id/tasks/:taskId", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const taskId = taskIdSchema.parse(req.params.taskId); const providerId = (req.user as { id: string }).id; const input = cateringBookingTaskDeleteSchema.parse(req.body ?? {}); const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  const guard = cateringWorkspaceGuard(booking.status as never, role, "tasks");
  if (guard !== "allowed") return refuseWorkspaceGuard(res, guard, "Only the provider may edit tasks on an active workspace");
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveBooking(tx, id)) return { kind: "read_only" } as const;
    await lockTaskCollection(tx, id);
    const [current] = await tx.select().from(cateringBookingTasks).where(and(eq(cateringBookingTasks.id, taskId), eq(cateringBookingTasks.bookingId, id))).limit(1);
    if (!current) return { kind: "not_found" } as const;
    // The version the provider confirmed deleting, compared against the authoritative locked row before anything is removed.
    const resolution = resolveCateringTaskDelete(current, input.expectedUpdatedAt);
    if (resolution.kind === "conflict") return { kind: "conflict" } as const;
    const [row] = await tx.delete(cateringBookingTasks).where(and(eq(cateringBookingTasks.id, taskId), eq(cateringBookingTasks.bookingId, id))).returning();
    if (!row) return { kind: "not_found" } as const;
    if (resolution.activity) await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: providerId, eventType: resolution.activity.eventType, visibility: "shared", metadata: { taskTitle: resolution.activity.taskTitle } });
    return { kind: "deleted" } as const;
  });
  if (result.kind === "not_found") return res.status(CATERING_TASK_NOT_FOUND_REFUSAL.status).json({ message: CATERING_TASK_NOT_FOUND_REFUSAL.message, code: CATERING_TASK_NOT_FOUND_REFUSAL.code });
  if (result.kind === "conflict") return res.status(409).json({ message: CATERING_TASK_VERSION_CONFLICT_MESSAGE, code: CATERING_TASK_VERSION_CONFLICT_CODE });
  if (result.kind === "read_only") return res.status(409).json({ message: "Booking became read-only before the task could be deleted", code: CATERING_WORKSPACE_READ_ONLY_CODE });
  res.status(204).end();
} catch (error) { invalid(error, res, next); } });

r.post("/bookings/:id/tasks/reorder", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const providerId = (req.user as { id: string }).id; const input = cateringBookingTaskReorderSchema.parse(req.body ?? {}); const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  const guard = cateringWorkspaceGuard(booking.status as never, role, "tasks");
  if (guard !== "allowed") return refuseWorkspaceGuard(res, guard, "Only the provider may reorder tasks on an active workspace");
  const result: TaskReorderResult = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveBooking(tx, id)) return { kind: "read_only" } as const;
    await lockTaskCollection(tx, id);
    const rows = await tx.select({ id: cateringBookingTasks.id, updatedAt: cateringBookingTasks.updatedAt }).from(cateringBookingTasks).where(eq(cateringBookingTasks.bookingId, id));
    // Membership, then every submitted version, both against the authoritative locked rows. A booking that went
    // read-only, an incomplete set, and a stale version are three different refusals, and none of them writes.
    const outcome = resolveCateringTaskReorder(rows, input.tasks);
    if (outcome.kind !== "reorder") return outcome;
    // Only past the precondition does anything persist, and the new sortOrder is the submitted position, never a
    // client-supplied one. Sequential so the whole reorder lands as one atomic set of writes under the task lock.
    const now = new Date();
    for (const { id: taskId, sortOrder } of outcome.updates) await tx.update(cateringBookingTasks).set({ sortOrder, updatedAt: now }).where(and(eq(cateringBookingTasks.id, taskId), eq(cateringBookingTasks.bookingId, id)));
    // The reorder bumped every task's version, so the response hands back the fresh authoritative ones.
    const reordered = await tx.select().from(cateringBookingTasks).where(eq(cateringBookingTasks.bookingId, id)).orderBy(asc(cateringBookingTasks.sortOrder), asc(cateringBookingTasks.id));
    return { kind: "reordered", tasks: reordered } as const;
  });
  if (result.kind === "conflict") return res.status(409).json({ message: CATERING_TASK_VERSION_CONFLICT_MESSAGE, code: CATERING_TASK_VERSION_CONFLICT_CODE });
  if (result.kind !== "reordered") { const refusal = CATERING_TASK_REORDER_REFUSALS[result.kind]; return res.status(409).json({ message: refusal.message, code: refusal.code }); }
  res.json({ tasks: result.tasks.map(serializeBookingTask) });
} catch (error) { invalid(error, res, next); } });

export default r;
