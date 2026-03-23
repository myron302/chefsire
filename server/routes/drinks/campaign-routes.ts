import { and, desc, eq, inArray } from "drizzle-orm";
import { type Router } from "express";
import { z } from "zod";

export function registerCampaignRoutes(r: Router, ctx: any) {
  const {
    db,
    optionalAuth,
    requireAuth,
    ensureDrinkCollectionsSchema,
    creatorCampaigns,
    loadFollowedCreatorIdsForUser,
    loadActiveMembershipCreatorIdsForUser,
    loadFollowedCampaignIdsForUser,
    canViewerSeeCreatorCampaign,
    loadCreatorCampaignSummaryMaps,
    serializeCreatorCampaign,
    logCollectionRouteError,
    collectionServerError,
    loadPinnedCampaignForCreator,
    loadPinnedCampaignSpotlightAnalytics,
    loadCampaignForOwnerOrThrow,
    setPinnedCampaignForCreator,
    clearPinnedCampaignForCreator,
    loadCreatorCampaignDetail,
    trackCreatorCampaignSpotlightEvent,
    trackCreatorCampaignSurfaceEvent,
    getCampaignEngagementSessionKey,
    CREATOR_CAMPAIGN_SURFACE_VALUES,
  } = ctx as any;

r.get("/campaigns", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const viewerId = req.user?.id ?? null;
      const [campaigns, followedCreatorIds, memberCreatorIds, followedCampaignIds] = await Promise.all([
        db.select().from(creatorCampaigns).orderBy(desc(creatorCampaigns.updatedAt)).limit(160),
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
        loadFollowedCampaignIdsForUser(viewerId),
      ]);
  
      const visibleCampaigns = campaigns.filter((campaign) => canViewerSeeCreatorCampaign({
        campaign,
        viewerId,
        followedCreatorIds,
        memberCreatorIds,
      }));
      const maps = await loadCreatorCampaignSummaryMaps(visibleCampaigns);
  
      return res.json({
        ok: true,
        count: visibleCampaigns.length,
        items: visibleCampaigns.map((campaign) => serializeCreatorCampaign(campaign, {
          viewerId,
          creator: maps.creatorMap.get(campaign.creatorUserId) ?? null,
          counts: maps.countsMap.get(campaign.id),
          followerCount: maps.followerCountMap.get(campaign.id) ?? 0,
          isFollowing: followedCampaignIds.has(campaign.id),
        })),
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load creator campaigns"));
    }
  });
  
  r.get("/campaigns/creator/:userId", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const creatorUserId = String(req.params.userId ?? "").trim();
      if (!creatorUserId) {
        return res.status(400).json({ ok: false, error: "Creator userId is required." });
      }
  
      const viewerId = req.user?.id ?? null;
      const [campaigns, followedCreatorIds, memberCreatorIds, followedCampaignIds] = await Promise.all([
        db.select().from(creatorCampaigns).where(eq(creatorCampaigns.creatorUserId, creatorUserId)).orderBy(desc(creatorCampaigns.updatedAt)).limit(80),
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
        loadFollowedCampaignIdsForUser(viewerId),
      ]);
  
      const visibleCampaigns = campaigns.filter((campaign) => canViewerSeeCreatorCampaign({
        campaign,
        viewerId,
        followedCreatorIds,
        memberCreatorIds,
      }));
      const maps = await loadCreatorCampaignSummaryMaps(visibleCampaigns);
  
      const pinnedCampaign = visibleCampaigns.find((campaign) => campaign.isPinned) ?? null;
  
      return res.json({
        ok: true,
        creatorUserId,
        count: visibleCampaigns.length,
        pinnedCampaign: pinnedCampaign
          ? serializeCreatorCampaign(pinnedCampaign, {
            viewerId,
            creator: maps.creatorMap.get(creatorUserId) ?? null,
            counts: maps.countsMap.get(pinnedCampaign.id),
            followerCount: maps.followerCountMap.get(pinnedCampaign.id) ?? 0,
            isFollowing: followedCampaignIds.has(pinnedCampaign.id),
          })
          : null,
        items: visibleCampaigns.map((campaign) => serializeCreatorCampaign(campaign, {
          viewerId,
          creator: maps.creatorMap.get(campaign.creatorUserId) ?? null,
          counts: maps.countsMap.get(campaign.id),
          followerCount: maps.followerCountMap.get(campaign.id) ?? 0,
          isFollowing: followedCampaignIds.has(campaign.id),
        })),
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/creator/:userId", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load creator campaigns"));
    }
  });
  
  r.get("/campaigns/featured", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const viewerId = req.user?.id ?? null;
      const [campaigns, followedCreatorIds, memberCreatorIds, followedCampaignIds] = await Promise.all([
        db.select().from(creatorCampaigns).where(eq(creatorCampaigns.isPinned, true)).orderBy(desc(creatorCampaigns.updatedAt)).limit(18),
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
        loadFollowedCampaignIdsForUser(viewerId),
      ]);
  
      const visibleCampaigns = campaigns.filter((campaign) => canViewerSeeCreatorCampaign({
        campaign,
        viewerId,
        followedCreatorIds,
        memberCreatorIds,
      }));
      const maps = await loadCreatorCampaignSummaryMaps(visibleCampaigns);
  
      return res.json({
        ok: true,
        count: visibleCampaigns.length,
        items: visibleCampaigns.map((campaign) => serializeCreatorCampaign(campaign, {
          viewerId,
          creator: maps.creatorMap.get(campaign.creatorUserId) ?? null,
          counts: maps.countsMap.get(campaign.id),
          followerCount: maps.followerCountMap.get(campaign.id) ?? 0,
          isFollowing: followedCampaignIds.has(campaign.id),
        })),
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/featured", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load featured campaigns"));
    }
  });
  
  r.post("/campaigns/:id/spotlight-events", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const parsed = z.object({
        eventType: z.enum(["view_pinned_campaign", "click_pinned_campaign"]),
        surface: z.enum(["creator_public_page", "discover_pinned_campaigns"]),
        referrerRoute: z.string().trim().max(240).optional().nullable(),
      }).safeParse(req.body ?? {});
  
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid spotlight event payload." });
      }
  
      const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.id, campaignId)).limit(1);
      const campaign = campaignRows[0];
      if (!campaign || !campaign.isPinned) {
        return res.status(404).json({ ok: false, error: "Pinned campaign not found." });
      }
  
      const viewerId = req.user?.id ?? null;
      const [followedCreatorIds, memberCreatorIds] = await Promise.all([
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
      ]);
      if (!canViewerSeeCreatorCampaign({ campaign, viewerId, followedCreatorIds, memberCreatorIds })) {
        return res.status(404).json({ ok: false, error: "Pinned campaign not found." });
      }
  
      await trackCreatorCampaignSpotlightEvent({
        campaignId,
        eventType: parsed.data.eventType,
        surface: parsed.data.surface,
        userId: viewerId,
        sessionKey: getCampaignEngagementSessionKey(req),
        metadata: parsed.data.referrerRoute ? { referrerRoute: parsed.data.referrerRoute } : null,
      });
  
      return res.status(201).json({ ok: true });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/spotlight-events", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to track pinned campaign spotlight event"));
    }
  });
  
  r.post("/campaigns/:id/surface-events", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const parsed = z.object({
        eventType: z.enum(["view_campaign", "click_campaign"]),
        surface: z.enum(CREATOR_CAMPAIGN_SURFACE_VALUES),
        referrerRoute: z.string().trim().max(240).optional().nullable(),
      }).safeParse(req.body ?? {});
  
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign surface event payload." });
      }
  
      const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.id, campaignId)).limit(1);
      const campaign = campaignRows[0];
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const viewerId = req.user?.id ?? null;
      const [followedCreatorIds, memberCreatorIds] = await Promise.all([
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
      ]);
      if (!canViewerSeeCreatorCampaign({ campaign, viewerId, followedCreatorIds, memberCreatorIds })) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      await trackCreatorCampaignSurfaceEvent({
        campaignId,
        eventType: parsed.data.eventType,
        surface: parsed.data.surface,
        userId: viewerId,
        sessionKey: getCampaignEngagementSessionKey(req),
        metadata: parsed.data.referrerRoute ? { referrerRoute: parsed.data.referrerRoute } : null,
      });
  
      return res.status(201).json({ ok: true });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/surface-events", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to track campaign surface event"));
    }
  });
  
  r.get("/creator-dashboard/pinned-campaign", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaign = await loadPinnedCampaignForCreator(req.user!.id);
      if (!campaign) {
        return res.json({ ok: true, campaign: null });
      }
  
      const detail = await loadCreatorCampaignDetail(campaign, req.user!.id);
      return res.json({ ok: true, campaign: detail.campaign });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/pinned-campaign", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load pinned campaign"));
    }
  });
  
  r.get("/creator-dashboard/pinned-campaign-analytics", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const analytics = await loadPinnedCampaignSpotlightAnalytics(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        pinnedCampaign: analytics.pinnedCampaign,
        candidates: analytics.candidates,
        rotationSuggestion: analytics.rotationSuggestion,
        attributionNotes: analytics.attributionNotes,
        generatedAt: analytics.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/pinned-campaign-analytics", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load pinned campaign spotlight analytics"));
    }
  });
  
  r.post("/campaigns/:id/pin", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const campaign = await setPinnedCampaignForCreator(req.user!.id, campaignId);
      const detail = await loadCreatorCampaignDetail(campaign, req.user!.id);
  
      return res.json({
        ok: true,
        replaced: true,
        campaign: detail.campaign,
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Unknown error";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/pin", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to pin campaign"));
    }
  });
  
  r.post("/campaigns/:id/unpin", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const campaign = await clearPinnedCampaignForCreator(req.user!.id, campaignId);
      if (!campaign) {
        return res.json({ ok: true, campaign: null, wasPinned: false });
      }
  
      const detail = await loadCreatorCampaignDetail(campaign, req.user!.id);
      return res.json({ ok: true, campaign: detail.campaign, wasPinned: true });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Unknown error";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/unpin", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to unpin campaign"));
    }
  });
  }
