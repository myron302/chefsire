import { and, desc, eq, inArray } from "drizzle-orm";
import { type Router } from "express";
import { z } from "zod";

export function registerRolloutRoutes(r: Router, ctx: any) {
  const {
    db,
    optionalAuth,
    requireAuth,
    ensureDrinkCollectionsSchema,
    creatorCampaigns,
    creatorCampaignTemplates,
    creatorCampaignGoals,
    creatorCampaignExperiments,
    creatorCampaignCtaVariants,
    creatorCampaignFollows,
    creatorCampaignRolloutBodySchema,
    updateCreatorCampaignRolloutBodySchema,
    normalizeCampaignRolloutUpdate,
    maybeCreateCampaignRolloutConfiguredEvent,
    loadCampaignForOwnerOrThrow,
    loadCreatorCampaignAudienceFit,
    formatCampaignRolloutResponse,
    logCollectionRouteError,
    collectionServerError,
    loadCampaignRolloutTimelineEntriesForCampaign,
    loadCreatorCampaignStageRecaps,
    loadCreatorCampaignSurfaceAttribution,
    loadCreatorCampaignRolloutAnalytics,
    loadCreatorCampaignRolloutAdvisor,
    loadCreatorCampaignTimingAdvisor,
    loadCreatorCampaignLaunchReadiness,
    loadCreatorCampaignUnlockReadinessAlerts,
    loadCreatorCampaignHealth,
    loadCreatorCampaignLifecycleSuggestions,
    buildCampaignRecoveryPlan,
    buildCampaignRolloutSuggestion,
    loadCampaignAnalyticsItemForOwner,
    loadCreatorCampaignPlaybookFitCollection,
    buildCreatorCampaignUpdateItems,
    loadCreatorCampaignRetrospectives,
    creatorCampaignUnlockDelayBodySchema,
    createCampaignRolloutTimelineEvent,
    formatRolloutTimelineAudience,
    formatRolloutTimelineDate,
    updateCreatorCampaignBodySchema,
    createCreatorCampaignBodySchema,
    insertCreatorCampaignSchema,
    serializeCreatorCampaign,
    loadCreatorCampaignDetail,
    buildCampaignTemplateBlueprint,
    creatorCampaignTemplateBlueprintSchema,
    insertCreatorCampaignTemplateSchema,
    serializeCreatorCampaignTemplate,
    loadCreatorCampaignVariantsByCampaignIds,
    loadCreatorCampaignGoalsByCampaignId,
    loadCreatorCampaignPerformanceSnapshots,
    loadCampaignFollowerCountMap,
    loadSerializedCreatorCampaignExperimentById,
    createCreatorCampaignExperimentBodySchema,
    updateCreatorCampaignExperimentBodySchema,
    insertCreatorCampaignExperimentSchema,
    creatorCampaignVariantBodySchema,
    updateCreatorCampaignVariantBodySchema,
    insertCreatorCampaignCtaVariantSchema,
    serializeCreatorCampaignVariant,
    loadCreatorCampaignVariantMetrics,
    trackCreatorCampaignVariantEvent,
    loadCampaignVariantForTracking,
    creatorCampaignGoalBodySchema,
    updateCreatorCampaignGoalBodySchema,
    insertCreatorCampaignGoalSchema,
    serializeCreatorCampaignGoal,
    insertCreatorCampaignFollowSchema,
    trackCreatorCampaignSurfaceEvent,
    getCampaignEngagementSessionKey,
    loadFollowedCreatorIdsForUser,
    loadActiveMembershipCreatorIdsForUser,
    loadFollowedCampaignIdsForUser,
    canViewerSeeCreatorCampaign,
    loadCreatorCampaignExperimentsCollection,
  } = ctx as any;

r.get("/campaigns/:id/rollout", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const audienceFit = await loadCreatorCampaignAudienceFit(req.user!.id);
      const audienceFitItem = audienceFit.items.find((item) => item.campaignId === campaign.id) ?? null;
      return res.json(formatCampaignRolloutResponse(
        campaign,
        audienceFitItem
          ? {
            bestAudienceFit: audienceFitItem.bestAudienceFit as CreatorCampaignRolloutAudience | null,
            bestAudienceFitConfidence: audienceFitItem.bestAudienceFitConfidence,
            bestAudienceFitReason: audienceFitItem.bestAudienceFitReason,
          }
          : null,
      ));
    } catch (error) {
      const status = error instanceof Error && error.message === "Campaign not found." ? 404 : 500;
      const message = logCollectionRouteError("/campaigns/:id/rollout", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to load campaign rollout"));
    }
  });
  
  r.post("/campaigns/:id/rollout", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = creatorCampaignRolloutBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign rollout payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const normalized = normalizeCampaignRolloutUpdate({
        campaign,
        payload: parsed.data,
      });
  
      const updatedRows = await db
        .update(creatorCampaigns)
        .set({
          rolloutMode: normalized.rolloutMode,
          startsWithAudience: normalized.startsWithAudience,
          unlockFollowersAt: normalized.unlockFollowersAt,
          unlockPublicAt: normalized.unlockPublicAt,
          rolloutNotes: normalized.rolloutNotes,
          isRolloutActive: normalized.isRolloutActive,
          isRolloutPaused: normalized.isRolloutPaused,
          rolloutPausedAt: normalized.rolloutPausedAt,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaigns.id, campaign.id))
        .returning();
  
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to save campaign rollout." });
      }
  
      await maybeCreateCampaignRolloutConfiguredEvent({
        previous: campaign,
        next: updated,
        actorUserId: req.user!.id,
        occurredAt: new Date(),
        isCreate: true,
      });
  
      const audienceFit = await loadCreatorCampaignAudienceFit(req.user!.id);
      const audienceFitItem = audienceFit.items.find((item) => item.campaignId === updated.id) ?? null;
      return res.status(201).json(formatCampaignRolloutResponse(
        updated,
        audienceFitItem
          ? {
            bestAudienceFit: audienceFitItem.bestAudienceFit as CreatorCampaignRolloutAudience | null,
            bestAudienceFitConfidence: audienceFitItem.bestAudienceFitConfidence,
            bestAudienceFitReason: audienceFitItem.bestAudienceFitReason,
          }
          : null,
      ));
    } catch (error) {
      const status = error instanceof Error && error.message === "Campaign not found." ? 404 : 500;
      const message = logCollectionRouteError("/campaigns/:id/rollout", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to save campaign rollout"));
    }
  });
  
  r.patch("/campaigns/:id/rollout", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = updateCreatorCampaignRolloutBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign rollout payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const normalized = normalizeCampaignRolloutUpdate({
        campaign,
        payload: parsed.data,
      });
  
      const updatedRows = await db
        .update(creatorCampaigns)
        .set({
          rolloutMode: normalized.rolloutMode,
          startsWithAudience: normalized.startsWithAudience,
          unlockFollowersAt: normalized.unlockFollowersAt,
          unlockPublicAt: normalized.unlockPublicAt,
          rolloutNotes: normalized.rolloutNotes,
          isRolloutActive: normalized.isRolloutActive,
          isRolloutPaused: normalized.isRolloutPaused,
          rolloutPausedAt: normalized.rolloutPausedAt,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaigns.id, campaign.id))
        .returning();
  
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to update campaign rollout." });
      }
  
      await maybeCreateCampaignRolloutConfiguredEvent({
        previous: campaign,
        next: updated,
        actorUserId: req.user!.id,
        occurredAt: new Date(),
      });
  
      const audienceFit = await loadCreatorCampaignAudienceFit(req.user!.id);
      const audienceFitItem = audienceFit.items.find((item) => item.campaignId === updated.id) ?? null;
      return res.json(formatCampaignRolloutResponse(
        updated,
        audienceFitItem
          ? {
            bestAudienceFit: audienceFitItem.bestAudienceFit as CreatorCampaignRolloutAudience | null,
            bestAudienceFitConfidence: audienceFitItem.bestAudienceFitConfidence,
            bestAudienceFitReason: audienceFitItem.bestAudienceFitReason,
          }
          : null,
      ));
    } catch (error) {
      const status = error instanceof Error && error.message === "Campaign not found." ? 404 : 500;
      const message = logCollectionRouteError("/campaigns/:id/rollout", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to update campaign rollout"));
    }
  });
  
  r.get("/campaigns/:id/rollout-timeline", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const items = await loadCampaignRolloutTimelineEntriesForCampaign(campaign);
  
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaign.id,
        campaign: {
          id: campaign.id,
          slug: campaign.slug,
          name: campaign.name,
          route: `/drinks/campaigns/${encodeURIComponent(campaign.slug)}`,
        },
        count: items.length,
        items,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const status = error instanceof Error && error.message === "Campaign not found." ? 404 : 500;
      const message = logCollectionRouteError("/campaigns/:id/rollout-timeline", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to load campaign rollout timeline"));
    }
  });
  
  r.get("/campaigns/:id/stage-recaps", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const recaps = await loadCreatorCampaignStageRecaps(req.user!.id, campaign.id);
      const item = recaps.items.find((entry) => entry.campaignId === campaign.id) ?? null;
  
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaign.id,
        campaign: {
          id: campaign.id,
          slug: campaign.slug,
          name: campaign.name,
          route: `/drinks/campaigns/${encodeURIComponent(campaign.slug)}`,
        },
        summary: recaps.summary,
        item,
        attributionNotes: recaps.attributionNotes,
        generatedAt: recaps.generatedAt,
      });
    } catch (error) {
      const status = error instanceof Error && error.message === "Campaign not found." ? 404 : 500;
      const message = logCollectionRouteError("/campaigns/:id/stage-recaps", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to load campaign stage recaps"));
    }
  });
  
  r.get("/creator-dashboard/campaign-rollout-timeline", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
      const campaigns = campaignId
        ? [await loadCampaignForOwnerOrThrow(campaignId, req.user!.id)]
        : await db
          .select()
          .from(creatorCampaigns)
          .where(eq(creatorCampaigns.creatorUserId, req.user!.id))
          .orderBy(desc(creatorCampaigns.updatedAt))
          .limit(8);
  
      const timelineGroups = await Promise.all(campaigns.map(async (campaign) => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignSlug: campaign.slug,
        campaignRoute: `/drinks/campaigns/${encodeURIComponent(campaign.slug)}`,
        items: await loadCampaignRolloutTimelineEntriesForCampaign(campaign),
      })));
  
      const items = timelineGroups
        .flatMap((group) => group.items.map((item) => ({
          ...item,
          campaignName: group.campaignName,
          campaignSlug: group.campaignSlug,
          campaignRoute: group.campaignRoute,
        })))
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, campaignId ? 60 : 120);
  
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaignId || null,
        campaigns: timelineGroups.map((group) => ({
          campaignId: group.campaignId,
          campaignName: group.campaignName,
          campaignSlug: group.campaignSlug,
          campaignRoute: group.campaignRoute,
          count: group.items.length,
        })),
        count: items.length,
        items,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const status = error instanceof Error && error.message === "Campaign not found." ? 404 : 500;
      const message = logCollectionRouteError("/creator-dashboard/campaign-rollout-timeline", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to load campaign rollout timeline"));
    }
  });
  
  r.get("/creator-dashboard/campaign-stage-recaps", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const recaps = await loadCreatorCampaignStageRecaps(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: recaps.summary,
        items: recaps.items,
        attributionNotes: recaps.attributionNotes,
        generatedAt: recaps.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-stage-recaps", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign stage recaps"));
    }
  });
  
  r.post("/campaigns/:id/unlock-controls/delay", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = creatorCampaignUnlockDelayBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid delay payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      if (campaign.isRolloutPaused) {
        return res.status(409).json({ ok: false, error: "Resume this rollout before delaying the next unlock." });
      }
  
      const now = new Date();
      const { rollout, field } = assertCampaignSupportsUnlockControls(campaign, "delay", now);
      if (!field || !rollout.nextAudience) {
        return res.status(409).json({ ok: false, error: "No follower/public unlock is available for delay right now." });
      }
  
      const baseUnlockAt = rollout.nextUnlockAt ? new Date(rollout.nextUnlockAt) : now;
      const nextUnlockAt = new Date(Math.max(baseUnlockAt.getTime(), now.getTime()) + parsed.data.hours * 60 * 60 * 1000);
  
      const updatedRows = await db
        .update(creatorCampaigns)
        .set({
          [field]: nextUnlockAt,
          updatedAt: now,
        })
        .where(eq(creatorCampaigns.id, campaign.id))
        .returning();
  
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to delay unlock." });
      }
  
      await createCampaignRolloutTimelineEvent({
        campaignId: campaign.id,
        actorUserId: req.user!.id,
        eventType: rollout.nextAudience === "followers" ? "follower_unlock_delayed" : "public_unlock_delayed",
        title: `${rollout.nextAudience === "followers" ? "Follower" : "Public"} unlock delayed`,
        message: `${rollout.nextAudience === "followers" ? "Follower" : "Public"} unlock moved by ${parsed.data.hours} hours to ${formatRolloutTimelineDate(nextUnlockAt)}.`,
        audienceStage: rollout.nextAudience,
        metadata: {
          delayedByHours: parsed.data.hours,
          nextUnlockAt: nextUnlockAt.toISOString(),
          field,
        },
        occurredAt: now,
      });
  
      return res.json({
        ...formatCampaignRolloutResponse(updated),
        action: "delay" as const,
        delayedAudience: rollout.nextAudience,
        delayedByHours: parsed.data.hours,
      });
    } catch (error) {
      const status = error instanceof Error && /Campaign not found/.test(error.message)
        ? 404
        : error instanceof Error && /Unlock controls|No follower\/public unlock/.test(error.message)
          ? 409
          : 500;
      const message = logCollectionRouteError("/campaigns/:id/unlock-controls/delay", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to delay campaign unlock"));
    }
  });
  
  r.post("/campaigns/:id/unlock-controls/release-now", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      if (campaign.isRolloutPaused) {
        return res.status(409).json({ ok: false, error: "Resume this rollout before releasing the next unlock." });
      }
  
      const now = new Date();
      const { rollout, field } = assertCampaignSupportsUnlockControls(campaign, "release_now", now);
      if (!field || !rollout.nextAudience) {
        return res.status(409).json({ ok: false, error: "No eligible follower/public unlock can be released right now." });
      }
  
      const updatedRows = await db
        .update(creatorCampaigns)
        .set({
          [field]: now,
          updatedAt: now,
        })
        .where(eq(creatorCampaigns.id, campaign.id))
        .returning();
  
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to release unlock now." });
      }
  
      await createCampaignRolloutTimelineEvent({
        campaignId: campaign.id,
        actorUserId: req.user!.id,
        eventType: rollout.nextAudience === "followers" ? "follower_unlock_released_now" : "public_unlock_released_now",
        title: `${rollout.nextAudience === "followers" ? "Follower" : "Public"} unlock released now`,
        message: `${rollout.nextAudience === "followers" ? "Follower" : "Public"} access was released immediately instead of waiting for the scheduled unlock.`,
        audienceStage: rollout.nextAudience,
        metadata: {
          releasedAt: now.toISOString(),
          field,
        },
        occurredAt: now,
      });
  
      return res.json({
        ...formatCampaignRolloutResponse(updated),
        action: "release_now" as const,
        releasedAudience: rollout.nextAudience,
      });
    } catch (error) {
      const status = error instanceof Error && /Campaign not found/.test(error.message)
        ? 404
        : error instanceof Error && /Unlock controls|No follower\/public unlock/.test(error.message)
          ? 409
          : 500;
      const message = logCollectionRouteError("/campaigns/:id/unlock-controls/release-now", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to release campaign unlock now"));
    }
  });
  
  r.post("/campaigns/:id/unlock-controls/pause", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const { rollout } = assertCampaignSupportsUnlockControls(campaign, "pause");
      if (campaign.isRolloutPaused) {
        return res.status(409).json({ ok: false, error: "This rollout is already paused." });
      }
      if (!rollout.nextAudience) {
        return res.status(409).json({ ok: false, error: "This rollout has no upcoming unlock left to pause." });
      }
  
      const now = new Date();
      const updatedRows = await db
        .update(creatorCampaigns)
        .set({
          isRolloutPaused: true,
          rolloutPausedAt: now,
          updatedAt: now,
        })
        .where(eq(creatorCampaigns.id, campaign.id))
        .returning();
  
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to pause rollout." });
      }
  
      await createCampaignRolloutTimelineEvent({
        campaignId: campaign.id,
        actorUserId: req.user!.id,
        eventType: "rollout_paused",
        title: "Rollout paused",
        message: rollout.nextAudience
          ? `Rollout paused before the next ${formatRolloutTimelineAudience(rollout.nextAudience)} unlock.`
          : "Rollout paused.",
        audienceStage: rollout.nextAudience,
        metadata: {
          nextAudience: rollout.nextAudience,
          nextUnlockAt: rollout.nextUnlockAt,
        },
        occurredAt: now,
      });
  
      return res.json({
        ...formatCampaignRolloutResponse(updated),
        action: "pause" as const,
      });
    } catch (error) {
      const status = error instanceof Error && /Campaign not found/.test(error.message)
        ? 404
        : error instanceof Error && /Unlock controls/.test(error.message)
          ? 409
          : 500;
      const message = logCollectionRouteError("/campaigns/:id/unlock-controls/pause", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to pause campaign rollout"));
    }
  });
  
  r.post("/campaigns/:id/unlock-controls/resume", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      assertCampaignSupportsUnlockControls(campaign, "resume");
      if (!campaign.isRolloutPaused || !campaign.rolloutPausedAt) {
        return res.status(409).json({ ok: false, error: "This rollout is not paused." });
      }
  
      const now = new Date();
      const shiftedUnlocks = shiftCampaignUnlocksForResume(campaign, now);
      const updatedRows = await db
        .update(creatorCampaigns)
        .set({
          unlockFollowersAt: shiftedUnlocks.unlockFollowersAt,
          unlockPublicAt: shiftedUnlocks.unlockPublicAt,
          isRolloutPaused: false,
          rolloutPausedAt: null,
          updatedAt: now,
        })
        .where(eq(creatorCampaigns.id, campaign.id))
        .returning();
  
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to resume rollout." });
      }
  
      await createCampaignRolloutTimelineEvent({
        campaignId: campaign.id,
        actorUserId: req.user!.id,
        eventType: "rollout_resumed",
        title: "Rollout resumed",
        message: `Rollout resumed after pause. Future unlocks were shifted to preserve the staged sequence safely.`,
        audienceStage: deriveCreatorCampaignRollout(updated).nextAudience,
        metadata: {
          previousPausedAt: campaign.rolloutPausedAt?.toISOString() ?? null,
          unlockFollowersAt: updated.unlockFollowersAt?.toISOString() ?? null,
          unlockPublicAt: updated.unlockPublicAt?.toISOString() ?? null,
        },
        occurredAt: now,
      });
  
      return res.json({
        ...formatCampaignRolloutResponse(updated),
        action: "resume" as const,
      });
    } catch (error) {
      const status = error instanceof Error && /Campaign not found/.test(error.message)
        ? 404
        : error instanceof Error && /Unlock controls/.test(error.message)
          ? 409
          : 500;
      const message = logCollectionRouteError("/campaigns/:id/unlock-controls/resume", req, error);
      return res.status(status).json(collectionServerError(message, "Failed to resume campaign rollout"));
    }
  });
  
  r.get("/campaigns/:id/experiments", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await requireOwnedCreatorCampaign(campaignId, req.user!.id);
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const collection = await loadCreatorCampaignExperimentsCollection(req.user!.id, campaign);
      return res.json({
        ok: true,
        campaignId: campaign.id,
        items: collection.items,
        suggestedExperimentTypes: collection.suggestedExperimentTypes,
        attributionNotes: collection.attributionNotes,
        generatedAt: collection.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/experiments", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign experiments"));
    }
  });
  
  r.post("/campaigns/:id/experiments", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await requireOwnedCreatorCampaign(campaignId, req.user!.id);
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const parsed = createCreatorCampaignExperimentBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid experiment payload." });
      }
  
      const payload = parsed.data;
      const startedAt = payload.startedAt ? new Date(payload.startedAt) : new Date();
      const insertedRows = await db.insert(creatorCampaignExperiments).values(insertCreatorCampaignExperimentSchema.parse({
        campaignId: campaign.id,
        experimentType: payload.experimentType,
        label: payload.label?.trim() ? payload.label.trim() : null,
        hypothesis: payload.hypothesis?.trim() ? payload.hypothesis.trim() : null,
        startedAt,
        endedAt: null,
        status: "active",
      })).returning();
  
      const inserted = insertedRows[0];
      if (!inserted) {
        return res.status(500).json({ ok: false, error: "Failed to create experiment." });
      }
  
      const item = await loadSerializedCreatorCampaignExperimentById(req.user!.id, campaign, inserted.id);
      return res.status(201).json({
        ok: true,
        campaignId: campaign.id,
        item,
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/experiments", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to create campaign experiment"));
    }
  });
  
  r.patch("/campaigns/:id/experiments/:experimentId", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const experimentId = String(req.params.experimentId ?? "").trim();
      if (!campaignId || !experimentId) {
        return res.status(400).json({ ok: false, error: "Campaign id and experiment id are required." });
      }
  
      const campaign = await requireOwnedCreatorCampaign(campaignId, req.user!.id);
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const existingRows = await db.select().from(creatorCampaignExperiments)
        .where(and(eq(creatorCampaignExperiments.id, experimentId), eq(creatorCampaignExperiments.campaignId, campaign.id)))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Experiment not found." });
      }
  
      const parsed = updateCreatorCampaignExperimentBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid experiment payload." });
      }
  
      const payload = parsed.data;
      const nextStartedAt = payload.startedAt === undefined
        ? existing.startedAt
        : payload.startedAt
          ? new Date(payload.startedAt)
          : null;
      const nextEndedAt = payload.endedAt === undefined
        ? existing.endedAt
        : payload.endedAt
          ? new Date(payload.endedAt)
          : null;
      if (nextStartedAt && nextEndedAt && nextEndedAt < nextStartedAt) {
        return res.status(400).json({ ok: false, error: "Experiment end time must be after the start time." });
      }
  
      const nextStatus = payload.status ?? existing.status;
      const updatedRows = await db.update(creatorCampaignExperiments)
        .set({
          experimentType: payload.experimentType ?? existing.experimentType,
          label: payload.label === undefined ? existing.label : (payload.label?.trim() ? payload.label.trim() : null),
          hypothesis: payload.hypothesis === undefined ? existing.hypothesis : (payload.hypothesis?.trim() ? payload.hypothesis.trim() : null),
          startedAt: nextStartedAt,
          endedAt: nextEndedAt,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaignExperiments.id, existing.id))
        .returning();
  
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to update experiment." });
      }
  
      const item = await loadSerializedCreatorCampaignExperimentById(req.user!.id, campaign, updated.id);
      return res.json({ ok: true, campaignId: campaign.id, item });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/experiments/:experimentId", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to update campaign experiment"));
    }
  });
  
  r.post("/campaigns/:id/experiments/:experimentId/complete", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const experimentId = String(req.params.experimentId ?? "").trim();
      if (!campaignId || !experimentId) {
        return res.status(400).json({ ok: false, error: "Campaign id and experiment id are required." });
      }
  
      const campaign = await requireOwnedCreatorCampaign(campaignId, req.user!.id);
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const existingRows = await db.select().from(creatorCampaignExperiments)
        .where(and(eq(creatorCampaignExperiments.id, experimentId), eq(creatorCampaignExperiments.campaignId, campaign.id)))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Experiment not found." });
      }
  
      const now = new Date();
      const updatedRows = await db.update(creatorCampaignExperiments)
        .set({
          status: "completed",
          startedAt: existing.startedAt ?? existing.createdAt,
          endedAt: existing.endedAt ?? now,
          updatedAt: now,
        })
        .where(eq(creatorCampaignExperiments.id, existing.id))
        .returning();
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to complete experiment." });
      }
  
      const item = await loadSerializedCreatorCampaignExperimentById(req.user!.id, campaign, updated.id);
      return res.json({ ok: true, campaignId: campaign.id, item });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/experiments/:experimentId/complete", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to complete campaign experiment"));
    }
  });
  
  r.post("/campaigns/:id/experiments/:experimentId/cancel", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const experimentId = String(req.params.experimentId ?? "").trim();
      if (!campaignId || !experimentId) {
        return res.status(400).json({ ok: false, error: "Campaign id and experiment id are required." });
      }
  
      const campaign = await requireOwnedCreatorCampaign(campaignId, req.user!.id);
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const existingRows = await db.select().from(creatorCampaignExperiments)
        .where(and(eq(creatorCampaignExperiments.id, experimentId), eq(creatorCampaignExperiments.campaignId, campaign.id)))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Experiment not found." });
      }
  
      const now = new Date();
      const updatedRows = await db.update(creatorCampaignExperiments)
        .set({
          status: "canceled",
          startedAt: existing.startedAt ?? existing.createdAt,
          endedAt: existing.endedAt ?? now,
          updatedAt: now,
        })
        .where(eq(creatorCampaignExperiments.id, existing.id))
        .returning();
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to cancel experiment." });
      }
  
      const item = await loadSerializedCreatorCampaignExperimentById(req.user!.id, campaign, updated.id);
      return res.json({ ok: true, campaignId: campaign.id, item });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/experiments/:experimentId/cancel", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to cancel campaign experiment"));
    }
  });
  
  r.get("/campaigns/following", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const viewerId = req.user!.id;
      const [followRows, followedCreatorIds, memberCreatorIds] = await Promise.all([
        db
          .select({ campaignId: creatorCampaignFollows.campaignId, createdAt: creatorCampaignFollows.createdAt })
          .from(creatorCampaignFollows)
          .where(eq(creatorCampaignFollows.userId, viewerId))
          .orderBy(desc(creatorCampaignFollows.createdAt))
          .limit(120),
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
      ]);
  
      const campaignIds = followRows.map((row) => row.campaignId).filter(Boolean);
      if (campaignIds.length === 0) {
        return res.json({ ok: true, count: 0, items: [] });
      }
  
      const campaigns = await db
        .select()
        .from(creatorCampaigns)
        .where(inArray(creatorCampaigns.id, campaignIds));
  
      const visibleCampaigns = campaigns.filter((campaign) => canViewerSeeCreatorCampaign({
        campaign,
        viewerId,
        followedCreatorIds,
        memberCreatorIds,
      }));
  
      const campaignMap = new Map(visibleCampaigns.map((campaign) => [campaign.id, campaign]));
      const orderedCampaigns = followRows
        .map((row) => campaignMap.get(row.campaignId))
        .filter((campaign): campaign is CreatorCampaignRecord => Boolean(campaign));
  
      const details = await Promise.all(orderedCampaigns.map((campaign) => loadCreatorCampaignDetail(campaign, viewerId)));
  
      return res.json({
        ok: true,
        count: details.length,
        items: details.map((detail) => ({
          campaign: detail.campaign,
          recentUpdates: buildCreatorCampaignUpdateItems(detail).slice(0, 3),
          linkedCounts: detail.campaign.counts,
        })),
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/following", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load followed campaigns"));
    }
  });
  
  r.get("/campaigns/:id/follow-status", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.id, campaignId)).limit(1);
      const campaign = campaignRows[0];
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const viewerId = req.user?.id ?? null;
      const [followedCreatorIds, memberCreatorIds, followerCountMap, followedCampaignIds] = await Promise.all([
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
        loadCampaignFollowerCountMap([campaignId]),
        loadFollowedCampaignIdsForUser(viewerId),
      ]);
  
      if (!canViewerSeeCreatorCampaign({ campaign, viewerId, followedCreatorIds, memberCreatorIds })) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      return res.json({
        ok: true,
        campaignId,
        isFollowing: viewerId ? followedCampaignIds.has(campaignId) : false,
        followerCount: followerCountMap.get(campaignId) ?? 0,
        canFollow: Boolean(viewerId && viewerId !== campaign.creatorUserId),
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/follow-status", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign follow status"));
    }
  });
  
  r.post("/campaigns/:id/follow", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.id, campaignId)).limit(1);
      const campaign = campaignRows[0];
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
      if (campaign.creatorUserId === req.user!.id) {
        return res.status(400).json({ ok: false, error: "Creators do not need to follow their own campaigns." });
      }
  
      const [followedCreatorIds, memberCreatorIds] = await Promise.all([
        loadFollowedCreatorIdsForUser(req.user!.id),
        loadActiveMembershipCreatorIdsForUser(req.user!.id),
      ]);
      if (!canViewerSeeCreatorCampaign({ campaign, viewerId: req.user!.id, followedCreatorIds, memberCreatorIds })) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const variantId = typeof req.body?.variantId === "string" ? req.body.variantId.trim() : "";
      const surface = resolveCreatorCampaignSurface(typeof req.body?.surface === "string" ? req.body.surface.trim() : null);
      const variant = variantId ? await loadCampaignVariantForTracking(campaignId, variantId) : null;
  
      await db.insert(creatorCampaignFollows).values(insertCreatorCampaignFollowSchema.parse({
        userId: req.user!.id,
        campaignId,
      })).onConflictDoNothing();
  
      if (variant) {
        await trackCreatorCampaignVariantEvent({
          campaignId,
          variantId: variant.id,
          eventType: "follow_after_variant",
          userId: req.user!.id,
          sessionKey: getCampaignEngagementSessionKey(req),
        });
      }
      await trackCreatorCampaignSurfaceEvent({
        campaignId,
        eventType: "follow_after_campaign_surface",
        surface,
        userId: req.user!.id,
        sessionKey: getCampaignEngagementSessionKey(req),
        metadata: variant ? { source: "campaign_variant", variantId: variant.id } : { source: "campaign_surface" },
      });
  
      const followerCountMap = await loadCampaignFollowerCountMap([campaignId]);
      return res.status(201).json({
        ok: true,
        campaignId,
        isFollowing: true,
        followerCount: followerCountMap.get(campaignId) ?? 0,
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/follow", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to follow campaign"));
    }
  });
  
  r.delete("/campaigns/:id/follow", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      await db.delete(creatorCampaignFollows).where(and(
        eq(creatorCampaignFollows.campaignId, campaignId),
        eq(creatorCampaignFollows.userId, req.user!.id),
      ));
  
      const followerCountMap = await loadCampaignFollowerCountMap([campaignId]);
      return res.json({
        ok: true,
        campaignId,
        isFollowing: false,
        followerCount: followerCountMap.get(campaignId) ?? 0,
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/follow", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to unfollow campaign"));
    }
  });
  
  r.get("/campaigns/:id/variants", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaignRows = await db
        .select()
        .from(creatorCampaigns)
        .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
        .limit(1);
      const campaign = campaignRows[0];
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const variants = (await loadCreatorCampaignVariantsByCampaignIds([campaignId])).get(campaignId) ?? [];
      const metrics = await loadCreatorCampaignVariantMetrics(campaign, variants);
  
      return res.json({
        ok: true,
        campaignId,
        count: variants.length,
        items: variants.map((variant) => serializeCreatorCampaignVariant(variant, metrics.get(variant.id))),
        attributionNotes: [
          "Views and CTA clicks are tracked directly on the campaign page CTA block.",
          "Follows and RSVPs only count when the creator CTA triggered that action.",
          "Purchases and memberships are approximate proxy counts based on a prior signed-in CTA click during the campaign window.",
        ],
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/variants", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign CTA variants"));
    }
  });
  
  r.post("/campaigns/:id/variants", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaignRows = await db
        .select()
        .from(creatorCampaigns)
        .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
        .limit(1);
      const campaign = campaignRows[0];
      if (!campaign) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const parsed = creatorCampaignVariantBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign CTA variant payload." });
      }
  
      const existingCountRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(creatorCampaignCtaVariants)
        .where(eq(creatorCampaignCtaVariants.campaignId, campaignId));
      if (Number(existingCountRows[0]?.count ?? 0) >= 6) {
        return res.status(400).json({ ok: false, error: "Version one supports up to 6 CTA variants per campaign." });
      }
  
      const shouldActivate = Boolean(parsed.data.isActive) || Number(existingCountRows[0]?.count ?? 0) === 0;
      if (shouldActivate) {
        await db
          .update(creatorCampaignCtaVariants)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(creatorCampaignCtaVariants.campaignId, campaignId));
      }
  
      const inserted = await db.insert(creatorCampaignCtaVariants).values(insertCreatorCampaignCtaVariantSchema.parse({
        campaignId,
        label: parsed.data.label.trim(),
        headline: parsed.data.headline?.trim() ? parsed.data.headline.trim() : null,
        subheadline: parsed.data.subheadline?.trim() ? parsed.data.subheadline.trim() : null,
        ctaText: parsed.data.ctaText.trim(),
        ctaTargetType: parsed.data.ctaTargetType,
        isActive: shouldActivate,
      })).returning();
  
      const variant = inserted[0];
      if (!variant) {
        return res.status(500).json({ ok: false, error: "Failed to create campaign CTA variant." });
      }
  
      return res.status(201).json({ ok: true, item: serializeCreatorCampaignVariant(variant) });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/variants", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to create campaign CTA variant"));
    }
  });
  
  r.patch("/campaigns/:id/variants/:variantId", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const variantId = String(req.params.variantId ?? "").trim();
      if (!campaignId || !variantId) {
        return res.status(400).json({ ok: false, error: "Campaign id and variant id are required." });
      }
  
      const parsed = updateCreatorCampaignVariantBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign CTA variant payload." });
      }
  
      const rows = await db
        .select({
          id: creatorCampaignCtaVariants.id,
          label: creatorCampaignCtaVariants.label,
          headline: creatorCampaignCtaVariants.headline,
          subheadline: creatorCampaignCtaVariants.subheadline,
          ctaText: creatorCampaignCtaVariants.ctaText,
          ctaTargetType: creatorCampaignCtaVariants.ctaTargetType,
          isActive: creatorCampaignCtaVariants.isActive,
        })
        .from(creatorCampaignCtaVariants)
        .innerJoin(creatorCampaigns, eq(creatorCampaigns.id, creatorCampaignCtaVariants.campaignId))
        .where(and(
          eq(creatorCampaignCtaVariants.id, variantId),
          eq(creatorCampaignCtaVariants.campaignId, campaignId),
          eq(creatorCampaigns.creatorUserId, req.user!.id),
        ))
        .limit(1);
      const row = rows[0];
      if (!row) {
        return res.status(404).json({ ok: false, error: "Campaign CTA variant not found." });
      }
  
      if (parsed.data.isActive === true) {
        await db
          .update(creatorCampaignCtaVariants)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(creatorCampaignCtaVariants.campaignId, campaignId));
      }
  
      const updatedRows = await db
        .update(creatorCampaignCtaVariants)
        .set({
          label: parsed.data.label !== undefined ? parsed.data.label.trim() : row.label,
          headline: parsed.data.headline !== undefined ? (parsed.data.headline?.trim() ? parsed.data.headline.trim() : null) : row.headline,
          subheadline: parsed.data.subheadline !== undefined ? (parsed.data.subheadline?.trim() ? parsed.data.subheadline.trim() : null) : row.subheadline,
          ctaText: parsed.data.ctaText !== undefined ? parsed.data.ctaText.trim() : row.ctaText,
          ctaTargetType: parsed.data.ctaTargetType ?? (row.ctaTargetType as CreatorCampaignCtaTargetType),
          isActive: parsed.data.isActive ?? row.isActive,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaignCtaVariants.id, variantId))
        .returning();
  
      const variant = updatedRows[0];
      if (!variant) {
        return res.status(500).json({ ok: false, error: "Failed to update campaign CTA variant." });
      }
  
      return res.json({ ok: true, item: serializeCreatorCampaignVariant(variant) });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/variants/:variantId", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to update campaign CTA variant"));
    }
  });
  
  r.delete("/campaigns/:id/variants/:variantId", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const variantId = String(req.params.variantId ?? "").trim();
      if (!campaignId || !variantId) {
        return res.status(400).json({ ok: false, error: "Campaign id and variant id are required." });
      }
  
      const rows = await db
        .select({
          campaignId: creatorCampaignCtaVariants.campaignId,
          isActive: creatorCampaignCtaVariants.isActive,
        })
        .from(creatorCampaignCtaVariants)
        .innerJoin(creatorCampaigns, eq(creatorCampaigns.id, creatorCampaignCtaVariants.campaignId))
        .where(and(
          eq(creatorCampaignCtaVariants.id, variantId),
          eq(creatorCampaignCtaVariants.campaignId, campaignId),
          eq(creatorCampaigns.creatorUserId, req.user!.id),
        ))
        .limit(1);
      const row = rows[0];
      if (!row) {
        return res.status(404).json({ ok: false, error: "Campaign CTA variant not found." });
      }
  
      await db.delete(creatorCampaignCtaVariants).where(eq(creatorCampaignCtaVariants.id, variantId));
  
      if (row.isActive) {
        const fallbackRows = await db
          .select()
          .from(creatorCampaignCtaVariants)
          .where(eq(creatorCampaignCtaVariants.campaignId, campaignId))
          .orderBy(asc(creatorCampaignCtaVariants.createdAt))
          .limit(1);
        if (fallbackRows[0]) {
          await db
            .update(creatorCampaignCtaVariants)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(creatorCampaignCtaVariants.id, fallbackRows[0].id));
        }
      }
  
      return res.json({ ok: true, deletedId: variantId });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/variants/:variantId", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to delete campaign CTA variant"));
    }
  });
  
  r.get("/campaigns/:id/goals", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const [goalRows, analytics] = await Promise.all([
        loadCreatorCampaignGoalsByCampaignId(campaign.id),
        loadCampaignAnalyticsItemForOwner(campaign),
      ]);
  
      return res.json({
        ok: true,
        campaignId: campaign.id,
        count: goalRows.length,
        items: goalRows.map((goal) => serializeCreatorCampaignGoal(goal, analytics)),
        attributionNotes: [
          "Goal progress is derived from the campaign analytics already tracked in the drinks platform.",
          "Purchase and membership conversion goals stay approximate whenever the underlying campaign analytics are approximate.",
        ],
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Unknown error";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/goals", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign goals"));
    }
  });
  
  r.get("/campaigns/:id/retrospective", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      if (getCreatorCampaignState(campaign) !== "past") {
        return res.status(400).json({ ok: false, error: "Retrospectives are only available after a campaign has ended or been archived." });
      }
  
      const retrospectives = await loadCreatorCampaignRetrospectives(req.user!.id);
      const item = retrospectives.items.find((entry) => entry.campaignId === campaign.id) ?? null;
  
      return res.json({
        ok: true,
        campaignId: campaign.id,
        retrospective: item,
        attributionNotes: retrospectives.attributionNotes,
        generatedAt: retrospectives.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/retrospective", req, error);
      const status = error instanceof Error && error.message === "Campaign not found." ? 404 : 500;
      return res.status(status).json(collectionServerError(message, "Failed to load campaign retrospective"));
    }
  });
  
  r.post("/campaigns/:id/goals", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = creatorCampaignGoalBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign goal payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const insertedRows = await db.insert(creatorCampaignGoals).values(insertCreatorCampaignGoalSchema.parse({
        campaignId: campaign.id,
        goalType: parsed.data.goalType,
        targetValue: parsed.data.targetValue,
        label: parsed.data.label?.trim() ? parsed.data.label.trim() : null,
      })).returning();
      const inserted = insertedRows[0];
      const analytics = await loadCampaignAnalyticsItemForOwner(campaign);
  
      return res.status(201).json({
        ok: true,
        item: serializeCreatorCampaignGoal(inserted, analytics),
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Unknown error";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/goals", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to create campaign goal"));
    }
  });
  
  r.patch("/campaigns/:id/goals/:goalId", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const goalId = String(req.params.goalId ?? "").trim();
      if (!campaignId || !goalId) {
        return res.status(400).json({ ok: false, error: "Campaign id and goal id are required." });
      }
  
      const parsed = updateCreatorCampaignGoalBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign goal payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const existingRows = await db
        .select()
        .from(creatorCampaignGoals)
        .where(and(eq(creatorCampaignGoals.id, goalId), eq(creatorCampaignGoals.campaignId, campaign.id)))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Campaign goal not found." });
      }
  
      const updatedRows = await db
        .update(creatorCampaignGoals)
        .set({
          goalType: parsed.data.goalType ?? (existing.goalType as CreatorCampaignGoalType),
          targetValue: parsed.data.targetValue ?? existing.targetValue,
          label: parsed.data.label !== undefined ? (parsed.data.label?.trim() ? parsed.data.label.trim() : null) : existing.label,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaignGoals.id, goalId))
        .returning();
      const updated = updatedRows[0];
      if (!updated) {
        return res.status(500).json({ ok: false, error: "Failed to update campaign goal." });
      }
  
      const analytics = await loadCampaignAnalyticsItemForOwner(campaign);
      return res.json({ ok: true, item: serializeCreatorCampaignGoal(updated, analytics) });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Unknown error";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/goals/:goalId", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to update campaign goal"));
    }
  });
  
  r.delete("/campaigns/:id/goals/:goalId", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const goalId = String(req.params.goalId ?? "").trim();
      if (!campaignId || !goalId) {
        return res.status(400).json({ ok: false, error: "Campaign id and goal id are required." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const deletedRows = await db
        .delete(creatorCampaignGoals)
        .where(and(eq(creatorCampaignGoals.id, goalId), eq(creatorCampaignGoals.campaignId, campaign.id)))
        .returning({ id: creatorCampaignGoals.id });
  
      if (!deletedRows[0]) {
        return res.status(404).json({ ok: false, error: "Campaign goal not found." });
      }
  
      return res.json({ ok: true, goalId });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Unknown error";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/goals/:goalId", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to delete campaign goal"));
    }
  });
  
  r.post("/campaigns/:id/variants/:variantId/events", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      const variantId = String(req.params.variantId ?? "").trim();
      const parsed = z.object({
        eventType: z.enum(["view_variant", "click_variant_cta"]),
        metadata: z.record(z.unknown()).optional().nullable(),
      }).safeParse(req.body ?? {});
  
      if (!campaignId || !variantId) {
        return res.status(400).json({ ok: false, error: "Campaign id and variant id are required." });
      }
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign variant event payload." });
      }
  
      const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.id, campaignId)).limit(1);
      const campaign = campaignRows[0];
      const variant = await loadCampaignVariantForTracking(campaignId, variantId);
      if (!campaign || !variant) {
        return res.status(404).json({ ok: false, error: "Campaign CTA variant not found." });
      }
  
      const viewerId = req.user?.id ?? null;
      const [followedCreatorIds, memberCreatorIds] = await Promise.all([
        loadFollowedCreatorIdsForUser(viewerId),
        loadActiveMembershipCreatorIdsForUser(viewerId),
      ]);
      if (!canViewerSeeCreatorCampaign({ campaign, viewerId, followedCreatorIds, memberCreatorIds })) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      await trackCreatorCampaignVariantEvent({
        campaignId,
        variantId,
        eventType: parsed.data.eventType,
        userId: viewerId,
        sessionKey: getCampaignEngagementSessionKey(req),
        metadata: parsed.data.metadata ?? null,
      });
  
      return res.status(201).json({ ok: true });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id/variants/:variantId/events", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to track campaign CTA event"));
    }
  });
  
  r.get("/campaigns/:slug", optionalAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const slug = String(req.params.slug ?? "").trim();
      if (!slug) {
        return res.status(400).json({ ok: false, error: "Campaign slug is required." });
      }
  
      const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.slug, slug)).limit(1);
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
  
      const detail = await loadCreatorCampaignDetail(campaign, viewerId);
      const performance = await loadCreatorCampaignPerformanceSnapshots(campaign.creatorUserId);
      const campaignSnapshot = performance.items.find((item) => item.campaignId === campaign.id) ?? null;
      const ownerGoalRows = viewerId && viewerId === campaign.creatorUserId
        ? await loadCreatorCampaignGoalsByCampaignId(campaign.id)
        : [];
      const ownerHealthCollection = viewerId && viewerId === campaign.creatorUserId
        ? await loadCreatorCampaignHealth(campaign.creatorUserId)
        : null;
      const ownerLifecycleCollection = viewerId && viewerId === campaign.creatorUserId
        ? await loadCreatorCampaignLifecycleSuggestions(campaign.creatorUserId)
        : null;
      const ownerHealth = ownerHealthCollection?.items.find((item) => item.campaignId === campaign.id) ?? null;
      const ownerLifecycleSuggestion = ownerLifecycleCollection?.items.find((item) => item.campaignId === campaign.id) ?? null;
      const ownerAnalytics = viewerId && viewerId === campaign.creatorUserId
        ? campaignSnapshot
        : null;
      const ownerRollout = viewerId && viewerId === campaign.creatorUserId
        ? deriveCreatorCampaignRollout(campaign)
        : null;
      const ownerRolloutAnalyticsCollection = viewerId && viewerId === campaign.creatorUserId
        ? await loadCreatorCampaignRolloutAnalytics(campaign.creatorUserId, campaign.id)
        : null;
      const ownerRolloutAnalytics = ownerRolloutAnalyticsCollection?.items[0] ?? null;
      const ownerRolloutAdvisorCollection = viewerId && viewerId === campaign.creatorUserId
        ? await loadCreatorCampaignRolloutAdvisor(campaign.creatorUserId)
        : null;
      const ownerRolloutAdvice = ownerRolloutAdvisorCollection?.items.find((item) => item.campaignId === campaign.id) ?? null;
      const ownerTimingAdvisorCollection = viewerId && viewerId === campaign.creatorUserId
        ? await loadCreatorCampaignTimingAdvisor(campaign.creatorUserId, campaign.id)
        : null;
      const ownerTimingAdvice = ownerTimingAdvisorCollection?.items[0] ?? null;
      const ownerAudienceFitCollection = viewerId && viewerId === campaign.creatorUserId
        ? await loadCreatorCampaignAudienceFit(campaign.creatorUserId)
        : null;
      const ownerAudienceFit = ownerAudienceFitCollection?.items.find((item) => item.campaignId === campaign.id) ?? null;
      const ownerPlaybookFit = viewerId && viewerId === campaign.creatorUserId
        ? (await loadCreatorCampaignPlaybookFitCollection(campaign.creatorUserId, campaign.id)).items[0] ?? null
        : null;
      const ownerRetrospective = viewerId && viewerId === campaign.creatorUserId && getCreatorCampaignState(campaign) === "past"
        ? (await loadCreatorCampaignRetrospectives(campaign.creatorUserId)).items.find((item) => item.campaignId === campaign.id) ?? null
        : null;
      const ownerRecoveryPlan = ownerHealth ? buildCampaignRecoveryPlan(ownerHealth) : null;
      return res.json({
        ok: true,
        ...detail,
        milestones: {
          public: (campaignSnapshot?.milestones ?? []).filter((milestone) => milestone.isPublic && milestone.achieved),
          owner: viewerId && viewerId === campaign.creatorUserId ? (campaignSnapshot?.milestones ?? []) : [],
        },
        ownerGoals: viewerId && viewerId === campaign.creatorUserId
          ? ownerGoalRows.map((goal) => serializeCreatorCampaignGoal(goal, campaignSnapshot))
          : [],
        recentUpdates: buildCreatorCampaignUpdateItems(detail),
        ownerAnalytics,
        ownerRollout,
        ownerRolloutAnalytics,
        ownerRolloutAdvice,
        ownerTimingAdvice,
        ownerRolloutSuggestion: viewerId && viewerId === campaign.creatorUserId
          ? buildCampaignRolloutSuggestion({
            campaign,
            audienceFit: ownerAudienceFit
              ? {
                bestAudienceFit: ownerAudienceFit.bestAudienceFit as CreatorCampaignRolloutAudience | null,
                bestAudienceFitConfidence: ownerAudienceFit.bestAudienceFitConfidence,
                bestAudienceFitReason: ownerAudienceFit.bestAudienceFitReason,
              }
              : null,
          })
          : null,
        ownerPlaybookFit,
        ownerRetrospective,
        ownerHealth,
        ownerLifecycleSuggestion,
        ownerRecoveryPlan,
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:slug", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load creator campaign"));
    }
  });
  
  r.post("/campaigns", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const parsed = createCreatorCampaignBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign payload." });
      }
  
      const payload = parsed.data;
      const links = [...new Map((payload.links ?? []).map((link, index) => [`${link.targetType}:${link.targetId}`, {
        targetType: link.targetType,
        targetId: link.targetId.trim(),
        sortOrder: Number(link.sortOrder ?? index),
      }])).values()] as Array<{ targetType: CreatorCampaignTargetType; targetId: string; sortOrder: number }>;
  
      await validateCreatorCampaignLinks(req.user!.id, links);
  
      const values = insertCreatorCampaignSchema.parse({
        creatorUserId: req.user!.id,
        slug: payload.slug.trim().toLowerCase(),
        name: payload.name.trim(),
        description: payload.description?.trim() ? payload.description.trim() : null,
        visibility: payload.visibility,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
        isActive: payload.isActive ?? true,
        rolloutMode: payload.rolloutMode ?? "public_first",
        startsWithAudience: payload.startsWithAudience ?? null,
        unlockFollowersAt: payload.unlockFollowersAt ? new Date(payload.unlockFollowersAt) : null,
        unlockPublicAt: payload.unlockPublicAt ? new Date(payload.unlockPublicAt) : null,
        rolloutNotes: payload.rolloutNotes?.trim() ? payload.rolloutNotes.trim() : null,
        isRolloutActive: payload.isRolloutActive ?? false,
      });
  
      const inserted = await db.insert(creatorCampaigns).values({
        ...values,
        updatedAt: new Date(),
      }).returning();
      const campaign = inserted[0];
      if (!campaign) {
        return res.status(500).json({ ok: false, error: "Failed to create campaign." });
      }
  
      await replaceCreatorCampaignLinks(campaign.id, links);
      const detail = await loadCreatorCampaignDetail(campaign, req.user!.id);
      return res.status(201).json({ ok: true, ...detail });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to create creator campaign"));
    }
  });
  
  r.patch("/campaigns/:id", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = updateCreatorCampaignBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign payload." });
      }
  
      const existingRows = await db
        .select()
        .from(creatorCampaigns)
        .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      const payload = parsed.data;
      const links = payload.links
        ? [...new Map(payload.links.map((link, index) => [`${link.targetType}:${link.targetId}`, {
            targetType: link.targetType,
            targetId: link.targetId.trim(),
            sortOrder: Number(link.sortOrder ?? index),
          }])).values()] as Array<{ targetType: CreatorCampaignTargetType; targetId: string; sortOrder: number }>
        : null;
      if (links) {
        await validateCreatorCampaignLinks(req.user!.id, links);
      }
  
      const nextSlug = payload.slug !== undefined ? payload.slug.trim().toLowerCase() : existing.slug;
      const updatedRows = await db
        .update(creatorCampaigns)
        .set({
          slug: nextSlug,
          name: payload.name !== undefined ? payload.name.trim() : existing.name,
          description: payload.description !== undefined ? (payload.description?.trim() ? payload.description.trim() : null) : existing.description,
          visibility: payload.visibility ?? (existing.visibility as CreatorCampaignVisibility),
          startsAt: payload.startsAt !== undefined ? (payload.startsAt ? new Date(payload.startsAt) : null) : existing.startsAt,
          endsAt: payload.endsAt !== undefined ? (payload.endsAt ? new Date(payload.endsAt) : null) : existing.endsAt,
          isActive: payload.isActive ?? existing.isActive,
          rolloutMode: payload.rolloutMode ?? (existing.rolloutMode as CreatorCampaignRolloutMode),
          startsWithAudience: payload.startsWithAudience !== undefined ? payload.startsWithAudience : existing.startsWithAudience,
          unlockFollowersAt: payload.unlockFollowersAt !== undefined ? (payload.unlockFollowersAt ? new Date(payload.unlockFollowersAt) : null) : existing.unlockFollowersAt,
          unlockPublicAt: payload.unlockPublicAt !== undefined ? (payload.unlockPublicAt ? new Date(payload.unlockPublicAt) : null) : existing.unlockPublicAt,
          rolloutNotes: payload.rolloutNotes !== undefined ? (payload.rolloutNotes?.trim() ? payload.rolloutNotes.trim() : null) : existing.rolloutNotes,
          isRolloutActive: payload.isRolloutActive ?? existing.isRolloutActive,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaigns.id, campaignId))
        .returning();
  
      const campaign = updatedRows[0];
      if (!campaign) {
        return res.status(500).json({ ok: false, error: "Failed to update campaign." });
      }
      if (links) {
        await replaceCreatorCampaignLinks(campaign.id, links);
      }
      const detail = await loadCreatorCampaignDetail(campaign, req.user!.id);
      return res.json({ ok: true, ...detail });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to update creator campaign"));
    }
  });
  
  r.delete("/campaigns/:id", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const deletedRows = await db
        .delete(creatorCampaigns)
        .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
        .returning({ id: creatorCampaigns.id });
  
      if (!deletedRows[0]) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      return res.json({ ok: true, deletedId: deletedRows[0].id });
    } catch (error) {
      const message = logCollectionRouteError("/campaigns/:id", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to delete creator campaign"));
    }
  });
  
  r.get("/campaign-templates", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const templates = await db
        .select()
        .from(creatorCampaignTemplates)
        .where(eq(creatorCampaignTemplates.creatorUserId, req.user!.id))
        .orderBy(desc(creatorCampaignTemplates.updatedAt), desc(creatorCampaignTemplates.createdAt));
  
      const campaigns = await db
        .select()
        .from(creatorCampaigns)
        .where(eq(creatorCampaigns.creatorUserId, req.user!.id))
        .orderBy(desc(creatorCampaigns.updatedAt))
        .limit(3);
  
      return res.json({
        ok: true,
        count: templates.length,
        items: templates.map(serializeCreatorCampaignTemplate),
        basedOnPastCampaigns: campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          route: `/drinks/campaigns/${encodeURIComponent(campaign.slug)}`,
        })),
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaign-templates", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign templates"));
    }
  });
  
  r.post("/campaigns/:id/save-template", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = campaignTemplateActionBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const blueprint = await buildCampaignTemplateBlueprint(campaign);
      const templateName = parsed.data.templateName?.trim() || `${campaign.name} Template`;
  
      const inserted = await db.insert(creatorCampaignTemplates).values(insertCreatorCampaignTemplateSchema.parse({
        creatorUserId: req.user!.id,
        sourceCampaignId: campaign.id,
        name: templateName,
        description: parsed.data.templateDescription?.trim() || campaign.description || `Reusable arc based on ${campaign.name}.`,
        blueprint,
      })).onConflictDoUpdate({
        target: [creatorCampaignTemplates.creatorUserId, creatorCampaignTemplates.name],
        set: {
          sourceCampaignId: campaign.id,
          description: parsed.data.templateDescription?.trim() || campaign.description || `Reusable arc based on ${campaign.name}.`,
          blueprint,
          updatedAt: new Date(),
        },
      }).returning();
  
      return res.status(201).json({
        ok: true,
        item: serializeCreatorCampaignTemplate(inserted[0]),
        message: "Campaign template saved.",
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to save campaign template";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/save-template", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to save campaign template"));
    }
  });
  
  r.post("/campaigns/:id/clone", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = campaignTemplateActionBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid clone payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const blueprint = await buildCampaignTemplateBlueprint(campaign);
      const clonedCampaign = await instantiateCampaignFromTemplate({
        creatorUserId: req.user!.id,
        blueprint,
        newName: parsed.data.newName?.trim() || `${campaign.name} Copy`,
        newSlug: parsed.data.newSlug?.trim(),
        resetDates: parsed.data.resetDates ?? true,
        copyLinkedDrafts: parsed.data.copyLinkedDrafts ?? true,
        copyCtaVariants: parsed.data.copyCtaVariants ?? true,
      });
      const detail = await loadCreatorCampaignDetail(clonedCampaign, req.user!.id);
  
      return res.status(201).json({
        ok: true,
        ...detail,
        clonedFromCampaignId: campaign.id,
        safety: {
          followersCopied: false,
          analyticsCopied: false,
          purchasesCopied: false,
          alertsCopied: false,
          membershipsCopied: false,
        },
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to clone campaign";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/clone", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to clone campaign"));
    }
  });
  
  r.post("/campaign-templates/:id/create-campaign", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const templateId = String(req.params.id ?? "").trim();
      if (!templateId) {
        return res.status(400).json({ ok: false, error: "Template id is required." });
      }
  
      const parsed = campaignTemplateActionBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template usage payload." });
      }
  
      const templateRows = await db
        .select()
        .from(creatorCampaignTemplates)
        .where(and(eq(creatorCampaignTemplates.id, templateId), eq(creatorCampaignTemplates.creatorUserId, req.user!.id)))
        .limit(1);
      const template = templateRows[0];
      if (!template) {
        return res.status(404).json({ ok: false, error: "Campaign template not found." });
      }
  
      const blueprint = creatorCampaignTemplateBlueprintSchema.parse(template.blueprint);
      const createdCampaign = await instantiateCampaignFromTemplate({
        creatorUserId: req.user!.id,
        blueprint,
        newName: parsed.data.newName?.trim() || `${blueprint.campaign.name} Draft`,
        newSlug: parsed.data.newSlug?.trim(),
        resetDates: parsed.data.resetDates,
        copyLinkedDrafts: parsed.data.copyLinkedDrafts,
        copyCtaVariants: parsed.data.copyCtaVariants,
      });
      await db.update(creatorCampaignTemplates).set({ updatedAt: new Date() }).where(eq(creatorCampaignTemplates.id, template.id));
      const detail = await loadCreatorCampaignDetail(createdCampaign, req.user!.id);
  
      return res.status(201).json({
        ok: true,
        templateId: template.id,
        ...detail,
        safety: {
          followersCopied: false,
          analyticsCopied: false,
          purchasesCopied: false,
          alertsCopied: false,
          membershipsCopied: false,
        },
      });
    } catch (error) {
      const message = logCollectionRouteError("/campaign-templates/:id/create-campaign", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to create campaign from template"));
    }
  });
  }
