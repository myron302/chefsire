export type FixItIssueType =
  | "missing-meals"
  | "low-protein"
  | "missing-details"
  | "calorie-balance";

export type ActiveFixItTarget = {
  issueType: FixItIssueType;
  targetDay: string | null;
  targetDate: string | null;
  reason: string;
  suggestedNextStep: string;
};

export type FixItDetailsQueueSkipReasonId =
  | "protein-unknown"
  | "label-unavailable"
  | "add-later"
  | "not-needed-today";

export type FixItDetailsQueueSnoozeOptionId =
  | "later-today"
  | "tomorrow"
  | "next-week";

export type FixItSlotRecommendation = {
  key: string;
  text: string;
  cta: string;
  onClick: () => void;
};

export const FIX_IT_DETAILS_QUEUE_SKIP_REASONS: Array<{
  id: FixItDetailsQueueSkipReasonId;
  label: string;
}> = [
  { id: "protein-unknown", label: "Don't know protein yet" },
  { id: "label-unavailable", label: "Label unavailable" },
  { id: "add-later", label: "Will add later" },
  { id: "not-needed-today", label: "Not needed today" },
];

export const DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON: FixItDetailsQueueSkipReasonId =
  "add-later";

export const FIX_IT_DETAILS_QUEUE_SNOOZE_OPTIONS: Array<{
  id: FixItDetailsQueueSnoozeOptionId;
  label: string;
}> = [
  { id: "later-today", label: "Later today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "next-week", label: "Next week" },
];
