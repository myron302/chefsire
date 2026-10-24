import { useCallback, useEffect, useRef, useState } from "react";
import { requestWeddingSubscription, type WeddingSubscription, type WeddingTier } from "./weddingSubscription";

export function useWeddingSubscription(userId?: string) {
  const [loaded, setLoaded] = useState<{ userId: string; subscription: WeddingSubscription }>();
  const [failure, setFailure] = useState<{ userId: string; message: string }>();
  const [attempt, setAttempt] = useState(0);
  const readPending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const account = useRef(userId);
  account.current = userId;
  const mutations = useRef(new Map<string, Promise<void>>());

  const retrySubscription = useCallback(() => {
    if (!userId || failure?.userId !== userId || readPending.current || mutations.current.has(userId)) return;
    readPending.current = true;
    setFailure(undefined);
    setAttempt((value) => value + 1);
  }, [userId, failure]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const requestGeneration = ++generation.current;
    setLoaded(undefined);
    setFailure(undefined);
    readPending.current = Boolean(userId);
    if (userId) {
      requestWeddingSubscription().then((subscription) => {
        if (active && account.current === userId && generation.current === requestGeneration) setLoaded({ userId, subscription });
      }).catch(() => {
        if (active && account.current === userId && generation.current === requestGeneration) setFailure({ userId, message: "Unable to load your Wedding Planner plan. Please try again." });
      }).finally(() => {
        if (active) readPending.current = false;
      });
    }
    return () => { active = false; mounted.current = false; generation.current += 1; };
  }, [userId, attempt]);

  const selectPlan = useCallback((tier: WeddingTier): Promise<void> => {
    if (!userId || account.current !== userId) return Promise.reject(new Error("Please sign in to select a plan"));
    const existing = mutations.current.get(userId);
    if (existing) return existing;
    const requestGeneration = ++generation.current;
    const pending: Promise<void> = requestWeddingSubscription(tier).then(async (subscription) => {
      if (!mounted.current || account.current !== userId) return;
      if (generation.current === requestGeneration) {
        setLoaded({ userId, subscription });
        return;
      }

      // The account returned while this shared write was pending. Its earlier
      // read may predate the write: reconcile once, without replaying the POST.
      const refreshGeneration = ++generation.current;
      setLoaded(undefined);
      setFailure(undefined);
      readPending.current = true;
      const isCurrent = () => mounted.current && account.current === userId && generation.current === refreshGeneration;
      try {
        const refreshed = await requestWeddingSubscription();
        if (!isCurrent()) throw new Error("Plan saved, but the active account changed. Please reload your Wedding Planner plan to confirm.");
        setLoaded({ userId, subscription: refreshed });
      } catch (error) {
        if (isCurrent()) setFailure({ userId, message: "Your plan was saved, but could not be reloaded. Please try again." });
        throw error;
      } finally {
        if (isCurrent()) readPending.current = false;
      }
    }).finally(() => {
      if (mutations.current.get(userId) === pending) mutations.current.delete(userId);
    });
    mutations.current.set(userId, pending);
    return pending;
  }, [userId]);

  const subscription = loaded?.userId === userId ? loaded?.subscription : undefined;
  const subscriptionError = failure?.userId === userId ? failure?.message : undefined;
  return {
    subscription,
    subscriptionError,
    subscriptionLoading: Boolean(userId && !subscription && !subscriptionError),
    retrySubscription,
    selectPlan,
  };
}
