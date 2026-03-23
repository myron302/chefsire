import * as React from "react";

import {
  normalizeCampaignSurfaceAttributionSurface,
  readCampaignSurfaceTouch,
  setCampaignSurfaceTouch,
  trackCampaignDetailLandingOnce,
  trackCampaignSurfaceEvent,
} from "@/lib/drinks/campaignSurfaceAttribution";

import { type CampaignDetailResponse } from "@/pages/drinks/campaign-detail/types";

export function useCampaignDetailSurfaceTracking(data: CampaignDetailResponse | undefined) {
  const currentSurface = React.useMemo(() => {
    if (typeof window === "undefined" || !data?.campaign.id) return "direct_or_unknown" as const;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeCampaignSurfaceAttributionSurface(params.get("surface"));
    if (fromQuery !== "direct_or_unknown") return fromQuery;
    return readCampaignSurfaceTouch(data.campaign.id);
  }, [data]);

  React.useEffect(() => {
    if (!data?.activeVariant) return;

    void fetch(
      `/api/drinks/campaigns/${encodeURIComponent(data.campaign.id)}/variants/${encodeURIComponent(data.activeVariant.id)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: "view_variant" }),
      },
    );
  }, [data]);

  React.useEffect(() => {
    if (!data?.campaign.id || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const querySurface = normalizeCampaignSurfaceAttributionSurface(params.get("surface"));
    if (querySurface !== "direct_or_unknown") {
      setCampaignSurfaceTouch(data.campaign.id, querySurface);
      return;
    }
    trackCampaignDetailLandingOnce({
      campaignId: data.campaign.id,
      surface: "campaign_detail_page",
      referrerRoute: `${window.location.pathname}${window.location.search}`,
    });
    setCampaignSurfaceTouch(data.campaign.id, "campaign_detail_page");
  }, [data?.campaign.id]);

  const trackVariantClick = React.useCallback(() => {
    if (!data?.activeVariant) return;
    void trackCampaignSurfaceEvent({
      campaignId: data.campaign.id,
      eventType: "click_campaign",
      surface: currentSurface === "direct_or_unknown" ? "campaign_detail_page" : currentSurface,
      referrerRoute: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : null,
    });
    void fetch(
      `/api/drinks/campaigns/${encodeURIComponent(data.campaign.id)}/variants/${encodeURIComponent(data.activeVariant.id)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventType: "click_variant_cta",
          metadata: {
            ctaTargetType: data.activeVariant.ctaTargetType,
          },
        }),
      },
    );
  }, [currentSurface, data]);

  return {
    currentSurface,
    trackVariantClick,
  };
}
