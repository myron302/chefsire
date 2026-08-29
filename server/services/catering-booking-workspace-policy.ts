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
