import type { CateringBookingActivityView, CateringBookingDetailsView } from "@shared/catering-booking-operations";

export type OperationalDetailItem = { label: string; value: string };
export type WorkspaceFormState<T> = { identity: string; value: T; dirty: boolean };

export function hydrateWorkspaceForm<T>(state: WorkspaceFormState<T>, identity: string, serverValue: T): WorkspaceFormState<T> {
  if (state.identity !== identity) return { identity, value: serverValue, dirty: false };
  return state.dirty ? state : { identity, value: serverValue, dirty: false };
}
export function editWorkspaceForm<T>(state: WorkspaceFormState<T>, value: T): WorkspaceFormState<T> { return { ...state, value, dirty: true }; }
export function saveWorkspaceForm<T>(identity: string, serverValue: T): WorkspaceFormState<T> { return { identity, value: serverValue, dirty: false }; }

export function historicalOperationalDetails(details: CateringBookingDetailsView, role: "provider" | "customer"): OperationalDetailItem[] {
  const items: Array<OperationalDetailItem | null> = [
    details.venueName ? { label: "Venue", value: details.venueName } : null,
    details.venueAddress ? { label: "Address", value: details.venueAddress } : null,
    details.venueCity ? { label: "City", value: details.venueCity } : null,
    details.venueState ? { label: "State / region", value: details.venueState } : null,
    details.venuePostalCode ? { label: "Postal code", value: details.venuePostalCode } : null,
    details.venueInstructions ? { label: "Venue instructions", value: details.venueInstructions } : null,
    details.arrivalTime ? { label: "Arrival time", value: details.arrivalTime } : null,
    details.serviceStartTime ? { label: "Service start", value: details.serviceStartTime } : null,
    details.serviceEndTime ? { label: "Service end", value: details.serviceEndTime } : null,
    details.setupNotes ? { label: "Setup notes", value: details.setupNotes } : null,
    details.accessNotes ? { label: "Access notes", value: details.accessNotes } : null,
    details.kitchenAvailable == null ? null : { label: "Kitchen available", value: details.kitchenAvailable ? "Yes" : "No" },
    details.refrigerationAvailable == null ? null : { label: "Refrigeration available", value: details.refrigerationAvailable ? "Yes" : "No" },
    details.powerAvailable == null ? null : { label: "Power available", value: details.powerAvailable ? "Yes" : "No" },
    details.waterAvailable == null ? null : { label: "Water available", value: details.waterAvailable ? "Yes" : "No" },
    details.indoorOutdoor ? { label: "Setting", value: details.indoorOutdoor === "both" ? "Indoor and outdoor" : details.indoorOutdoor[0].toUpperCase() + details.indoorOutdoor.slice(1) } : null,
    role === "provider" && details.providerNotes ? { label: "Private provider notes", value: details.providerNotes } : null,
  ];
  return items.filter((item): item is OperationalDetailItem => item !== null);
}

export function combineCateringActivityPages(pages: Array<{ activity: CateringBookingActivityView[] }>): CateringBookingActivityView[] {
  const seen = new Set<string>();
  const combined: CateringBookingActivityView[] = [];
  for (const page of pages) for (const activity of page.activity) {
    if (seen.has(activity.id)) continue;
    seen.add(activity.id);
    combined.push(activity);
  }
  return combined;
}

export function nextCateringActivityPage(pagination: { page: number; totalPages: number }): number | undefined {
  return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
}
