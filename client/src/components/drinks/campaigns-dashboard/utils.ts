export function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function campaignGoalTypeLabel(value: CampaignGoalType) {
  return campaignGoalTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function rolloutModeLabel(value: CampaignRolloutMode) {
  switch (value) {
    case "followers_first":
      return "Followers first";
    case "members_first":
      return "Members first";
    case "staged":
      return "Staged rollout";
    case "public_first":
    default:
      return "Public first";
  }
}

export function rolloutStateLabel(value: CampaignRolloutState) {
  switch (value) {
    case "scheduled_for_members":
      return "Scheduled for members";
    case "scheduled_for_followers":
      return "Scheduled for followers";
    case "scheduled_for_public":
      return "Scheduled for public";
    case "live_for_members":
      return "Live for members";
    case "live_for_followers":
      return "Live for followers";
    case "live_for_public":
      return "Live for public";
    case "fully_open":
      return "Fully open";
    case "completed":
    default:
      return "Completed";
  }
}

export function rolloutAudienceLabel(value: CampaignRolloutAudience | null) {
  if (value === "members") return "Members";
  if (value === "followers") return "Followers";
  if (value === "public") return "Public";
  return "—";
}
