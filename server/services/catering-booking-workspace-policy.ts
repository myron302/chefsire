import type { CateringBookingStatus } from "@shared/catering-bookings";
import { cateringWorkspaceRole, mayEditCateringWorkspace } from "@shared/catering-booking-operations";

export { cateringWorkspaceRole, mayEditCateringWorkspace };
export function mayMutateWorkspace(status: CateringBookingStatus, role: "provider" | "customer", resource: "provider-details" | "customer-notes" | "tasks"): boolean {
  if (!mayEditCateringWorkspace(status)) return false;
  return resource === "customer-notes" ? role === "customer" : role === "provider";
}

export function nextCateringTaskSortOrder(maxSortOrder: number | null): number {
  return maxSortOrder == null ? 0 : maxSortOrder + 1;
}

export function sharedTaskUpdateActivity(current: { title: string; visibility: string; status: string }, input: { title?: string; visibility?: string; status?: string }) {
  const visibility = input.visibility ?? current.visibility;
  if (visibility !== "shared") return null;
  return {
    eventType: input.status === "completed" && current.status !== "completed" ? "shared_requirement_completed" as const : "shared_requirement_updated" as const,
    taskTitle: input.title ?? current.title,
  };
}

export const CATERING_SHARED_DETAIL_FIELDS = ["venueName", "venueAddress", "venueCity", "venueState", "venuePostalCode", "venueInstructions", "arrivalTime", "serviceStartTime", "serviceEndTime", "setupNotes", "accessNotes", "kitchenAvailable", "refrigerationAvailable", "powerAvailable", "waterAvailable", "indoorOutdoor"] as const;
type CateringDetailComparison = Partial<Record<typeof CATERING_SHARED_DETAIL_FIELDS[number] | "providerNotes" | "customerNotes", unknown>>;

export function cateringDetailsActivityVisibility(existing: CateringDetailComparison | undefined, input: CateringDetailComparison, role: "provider" | "customer"): "shared" | "provider" | null {
  const previous = existing ?? {};
  if (role === "customer") return "customerNotes" in input && input.customerNotes !== (previous.customerNotes ?? null) ? "shared" : null;
  const sharedChanged = CATERING_SHARED_DETAIL_FIELDS.some((field) => field in input && input[field] !== (previous[field] ?? null));
  if (sharedChanged) return "shared";
  return "providerNotes" in input && input.providerNotes !== (previous.providerNotes ?? null) ? "provider" : null;
}
