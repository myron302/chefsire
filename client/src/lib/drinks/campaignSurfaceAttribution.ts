const VIEW_STORAGE_PREFIX = "drinks:campaign-surface-view:";
const DETAIL_VIEW_STORAGE_PREFIX = "drinks:campaign-detail-view:";
const TOUCH_STORAGE_PREFIX = "drinks:campaign-surface-touch:";

export type CampaignSurfaceAttributionSurface =
  | "creator_public_page"
  | "discover_pinned_campaigns"
  | "following_feed"
  | "alerts"
  | "campaign_detail_page"
  | "direct_or_unknown";

export type CampaignSurfaceAttributionEventType = "view_campaign" | "click_campaign";

const SUPPORTED_SURFACES = new Set<CampaignSurfaceAttributionSurface>([
  "creator_public_page",
  "discover_pinned_campaigns",
  "following_feed",
  "alerts",
  "campaign_detail_page",
  "direct_or_unknown",
]);

function viewStorageKey(campaignId: string, surface: CampaignSurfaceAttributionSurface, scope = "default") {
  return `${VIEW_STORAGE_PREFIX}${surface}:${campaignId}:${scope}`;
}

function detailViewStorageKey(campaignId: string, surface: CampaignSurfaceAttributionSurface) {
  return `${DETAIL_VIEW_STORAGE_PREFIX}${surface}:${campaignId}`;
}

function touchStorageKey(campaignId: string) {
  return `${TOUCH_STORAGE_PREFIX}${campaignId}`;
}

export function isCampaignSurfaceAttributionSurface(value: string | null | undefined): value is CampaignSurfaceAttributionSurface {
  return Boolean(value && SUPPORTED_SURFACES.has(value as CampaignSurfaceAttributionSurface));
}

export function normalizeCampaignSurfaceAttributionSurface(value: string | null | undefined): CampaignSurfaceAttributionSurface {
  return isCampaignSurfaceAttributionSurface(value) ? value : "direct_or_unknown";
}

export async function trackCampaignSurfaceEvent(input: {
  campaignId: string;
  eventType: CampaignSurfaceAttributionEventType;
  surface: CampaignSurfaceAttributionSurface;
  referrerRoute?: string | null;
}) {
  if (!input.campaignId) return;

  await fetch(`/api/drinks/campaigns/${encodeURIComponent(input.campaignId)}/surface-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      eventType: input.eventType,
      surface: input.surface,
      referrerRoute: input.referrerRoute ?? null,
    }),
  }).catch(() => null);
}

export function setCampaignSurfaceTouch(campaignId: string, surface: CampaignSurfaceAttributionSurface) {
  if (typeof window === "undefined" || !campaignId) return;
  window.sessionStorage.setItem(touchStorageKey(campaignId), surface);
}

export function readCampaignSurfaceTouch(campaignId: string): CampaignSurfaceAttributionSurface {
  if (typeof window === "undefined" || !campaignId) return "direct_or_unknown";
  return normalizeCampaignSurfaceAttributionSurface(window.sessionStorage.getItem(touchStorageKey(campaignId)));
}

export function buildCampaignRouteWithSurface(campaignRoute: string, surface: CampaignSurfaceAttributionSurface) {
  if (!campaignRoute) return campaignRoute;
  const separator = campaignRoute.includes("?") ? "&" : "?";
  return `${campaignRoute}${separator}surface=${encodeURIComponent(surface)}`;
}

export function trackCampaignSurfaceViewOnce(input: {
  campaignId: string;
  surface: CampaignSurfaceAttributionSurface;
  referrerRoute?: string | null;
  scope?: string;
}) {
  if (typeof window === "undefined" || !input.campaignId) return;

  const storageKey = viewStorageKey(input.campaignId, input.surface, input.scope ?? "default");
  if (window.sessionStorage.getItem(storageKey)) return;
  window.sessionStorage.setItem(storageKey, "1");
  setCampaignSurfaceTouch(input.campaignId, input.surface);

  void trackCampaignSurfaceEvent({
    campaignId: input.campaignId,
    eventType: "view_campaign",
    surface: input.surface,
    referrerRoute: input.referrerRoute ?? null,
  });
}

export function trackCampaignDetailLandingOnce(input: {
  campaignId: string;
  surface: CampaignSurfaceAttributionSurface;
  referrerRoute?: string | null;
}) {
  if (typeof window === "undefined" || !input.campaignId) return;

  const storageKey = detailViewStorageKey(input.campaignId, input.surface);
  if (window.sessionStorage.getItem(storageKey)) return;
  window.sessionStorage.setItem(storageKey, "1");
  setCampaignSurfaceTouch(input.campaignId, input.surface);

  void trackCampaignSurfaceEvent({
    campaignId: input.campaignId,
    eventType: "view_campaign",
    surface: input.surface,
    referrerRoute: input.referrerRoute ?? null,
  });
}
