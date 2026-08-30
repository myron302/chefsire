import { Router } from "express";
import { and, asc, count, desc, eq, max, or, sql } from "drizzle-orm";
import { z } from "zod";
import { cateringBookingActivity, cateringBookingDetails, cateringBookings, cateringBookingTasks, notifications } from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { CATERING_BOOKING_TASK_LIMIT, CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_TASK_VERSION_CONFLICT_MESSAGE, cateringBookingActivityPageSchema, cateringBookingCustomerDetailsSchema, cateringBookingProviderDetailsSchema, cateringBookingTaskCreateSchema, cateringBookingTaskReorderSchema, cateringBookingTaskUpdateSchema, cateringBookingWorkspacePath, cateringWorkspaceRole, hasValidCateringServiceTimeRange, mergeCateringServiceTimes } from "@shared/catering-booking-operations";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { serializeCateringBooking } from "../serializers/catering-booking";
import { serializeBookingActivity, serializeBookingDetails, serializeBookingTask } from "../serializers/catering-booking-workspace";
import { cateringDetailsActivityVisibility, mayMutateWorkspace, nextCateringTaskSortOrder, resolveCateringTaskPatch } from "../services/catering-booking-workspace-policy";

const r = Router();
const taskIdSchema = z.string().uuid();
async function ownedBooking(id: string, userId: string) {
  const [booking] = await db.select().from(cateringBookings).where(and(eq(cateringBookings.id, id), or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId)))).limit(1);
  return booking;
}
async function lockActiveBooking(tx: typeof db, id: string) {
  await tx.execute(sql`SELECT id FROM catering_bookings WHERE id = ${id} FOR UPDATE`);
  const [booking] = await tx.select({ status: cateringBookings.status }).from(cateringBookings).where(eq(cateringBookings.id, id)).limit(1);
  return booking?.status === "pending_confirmation" || booking?.status === "confirmed";
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
  if (!mayMutateWorkspace(booking.status as never, role, role === "provider" ? "provider-details" : "customer-notes")) return res.status(409).json({ message: "Cancelled and completed workspaces are read-only" });
  const now = new Date();
  const [details] = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveBooking(tx, id)) return [];
    const [existing] = await tx.select().from(cateringBookingDetails).where(eq(cateringBookingDetails.bookingId, id)).limit(1);
    const serviceInput = role === "provider" ? { ...("serviceStartTime" in input ? { serviceStartTime: input.serviceStartTime } : {}), ...("serviceEndTime" in input ? { serviceEndTime: input.serviceEndTime } : {}) } : {};
    const serviceTimes = mergeCateringServiceTimes(existing, serviceInput);
    if (role === "provider" && !hasValidCateringServiceTimeRange(serviceTimes)) return [];
    const visibility = cateringDetailsActivityVisibility(existing, input, role);
    const rows = await tx.insert(cateringBookingDetails).values({ bookingId: id, ...input, updatedAt: now }).onConflictDoUpdate({ target: cateringBookingDetails.bookingId, set: { ...input, updatedAt: now } }).returning();
    if (visibility) await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: userId, eventType: "details_updated", visibility, metadata: {} }); return rows;
  });
  if (!details) return res.status(409).json({ message: "Booking is read-only or the resulting service time range is invalid" });
  res.json({ details: serializeBookingDetails(details, role) });
} catch (error) { invalid(error, res, next); } });

r.post("/bookings/:id/tasks", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const providerId = (req.user as { id: string }).id; const input = cateringBookingTaskCreateSchema.parse(req.body ?? {}); const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  if (!mayMutateWorkspace(booking.status as never, role, "tasks")) return res.status(409).json({ message: "Only the provider may edit tasks on an active workspace" });
  const task = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveBooking(tx, id)) return null;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-tasks:${id}`}))`);
    const [{ value, maxSortOrder }] = await tx.select({ value: count(), maxSortOrder: max(cateringBookingTasks.sortOrder) }).from(cateringBookingTasks).where(eq(cateringBookingTasks.bookingId, id)); if (Number(value) >= CATERING_BOOKING_TASK_LIMIT) return null;
    const sortOrder = nextCateringTaskSortOrder(maxSortOrder == null ? null : Number(maxSortOrder));
    const [row] = await tx.insert(cateringBookingTasks).values({ bookingId: id, createdBy: providerId, sortOrder, ...input }).returning();
    if (input.visibility === "shared") await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: providerId, eventType: "shared_requirement_added", visibility: "shared", metadata: { taskTitle: input.title } }); return row;
  });
  if (!task) return res.status(409).json({ message: `A booking may have at most ${CATERING_BOOKING_TASK_LIMIT} tasks` });
  if (input.visibility === "shared") await db.insert(notifications).values({ userId: booking.customerId, type: "catering_booking_requirement", title: "New catering event requirement", message: "Your caterer added a preparation requirement.", linkUrl: cateringBookingWorkspacePath("customer", id) }).catch(() => undefined);
  res.status(201).json({ task: serializeBookingTask(task) });
} catch (error) { invalid(error, res, next); } });

