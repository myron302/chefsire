import { Router } from "express";
import { and, asc, count, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { cateringBookingActivity, cateringBookingDetails, cateringBookings, cateringBookingTasks, users } from "@shared/schema";
import { CATERING_ACTIVITY_DEFAULT_LIMIT, CATERING_ACTIVITY_MAX_LIMIT, CATERING_TASK_LIMIT, canEditBookingWorkspace, cateringBookingDetailsSchema, cateringTaskCreateSchema, cateringTaskPatchSchema, cateringTaskReorderSchema, serializeBookingDetails, serializeBookingTask } from "@shared/catering-booking-workspace";

const router = Router();
type Role = "provider" | "customer";
async function participant(bookingId: string, userId: string) {
  const [booking] = await db.select().from(cateringBookings).where(and(eq(cateringBookings.id, bookingId), or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId)))).limit(1);
  return booking ? { booking, role: (booking.providerId === userId ? "provider" : "customer") as Role } : null;
}
function editable(status: string) { if (!canEditBookingWorkspace(status)) { const error = new Error("Completed and cancelled event workspaces are read-only"); Object.assign(error, { status: 409 }); throw error; } }
async function activity(bookingId: string, actorUserId: string, eventType: string, visibility: "provider" | "shared" = "shared", metadata: Record<string, string> = {}) { await db.insert(cateringBookingActivity).values({ bookingId, actorUserId, eventType, visibility, metadata }); }

router.get("/:id/workspace", requireAuth, async (req, res, next) => { try {
  const access = await participant(req.params.id, (req.user as { id: string }).id); if (!access) return res.status(404).json({ message: "Booking workspace not found" });
  const limit = Math.min(CATERING_ACTIVITY_MAX_LIMIT, Math.max(1, Number(req.query.activityLimit) || CATERING_ACTIVITY_DEFAULT_LIMIT));
  const cursorAt = typeof req.query.cursorAt === "string" ? new Date(req.query.cursorAt) : null; const cursorId = typeof req.query.cursorId === "string" ? req.query.cursorId : null;
  const visibility = access.role === "provider" ? undefined : eq(cateringBookingActivity.visibility, "shared");
  const cursor = cursorAt && cursorId ? or(lt(cateringBookingActivity.createdAt, cursorAt), and(eq(cateringBookingActivity.createdAt, cursorAt), lt(cateringBookingActivity.id, cursorId))) : undefined;
  const [details, tasks, events, provider, customer] = await Promise.all([
    db.select().from(cateringBookingDetails).where(eq(cateringBookingDetails.bookingId, access.booking.id)).limit(1),
    db.select().from(cateringBookingTasks).where(access.role === "provider" ? eq(cateringBookingTasks.bookingId, access.booking.id) : and(eq(cateringBookingTasks.bookingId, access.booking.id), eq(cateringBookingTasks.visibility, "shared"))).orderBy(asc(cateringBookingTasks.sortOrder), asc(cateringBookingTasks.id)).limit(CATERING_TASK_LIMIT),
    db.select({ id: cateringBookingActivity.id, eventType: cateringBookingActivity.eventType, metadata: cateringBookingActivity.metadata, createdAt: cateringBookingActivity.createdAt }).from(cateringBookingActivity).where(and(eq(cateringBookingActivity.bookingId, access.booking.id), visibility, cursor)).orderBy(desc(cateringBookingActivity.createdAt), desc(cateringBookingActivity.id)).limit(limit + 1),
    db.select({ id: users.id, displayName: users.displayName, avatar: users.avatar }).from(users).where(eq(users.id, access.booking.providerId)).limit(1),
    db.select({ id: users.id, displayName: users.displayName, avatar: users.avatar }).from(users).where(eq(users.id, access.booking.customerId)).limit(1),
  ]);
  const page = events.slice(0, limit); const last = page.at(-1);
  res.json({ role: access.role, editable: canEditBookingWorkspace(access.booking.status), booking: { id: access.booking.id, status: access.booking.status, eventDate: access.booking.eventDate, eventType: access.booking.eventType, guestCount: access.booking.guestCount, packageSnapshot: access.booking.packageSnapshot, agreedPrice: access.booking.agreedPrice, currency: access.booking.currency }, provider: provider[0] ?? null, customer: access.role === "provider" ? customer[0] ?? null : undefined, details: serializeBookingDetails(details[0], access.role), tasks: tasks.map((row: Record<string, unknown>) => serializeBookingTask(row, access.role)).filter(Boolean), activity: { items: page, nextCursor: events.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null } });
} catch (error) { next(error); } });

