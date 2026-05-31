import { useCallback } from "react";

type ToastFn = (options: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

type UsePlannerShareActionsArgs = {
  weeklyShareSummaryText: string;
  weekLabel: string;
  publicShareUrl: string;
  toast: ToastFn;
};

export const usePlannerShareActions = ({
  weeklyShareSummaryText,
  weekLabel,
  publicShareUrl,
  toast,
}: UsePlannerShareActionsArgs) => {
  const copyWeeklyShareSummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(weeklyShareSummaryText);
      toast({
        description: "✅ Weekly plan share summary copied to clipboard.",
      });
    } catch (error) {
      console.error("Error copying weekly share summary:", error);
      toast({
        variant: "destructive",
        description: "Unable to copy summary right now.",
      });
    }
  }, [toast, weeklyShareSummaryText]);

  const shareWeeklySummary = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function"
    ) {
      await copyWeeklyShareSummary();
      return;
    }

    try {
      await navigator.share({
        title: `Meal plan summary • ${weekLabel}`,
        text: weeklyShareSummaryText,
      });
      toast({ description: "Shared weekly meal plan summary." });
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error sharing weekly summary:", error);
        await copyWeeklyShareSummary();
      }
    }
  }, [copyWeeklyShareSummary, toast, weekLabel, weeklyShareSummaryText]);

  const copyWeeklyPublicShareLink = useCallback(async () => {
    if (!publicShareUrl) {
      toast({
        variant: "destructive",
        description:
          "Public share link is still preparing. Try again in a moment.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      toast({
        description: "✅ Public weekly share link copied to clipboard.",
      });
    } catch (error) {
      console.error("Error copying weekly public share link:", error);
      toast({
        variant: "destructive",
        description: "Unable to copy the public share link right now.",
      });
    }
  }, [publicShareUrl, toast]);

  return {
    copyWeeklyShareSummary,
    shareWeeklySummary,
    copyWeeklyPublicShareLink,
  };
};
