export type WeddingTier = "free" | "premium" | "elite";
export type WeddingSubscription = {
  currentTier: WeddingTier;
  status: string;
  onboardingCompleted: boolean;
};

// Both reads and writes use the authenticated Wedding entitlement, never marketplace state.
export async function requestWeddingSubscription(tier?: WeddingTier): Promise<WeddingSubscription> {
  const response = await fetch(`/api/wedding/subscription${tier ? "/change" : ""}`, {
    credentials: "include",
    ...(tier ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    } : {}),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || "Unable to load Wedding Planner subscription");
  }
  return data;
}
