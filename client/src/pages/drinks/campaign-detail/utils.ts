import { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import type { CampaignDetailResponse, CampaignGoalItem, CampaignHealthItem } from "./types";

export function describeState(campaign: CreatorCampaignItem) {
  if (campaign.state === "upcoming") return "This story arc is queued up and will become more relevant as the linked drops and notes roll in.";
  if (campaign.state === "past") return "This arc has moved into recap mode, but the linked drops, posts, and roadmap notes still tell the full launch story.";
  return "This campaign is actively shaping the creator's current release story across drops, promos, posts, and roadmap moments.";
}

export function formatMilestoneDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function campaignHealthBadgeVariant(state: CampaignHealthItem["healthState"]): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "thriving":
      return "default";
    case "healthy":
      return "secondary";
    case "at_risk":
      return "destructive";
    case "watch":
    case "completed":
    default:
      return "outline";
  }
}

export function campaignHealthLabel(state: CampaignHealthItem["healthState"]) {
  switch (state) {
    case "at_risk":
      return "At risk";
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "watch":
      return "Watch";
    case "completed":
    default:
      return "Completed";
  }
}

export function formatHealthDateTime(value: string | null) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function rolloutModeLabel(value: NonNullable<CreatorCampaignItem["rollout"]>["rolloutMode"]) {
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

export function rolloutStateLabel(value: NonNullable<CreatorCampaignItem["rollout"]>["state"]) {
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

export function rolloutAudienceLabel(value: NonNullable<CreatorCampaignItem["rollout"]>["currentAudience"] | null) {
  if (value === "members") return "Members";
  if (value === "followers") return "Followers";
  if (value === "public") return "Public";
  return "—";
}

export function buildVariantDestination(data: CampaignDetailResponse) {
  const variant = data.activeVariant;
  if (!variant) return null;

  switch (variant.ctaTargetType) {
    case "collection":
      return data.linkedContent.collections[0]
        ? { href: data.linkedContent.collections[0].route, label: "collection" }
        : null;
    case "membership":
      return data.campaign.creator
        ? { href: `${data.campaign.creator.route}#membership`, label: "membership" }
        : null;
    case "drop":
      return data.linkedContent.drops[0]
        ? { href: data.linkedContent.drops[0].detailRoute, label: "drop" }
        : null;
    case "challenge":
      return data.linkedContent.challenges[0]
        ? { href: data.linkedContent.challenges[0].route, label: "challenge" }
        : null;
    default:
      return null;
  }
}

export function rolloutAdviceTypeLabel(value: NonNullable<CampaignDetailResponse["ownerRolloutAdvice"]>["recommendationType"]) {
  switch (value) {
    case "keep_members_first":
      return "Keep members first";
    case "keep_followers_first":
      return "Keep followers first";
    case "keep_public_first":
      return "Keep public first";
    case "shorten_staged_rollout":
      return "Shorten staged rollout";
    case "extend_member_window":
      return "Extend member window";
    case "extend_follower_window":
      return "Extend follower window";
    case "go_public_earlier":
      return "Go public earlier";
    case "add_member_phase":
      return "Add member phase";
    case "skip_member_phase":
      return "Skip member phase";
    case "skip_follower_phase":
      return "Skip follower phase";
    case "use_staged_rollout_next_time":
    default:
      return "Use staged rollout next time";
  }
}

export function timingAdviceTypeLabel(value: NonNullable<CampaignDetailResponse["ownerTimingAdvice"]>["timingRecommendationType"]) {
  switch (value) {
    case "start_earlier":
      return "Start earlier";
    case "start_later":
      return "Start later";
    case "shorten_member_window":
      return "Shorten member window";
    case "extend_member_window":
      return "Extend member window";
    case "shorten_follower_window":
      return "Shorten follower window";
    case "extend_follower_window":
      return "Extend follower window";
    case "accelerate_public_unlock":
      return "Accelerate public unlock";
    case "delay_public_unlock":
      return "Delay public unlock";
    case "use_short_burst_launch":
      return "Use short burst launch";
    case "use_longer_staged_rollout":
      return "Use longer staged rollout";
    case "keep_current_timing":
    default:
      return "Keep current timing";
  }
}

export function formatTimingDelay(value: number | null, fallback: string) {
  if (value === null) return fallback;
  if (value <= 0) return "same day";
  if (value === 1) return "1 day";
  return `${value} days`;
}

export function campaignGoalLabel(goal: CampaignGoalItem) {
  return goal.label?.trim()
    || ({
      followers: "Campaign followers",
      rsvps: "Linked drop RSVPs",
      clicks: "Linked drop clicks",
      purchases: "Linked collection purchases",
      membership_conversions: "Membership conversions",
      linked_drop_views: "Linked drop views",
    }[goal.goalType] ?? goal.goalType);
}
