import { z } from "zod";
import type { CateringBookingStatus, CateringBookingView } from "./catering-bookings";
import { calendarDateSchema } from "./catering-availability";

export const CATERING_BOOKING_TASK_LIMIT = 100;
export const CATERING_BOOKING_TASK_STATUSES = ["pending", "completed"] as const;
export const CATERING_BOOKING_TASK_VISIBILITIES = ["provider", "shared"] as const;
export const CATERING_BOOKING_ACTIVITY_EVENT_TYPES = ["booking_offered", "customer_confirmed", "booking_cancelled", "booking_completed", "details_updated", "shared_requirement_added", "shared_requirement_updated", "shared_requirement_completed", "shared_requirement_deleted"] as const;

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const wallClock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm event-local time").nullable();
const calendarDate = calendarDateSchema.nullable();

export const cateringBookingProviderDetailsSchema = z.object({
  venueName: optionalText(160), venueAddress: optionalText(240), venueCity: optionalText(120), venueState: optionalText(80), venuePostalCode: optionalText(24),
  venueInstructions: optionalText(2000), arrivalTime: wallClock.optional(), serviceStartTime: wallClock.optional(), serviceEndTime: wallClock.optional(),
  setupNotes: optionalText(2000), accessNotes: optionalText(2000), kitchenAvailable: z.boolean().nullable().optional(), refrigerationAvailable: z.boolean().nullable().optional(),
  powerAvailable: z.boolean().nullable().optional(), waterAvailable: z.boolean().nullable().optional(), indoorOutdoor: z.enum(["indoor", "outdoor", "both"]).nullable().optional(),
  providerNotes: optionalText(4000),
}).strict().refine((value) => value.serviceStartTime == null || value.serviceEndTime == null || value.serviceStartTime <= value.serviceEndTime, { message: "Service end time must not precede service start time", path: ["serviceEndTime"] });
export const cateringBookingCustomerDetailsSchema = z.object({ customerNotes: optionalText(2000) }).strict();

export const cateringBookingTaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(160), description: optionalText(2000), visibility: z.enum(CATERING_BOOKING_TASK_VISIBILITIES).default("provider"), dueDate: calendarDate.optional(), dueTime: wallClock.optional(),
}).strict();
/**
 * Optimistic concurrency precondition for every task update: the serialized updatedAt the submitted edit was based on.
 * It is a precondition only -- the server stays authoritative for the next updatedAt and never persists a client value.
 */
export const cateringBookingTaskVersionSchema = z.string().datetime();
export const CATERING_TASK_VERSION_CONFLICT_CODE = "task_version_conflict";
export const CATERING_TASK_VERSION_CONFLICT_MESSAGE = "This task changed since you started editing it. Reload the latest task before saving.";
export const cateringBookingTaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(), description: optionalText(2000), visibility: z.enum(CATERING_BOOKING_TASK_VISIBILITIES).optional(), dueDate: calendarDate.optional(), dueTime: wallClock.optional(), status: z.enum(CATERING_BOOKING_TASK_STATUSES).optional(),
  expectedUpdatedAt: cateringBookingTaskVersionSchema,
}).strict().refine((value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"), "At least one task field is required");
export const cateringBookingTaskReorderSchema = z.object({ taskIds: z.array(z.string().uuid()).min(1).max(CATERING_BOOKING_TASK_LIMIT) }).strict().refine((value) => new Set(value.taskIds).size === value.taskIds.length, "Task IDs must be unique");
export const cateringBookingActivityPageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });

export function hasValidCateringServiceTimeRange(value: { serviceStartTime?: string | null; serviceEndTime?: string | null }): boolean {
  return value.serviceStartTime == null || value.serviceEndTime == null || value.serviceStartTime <= value.serviceEndTime;
}
export function mergeCateringServiceTimes(existing: { serviceStartTime?: string | null; serviceEndTime?: string | null } | undefined, input: { serviceStartTime?: string | null; serviceEndTime?: string | null }) {
  return {
    serviceStartTime: "serviceStartTime" in input ? input.serviceStartTime : existing?.serviceStartTime,
    serviceEndTime: "serviceEndTime" in input ? input.serviceEndTime : existing?.serviceEndTime,
  };
}

export function mayEditCateringWorkspace(status: CateringBookingStatus): boolean { return status === "pending_confirmation" || status === "confirmed"; }
export function cateringWorkspaceRole(booking: { providerId: string; customerId: string }, userId: string): "provider" | "customer" | null { return booking.providerId === userId ? "provider" : booking.customerId === userId ? "customer" : null; }

export type CateringBookingDetailsView = { venueName: string | null; venueAddress: string | null; venueCity: string | null; venueState: string | null; venuePostalCode: string | null; venueInstructions: string | null; arrivalTime: string | null; serviceStartTime: string | null; serviceEndTime: string | null; setupNotes: string | null; accessNotes: string | null; kitchenAvailable: boolean | null; refrigerationAvailable: boolean | null; powerAvailable: boolean | null; waterAvailable: boolean | null; indoorOutdoor: "indoor" | "outdoor" | "both" | null; customerNotes: string | null; providerNotes?: string | null; updatedAt: string | null };
export type CateringBookingTaskView = { id: string; title: string; description: string | null; status: "pending" | "completed"; visibility: "provider" | "shared"; dueDate: string | null; dueTime: string | null; sortOrder: number; createdAt: string; completedAt: string | null; updatedAt: string };
export type CateringBookingActivityView = { id: string; eventType: typeof CATERING_BOOKING_ACTIVITY_EVENT_TYPES[number]; metadata: Record<string, string>; createdAt: string };
export type CateringBookingWorkspaceView = { role: "provider" | "customer"; editable: boolean; booking: CateringBookingView; details: CateringBookingDetailsView; tasks: CateringBookingTaskView[]; activity: CateringBookingActivityView[]; activityPagination: { page: number; limit: number; total: number; totalPages: number } };

export function cateringBookingWorkspacePath(role: "provider" | "customer", bookingId: string): string { return role === "provider" ? `/services/catering/provider/bookings/${bookingId}` : `/services/catering/bookings/${bookingId}`; }
export const cateringBookingWorkspaceKey = (userId: string, bookingId: string) => ["catering", "booking-workspace", userId, bookingId] as const;
