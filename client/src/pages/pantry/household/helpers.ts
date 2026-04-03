import type { DuplicateDecision, DuplicatePair, HouseholdInfo } from "./types";

export const HOUSEHOLD_QUERY_KEY = ["/api/pantry/household"] as const;
export const HOUSEHOLD_INVITES_QUERY_KEY = ["/api/pantry/household/invites"] as const;
export const PANTRY_ITEMS_QUERY_KEY = ["/api/pantry/items"] as const;
export const HOUSEHOLD_REFETCH_INTERVAL_MS = 30000;

export function buildInitialDuplicateDecisions(duplicates: DuplicatePair[]): Record<string, DuplicateDecision> {
  const initial: Record<string, DuplicateDecision> = {};
  for (const duplicate of duplicates) {
    initial[duplicate.incoming.id] = "merge";
  }
  return initial;
}

export function buildResolveDuplicatesDecisions(
  duplicates: DuplicatePair[],
  decisions: Record<string, DuplicateDecision>,
) {
  return duplicates.map((duplicate) => ({
    incomingId: duplicate.incoming.id,
    existingId: duplicate.existing.id,
    action: decisions[duplicate.incoming.id] || "merge",
  }));
}

export function canManageHousehold(householdInfo: HouseholdInfo | undefined) {
  return householdInfo?.userRole === "owner" || householdInfo?.userRole === "admin";
}
