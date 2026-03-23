import type { CreatorActivityType, CreatorCollaborationItem } from "./types";

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function metricNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

export function formatCurrency(cents: number | null | undefined, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(cents ?? 0) / 100);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

export function formatPromotionDiscount(discountType: "percent" | "fixed", discountValue: number): string {
  if (discountType === "percent") return `${metricNumber(discountValue)}% off`;
  return `${formatCurrency(discountValue)} off`;
}

export function saleStatusLabel(status: string): string {
  switch (status) {
    case "refunded":
      return "Refunded sale";
    case "refunded_pending":
      return "Pending refund";
    case "revoked":
      return "Revoked access";
    case "pending":
      return "Pending";
    case "completed":
    default:
      return "Completed sale";
  }
}

export function saleStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed":
      return "secondary";
    case "refunded":
    case "refunded_pending":
    case "revoked":
    default:
      return "outline";
  }
}

export function activityBadgeLabel(type: CreatorActivityType): string {
  switch (type) {
    case "remix":
      return "Remix";
    case "follow":
      return "Follower";
    case "grocery_add":
      return "Grocery Add";
    case "view":
    default:
      return "View";
  }
}

export function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function collaborationTypeLabel(type: CreatorCollaborationItem["collaborationType"]) {
  switch (type) {
    case "collection":
      return "Collection";
    case "drop":
      return "Drop";
    case "post":
      return "Post";
    case "roadmap":
      return "Roadmap";
    default:
      return "Collaboration";
  }
}

export function collaborationStatusLabel(status: CreatorCollaborationItem["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}

export const DASHBOARD_TAB_SECTION_MAP = {
  overview: ["campaign-action-center", "campaign-rollout-timeline", "campaign-unlock-readiness-alerts", "campaign-launch-readiness", "campaign-spotlight-performance", "bundles"],
  "campaign-strategy": ["campaigns", "campaign-retrospectives", "campaign-weekly-digest", "campaign-lifecycle-suggestions", "campaign-recommendations"],
  "rollout-launch": ["campaign-rollout-advisor", "campaign-timing-advisor", "campaign-rollout-analytics", "campaign-stage-recaps", "launch-analytics", "roadmap"],
  performance: ["campaign-benchmarks", "campaign-audience-fit", "campaign-health", "campaign-recovery-plans", "campaign-surface-attribution", "campaign-analytics", "campaign-funnel-bottlenecks"],
  experiments: ["campaign-fix-matching", "campaign-fix-experiments", "campaign-experiment-library"],
  playbooks: ["campaign-playbook-profiles", "campaign-playbook-fit", "campaign-playbook-onboarding", "campaign-playbook-drift", "campaign-playbook-outcomes"],
  operations: ["collaborations", "posts", "drops", "membership", "promotions", "conversions", "sales", "orders"],
} as const;

export type DashboardTabValue = keyof typeof DASHBOARD_TAB_SECTION_MAP;

export function tabForHash(hash: string | null | undefined): DashboardTabValue {
  const normalized = hash?.replace(/^#/, "");
  if (!normalized) return "overview";

  for (const [tab, ids] of Object.entries(DASHBOARD_TAB_SECTION_MAP) as Array<[DashboardTabValue, readonly string[]]>) {
    if (ids.includes(normalized)) return tab;
  }

  return "overview";
}
