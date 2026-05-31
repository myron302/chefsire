import { useCallback } from "react";
import { buildTemplateSlotDiff } from "@/components/meal-planner/nutritionMealPlannerUtils";

export type TemplateMergeMode = "replace" | "append";
export type TemplateBridgePayload = {
  templateName: string;
  targetWeekStart?: string;
  source?: string;
  requestedAt?: string;
  mergeMode?: TemplateMergeMode;
};
export type PendingTemplateBridgePreview = TemplateBridgePayload & {
  templateMeals: Record<string, any>;
  mergeMode: TemplateMergeMode;
};
export type RecentPinnedTemplateUsage = {
  templateName: string;
  lastUsedAt: string;
  mergeMode: TemplateMergeMode;
  lastAppliedSummary?: string;
  appliedMealCount?: number;
  addedMealCount?: number;
  targetWeekStart?: string;
};

type ToastFn = (options: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

export type RecentPinnedTemplateApplyResult = {
  appliedMealCount?: number;
  addedMealCount?: number;
  targetWeekStart?: string;
  lastAppliedSummary?: string;
};

type UsePlannerTemplateActionsArgs = {
  weeklyMeals: Record<string, any>;
  setWeeklyMeals: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setShowLoadTemplateModal: (open: boolean) => void;
  selectedDate: string;
  pendingTemplateBridgePreview: PendingTemplateBridgePreview | null;
  setPendingTemplateBridgePreview: React.Dispatch<
    React.SetStateAction<PendingTemplateBridgePreview | null>
  >;
  setTemplateBridgeRequest: React.Dispatch<
    React.SetStateAction<TemplateBridgePayload | null>
  >;
  setRecentPinnedTemplates: React.Dispatch<
    React.SetStateAction<RecentPinnedTemplateUsage[]>
  >;
  getCurrentWeekAnchor: () => string;
  getTemplateMergePreference: (templateName: string) => TemplateMergeMode;
  setTemplateMergePreference: (
    templateName: string,
    mergeMode: TemplateMergeMode,
  ) => void;
  refreshRecentPinnedTemplates: () => void;
  countMealEntries: (
    weekMeals: Record<string, any> | null | undefined,
  ) => number;
  estimateAppendAddedMeals: (
    currentMeals: Record<string, any>,
    templateMeals: Record<string, any>,
  ) => number;
  applyTemplateMeals: (
    currentWeek: Record<string, any>,
    templateWeek: Record<string, any>,
    mergeMode: TemplateMergeMode,
  ) => Record<string, any>;
  recordRecentPinnedTemplateUse: (
    templateName: string,
    mergeMode?: TemplateMergeMode,
    result?: RecentPinnedTemplateApplyResult,
  ) => void;
  pendingTemplateMealsCount: number;
  pendingTemplateAppendAddedMeals: number;
  recentPinnedTemplateStorageKey: string;
  toast: ToastFn;
};

export const usePlannerTemplateActions = ({
  weeklyMeals,
  setWeeklyMeals,
  setShowLoadTemplateModal,
  selectedDate,
  pendingTemplateBridgePreview,
  setPendingTemplateBridgePreview,
  setTemplateBridgeRequest,
  setRecentPinnedTemplates,
  getCurrentWeekAnchor,
  getTemplateMergePreference,
  setTemplateMergePreference,
  refreshRecentPinnedTemplates,
  countMealEntries,
  estimateAppendAddedMeals,
  applyTemplateMeals,
  recordRecentPinnedTemplateUse,
  pendingTemplateMealsCount,
  pendingTemplateAppendAddedMeals,
  recentPinnedTemplateStorageKey,
  toast,
}: UsePlannerTemplateActionsArgs) => {
  const saveTemplate = useCallback(() => {
    const templateName = prompt("Enter a name for this meal plan template:");
    if (templateName) {
      localStorage.setItem(
        `meal-template-${templateName}`,
        JSON.stringify(weeklyMeals),
      );
      toast({
        description: `✅ Template "${templateName}" saved successfully!`,
      });
    }
  }, [toast, weeklyMeals]);

  const loadTemplate = useCallback(
    (templateName: string, mergeMode: TemplateMergeMode = "replace") => {
      const saved = localStorage.getItem(`meal-template-${templateName}`);
      if (saved) {
        try {
          const parsedTemplateMeals = JSON.parse(saved);
          if (!parsedTemplateMeals || typeof parsedTemplateMeals !== "object")
            throw new Error("Invalid template payload");
          const appliedMealCount = countMealEntries(parsedTemplateMeals);
          const addedMealCount =
            mergeMode === "append"
              ? estimateAppendAddedMeals(weeklyMeals, parsedTemplateMeals)
              : undefined;
          const nextWeeklyMeals = applyTemplateMeals(
            weeklyMeals,
            parsedTemplateMeals,
            mergeMode,
          );
          setWeeklyMeals(nextWeeklyMeals);
          setTemplateMergePreference(templateName, mergeMode);
          recordRecentPinnedTemplateUse(templateName, mergeMode, {
            appliedMealCount,
            addedMealCount,
            targetWeekStart: getCurrentWeekAnchor(),
          });
          toast({
            description:
              mergeMode === "append"
                ? `✅ Template "${templateName}" appended into open planner slots!`
                : `✅ Template "${templateName}" loaded successfully!`,
          });
          setShowLoadTemplateModal(false);
        } catch (error) {
          console.error("Error loading template from localStorage:", error);
          toast({
            variant: "destructive",
            description: `Template "${templateName}" is invalid or outdated. Re-save it and try again.`,
          });
        }
      }
    },
    [
      countMealEntries,
      estimateAppendAddedMeals,
      getCurrentWeekAnchor,
      recordRecentPinnedTemplateUse,
      setShowLoadTemplateModal,
      setTemplateMergePreference,
      setWeeklyMeals,
      toast,
      weeklyMeals,
    ],
  );

  const handleLoadTemplate = useCallback(() => {
    setShowLoadTemplateModal(true);
  }, [setShowLoadTemplateModal]);

  const handleApplyPendingTemplateBridge = useCallback(() => {
    if (!pendingTemplateBridgePreview) return;
    const nextWeeklyMeals = applyTemplateMeals(
      weeklyMeals,
      pendingTemplateBridgePreview.templateMeals,
      pendingTemplateBridgePreview.mergeMode,
    );
    setWeeklyMeals(nextWeeklyMeals);
    setTemplateMergePreference(
      pendingTemplateBridgePreview.templateName,
      pendingTemplateBridgePreview.mergeMode,
    );
    recordRecentPinnedTemplateUse(
      pendingTemplateBridgePreview.templateName,
      pendingTemplateBridgePreview.mergeMode,
      {
        appliedMealCount: pendingTemplateMealsCount,
        addedMealCount:
          pendingTemplateBridgePreview.mergeMode === "append"
            ? pendingTemplateAppendAddedMeals
            : undefined,
        targetWeekStart:
          pendingTemplateBridgePreview.targetWeekStart || selectedDate,
      },
    );
    toast({
      title: "Template applied",
      description:
        pendingTemplateBridgePreview.mergeMode === "append"
          ? `Appended "${pendingTemplateBridgePreview.templateName}" into open slots for week ${pendingTemplateBridgePreview.targetWeekStart || selectedDate}.`
          : `Loaded "${pendingTemplateBridgePreview.templateName}" into week ${pendingTemplateBridgePreview.targetWeekStart || selectedDate}.`,
    });
    localStorage.removeItem("meal-planner-template-bridge-v1");
    setTemplateBridgeRequest(null);
    setPendingTemplateBridgePreview(null);
  }, [
    applyTemplateMeals,
    pendingTemplateAppendAddedMeals,
    pendingTemplateBridgePreview,
    pendingTemplateMealsCount,
    recordRecentPinnedTemplateUse,
    selectedDate,
    setPendingTemplateBridgePreview,
    setTemplateBridgeRequest,
    setTemplateMergePreference,
    setWeeklyMeals,
    toast,
    weeklyMeals,
  ]);

  const handleCancelPendingTemplateBridge = useCallback(() => {
    if (!pendingTemplateBridgePreview) return;
    toast({
      description: `Cancelled applying "${pendingTemplateBridgePreview.templateName}".`,
    });
    localStorage.removeItem("meal-planner-template-bridge-v1");
    setTemplateBridgeRequest(null);
    setPendingTemplateBridgePreview(null);
  }, [
    pendingTemplateBridgePreview,
    setPendingTemplateBridgePreview,
    setTemplateBridgeRequest,
    toast,
  ]);

  const handleUseRecentPinnedTemplate = useCallback(
    (templateName: string) => {
      const saved = localStorage.getItem(`meal-template-${templateName}`);
      if (!saved) {
        toast({
          variant: "destructive",
          description: `Template "${templateName}" is no longer available.`,
        });
        refreshRecentPinnedTemplates();
        return;
      }
      const request: TemplateBridgePayload = {
        templateName,
        targetWeekStart: getCurrentWeekAnchor(),
        source: "planner-recent-pinned-strip",
        requestedAt: new Date().toISOString(),
        mergeMode: getTemplateMergePreference(templateName),
      };
      localStorage.setItem(
        "meal-planner-template-bridge-v1",
        JSON.stringify(request),
      );
      setTemplateBridgeRequest(request);
    },
    [
      getCurrentWeekAnchor,
      getTemplateMergePreference,
      refreshRecentPinnedTemplates,
      setTemplateBridgeRequest,
      toast,
    ],
  );

  const handleChangeRecentPinnedTemplateMergePreference = useCallback(
    (templateName: string, mergeMode: TemplateMergeMode) => {
      setTemplateMergePreference(templateName, mergeMode);
      setRecentPinnedTemplates((prev) => {
        const nextItems = prev.map((item) =>
          item.templateName === templateName ? { ...item, mergeMode } : item,
        );
        localStorage.setItem(
          recentPinnedTemplateStorageKey,
          JSON.stringify(nextItems),
        );
        return nextItems;
      });
    },
    [
      recentPinnedTemplateStorageKey,
      setRecentPinnedTemplates,
      setTemplateMergePreference,
    ],
  );

  return {
    saveTemplate,
    loadTemplate,
    handleLoadTemplate,
    handleApplyPendingTemplateBridge,
    handleCancelPendingTemplateBridge,
    handleUseRecentPinnedTemplate,
    handleChangeRecentPinnedTemplateMergePreference,
    buildTemplateSlotDiff,
  };
};
