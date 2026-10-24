import { useCallback, useEffect, useState } from "react";
import { requestWeddingSubscription, type WeddingSubscription, type WeddingTier } from "./weddingSubscription";

export function useWeddingSubscription(userId?: string) {
  const [loaded, setLoaded] = useState<{ userId: string; subscription: WeddingSubscription }>();
  const [failure, setFailure] = useState<{ userId: string; message: string }>();
  const [attempt, setAttempt] = useState(0);
  const retrySubscription = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoaded(undefined);
    setFailure(undefined);
    if (userId) {
      requestWeddingSubscription().then((subscription) => {
        if (active) setLoaded({ userId, subscription });
      }).catch(() => {
        // Keep unknown entitlement hidden, but let this account retry without remounting.
        if (active) setFailure({ userId, message: "Unable to load your Wedding Planner plan. Please try again." });
      });
    }
    return () => { active = false; };
  }, [userId, attempt]);

  const selectPlan = useCallback(async (tier: WeddingTier) => {
    if (!userId) throw new Error("Please sign in to select a plan");
    const subscription = await requestWeddingSubscription(tier);
    setLoaded({ userId, subscription });
  }, [userId]);

  return {
    subscription: loaded?.userId === userId ? loaded?.subscription : undefined,
    subscriptionError: failure?.userId === userId ? failure?.message : undefined,
    retrySubscription,
    selectPlan,
  };
}
