export type WeddingTier = "free" | "premium" | "elite";
export type WeddingSubscription = {
  currentTier: WeddingTier;
  status: string;
  onboardingCompleted: boolean;
  endsAt?: string | null;
  trial?: {
    eligible: boolean;
    status: "eligible" | "active" | "expired" | "cancelled";
    tier: "premium" | "elite" | null;
    activatedAt: string | null;
    expiresAt: string | null;
    remainingDays: number;
  };
};

export class WeddingSubscriptionError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

// Both reads and writes use the authenticated Wedding entitlement, never marketplace state.
export async function requestWeddingSubscription(tier?: WeddingTier): Promise<WeddingSubscription> {
  const response = await fetch(`/api/wedding/subscription${tier ? tier === "free" ? "/change" : "/trial" : ""}`, {
    credentials: "include",
    ...(tier ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    } : {}),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) {
    throw new WeddingSubscriptionError(data.error || "Unable to load Wedding Planner subscription", data.code);
  }
  return data;
}
