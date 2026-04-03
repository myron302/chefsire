import { Dispatch, SetStateAction, useEffect, useRef } from "react";

import {
  DEFAULT_BUDGET_ALLOCATIONS,
  DEFAULT_PLANNING_TASKS,
  DEFAULT_REGISTRY_LINKS,
  BudgetAllocation,
  normalizeBudgetAllocations,
  normalizeRegistryLinks,
  PlanningInsightAction,
  PlanningInsightTip,
  PlanningTask,
  RegistryLink,
} from "@/pages/services/lib/wedding-planning-core";

interface PlanningTasksPersistenceOptions {
  userId?: number | string | null;
  planningTasks: PlanningTask[];
  hasLoadedPlanningTasks: boolean;
  setPlanningTasks: Dispatch<SetStateAction<PlanningTask[]>>;
  setHasLoadedPlanningTasks: Dispatch<SetStateAction<boolean>>;
}

export function usePlanningTasksPersistence({
  userId,
  planningTasks,
  hasLoadedPlanningTasks,
  setPlanningTasks,
  setHasLoadedPlanningTasks,
}: PlanningTasksPersistenceOptions) {
  const savePlanningTasksTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlanningTasks = async () => {
      setHasLoadedPlanningTasks(false);
      if (!userId) {
        if (!cancelled) {
          setPlanningTasks(DEFAULT_PLANNING_TASKS);
          setHasLoadedPlanningTasks(true);
        }
        return;
      }

      try {
        const resp = await fetch("/api/wedding/planning-tasks", { credentials: "include" });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.ok && Array.isArray(data.tasks) && data.tasks.length > 0) {
            if (!cancelled) {
              setPlanningTasks(data.tasks);
              setHasLoadedPlanningTasks(true);
            }
            return;
          }
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to fetch planning tasks from DB:", error);
      }

      if (!cancelled) {
        setPlanningTasks(DEFAULT_PLANNING_TASKS);
        setHasLoadedPlanningTasks(true);
      }
    };

    loadPlanningTasks();

    return () => {
      cancelled = true;
    };
  }, [userId, setHasLoadedPlanningTasks, setPlanningTasks]);

  useEffect(() => {
    if (!hasLoadedPlanningTasks) return;
    if (!userId) return;

    if (savePlanningTasksTimeoutRef.current) {
      window.clearTimeout(savePlanningTasksTimeoutRef.current);
    }

    savePlanningTasksTimeoutRef.current = window.setTimeout(async () => {
      try {
        await fetch("/api/wedding/planning-tasks", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: planningTasks }),
        });
      } catch (error) {
        console.error("[Wedding Planning] Failed to save planning tasks to DB:", error);
      }
    }, 400);
  }, [planningTasks, userId, hasLoadedPlanningTasks]);
}

interface BudgetSettingsPersistenceOptions {
  userId?: number | string | null;
  budgetRange: number[];
  guestCount: number[];
  budgetAllocations: BudgetAllocation[];
  hasLoadedBudgetSettings: boolean;
  setBudgetRange: Dispatch<SetStateAction<number[]>>;
  setGuestCount: Dispatch<SetStateAction<number[]>>;
  setBudgetAllocations: Dispatch<SetStateAction<BudgetAllocation[]>>;
  setHasLoadedBudgetSettings: Dispatch<SetStateAction<boolean>>;
}

