import { and, desc, eq } from "drizzle-orm";
import { type Router } from "express";
import { z } from "zod";

export function registerDashboardRoutes(r: Router, ctx: any) {
  const {
    db,
    optionalAuth,
    requireAuth,
    ensureDrinkCollectionsSchema,
    logCollectionRouteError,
    collectionServerError,
    creatorCampaigns,
    loadCreatorCampaignAnalytics,
    loadCreatorCampaignFunnelBottlenecks,
    loadCreatorCampaignExperimentLibrary,
    loadCreatorCampaignFixMatching,
    loadCreatorCampaignRolloutAnalytics,
    loadCreatorCampaignRolloutAdvisor,
    loadCreatorCampaignTimingAdvisor,
    loadCreatorCampaignLaunchReadiness,
    loadCreatorCampaignUnlockReadinessAlerts,
    loadCreatorCampaignSurfaceAttribution,
    loadCreatorCampaignBenchmarks,
    loadCreatorCampaignAudienceFit,
    loadCreatorCampaignWeeklyDigest,
    loadCreatorCampaignHealth,
    loadCreatorCampaignRecoveryPlans,
    loadCreatorCampaignRecommendations,
    loadCreatorCampaignLifecycleSuggestions,
    loadCreatorCampaignActionCenter,
    loadCreatorCampaignActionCenterRaw,
    insertCreatorCampaignActionStateSchema,
    creatorCampaignActionStates,
    classifyCollectionError,
    collectionDbErrorResponse,
    logCollectionDbUnavailable,
    loadCreatorCollectionSalesSummary,
    loadCreatorCollectionOrders,
    loadCreatorCollectionFinanceSummary,
    loadCreatorMembershipDashboardSummary,
    creatorMembershipPlanInputSchema,
    normalizeMembershipPlanSlug,
    normalizeCollectionDescription,
    normalizeMembershipBillingInterval,
    loadCreatorMembershipPlanByCreatorId,
    creatorMembershipPlans,
    serializeMembershipPlan,
    loadCreatorCollectionConversionAnalytics,
    drinkCollectionPromotions,
    drinkCollections,
    promotionInputSchema,
    promotionUpdateSchema,
    normalizeCollectionRowForResponse,
    toNullableDate,
    loadWishlistCountsForCollections,
    logWishlistPromoAlertReady,
    maybeNotifyPromoActivation,
    creatorDrops,
    creatorDropEvents,
    creatorDropRsvps,
    creatorMemberships,
    loadCreatorCampaignRetrospectives,
  } = ctx as any;

r.get("/creator-dashboard/campaign-analytics", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const analytics = await loadCreatorCampaignAnalytics(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: analytics.summary,
        items: analytics.items,
        attributionNotes: analytics.attributionNotes,
        generatedAt: analytics.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-analytics", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign analytics"));
    }
  });
  
  r.get("/creator-dashboard/campaign-funnel-bottlenecks", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
      if (campaignId) {
        const ownedCampaign = await db
          .select({ id: creatorCampaigns.id })
          .from(creatorCampaigns)
          .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
          .limit(1);
        if (!ownedCampaign[0]) {
          return res.status(404).json({ ok: false, error: "Campaign not found." });
        }
      }
  
      const diagnostics = await loadCreatorCampaignFunnelBottlenecks(req.user!.id, campaignId || null);
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaignId || null,
        summary: diagnostics.summary,
        items: diagnostics.items,
        attributionNotes: diagnostics.attributionNotes,
        generatedAt: diagnostics.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-funnel-bottlenecks", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign funnel bottlenecks"));
    }
  });
  
  r.get("/creator-dashboard/campaign-experiment-library", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const library = await loadCreatorCampaignExperimentLibrary(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: library.summary,
        items: library.items,
        bestFixTypes: library.bestFixTypes,
        weakestFixTypes: library.weakestFixTypes,
        fixPatterns: library.fixPatterns,
        attributionNotes: library.attributionNotes,
        generatedAt: library.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-experiment-library", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign experiment library"));
    }
  });
  
  r.get("/creator-dashboard/campaign-fix-matching", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
      if (campaignId) {
        const ownedCampaign = await db
          .select({ id: creatorCampaigns.id })
          .from(creatorCampaigns)
          .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
          .limit(1);
        if (!ownedCampaign[0]) {
          return res.status(404).json({ ok: false, error: "Campaign not found." });
        }
      }
  
      const matching = await loadCreatorCampaignFixMatching(req.user!.id, campaignId || null);
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaignId || null,
        summary: matching.summary,
        items: matching.items,
        attributionNotes: matching.attributionNotes,
        generatedAt: matching.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-fix-matching", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign fix matching"));
    }
  });
  
  r.get("/creator-dashboard/campaign-rollout-analytics", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const analytics = await loadCreatorCampaignRolloutAnalytics(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: analytics.summary,
        items: analytics.items,
        attributionNotes: analytics.attributionNotes,
        generatedAt: analytics.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-rollout-analytics", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign rollout analytics"));
    }
  });
  
  r.get("/creator-dashboard/campaign-rollout-advisor", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const advisor = await loadCreatorCampaignRolloutAdvisor(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: advisor.summary,
        creatorInsights: advisor.creatorInsights,
        items: advisor.items,
        attributionNotes: advisor.attributionNotes,
        generatedAt: advisor.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-rollout-advisor", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign rollout advisor"));
    }
  });
  
  
  r.get("/creator-dashboard/campaign-timing-advisor", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
      if (campaignId) {
        const ownedCampaign = await db
          .select({ id: creatorCampaigns.id })
          .from(creatorCampaigns)
          .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
          .limit(1);
        if (!ownedCampaign[0]) {
          return res.status(404).json({ ok: false, error: "Campaign not found." });
        }
      }
  
      const advisor = await loadCreatorCampaignTimingAdvisor(req.user!.id, campaignId || null);
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaignId || null,
        summary: advisor.summary,
        creatorInsights: advisor.creatorInsights,
        items: advisor.items,
        attributionNotes: advisor.attributionNotes,
        generatedAt: advisor.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-timing-advisor", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign timing advisor"));
    }
  });
  
  r.get("/creator-dashboard/campaign-launch-readiness", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
      if (campaignId) {
        const ownedCampaign = await db
          .select({ id: creatorCampaigns.id })
          .from(creatorCampaigns)
          .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
          .limit(1);
        if (!ownedCampaign[0]) {
          return res.status(404).json({ ok: false, error: "Campaign not found." });
        }
      }
  
      const readiness = await loadCreatorCampaignLaunchReadiness(req.user!.id, campaignId || null);
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaignId || null,
        summary: readiness.summary,
        items: readiness.items,
        attributionNotes: readiness.attributionNotes,
        generatedAt: readiness.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-launch-readiness", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign launch readiness"));
    }
  });
  
  r.get("/creator-dashboard/campaign-unlock-alerts", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
      if (campaignId) {
        const ownedCampaign = await db
          .select({ id: creatorCampaigns.id })
          .from(creatorCampaigns)
          .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
          .limit(1);
        if (!ownedCampaign[0]) {
          return res.status(404).json({ ok: false, error: "Campaign not found." });
        }
      }
  
      const alerts = await loadCreatorCampaignUnlockReadinessAlerts(req.user!.id, campaignId || null);
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaignId || null,
        summary: alerts.summary,
        items: alerts.items,
        attributionNotes: alerts.attributionNotes,
        generatedAt: alerts.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-unlock-alerts", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign unlock alerts"));
    }
  });
  
  r.get("/creator-dashboard/campaign-surface-attribution", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const attribution = await loadCreatorCampaignSurfaceAttribution(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: attribution.summary,
        supportedSurfaces: attribution.supportedSurfaces,
        overallSurfaces: attribution.overallSurfaces,
        topSurfaceInsights: attribution.topSurfaceInsights,
        items: attribution.items,
        attributionNotes: attribution.attributionNotes,
        generatedAt: attribution.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-surface-attribution", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign surface attribution"));
    }
  });
  
  r.get("/creator-dashboard/campaign-benchmarks", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const benchmarks = await loadCreatorCampaignBenchmarks(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: benchmarks.summary,
        items: benchmarks.items,
        insights: benchmarks.insights,
        attributionNotes: benchmarks.attributionNotes,
        generatedAt: benchmarks.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-benchmarks", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign benchmarks"));
    }
  });
  
  r.get("/creator-dashboard/campaign-audience-fit", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const audienceFit = await loadCreatorCampaignAudienceFit(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: audienceFit.summary,
        items: audienceFit.items,
        attributionNotes: audienceFit.attributionNotes,
        generatedAt: audienceFit.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-audience-fit", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign audience fit"));
    }
  });
  
  r.get("/creator-dashboard/campaign-weekly-digest", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const digest = await loadCreatorCampaignWeeklyDigest(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        window: digest.window,
        summary: digest.summary,
        items: digest.items,
        attributionNotes: digest.attributionNotes,
        generatedAt: digest.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-weekly-digest", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign weekly digest"));
    }
  });
  
  r.get("/creator-dashboard/campaign-health", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const health = await loadCreatorCampaignHealth(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: health.summary,
        items: health.items,
        watchlist: health.watchlist,
        attributionNotes: health.attributionNotes,
        generatedAt: health.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-health", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign health"));
    }
  });
  
  r.get("/creator-dashboard/campaign-recovery-plans", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const recoveryPlans = await loadCreatorCampaignRecoveryPlans(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: recoveryPlans.summary,
        items: recoveryPlans.items,
        attributionNotes: recoveryPlans.attributionNotes,
        generatedAt: recoveryPlans.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-recovery-plans", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign recovery plans"));
    }
  });
  
  r.get("/creator-dashboard/campaign-recommendations", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const recommendations = await loadCreatorCampaignRecommendations(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: recommendations.summary,
        items: recommendations.items,
        attributionNotes: recommendations.attributionNotes,
        generatedAt: recommendations.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-recommendations", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign recommendations"));
    }
  });
  
  r.get("/creator-dashboard/campaign-lifecycle-suggestions", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const lifecycle = await loadCreatorCampaignLifecycleSuggestions(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: lifecycle.summary,
        items: lifecycle.items,
        attributionNotes: lifecycle.attributionNotes,
        generatedAt: lifecycle.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-lifecycle-suggestions", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign lifecycle suggestions"));
    }
  });
  
  r.get("/creator-dashboard/campaign-action-center", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
      if (campaignId) {
        const ownedCampaign = await db
          .select({ id: creatorCampaigns.id })
          .from(creatorCampaigns)
          .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
          .limit(1);
        if (!ownedCampaign[0]) {
          return res.status(404).json({ ok: false, error: "Campaign not found." });
        }
      }
  
      const actionCenter = await loadCreatorCampaignActionCenter(req.user!.id, campaignId || null);
      return res.json({
        ok: true,
        userId: req.user!.id,
        campaignId: campaignId || null,
        summary: actionCenter.summary,
        items: actionCenter.items,
        recentlyCompleted: actionCenter.recentlyCompleted,
        attributionNotes: actionCenter.attributionNotes,
        generatedAt: actionCenter.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-action-center", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign action center"));
    }
  });
  
  r.post("/creator-dashboard/campaign-actions/:actionKey/dismiss", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const actionKey = decodeURIComponent(req.params.actionKey ?? "").trim();
      const payload = campaignActionStateUpdateSchema.safeParse(req.body ?? {});
      if (!actionKey || !payload.success) {
        return res.status(400).json({ ok: false, error: "Invalid action request." });
      }
  
      const item = await loadCreatorCampaignActionCandidate(req.user!.id, actionKey, payload.data.campaignId ?? null);
      if (!item) {
        return res.status(404).json({ ok: false, error: "Campaign action not found." });
      }
  
      await upsertCreatorCampaignActionState({
        userId: req.user!.id,
        item,
        state: "dismissed",
        snoozedUntil: null,
      });
  
      return res.json({ ok: true, actionKey: item.actionKey, state: "dismissed" });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-actions/:actionKey/dismiss", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to dismiss campaign action"));
    }
  });
  
  r.post("/creator-dashboard/campaign-actions/:actionKey/snooze", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const actionKey = decodeURIComponent(req.params.actionKey ?? "").trim();
      const payload = campaignActionSnoozeSchema.safeParse(req.body ?? {});
      if (!actionKey || !payload.success) {
        return res.status(400).json({ ok: false, error: "Invalid snooze request." });
      }
  
      const item = await loadCreatorCampaignActionCandidate(req.user!.id, actionKey, payload.data.campaignId ?? null);
      if (!item) {
        return res.status(404).json({ ok: false, error: "Campaign action not found." });
      }
  
      const snoozedUntil = payload.data.snoozedUntil
        ? new Date(payload.data.snoozedUntil)
        : new Date(Date.now() + (payload.data.durationDays ?? 7) * 24 * 60 * 60 * 1000);
      if (Number.isNaN(snoozedUntil.getTime())) {
        return res.status(400).json({ ok: false, error: "Invalid snooze date." });
      }
  
      await upsertCreatorCampaignActionState({
        userId: req.user!.id,
        item,
        state: "snoozed",
        snoozedUntil,
      });
  
      return res.json({ ok: true, actionKey: item.actionKey, state: "snoozed", snoozedUntil: snoozedUntil.toISOString() });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-actions/:actionKey/snooze", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to snooze campaign action"));
    }
  });
  
  r.post("/creator-dashboard/campaign-actions/:actionKey/complete", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const actionKey = decodeURIComponent(req.params.actionKey ?? "").trim();
      const payload = campaignActionStateUpdateSchema.safeParse(req.body ?? {});
      if (!actionKey || !payload.success) {
        return res.status(400).json({ ok: false, error: "Invalid action request." });
      }
  
      const item = await loadCreatorCampaignActionCandidate(req.user!.id, actionKey, payload.data.campaignId ?? null);
      if (!item) {
        return res.status(404).json({ ok: false, error: "Campaign action not found." });
      }
  
      await upsertCreatorCampaignActionState({
        userId: req.user!.id,
        item,
        state: "completed",
        snoozedUntil: null,
      });
  
      return res.json({ ok: true, actionKey: item.actionKey, state: "completed" });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-actions/:actionKey/complete", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to complete campaign action"));
    }
  });
  
  r.post("/creator-dashboard/campaign-actions/:actionKey/reopen", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const actionKey = decodeURIComponent(req.params.actionKey ?? "").trim();
      const payload = campaignActionStateUpdateSchema.safeParse(req.body ?? {});
      if (!actionKey || !payload.success) {
        return res.status(400).json({ ok: false, error: "Invalid action request." });
      }
  
      const item = await loadCreatorCampaignActionCandidate(req.user!.id, actionKey, payload.data.campaignId ?? null);
      if (!item) {
        return res.status(404).json({ ok: false, error: "Campaign action not found." });
      }
  
      await upsertCreatorCampaignActionState({
        userId: req.user!.id,
        item,
        state: "open",
        snoozedUntil: null,
      });
  
      return res.json({ ok: true, actionKey: item.actionKey, state: "open" });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-actions/:actionKey/reopen", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to reopen campaign action"));
    }
  });
  
  r.get("/creator-dashboard/campaign-retrospectives", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const retrospectives = await loadCreatorCampaignRetrospectives(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: retrospectives.summary,
        items: retrospectives.items,
        attributionNotes: retrospectives.attributionNotes,
        generatedAt: retrospectives.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-retrospectives", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign retrospectives"));
    }
  });
  
  r.get("/creator-dashboard/drop-analytics", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const creatorUserId = req.user!.id;
      const drops = await db
        .select()
        .from(creatorDrops)
        .where(eq(creatorDrops.creatorUserId, creatorUserId))
        .orderBy(desc(creatorDrops.scheduledFor))
        .limit(160);
  
      const dropIds = drops.map((drop) => drop.id);
      const linkedCollectionIds = [...new Set(drops.map((drop) => drop.linkedCollectionId).filter((value): value is string => Boolean(value)))];
  
      const [eventRows, rsvpRows, notificationRows, purchaseRows, membershipRows] = await Promise.all([
        dropIds.length
          ? db.select({
              dropId: creatorDropEvents.dropId,
              eventType: creatorDropEvents.eventType,
              count: sql<number>`count(*)::int`,
            }).from(creatorDropEvents).where(inArray(creatorDropEvents.dropId, dropIds)).groupBy(creatorDropEvents.dropId, creatorDropEvents.eventType)
          : Promise.resolve([] as Array<{ dropId: string; eventType: string; count: number }>),
        dropIds.length
          ? db.select({ dropId: creatorDropRsvps.dropId, count: sql<number>`count(*)::int` }).from(creatorDropRsvps).where(inArray(creatorDropRsvps.dropId, dropIds)).groupBy(creatorDropRsvps.dropId)
          : Promise.resolve([] as Array<{ dropId: string; count: number }>),
        dropIds.length
          ? db.select({
              dropId: sql<string>`${notifications.metadata}->>'dropId'`,
              count: sql<number>`count(*)::int`,
            }).from(notifications).where(
              or(...dropIds.map((id) => sql`${notifications.metadata}->>'dropId' = ${id}`)),
            ).groupBy(sql`${notifications.metadata}->>'dropId'`)
          : Promise.resolve([] as Array<{ dropId: string; count: number }>),
        linkedCollectionIds.length
          ? db.select({
              collectionId: drinkCollectionPurchases.collectionId,
              createdAt: drinkCollectionPurchases.createdAt,
              status: drinkCollectionPurchases.status,
            }).from(drinkCollectionPurchases).where(inArray(drinkCollectionPurchases.collectionId, linkedCollectionIds))
          : Promise.resolve([] as Array<{ collectionId: string; createdAt: Date; status: string }>),
        db.select({
          creatorUserId: creatorMemberships.creatorUserId,
          createdAt: creatorMemberships.createdAt,
          status: creatorMemberships.status,
        }).from(creatorMemberships).where(eq(creatorMemberships.creatorUserId, creatorUserId)),
      ]);
  
      const eventCountMap = new Map<string, { viewCount: number; linkedClicksCount: number }>();
      for (const row of eventRows) {
        const current = eventCountMap.get(row.dropId) ?? { viewCount: 0, linkedClicksCount: 0 };
        if (row.eventType === "view_drop") current.viewCount = Number(row.count ?? 0);
        if (row.eventType === "click_drop_target") current.linkedClicksCount = Number(row.count ?? 0);
        eventCountMap.set(row.dropId, current);
      }
      const rsvpCountMap = new Map(rsvpRows.map((row) => [row.dropId, Number(row.count ?? 0)]));
      const alertsSentMap = new Map(notificationRows.map((row) => [row.dropId, Number(row.count ?? 0)]));
      const purchasesByCollection = new Map<string, Array<{ createdAt: Date; status: string }>>();
      for (const row of purchaseRows) {
        const current = purchasesByCollection.get(row.collectionId) ?? [];
        current.push({ createdAt: row.createdAt, status: row.status });
        purchasesByCollection.set(row.collectionId, current);
      }
  
      const items = drops.map((drop) => {
        const metrics = eventCountMap.get(drop.id) ?? { viewCount: 0, linkedClicksCount: 0 };
        const rsvpCount = rsvpCountMap.get(drop.id) ?? 0;
        const alertsSentCount = alertsSentMap.get(drop.id) ?? 0;
        const linkedPurchases = drop.linkedCollectionId
          ? (purchasesByCollection.get(drop.linkedCollectionId) ?? []).filter((purchase) => purchase.createdAt >= drop.scheduledFor && purchase.status === "completed")
          : [];
        const membershipConversions = drop.dropType === "member_drop"
          ? membershipRows.filter((membership) => membership.status === "active" && membership.createdAt >= drop.scheduledFor).length
          : 0;
        const funnelBase = metrics.viewCount > 0 ? metrics.viewCount : rsvpCount > 0 ? rsvpCount : 0;
        const conversionRate = funnelBase > 0 ? Number((((linkedPurchases.length + membershipConversions) / funnelBase) * 100).toFixed(1)) : null;
  
        return {
          dropId: drop.id,
          title: drop.title,
          status: getCreatorDropStatus(drop),
          scheduledFor: drop.scheduledFor.toISOString(),
          liveAt: drop.isPublished && drop.scheduledFor <= new Date() ? drop.scheduledFor.toISOString() : null,
          rsvpCount,
          viewCount: metrics.viewCount,
          alertsSentCount,
          linkedClicksCount: metrics.linkedClicksCount,
          purchaseCount: linkedPurchases.length,
          membershipConversionsCount: membershipConversions,
          membershipConversionsNote: drop.dropType === "member_drop" ? "Approximate: counts memberships started after this member drop went live." : null,
          purchaseAttributionNote: drop.linkedCollectionId ? "Approximate: counts completed purchases of the linked collection after this drop's launch time." : null,
          conversionRate,
          linkedCollectionId: drop.linkedCollectionId ?? null,
          linkedPromotionId: drop.linkedPromotionId ?? null,
        };
      });
  
      return res.json({
        ok: true,
        userId: creatorUserId,
        summary: {
          totalDrops: items.length,
          upcomingDrops: items.filter((item) => item.status === "upcoming").length,
          liveDrops: items.filter((item) => item.status === "live").length,
          archivedDrops: items.filter((item) => item.status === "archived").length,
          totalViews: items.reduce((sum, item) => sum + item.viewCount, 0),
          totalRsvps: items.reduce((sum, item) => sum + item.rsvpCount, 0),
          totalAlertsSent: items.reduce((sum, item) => sum + item.alertsSentCount, 0),
          totalLinkedClicks: items.reduce((sum, item) => sum + item.linkedClicksCount, 0),
          totalPurchasesFromDrops: items.reduce((sum, item) => sum + item.purchaseCount, 0),
          totalMembershipConversions: items.reduce((sum, item) => sum + item.membershipConversionsCount, 0),
        },
        attributionNotes: [
          "Drop views and click-throughs are counted from dedicated drop pages.",
          "Purchases from linked release are approximate and count completed linked-collection purchases after the drop launch time.",
          "Membership conversions are approximate and only shown for member drops.",
        ],
        items,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/drop-analytics", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load drop launch analytics"));
    }
  });
  
  r.get("/creator-dashboard/sales", requireAuth, async (req, res) => {
    try {
      if (!db) {
        logCollectionDbUnavailable("/creator-dashboard/sales", req);
        return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
      }
  
      await ensureDrinkCollectionsSchema();
  
      const sales = await loadCreatorCollectionSalesSummary(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        totals: sales.totals,
        reviewInsights: sales.reviewInsights,
        collections: sales.collections,
        reportingNotes: [
          "Active purchases only count when the ownership record is still in completed status.",
          "Refunded, refund-pending, and revoked premium sales are tracked separately and excluded from completed sales totals.",
          "Gross sales are reporting only, use the actual paid amount after discounts, and do not imply payouts or net earnings.",
          "Reviews are social proof only and do not change ownership, finance reporting, or conversion analytics directly.",
        ],
      });
    } catch (error) {
      logCollectionRouteError("/creator-dashboard/sales", req, error);
      const payload = collectionDbErrorResponse(error, "Failed to load creator sales");
      const status = classifyCollectionError(error, "Failed to load creator sales").status;
      return res.status(status).json(payload);
    }
  });
  
  r.get("/creator-dashboard/orders", requireAuth, async (req, res) => {
    try {
      if (!db) {
        logCollectionDbUnavailable("/creator-dashboard/orders", req);
        return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
      }
  
      await ensureDrinkCollectionsSchema();
  
      const orders = await loadCreatorCollectionOrders(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        orders,
        count: orders.length,
        reportingNotes: [
          "Completed sale means the premium collection purchase is still counted in finance totals at the actual paid amount.",
          "Refunded sale, pending refund, and revoked access stay visible for audit history but do not imply payouts.",
          "Buyer details stay privacy-safe in this dashboard.",
        ],
      });
    } catch (error) {
      logCollectionRouteError("/creator-dashboard/orders", req, error);
      const payload = collectionDbErrorResponse(error, "Failed to load creator order history");
      const status = classifyCollectionError(error, "Failed to load creator order history").status;
      return res.status(status).json(payload);
    }
  });
  
  r.get("/creator-dashboard/finance", requireAuth, async (req, res) => {
    try {
      if (!db) {
        logCollectionDbUnavailable("/creator-dashboard/finance", req);
        return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
      }
  
      await ensureDrinkCollectionsSchema();
  
      const finance = await loadCreatorCollectionFinanceSummary(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: finance.summary,
        recentSales: finance.recentSales,
        reportingNotes: finance.reportingNotes,
      });
    } catch (error) {
      logCollectionRouteError("/creator-dashboard/finance", req, error);
      const payload = collectionDbErrorResponse(error, "Failed to load creator finance");
      const status = classifyCollectionError(error, "Failed to load creator finance").status;
      return res.status(status).json(payload);
    }
  });
  
  r.get("/creator-dashboard/membership", requireAuth, async (req, res) => {
    try {
      if (!db) {
        logCollectionDbUnavailable("/creator-dashboard/membership", req);
        return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
      }
      await ensureDrinkCollectionsSchema();
      const membership = await loadCreatorMembershipDashboardSummary(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        ...membership,
        reportingNotes: [
          "Membership revenue is reported separately from one-off premium collection sales.",
          "Version one memberships are term-based and manually renewed through a new Square checkout each billing period.",
        ],
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/membership", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load creator membership dashboard"));
    }
  });
  
  r.post("/creator-dashboard/membership-plan", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
      await ensureDrinkCollectionsSchema();
      const parsed = creatorMembershipPlanInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid membership plan payload", details: parsed.error.flatten() });
      }
  
      const data = parsed.data;
      const now = new Date();
      const values = {
        creatorUserId: req.user!.id,
        slug: normalizeMembershipPlanSlug(data.name, req.user!.id),
        name: data.name.trim(),
        description: normalizeCollectionDescription(data.description ?? null),
        priceCents: Math.round(Number(data.priceCents)),
        billingInterval: normalizeMembershipBillingInterval(data.billingInterval),
        isActive: Boolean(data.isActive ?? true),
        updatedAt: now,
      };
  
      const existing = await loadCreatorMembershipPlanByCreatorId(req.user!.id);
      const result = existing
        ? await db.update(creatorMembershipPlans).set(values).where(eq(creatorMembershipPlans.id, existing.id)).returning()
        : await db.insert(creatorMembershipPlans).values(values).returning();
  
      const summary = await loadCreatorMembershipDashboardSummary(req.user!.id);
      return res.status(existing ? 200 : 201).json({
        ok: true,
        plan: serializeMembershipPlan(result[0]),
        stats: summary.stats,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/membership-plan", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to save membership plan"));
    }
  });
  
  r.get("/creator-dashboard/conversions", requireAuth, async (req, res) => {
    try {
      if (!db) {
        logCollectionDbUnavailable("/creator-dashboard/conversions", req);
        return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
      }
  
      await ensureDrinkCollectionsSchema();
  
      const conversions = await loadCreatorCollectionConversionAnalytics(req.user!.id);
      return res.json({
        ok: true,
        userId: req.user!.id,
        summary: conversions.summary,
        collections: conversions.collections,
        reportingNotes: conversions.reportingNotes,
      });
    } catch (error) {
      logCollectionRouteError("/creator-dashboard/conversions", req, error);
      const payload = collectionDbErrorResponse(error, "Failed to load creator conversion analytics");
      const status = classifyCollectionError(error, "Failed to load creator conversion analytics").status;
      return res.status(status).json(payload);
    }
  });
  
  r.get("/creator-dashboard/promotions", requireAuth, async (req, res) => {
    try {
      if (!db) {
        logCollectionDbUnavailable("/creator-dashboard/promotions", req);
        return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
      }
  
      await ensureDrinkCollectionsSchema();
  
      const requestedCollectionId = typeof req.query.collectionId === "string" ? req.query.collectionId.trim() : "";
      const collectionFilter = requestedCollectionId.length
        ? and(
          eq(drinkCollectionPromotions.creatorUserId, req.user!.id),
          eq(drinkCollectionPromotions.collectionId, requestedCollectionId),
        )
        : eq(drinkCollectionPromotions.creatorUserId, req.user!.id);
  
      const rows = await db
        .select({
          id: drinkCollectionPromotions.id,
          collectionId: drinkCollectionPromotions.collectionId,
          collectionName: drinkCollections.name,
          code: drinkCollectionPromotions.code,
          discountType: drinkCollectionPromotions.discountType,
          discountValue: drinkCollectionPromotions.discountValue,
          startsAt: drinkCollectionPromotions.startsAt,
          endsAt: drinkCollectionPromotions.endsAt,
          isActive: drinkCollectionPromotions.isActive,
          maxRedemptions: drinkCollectionPromotions.maxRedemptions,
          redemptionCount: drinkCollectionPromotions.redemptionCount,
          createdAt: drinkCollectionPromotions.createdAt,
          updatedAt: drinkCollectionPromotions.updatedAt,
        })
        .from(drinkCollectionPromotions)
        .innerJoin(drinkCollections, eq(drinkCollectionPromotions.collectionId, drinkCollections.id))
        .where(collectionFilter)
        .orderBy(desc(drinkCollectionPromotions.createdAt));
  
      return res.json({
        ok: true,
        promotions: rows.map((row) => ({
          ...row,
          discountValue: Number(row.discountValue ?? 0),
          maxRedemptions: row.maxRedemptions === null ? null : Number(row.maxRedemptions ?? 0),
          redemptionCount: Number(row.redemptionCount ?? 0),
          startsAt: row.startsAt ? row.startsAt.toISOString() : null,
          endsAt: row.endsAt ? row.endsAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      logCollectionRouteError("/creator-dashboard/promotions", req, error);
      const payload = collectionDbErrorResponse(error, "Failed to load creator promotions");
      const status = classifyCollectionError(error, "Failed to load creator promotions").status;
      return res.status(status).json(payload);
    }
  });
  
  r.post("/creator-dashboard/promotions", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
      await ensureDrinkCollectionsSchema();
  
      const parsed = promotionInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid promotion details", details: parsed.error.flatten() });
      }
  
      const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, parsed.data.collectionId)).limit(1);
      const collection = collectionRows[0] ? normalizeCollectionRowForResponse(collectionRows[0]) : null;
      if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });
      if (collection.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });
      if (collection.accessType !== "premium_purchase") return res.status(400).json({ ok: false, error: "Promotions are only available for Premium Purchase collections" });
  
      if (parsed.data.discountType === "fixed" && parsed.data.discountValue >= Number(collection.priceCents ?? 0)) {
        return res.status(400).json({ ok: false, error: "Fixed discount must be less than the collection price." });
      }
  
      const values = {
        creatorUserId: req.user!.id,
        collectionId: collection.id,
        code: parsed.data.code,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        startsAt: toNullableDate(parsed.data.startsAt),
        endsAt: toNullableDate(parsed.data.endsAt),
        isActive: parsed.data.isActive ?? true,
        maxRedemptions: parsed.data.maxRedemptions ?? null,
        updatedAt: new Date(),
      } as const;
  
      const inserted = await db.insert(drinkCollectionPromotions).values(values).returning();
      const promotion = inserted[0];
      const wishlistAudienceCount = Number((await loadWishlistCountsForCollections([collection.id])).get(collection.id) ?? 0);
      if (promotion) {
        logWishlistPromoAlertReady({
          collectionId: collection.id,
          creatorUserId: req.user!.id,
          promotionId: promotion.id,
          wishlistAudienceCount,
        });
        await maybeNotifyPromoActivation({
          collection,
          previousPromotion: null,
          nextPromotion: promotion,
        });
      }
      return res.status(201).json({ ok: true, promotion, promoAlertReadyAudienceCount: wishlistAudienceCount });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/promotions", req, error);
      if (String(message).toLowerCase().includes("duplicate")) {
        return res.status(409).json({ ok: false, error: "That promo code already exists for this collection." });
      }
      return res.status(500).json(collectionServerError(message, "Failed to create promotion"));
    }
  });
  
  r.patch("/creator-dashboard/promotions/:id", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
      await ensureDrinkCollectionsSchema();
  
      const existingRows = await db.select().from(drinkCollectionPromotions).where(eq(drinkCollectionPromotions.id, req.params.id)).limit(1);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ ok: false, error: "Promotion not found" });
      if (existing.creatorUserId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });
  
      const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, existing.collectionId)).limit(1);
      const collection = collectionRows[0];
      if (!collection || collection.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });
  
      const parsed = promotionUpdateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid promotion update", details: parsed.error.flatten() });
      }
  
      const nextDiscountType = parsed.data.discountType ?? existing.discountType;
      const nextDiscountValue = parsed.data.discountValue ?? Number(existing.discountValue ?? 0);
      if (nextDiscountType === "percent" && nextDiscountValue >= 100) {
        return res.status(400).json({ ok: false, error: "Percent discounts must stay between 1 and 99." });
      }
      if (nextDiscountType === "fixed" && nextDiscountValue >= Number(collection.priceCents ?? 0)) {
        return res.status(400).json({ ok: false, error: "Fixed discount must be less than the collection price." });
      }
  
      const startsAt = parsed.data.startsAt !== undefined ? toNullableDate(parsed.data.startsAt) : existing.startsAt;
      const endsAt = parsed.data.endsAt !== undefined ? toNullableDate(parsed.data.endsAt) : existing.endsAt;
      if (startsAt && endsAt && endsAt <= startsAt) {
        return res.status(400).json({ ok: false, error: "Promotion end date must be after the start date." });
      }
  
      const updated = await db
        .update(drinkCollectionPromotions)
        .set({
          ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
          ...(parsed.data.discountType !== undefined ? { discountType: parsed.data.discountType } : {}),
          ...(parsed.data.discountValue !== undefined ? { discountValue: parsed.data.discountValue } : {}),
          ...(parsed.data.startsAt !== undefined ? { startsAt } : {}),
          ...(parsed.data.endsAt !== undefined ? { endsAt } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
          ...(parsed.data.maxRedemptions !== undefined ? { maxRedemptions: parsed.data.maxRedemptions } : {}),
          updatedAt: new Date(),
        })
        .where(eq(drinkCollectionPromotions.id, existing.id))
        .returning();
  
      const promotion = updated[0] ?? existing;
      const wishlistAudienceCount = Number((await loadWishlistCountsForCollections([collection.id])).get(collection.id) ?? 0);
      logWishlistPromoAlertReady({
        collectionId: collection.id,
        creatorUserId: req.user!.id,
        promotionId: promotion.id,
        wishlistAudienceCount,
      });
      await maybeNotifyPromoActivation({
        collection,
        previousPromotion: existing,
        nextPromotion: promotion,
      });
  
      return res.json({ ok: true, promotion, promoAlertReadyAudienceCount: wishlistAudienceCount });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/promotions/:id", req, error);
      if (String(message).toLowerCase().includes("duplicate")) {
        return res.status(409).json({ ok: false, error: "That promo code already exists for this collection." });
      }
      return res.status(500).json(collectionServerError(message, "Failed to update promotion"));
    }
  });
  
  r.delete("/creator-dashboard/promotions/:id", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
      await ensureDrinkCollectionsSchema();
  
      const existingRows = await db.select().from(drinkCollectionPromotions).where(eq(drinkCollectionPromotions.id, req.params.id)).limit(1);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ ok: false, error: "Promotion not found" });
      if (existing.creatorUserId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });
  
      await db.delete(drinkCollectionPromotions).where(eq(drinkCollectionPromotions.id, existing.id));
      return res.json({ ok: true, deletedId: existing.id });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/promotions/:id", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to delete promotion"));
    }
  });
  }
