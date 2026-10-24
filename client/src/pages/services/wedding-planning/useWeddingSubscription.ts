import { useCallback, useEffect, useState } from "react";
import { requestWeddingSubscription, type WeddingSubscription, type WeddingTier } from "./weddingSubscription";

export function useWeddingSubscription(userId?: string) {
  const [loaded, setLoaded] = useState<{ userId: string; subscription: WeddingSubscription }>();
  useEffect(() => {
    let active = true;
    setLoaded(undefined);
    if (userId) {
      requestWeddingSubscription().then((subscription) => {
        if (active) setLoaded({ userId, subscription });
      }).catch(() => {
        // Unknown state must never flash the onboarding popup.
      });
    }
    return () => { active = false; };
  }, [userId]);

  const selectPlan = useCallback(async (tier: WeddingTier) => {
    if (!userId) throw new Error("Please sign in to select a plan");
    const subscription = await requestWeddingSubscription(tier);
    setLoaded({ userId, subscription });
  }, [userId]);

  return { subscription: loaded?.userId === userId ? loaded?.subscription : undefined, selectPlan };
}
