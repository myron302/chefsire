import { useCallback } from "react";
import type { PrepSessionState } from "@/components/meal-planner/sections/PrepTabSection";
import {
  formatLocalDate,
  parseDateOnly,
} from "@/components/meal-planner/nutritionMealPlannerUtils";
import { GROCERY_LINKED_PREP_BLOCKER_IDS } from "@/components/meal-planner/tab-domains/prepTabDomain";

type ToastFn = (options: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

type UsePlannerPrepActionsArgs = {
  prepSession: PrepSessionState;
  setPrepSession: React.Dispatch<React.SetStateAction<PrepSessionState>>;
  getCurrentWeekAnchor: () => string;
  getPrepSessionStorageKeyForAnchor: (anchorDate: string) => string;
  normalizePrepSession: (session: any) => PrepSessionState;
  toast: ToastFn;
};

export const usePlannerPrepActions = ({
  prepSession,
  setPrepSession,
  getCurrentWeekAnchor,
  getPrepSessionStorageKeyForAnchor,
  normalizePrepSession,
  toast,
}: UsePlannerPrepActionsArgs) => {
  const updatePrepSchedule = useCallback(
    (value: string) => {
      setPrepSession((prev) => ({
        ...prev,
        scheduledAt: value,
        completedAt: value ? prev.completedAt : null,
      }));
    },
    [setPrepSession],
  );

  const updatePrepNotes = useCallback(
    (value: string) => {
      setPrepSession((prev) => ({ ...prev, notes: value }));
    },
    [setPrepSession],
  );

  const togglePrepTask = useCallback(
    (taskId: string) => {
      setPrepSession((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task,
        ),
        carryoverTaskIds: prev.tasks.find((task) => task.id === taskId)?.done
          ? Array.from(new Set([...prev.carryoverTaskIds, taskId]))
          : prev.carryoverTaskIds.filter((id) => id !== taskId),
        completedAt: prev.completedAt,
      }));
    },
    [setPrepSession],
  );

  const togglePrepBlocker = useCallback(
    (blockerId: string) => {
      setPrepSession((prev) => ({
        ...prev,
        blockers: prev.blockers.map((blocker) =>
          blocker.id === blockerId
            ? { ...blocker, active: !blocker.active }
            : blocker,
        ),
        completedAt: null,
      }));
    },
    [setPrepSession],
  );

  const updatePrepBlockerNote = useCallback(
    (value: string) => {
      setPrepSession((prev) => ({ ...prev, blockerNote: value }));
    },
    [setPrepSession],
  );

  const resolvePrepGroceryBlockers = useCallback(() => {
    setPrepSession((prev) => ({
      ...prev,
      blockers: prev.blockers.map((blocker) =>
        GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id)
          ? { ...blocker, active: false }
          : blocker,
      ),
      completedAt: null,
    }));
  }, [setPrepSession]);

  const resolvePrepBlockersFromTrackedSuggestions = useCallback(() => {
    setPrepSession((prev) => {
      const hasActiveLinkedBlocker = prev.blockers.some(
        (blocker) =>
          blocker.active &&
          GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
      );
      if (!hasActiveLinkedBlocker) return prev;
      return {
        ...prev,
        blockers: prev.blockers.map((blocker) =>
          GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id)
            ? { ...blocker, active: false }
            : blocker,
        ),
        completedAt: null,
      };
    });
    toast({
      description:
        "Resolved grocery-linked prep blockers from completed blocker suggestions.",
    });
  }, [setPrepSession, toast]);

  const carryForwardUnfinishedPrepTasks = useCallback(() => {
    const unfinishedTaskIds = prepSession.tasks
      .filter((task) => !task.done)
      .map((task) => task.id);
    if (unfinishedTaskIds.length === 0) {
      toast({ description: "No unfinished prep tasks to carry forward." });
      return;
    }

    const nextWeekDate = parseDateOnly(getCurrentWeekAnchor());
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekAnchor = formatLocalDate(nextWeekDate);

    try {
      const nextWeekStorageKey =
        getPrepSessionStorageKeyForAnchor(nextWeekAnchor);
      const stored = localStorage.getItem(nextWeekStorageKey);
      const parsed = stored ? JSON.parse(stored) : {};
      const nextWeekSession = normalizePrepSession(parsed);
      const mergedCarryoverIds = Array.from(
        new Set([...nextWeekSession.carryoverTaskIds, ...unfinishedTaskIds]),
      );
      localStorage.setItem(
        nextWeekStorageKey,
        JSON.stringify({
          ...nextWeekSession,
          carryoverTaskIds: mergedCarryoverIds,
        }),
      );
      setPrepSession((prev) => ({
        ...prev,
        carryoverTaskIds: Array.from(
          new Set([...prev.carryoverTaskIds, ...unfinishedTaskIds]),
        ),
      }));
      toast({
        description: `Carried ${unfinishedTaskIds.length} unfinished prep tasks to next week.`,
      });
    } catch (error) {
      console.error("Error carrying prep tasks forward:", error);
      toast({
        variant: "destructive",
        description: "Unable to carry forward prep tasks right now.",
      });
    }
  }, [
    getCurrentWeekAnchor,
    getPrepSessionStorageKeyForAnchor,
    normalizePrepSession,
    prepSession.tasks,
    setPrepSession,
    toast,
  ]);

  const markPrepComplete = useCallback(() => {
    setPrepSession((prev) => ({
      ...prev,
      completedAt: formatLocalDate(new Date()),
    }));
    toast({
      description:
        "Prep session marked complete. Your readiness checklist is now execution-aware.",
    });
  }, [setPrepSession, toast]);

  const resetPrepCompletion = useCallback(() => {
    setPrepSession((prev) => ({ ...prev, completedAt: null }));
  }, [setPrepSession]);

  const toggleGeneratedPrepTask = useCallback(
    (taskId: string) => {
      setPrepSession((prev) => ({
        ...prev,
        generatedPrepTaskCompletions: {
          ...(prev.generatedPrepTaskCompletions || {}),
          [taskId]: !prev.generatedPrepTaskCompletions?.[taskId],
        },
      }));
    },
    [setPrepSession],
  );

  return {
    updatePrepSchedule,
    updatePrepNotes,
    togglePrepTask,
    togglePrepBlocker,
    updatePrepBlockerNote,
    resolvePrepGroceryBlockers,
    resolvePrepBlockersFromTrackedSuggestions,
    carryForwardUnfinishedPrepTasks,
    markPrepComplete,
    resetPrepCompletion,
    toggleGeneratedPrepTask,
  };
};