r.patch("/bookings/:id/tasks/:taskId", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const taskId = taskIdSchema.parse(req.params.taskId); const providerId = (req.user as { id: string }).id; const input = cateringBookingTaskUpdateSchema.parse(req.body ?? {}); const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  if (!mayMutateWorkspace(booking.status as never, role, "tasks")) return res.status(409).json({ message: "Only the provider may edit tasks on an active workspace" });
  const result = await db.transaction(async (tx: typeof db) => {
    if (!await lockActiveBooking(tx, id)) return { kind: "read_only" } as const;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-tasks:${id}`}))`);
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
  if (result.kind === "not_found") return res.status(404).json({ message: "Task not found" });
  if (result.kind === "conflict") return res.status(409).json({ message: CATERING_TASK_VERSION_CONFLICT_MESSAGE, code: CATERING_TASK_VERSION_CONFLICT_CODE });
  if (result.kind === "read_only") return res.status(409).json({ message: "Booking became read-only before the task update completed" });
  res.json({ task: serializeBookingTask(result.task) });
} catch (error) { invalid(error, res, next); } });

r.delete("/bookings/:id/tasks/:taskId", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const taskId = taskIdSchema.parse(req.params.taskId); const providerId = (req.user as { id: string }).id; const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  if (!mayMutateWorkspace(booking.status as never, role, "tasks")) return res.status(409).json({ message: "Only the provider may edit tasks on an active workspace" });
  const deleted = await db.transaction(async (tx: typeof db) => { if (!await lockActiveBooking(tx, id)) return undefined; const [row] = await tx.delete(cateringBookingTasks).where(and(eq(cateringBookingTasks.id, taskId), eq(cateringBookingTasks.bookingId, id))).returning(); if (row?.visibility === "shared") await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: providerId, eventType: "shared_requirement_deleted", visibility: "shared", metadata: { taskTitle: row.title } }); return row; });
  if (!deleted) return res.status(404).json({ message: "Task not found" }); res.status(204).end();
} catch (error) { invalid(error, res, next); } });

r.post("/bookings/:id/tasks/reorder", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const providerId = (req.user as { id: string }).id; const input = cateringBookingTaskReorderSchema.parse(req.body ?? {}); const booking = await ownedBooking(id, providerId);
  if (!booking) return res.status(404).json({ message: "Booking workspace not found" }); const role = cateringWorkspaceRole(booking, providerId)!;
  if (!mayMutateWorkspace(booking.status as never, role, "tasks")) return res.status(409).json({ message: "Only the provider may reorder tasks on an active workspace" });
  const ok = await db.transaction(async (tx: typeof db) => { if (!await lockActiveBooking(tx, id)) return false; await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-tasks:${id}`}))`); const rows = await tx.select({ id: cateringBookingTasks.id }).from(cateringBookingTasks).where(eq(cateringBookingTasks.bookingId, id)); if (rows.length !== input.taskIds.length || rows.some((row: { id: string }) => !input.taskIds.includes(row.id))) return false; await Promise.all(input.taskIds.map((taskId, sortOrder) => tx.update(cateringBookingTasks).set({ sortOrder, updatedAt: new Date() }).where(and(eq(cateringBookingTasks.id, taskId), eq(cateringBookingTasks.bookingId, id))))); return true; });
  if (!ok) return res.status(409).json({ message: "Reorder must contain the complete current task set" }); res.status(204).end();
} catch (error) { invalid(error, res, next); } });

export default r;
