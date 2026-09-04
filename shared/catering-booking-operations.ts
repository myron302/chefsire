import { z } from "zod";
import type { CateringBookingStatus, CateringBookingView } from "./catering-bookings";
import { calendarDateSchema } from "./catering-availability";
import type { CateringBookingActivityEventType } from "./catering-booking-activity-events";

export const CATERING_BOOKING_TASK_LIMIT = 100;
export const CATERING_BOOKING_TASK_STATUSES = ["pending", "completed"] as const;
export const CATERING_BOOKING_TASK_VISIBILITIES = ["provider", "shared"] as const;
/**
 * The finite activity allowlist, re-exported from the one module the Drizzle CHECK constraint also derives from, so
 * the contract and the schema cannot drift apart. Phase 2I extends it with the four file events and nothing else:
 * messages form their own chronological thread and deliberately write no activity.
 */
export { CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "./catering-booking-activity-events";

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
/** A booking that went cancelled or completed between the request's status check and the locked transaction. */
/**
 * How often an OPEN booking workspace re-reads its own live sections, in milliseconds.
 *
 * Booking-linked threads are deliberately excluded from the generic DM socket -- that exclusion is what stops the
 * socket transport from bypassing booking participation, lifecycle and idempotency rules -- and booking files never
 * had a live channel at all. So neither section has a delivery mechanism other than asking again.
 * `refetchOnWindowFocus` only fires on a focus TRANSITION, and two participants sitting in their workspaces with
 * tabs focused never have one: each would sit on stale messages and a stale shared-file list indefinitely.
 *
 * Fifteen seconds is deliberately unhurried, and matches both queries' `staleTime` so a poll and the staleness
 * boundary agree rather than fight. It lives here, on the workspace contract both sections belong to, so the two
 * cadences cannot drift apart into two different policies.
 */
export const CATERING_WORKSPACE_POLL_MS = 15_000;

/**
 * The editable state a booking-scoped list endpoint reported, or undefined before any page has arrived.
 *
 * The workspace summary that renders these sections is fetched once and does not poll, so its `editable` flag goes
 * stale the moment the counterpart cancels the booking or the provider completes it. The section's OWN polled
 * endpoint knows better: it re-derives the flag from the persisted booking status on every request. Reading it is
 * what stops a section from presenting a terminal booking as still editable until a failed send, a refocus, or an
 * unrelated invalidation happens to reveal it.
 *
 * Any page reporting false makes the answer false. Pages are refetched together and terminal state is irreversible
 * server-side -- a cancelled or completed booking never becomes active again -- so a single false is authoritative
 * and cannot be contradicted by a stale sibling page. Nothing is inferred beyond what the endpoint said: with no
 * pages loaded the answer is undefined, not a guess.
 */
export function observedCateringEditable(pages: readonly { editable?: boolean }[] | undefined): boolean | undefined {
  if (!pages || pages.length === 0) return undefined;
  return !pages.some((page) => page.editable === false);
}

/**
 * The state a section acts on: what its own endpoint last said, falling back to the parent's prop only until the
 * endpoint has said anything at all.
 *
 * Because the authoritative answer wins outright rather than being combined, a stale parent `true` cannot re-enable
 * a section the endpoint has already reported terminal -- and when the parent workspace later refreshes it simply
 * converges on the same answer.
 */
export function effectiveCateringEditable(parentEditable: boolean, observed: boolean | undefined): boolean {
  return observed ?? parentEditable;
}

/**
 * The polling cadence for one workspace section, or `false` when it must not poll at all.
 *
 * A cancelled or completed booking is immutable: no message can be sent into it, no file uploaded or removed. Its
 * message list and file list are therefore settled, and re-asking every fifteen seconds forever would be pure
 * traffic for an answer that cannot change. `editable` is the parent workspace's own authoritative flag -- the same
 * one that renders the read-only banner and gates every mutation control -- so closure is never inferred a second
 * time here from a status string.
 *
 * Only the recurring poll stops. The query itself is untouched: a historical workspace still loads its messages and
 * files, still paginates, and still refetches on window focus, because reading never closes -- only writing does.
 */
export function cateringWorkspacePollInterval(editable: boolean): number | false {
  return editable ? CATERING_WORKSPACE_POLL_MS : false;
}

export const CATERING_WORKSPACE_READ_ONLY_CODE = "workspace_read_only";
/** A task that no longer exists in the authoritative locked collection, usually because another tab deleted it. */
export const CATERING_TASK_NOT_FOUND_CODE = "catering_task_not_found";
/**
 * The authoritative task collection gained or lost a task since the client loaded it, so a reorder that was composed
 * against the older collection is no longer the complete current set. Distinct from a version conflict: no submitted
 * task is stale, the membership itself changed, and the client needs the new collection rather than a newer version.
 */
export const CATERING_TASK_SET_CHANGED_CODE = "catering_task_set_changed";
export const cateringBookingTaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(), description: optionalText(2000), visibility: z.enum(CATERING_BOOKING_TASK_VISIBILITIES).optional(), dueDate: calendarDate.optional(), dueTime: wallClock.optional(), status: z.enum(CATERING_BOOKING_TASK_STATUSES).optional(),
  expectedUpdatedAt: cateringBookingTaskVersionSchema,
}).strict().refine((value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"), "At least one task field is required");
/** Deleting a task is a write like any other, so it carries the version of the task the provider confirmed deleting. */
export const cateringBookingTaskDeleteSchema = z.object({ expectedUpdatedAt: cateringBookingTaskVersionSchema }).strict();
/**
 * Reordering is a write against every task it moves, so each entry carries the version the client observed. The array
 * order is the requested sort order: a client-supplied sortOrder is never accepted, and `.strict()` rejects one.
 */
export const cateringBookingTaskReorderEntrySchema = z.object({ id: z.string().uuid(), expectedUpdatedAt: cateringBookingTaskVersionSchema }).strict();
export const cateringBookingTaskReorderSchema = z.object({ tasks: z.array(cateringBookingTaskReorderEntrySchema).min(1).max(CATERING_BOOKING_TASK_LIMIT) }).strict().refine((value) => new Set(value.tasks.map((task) => task.id)).size === value.tasks.length, "Task IDs must be unique");
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
export type CateringBookingActivityView = { id: string; eventType: CateringBookingActivityEventType; metadata: Record<string, string>; createdAt: string };
/**
 * Bounded Phase 2I summaries. Neither collection is inlined -- messages and files stay on their own paginated APIs --
 * and both counts are capped rather than run as unbounded totals. `activeFileCount` is counted per actor, so a
 * customer's summary never includes a provider-private file and cannot reveal that one exists.
 */
export type CateringBookingWorkspaceSummary = { unreadMessageCount: number; unreadMessageCountCapped: boolean; activeFileCount: number; activeFileCountCapped: boolean };
export type CateringBookingWorkspaceView = { role: "provider" | "customer"; editable: boolean; booking: CateringBookingView; details: CateringBookingDetailsView; tasks: CateringBookingTaskView[]; activity: CateringBookingActivityView[]; activityPagination: { page: number; limit: number; total: number; totalPages: number }; summary: CateringBookingWorkspaceSummary };

export function cateringBookingWorkspacePath(role: "provider" | "customer", bookingId: string): string { return role === "provider" ? `/services/catering/provider/bookings/${bookingId}` : `/services/catering/bookings/${bookingId}`; }
export const cateringBookingWorkspaceKey = (userId: string, bookingId: string) => ["catering", "booking-workspace", userId, bookingId] as const;
