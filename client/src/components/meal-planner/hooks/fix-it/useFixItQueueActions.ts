import { useCallback, useMemo } from "react";
import { formatMealTypeLabel } from "@/components/meal-planner/tab-domains/analyticsTabDomain";
import {
  DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
  FIX_IT_DETAILS_QUEUE_SKIP_REASONS,
  type ActiveFixItTarget,
  type FixItDetailsQueueSkipReasonId,
  type FixItDetailsQueueSnoozeOptionId,
} from "@/components/meal-planner/hooks/fix-it/types";

type UseFixItQueueActionsArgs = {
  activeFixItTarget: ActiveFixItTarget | null;
  fixItDetailsQueueSkippedKeys: string[];
  fixItDetailsQueueSkipReasonByKey: Record<
    string,
    FixItDetailsQueueSkipReasonId
  >;
  setFixItDetailsQueueSkippedKeys: React.Dispatch<
    React.SetStateAction<string[]>
  >;
  setFixItDetailsQueueSkipReasonByKey: React.Dispatch<
    React.SetStateAction<Record<string, FixItDetailsQueueSkipReasonId>>
  >;
  setFixItDetailsQueuePendingSkipReason: React.Dispatch<
    React.SetStateAction<FixItDetailsQueueSkipReasonId>
  >;
  setFixItDetailsQueueDone: React.Dispatch<React.SetStateAction<boolean>>;
  setFixItDetailsQueueSnoozedByKey: React.Dispatch<
    React.SetStateAction<Record<string, FixItDetailsQueueSnoozeOptionId>>
  >;
  focusPlannerDay: (day: string) => void;
  handleAddMeal: (day?: string, type?: string) => void;
};

export const useFixItQueueActions = ({
  activeFixItTarget,
  fixItDetailsQueueSkippedKeys,
  fixItDetailsQueueSkipReasonByKey,
  setFixItDetailsQueueSkippedKeys,
  setFixItDetailsQueueSkipReasonByKey,
  setFixItDetailsQueuePendingSkipReason,
  setFixItDetailsQueueDone,
  setFixItDetailsQueueSnoozedByKey,
  focusPlannerDay,
  handleAddMeal,
}: UseFixItQueueActionsArgs) => {
  const handleQueueCompleteDetails = useCallback(
    (mealType: string) => {
      if (!activeFixItTarget?.targetDay) return;
      focusPlannerDay(activeFixItTarget.targetDay);
      handleAddMeal(activeFixItTarget.targetDay, formatMealTypeLabel(mealType));
    },
    [activeFixItTarget?.targetDay, focusPlannerDay, handleAddMeal],
  );

  const handleQueueSkipCurrent = useCallback(
    (
      slotKey: string,
      reasonId: FixItDetailsQueueSkipReasonId = DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
    ) => {
      setFixItDetailsQueueSkippedKeys((prev) =>
        prev.includes(slotKey) ? prev : [...prev, slotKey],
      );
      setFixItDetailsQueueSkipReasonByKey((prev) => ({
        ...prev,
        [slotKey]: reasonId,
      }));
      setFixItDetailsQueueSnoozedByKey((prev) => {
        if (!prev[slotKey]) return prev;
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });
      setFixItDetailsQueuePendingSkipReason(
        DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
      );
    },
    [
      setFixItDetailsQueuePendingSkipReason,
      setFixItDetailsQueueSkipReasonByKey,
      setFixItDetailsQueueSkippedKeys,
      setFixItDetailsQueueSnoozedByKey,
    ],
  );

  const handleQueueSnoozeCurrent = useCallback(
    (slotKey: string, snoozeId: FixItDetailsQueueSnoozeOptionId) => {
      setFixItDetailsQueueSnoozedByKey((prev) => ({
        ...prev,
        [slotKey]: snoozeId,
      }));
      setFixItDetailsQueueSkippedKeys((prev) =>
        prev.filter((key) => key !== slotKey),
      );
      setFixItDetailsQueueSkipReasonByKey((prev) => {
        if (!prev[slotKey]) return prev;
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });
    },
    [
      setFixItDetailsQueueSkipReasonByKey,
      setFixItDetailsQueueSkippedKeys,
      setFixItDetailsQueueSnoozedByKey,
    ],
  );

  const handleQueueRevisitSnoozed = useCallback(() => {
    setFixItDetailsQueueSnoozedByKey({});
  }, [setFixItDetailsQueueSnoozedByKey]);

  const handleQueueRevisitSkipped = useCallback(() => {
    setFixItDetailsQueueSkippedKeys([]);
    setFixItDetailsQueueSkipReasonByKey({});
    setFixItDetailsQueuePendingSkipReason(
      DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
    );
    setFixItDetailsQueueDone(false);
  }, [
    setFixItDetailsQueueDone,
    setFixItDetailsQueuePendingSkipReason,
    setFixItDetailsQueueSkipReasonByKey,
    setFixItDetailsQueueSkippedKeys,
  ]);

  const activeFixItSkippedReasonSummary = useMemo(() => {
    if (fixItDetailsQueueSkippedKeys.length <= 0) return "";
    const counts = fixItDetailsQueueSkippedKeys.reduce(
      (acc, slotKey) => {
        const reasonId =
          fixItDetailsQueueSkipReasonByKey[slotKey] ??
          DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON;
        acc[reasonId] = (acc[reasonId] ?? 0) + 1;
        return acc;
      },
      {} as Record<FixItDetailsQueueSkipReasonId, number>,
    );
    return FIX_IT_DETAILS_QUEUE_SKIP_REASONS.filter(
      (reason) => counts[reason.id],
    )
      .map((reason) => `${reason.label} (${counts[reason.id]})`)
      .join(" • ");
  }, [fixItDetailsQueueSkipReasonByKey, fixItDetailsQueueSkippedKeys]);

  return {
    handleQueueCompleteDetails,
    handleQueueSkipCurrent,
    handleQueueSnoozeCurrent,
    handleQueueRevisitSnoozed,
    handleQueueRevisitSkipped,
    activeFixItSkippedReasonSummary,
  };
};