export function useBudgetSettingsPersistence({
  userId,
  budgetRange,
  guestCount,
  budgetAllocations,
  hasLoadedBudgetSettings,
  setBudgetRange,
  setGuestCount,
  setBudgetAllocations,
  setHasLoadedBudgetSettings,
}: BudgetSettingsPersistenceOptions) {
  useEffect(() => {
    let cancelled = false;

    const loadBudgetSettings = async () => {
      setHasLoadedBudgetSettings(false);
      if (!userId) {
        if (!cancelled) {
          setBudgetRange([5000, 50000]);
          setGuestCount([100]);
          setBudgetAllocations(DEFAULT_BUDGET_ALLOCATIONS);
          setHasLoadedBudgetSettings(true);
        }
        return;
      }

      try {
        const response = await fetch("/api/wedding/budget-settings", { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          const settings = data?.settings;
          if (settings && !cancelled) {
            setBudgetRange([
              Math.max(5000, Math.min(100000, Math.round(Number(settings.budgetMin) || 5000))),
              Math.max(5000, Math.min(100000, Math.round(Number(settings.budgetMax) || 50000))),
            ]);
            setGuestCount([Math.max(1, Math.min(2000, Math.round(Number(settings.guestCount) || 100)))]);
            setBudgetAllocations(normalizeBudgetAllocations(settings.allocations));
          }
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to fetch budget settings:", error);
      }

      if (!cancelled) setHasLoadedBudgetSettings(true);
    };

    loadBudgetSettings();

    return () => {
      cancelled = true;
    };
  }, [userId, setBudgetAllocations, setBudgetRange, setGuestCount, setHasLoadedBudgetSettings]);

  useEffect(() => {
    if (!hasLoadedBudgetSettings) return;
    if (!userId) return;

    const [budgetMin, budgetMax] = budgetRange;
    const payload = {
      budgetMin,
      budgetMax,
      guestCount: guestCount[0],
      allocations: budgetAllocations.map((a) => ({ key: a.key, label: a.category, percentage: a.percentage })),
    };

    const timeout = window.setTimeout(async () => {
      try {
        await fetch("/api/wedding/budget-settings", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("[Wedding Planning] Failed to save budget settings:", error);
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [budgetRange, guestCount, budgetAllocations, userId, hasLoadedBudgetSettings]);
}

interface RegistryLinksPersistenceOptions {
  userId?: number | string | null;
  registryLinks: RegistryLink[];
  hasLoadedRegistryLinks: boolean;
  isEditingRegistryLinks: boolean;
  setRegistryLinks: Dispatch<SetStateAction<RegistryLink[]>>;
  setRegistryDraft: Dispatch<SetStateAction<RegistryLink[]>>;
  setHasLoadedRegistryLinks: Dispatch<SetStateAction<boolean>>;
}

export function useRegistryLinksPersistence({
  userId,
  registryLinks,
  hasLoadedRegistryLinks,
  isEditingRegistryLinks,
  setRegistryLinks,
  setRegistryDraft,
  setHasLoadedRegistryLinks,
}: RegistryLinksPersistenceOptions) {
  useEffect(() => {
    let cancelled = false;

    const loadRegistryLinks = async () => {
      setHasLoadedRegistryLinks(false);

      if (!userId) {
        if (!cancelled) {
          setRegistryLinks(DEFAULT_REGISTRY_LINKS);
          setRegistryDraft(DEFAULT_REGISTRY_LINKS);
          setHasLoadedRegistryLinks(true);
        }
        return;
      }

      try {
        const response = await fetch("/api/wedding/registry-links", { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          const fromServer =
            data?.ok && Array.isArray(data.registryLinks) ? normalizeRegistryLinks(data.registryLinks) : null;

          if (!cancelled) {
            if (fromServer && fromServer.length > 0) {
              setRegistryLinks(fromServer);
              setRegistryDraft(fromServer);
            } else {
              setRegistryLinks(DEFAULT_REGISTRY_LINKS);
              setRegistryDraft(DEFAULT_REGISTRY_LINKS);
            }
          }
        } else if (!cancelled) {
          setRegistryLinks(DEFAULT_REGISTRY_LINKS);
          setRegistryDraft(DEFAULT_REGISTRY_LINKS);
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to load registry links:", error);
        if (!cancelled) {
          setRegistryLinks(DEFAULT_REGISTRY_LINKS);
          setRegistryDraft(DEFAULT_REGISTRY_LINKS);
        }
      } finally {
        if (!cancelled) setHasLoadedRegistryLinks(true);
      }
    };

    loadRegistryLinks();

    return () => {
      cancelled = true;
    };
  }, [userId, setHasLoadedRegistryLinks, setRegistryDraft, setRegistryLinks]);

  useEffect(() => {
    if (!hasLoadedRegistryLinks) return;
    if (!isEditingRegistryLinks) {
      setRegistryDraft(registryLinks);
    }
  }, [registryLinks, hasLoadedRegistryLinks, isEditingRegistryLinks, setRegistryDraft]);
}

interface InsightsPersistenceOptions {
  userId?: number | string | null;
  customTips: PlanningInsightTip[];
  customActions: PlanningInsightAction[];
  hasLoadedInsights: boolean;
  setCustomTips: Dispatch<SetStateAction<PlanningInsightTip[]>>;
  setCustomActions: Dispatch<SetStateAction<PlanningInsightAction[]>>;
  setHasLoadedInsights: Dispatch<SetStateAction<boolean>>;
}

export function useInsightsPersistence({
  userId,
  customTips,
  customActions,
  hasLoadedInsights,
  setCustomTips,
  setCustomActions,
  setHasLoadedInsights,
}: InsightsPersistenceOptions) {
  useEffect(() => {
    if (!userId) {
      setHasLoadedInsights(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/wedding/insights", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load insights");
        const data = await res.json();

        const tips = Array.isArray(data?.tips) ? (data.tips as PlanningInsightTip[]) : [];
        const actions = Array.isArray(data?.actions) ? (data.actions as PlanningInsightAction[]) : [];

        if (!cancelled) {
          setCustomTips(
            tips
              .filter((t) => t && typeof t.id === "string" && typeof t.title === "string" && typeof t.detail === "string")
              .slice(0, 25)
          );
          setCustomActions(
            actions
              .filter((a) => a && typeof a.id === "string" && typeof a.label === "string")
              .map((a) => ({ ...a, done: !!(a as any).done }))
              .slice(0, 25)
          );
        }
      } catch {
        if (!cancelled) {
          setCustomTips([]);
          setCustomActions([]);
        }
      } finally {
        if (!cancelled) setHasLoadedInsights(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, setCustomActions, setCustomTips, setHasLoadedInsights]);

  useEffect(() => {
    if (!userId || !hasLoadedInsights) return;

    const timeout = window.setTimeout(async () => {
      try {
        await fetch("/api/wedding/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tips: customTips, actions: customActions }),
        });
      } catch (e) {
        console.error("[Wedding Planning] save insights failed:", e);
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [customTips, customActions, userId, hasLoadedInsights]);
}
