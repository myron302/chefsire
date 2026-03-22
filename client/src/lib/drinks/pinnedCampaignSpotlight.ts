const VIEW_STORAGE_PREFIX = "drinks:pinned-campaign-view:";

export type PinnedCampaignSpotlightSurface = "creator_public_page" | "discover_pinned_campaigns";
export type PinnedCampaignSpotlightEventType = "view_pinned_campaign" | "click_pinned_campaign";

function viewStorageKey(campaignId: string, surface: PinnedCampaignSpotlightSurface) {
  return `${VIEW_STORAGE_PREFIX}${surface}:${campaignId}`;
}

export async function trackPinnedCampaignSpotlightEvent(input: {
  campaignId: string;
  eventType: PinnedCampaignSpotlightEventType;
  surface: PinnedCampaignSpotlightSurface;
  referrerRoute?: string | null;
}) {
  if (!input.campaignId) return;

  await fetch(`/api/drinks/campaigns/${encodeURIComponent(input.campaignId)}/spotlight-events`, {
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

export function trackPinnedCampaignSpotlightViewOnce(input: {
  campaignId: string;
  surface: PinnedCampaignSpotlightSurface;
  referrerRoute?: string | null;
}) {
  if (typeof window === "undefined" || !input.campaignId) return;

  const storageKey = viewStorageKey(input.campaignId, input.surface);
  if (window.sessionStorage.getItem(storageKey)) return;
  window.sessionStorage.setItem(storageKey, "1");

  void trackPinnedCampaignSpotlightEvent({
    campaignId: input.campaignId,
    eventType: "view_pinned_campaign",
    surface: input.surface,
    referrerRoute: input.referrerRoute ?? null,
  });
}
