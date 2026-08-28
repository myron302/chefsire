import { z } from "zod";

export const BOOKING_EDITABLE_STATUSES = ["pending_confirmation", "confirmed"] as const;
export const BOOKING_TERMINAL_STATUSES = ["cancelled", "completed"] as const;
export const CATERING_TASK_LIMIT = 100;
export const CATERING_ACTIVITY_DEFAULT_LIMIT = 25;
export const CATERING_ACTIVITY_MAX_LIMIT = 50;
export const wallClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour event-local time (HH:mm)");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const cateringBookingDetailsSchema = z.object({
  venueName: optionalText(160), venueAddress: optionalText(240), venueCity: optionalText(100), venueState: optionalText(100), venuePostalCode: optionalText(24), venueInstructions: optionalText(2000), arrivalTime: wallClockTimeSchema.nullable().optional(), serviceStartTime: wallClockTimeSchema.nullable().optional(), serviceEndTime: wallClockTimeSchema.nullable().optional(), setupNotes: optionalText(2000), accessNotes: optionalText(2000), kitchenAvailable: z.boolean().nullable().optional(), refrigerationAvailable: z.boolean().nullable().optional(), powerAvailable: z.boolean().nullable().optional(), waterAvailable: z.boolean().nullable().optional(), indoorOutdoor: z.enum(["indoor", "outdoor", "both"]).nullable().optional(), customerNotes: optionalText(2000), providerNotes: optionalText(4000),
}).strict();
export const cateringTaskCreateSchema = z.object({ title: z.string().trim().min(1).max(160), description: optionalText(2000), visibility: z.enum(["provider", "shared"]).default("provider"), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), dueTime: wallClockTimeSchema.nullable().optional() }).strict();
export const cateringTaskPatchSchema = cateringTaskCreateSchema.partial().extend({ status: z.enum(["pending", "completed"]).optional() }).strict();
export const cateringTaskReorderSchema = z.object({ taskIds: z.array(z.string().uuid()).min(1).max(CATERING_TASK_LIMIT) }).strict();
export function canEditBookingWorkspace(status: string) { return (BOOKING_EDITABLE_STATUSES as readonly string[]).includes(status); }
export function serializeBookingDetails(row: Record<string, unknown> | undefined, role: "provider" | "customer") { if (!row) return null; const { providerNotes: _private, ...shared } = row; return role === "provider" ? { ...shared, providerNotes: row.providerNotes ?? null } : shared; }
export function serializeBookingTask(row: Record<string, unknown>, role: "provider" | "customer") { if (role === "customer" && row.visibility !== "shared") return null; return { id: row.id, title: row.title, description: row.description, status: row.status, visibility: row.visibility, dueDate: row.dueDate, dueTime: row.dueTime, sortOrder: row.sortOrder, source: row.source, createdAt: row.createdAt, completedAt: row.completedAt, updatedAt: row.updatedAt }; }