router.put("/:id/details", requireAuth, async (req, res, next) => { try {
  const userId = (req.user as { id: string }).id; const access = await participant(req.params.id, userId); if (!access) return res.status(404).json({ message: "Booking workspace not found" }); editable(access.booking.status);
  const input = cateringBookingDetailsSchema.parse(req.body); if (access.role === "customer" && "providerNotes" in input) return res.status(403).json({ message: "Provider notes are private" });
  const { customerNotes, ...providerFields } = input;
  const values = access.role === "customer" ? { customerNotes, updatedAt: new Date() } : { ...providerFields, updatedAt: new Date() };
  const [saved] = await db.insert(cateringBookingDetails).values({ bookingId: access.booking.id, ...values }).onConflictDoUpdate({ target: cateringBookingDetails.bookingId, set: values }).returning();
  await activity(access.booking.id, userId, "operational_details_updated"); res.json({ details: serializeBookingDetails(saved, access.role) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message, errors: error.issues }); next(error); } });

router.post("/:id/tasks", requireAuth, async (req, res, next) => { try {
  const userId = (req.user as { id: string }).id; const access = await participant(req.params.id, userId); if (!access) return res.status(404).json({ message: "Booking workspace not found" }); if (access.role !== "provider") return res.status(403).json({ message: "Only the provider can manage tasks" }); editable(access.booking.status); const input = cateringTaskCreateSchema.parse(req.body);
  const created = await db.transaction(async (tx: typeof db) => { await tx.select({ id: cateringBookings.id }).from(cateringBookings).where(and(eq(cateringBookings.id, access.booking.id), eq(cateringBookings.providerId, userId))).for("update"); const [total] = await tx.select({ value: count() }).from(cateringBookingTasks).where(eq(cateringBookingTasks.bookingId, access.booking.id)); if (Number(total.value) >= CATERING_TASK_LIMIT) throw Object.assign(new Error(`A booking can have at most ${CATERING_TASK_LIMIT} tasks`), { status: 409 }); const [row] = await tx.insert(cateringBookingTasks).values({ ...input, bookingId: access.booking.id, createdBy: userId, sortOrder: Number(total.value), source: "provider" }).returning(); return row; });
  if (input.visibility === "shared") await activity(access.booking.id, userId, "shared_requirement_added", "shared", { taskId: created.id, title: created.title }); res.status(201).json({ task: serializeBookingTask(created, "provider") });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

router.patch("/:id/tasks/:taskId", requireAuth, async (req, res, next) => { try {
  const userId = (req.user as { id: string }).id; const access = await participant(req.params.id, userId); if (!access) return res.status(404).json({ message: "Booking workspace not found" }); if (access.role !== "provider") return res.status(403).json({ message: "Only the provider can manage tasks" }); editable(access.booking.status); const input = cateringTaskPatchSchema.parse(req.body);
  const [updated] = await db.update(cateringBookingTasks).set({ ...input, completedAt: input.status === "completed" ? new Date() : input.status === "pending" ? null : undefined, updatedAt: new Date() }).where(and(eq(cateringBookingTasks.id, req.params.taskId), eq(cateringBookingTasks.bookingId, access.booking.id))).returning(); if (!updated) return res.status(404).json({ message: "Task not found" }); res.json({ task: serializeBookingTask(updated, "provider") });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

router.delete("/:id/tasks/:taskId", requireAuth, async (req, res, next) => { try { const access = await participant(req.params.id, (req.user as { id: string }).id); if (!access) return res.status(404).json({ message: "Booking workspace not found" }); if (access.role !== "provider") return res.status(403).json({ message: "Only the provider can manage tasks" }); editable(access.booking.status); const removed = await db.delete(cateringBookingTasks).where(and(eq(cateringBookingTasks.id, req.params.taskId), eq(cateringBookingTasks.bookingId, access.booking.id))).returning({ id: cateringBookingTasks.id }); if (!removed.length) return res.status(404).json({ message: "Task not found" }); res.status(204).end(); } catch (error) { next(error); } });

router.post("/:id/tasks/reorder", requireAuth, async (req, res, next) => { try { const userId = (req.user as { id: string }).id; const access = await participant(req.params.id, userId); if (!access) return res.status(404).json({ message: "Booking workspace not found" }); if (access.role !== "provider") return res.status(403).json({ message: "Only the provider can manage tasks" }); editable(access.booking.status); const { taskIds } = cateringTaskReorderSchema.parse(req.body); if (new Set(taskIds).size !== taskIds.length) return res.status(400).json({ message: "Task order contains duplicates" }); await db.transaction(async (tx: typeof db) => { const owned = await tx.select({ id: cateringBookingTasks.id }).from(cateringBookingTasks).where(eq(cateringBookingTasks.bookingId, access.booking.id)).for("update"); const ownedIds = new Set(owned.map((item: { id: string }) => item.id)); if (owned.length !== taskIds.length || taskIds.some((id) => !ownedIds.has(id))) throw Object.assign(new Error("Task order must contain every task in this booking exactly once"), { status: 409 }); for (let sortOrder = 0; sortOrder < taskIds.length; sortOrder += 1) { const id = taskIds[sortOrder]; await tx.update(cateringBookingTasks).set({ sortOrder, updatedAt: new Date() }).where(and(eq(cateringBookingTasks.id, id), eq(cateringBookingTasks.bookingId, access.booking.id))); } }); res.status(204).end(); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

export default router;
