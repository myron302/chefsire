import type { CateringBookingStatus } from "@shared/catering-bookings";
import { cateringWorkspaceRole, mayEditCateringWorkspace } from "@shared/catering-booking-operations";

export { cateringWorkspaceRole, mayEditCateringWorkspace };
export function mayMutateWorkspace(status: CateringBookingStatus, role: "provider" | "customer", resource: "provider-details" | "customer-notes" | "tasks"): boolean {
  if (!mayEditCateringWorkspace(status)) return false;
  return resource === "customer-notes" ? role === "customer" : role === "provider";
}
