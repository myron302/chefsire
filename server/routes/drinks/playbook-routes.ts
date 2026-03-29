import { and, desc, eq, inArray } from "drizzle-orm";
import { type Router } from "express";
import { z } from "zod";

export function registerPlaybookRoutes(r: Router, ctx: any) {
  const {
    db,
    optionalAuth,
    requireAuth,
    ensureDrinkCollectionsSchema,
    creatorCampaignPlaybookProfiles,
    creatorCampaigns,
    logCollectionRouteError,
    collectionServerError,
    loadCreatorCampaignPlaybookLineageCollection,
    loadCreatorCampaignPlaybookFitCollection,
    loadCreatorCampaignPlaybookOutcomeCollection,
    loadCreatorCampaignPlaybookDriftCollection,
    loadCampaignForOwnerOrThrow,
    loadCreatorCampaignPlaybookOnboarding,
    saveCampaignPlaybookProfileBodySchema,
    buildCreatorCampaignPlaybookProfileFromCampaign,
    serializeCreatorCampaignPlaybookProfile,
    updatePlaybookFromCampaignBodySchema,
    buildNextPlaybookVersionLabel,
    PLAYBOOK_EVOLUTION_STRATEGY_FIELDS,
    createPlaybookForkFromCampaignBodySchema,
    applyCreatorCampaignPlaybookProfileToCampaign,
    normalizeCreatorCampaignPlaybookPreferredAudienceFit,
    loadCreatorCampaignDetail,
    createCreatorCampaignPlaybookProfileBodySchema,
    insertCreatorCampaignPlaybookProfileSchema,
    updateCreatorCampaignPlaybookProfileBodySchema,
    playbookOutcomeStrengthLabel,
  } = ctx as any;

r.get("/creator-dashboard/campaign-playbook-profiles", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const [lineage, campaigns, outcomes] = await Promise.all([
        loadCreatorCampaignPlaybookLineageCollection(req.user!.id),
        db
          .select()
          .from(creatorCampaigns)
          .where(eq(creatorCampaigns.creatorUserId, req.user!.id))
          .orderBy(desc(creatorCampaigns.updatedAt))
          .limit(24),
        loadCreatorCampaignPlaybookOutcomeCollection(req.user!.id),
      ]);
      const outcomeByPlaybookId = new Map(
        outcomes.items.map((item) => [String((item as { playbookId: string }).playbookId), item as {
          playbookId: string;
          appliedCount: number;
          scorecardLabel: CreatorCampaignPlaybookScorecardLabel;
          confidenceNote: string | null;
        }] as const),
      );
  
      return res.json({
        ok: true,
        count: lineage.items.length,
        items: lineage.items.map((profile) => ({
          ...profile,
          outcomeSnapshot: outcomeByPlaybookId.get(profile.id)
            ? {
                appliedCount: outcomeByPlaybookId.get(profile.id)!.appliedCount,
                scorecardLabel: outcomeByPlaybookId.get(profile.id)!.scorecardLabel,
                outcomeLabel: playbookOutcomeStrengthLabel(outcomeByPlaybookId.get(profile.id)!.scorecardLabel),
                confidenceNote: outcomeByPlaybookId.get(profile.id)!.confidenceNote,
              }
            : null,
        })),
        availableCampaigns: campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          route: `/drinks/campaigns/${encodeURIComponent(campaign.slug)}`,
        })),
        attributionNotes: [
          "Playbook profiles stay lightweight on purpose: they save reusable strategy settings, not analytics history, linked drafts, or a full campaign clone.",
          "This layer stays distinct from templates, rollout/timing advisors, and the experiment library. It simply stores the creator's own reusable strategic defaults.",
        ],
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-profiles", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook profiles"));
    }
  });
  
  r.post("/creator-dashboard/campaign-playbook-profiles", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const parsed = createCreatorCampaignPlaybookProfileBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid playbook profile payload." });
      }
  
      const payload = parsed.data;
      const inserted = await db
        .insert(creatorCampaignPlaybookProfiles)
        .values(insertCreatorCampaignPlaybookProfileSchema.parse({
          creatorUserId: req.user!.id,
          name: payload.name.trim(),
          description: payload.description?.trim() || null,
          visibilityStrategy: payload.visibilityStrategy ?? null,
          rolloutMode: payload.rolloutMode,
          startsWithAudience: payload.startsWithAudience ?? null,
          recommendedFollowerUnlockDelayHours: payload.recommendedFollowerUnlockDelayHours ?? null,
          recommendedPublicUnlockDelayHours: payload.recommendedPublicUnlockDelayHours ?? null,
          preferredCtaDirection: payload.preferredCtaDirection ?? null,
          preferredExperimentTypes: payload.preferredExperimentTypes ?? [],
          preferredAudienceFit: payload.preferredAudienceFit ?? null,
          notes: payload.notes?.trim() || null,
        }))
        .returning();
  
      return res.status(201).json({
        ok: true,
        item: serializeCreatorCampaignPlaybookProfile(inserted[0]!),
        message: "Campaign playbook profile saved.",
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-profiles", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to create campaign playbook profile"));
    }
  });
  
  r.patch("/creator-dashboard/campaign-playbook-profiles/:id", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const profileId = String(req.params.id ?? "").trim();
      if (!profileId) {
        return res.status(400).json({ ok: false, error: "Playbook profile id is required." });
      }
  
      const parsed = updateCreatorCampaignPlaybookProfileBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid playbook profile payload." });
      }
  
      const existingRows = await db
        .select()
        .from(creatorCampaignPlaybookProfiles)
        .where(and(eq(creatorCampaignPlaybookProfiles.id, profileId), eq(creatorCampaignPlaybookProfiles.creatorUserId, req.user!.id)))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Campaign playbook profile not found." });
      }
  
      const payload = parsed.data;
      const updated = await db
        .update(creatorCampaignPlaybookProfiles)
        .set({
          name: payload.name !== undefined ? payload.name.trim() : existing.name,
          description: payload.description !== undefined ? (payload.description?.trim() || null) : existing.description,
          visibilityStrategy: payload.visibilityStrategy !== undefined ? payload.visibilityStrategy : existing.visibilityStrategy,
          rolloutMode: payload.rolloutMode ?? (existing.rolloutMode as CreatorCampaignRolloutMode),
          startsWithAudience: payload.startsWithAudience !== undefined ? payload.startsWithAudience : existing.startsWithAudience,
          recommendedFollowerUnlockDelayHours: payload.recommendedFollowerUnlockDelayHours !== undefined ? payload.recommendedFollowerUnlockDelayHours : existing.recommendedFollowerUnlockDelayHours,
          recommendedPublicUnlockDelayHours: payload.recommendedPublicUnlockDelayHours !== undefined ? payload.recommendedPublicUnlockDelayHours : existing.recommendedPublicUnlockDelayHours,
          preferredCtaDirection: payload.preferredCtaDirection !== undefined ? payload.preferredCtaDirection : existing.preferredCtaDirection,
          preferredExperimentTypes: payload.preferredExperimentTypes !== undefined ? payload.preferredExperimentTypes : existing.preferredExperimentTypes,
          preferredAudienceFit: payload.preferredAudienceFit !== undefined
            ? payload.preferredAudienceFit
            : normalizeCreatorCampaignPlaybookPreferredAudienceFit(existing.preferredAudienceFit),
          notes: payload.notes !== undefined ? (payload.notes?.trim() || null) : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaignPlaybookProfiles.id, profileId))
        .returning();
  
      return res.json({
        ok: true,
        item: serializeCreatorCampaignPlaybookProfile(updated[0]!),
        message: "Campaign playbook profile updated.",
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-profiles/:id", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to update campaign playbook profile"));
    }
  });
  
  r.delete("/creator-dashboard/campaign-playbook-profiles/:id", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const profileId = String(req.params.id ?? "").trim();
      if (!profileId) {
        return res.status(400).json({ ok: false, error: "Playbook profile id is required." });
      }
  
      const deleted = await db
        .delete(creatorCampaignPlaybookProfiles)
        .where(and(eq(creatorCampaignPlaybookProfiles.id, profileId), eq(creatorCampaignPlaybookProfiles.creatorUserId, req.user!.id)))
        .returning({ id: creatorCampaignPlaybookProfiles.id });
  
      if (!deleted[0]) {
        return res.status(404).json({ ok: false, error: "Campaign playbook profile not found." });
      }
  
      return res.json({ ok: true, deletedId: deleted[0].id });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-profiles/:id", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to delete campaign playbook profile"));
    }
  });
  
  r.get("/creator-dashboard/campaign-playbook-lineage", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const lineage = await loadCreatorCampaignPlaybookLineageCollection(req.user!.id);
      return res.json({
        ok: true,
        count: lineage.items.length,
        items: lineage.items,
        attributionNotes: [
          "Playbook evolution stays intentionally lightweight: ChefSire only records parent/source relationships plus a small version label when it helps.",
          "Lineage shows where a saved strategy came from, not a giant diff history or full document version tree.",
        ],
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-lineage", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook lineage"));
    }
  });
  
  r.get("/creator-dashboard/campaign-playbook-fit", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const fit = await loadCreatorCampaignPlaybookFitCollection(req.user!.id);
      return res.json({
        ok: true,
        count: fit.items.length,
        profilesCount: fit.profiles.length,
        items: fit.items.map((item) => ({
          ...item,
          hasSuggestedPlaybook: Boolean((item as { bestMatch?: unknown }).bestMatch),
        })),
        attributionNotes: fit.attributionNotes,
        generatedAt: fit.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-fit", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook fit"));
    }
  });
  
  async function handleCreatorCampaignPlaybookOutcomesRoute(req: Request, res: Response) {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const outcomes = await loadCreatorCampaignPlaybookOutcomeCollection(req.user!.id);
      return res.json({
        ok: true,
        count: outcomes.items.length,
        strongestPlaybooks: outcomes.strongestPlaybooks,
        weakestPlaybooks: outcomes.weakestPlaybooks,
        items: outcomes.items,
        attributionNotes: outcomes.attributionNotes,
        generatedAt: outcomes.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-outcomes", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook outcomes"));
    }
  }
  
  r.get("/creator-dashboard/campaign-playbook-outcomes", requireAuth, handleCreatorCampaignPlaybookOutcomesRoute);
  r.get("/creator-dashboard/campaign-playbook-effectiveness", requireAuth, handleCreatorCampaignPlaybookOutcomesRoute);
  
  async function handleCreatorCampaignPlaybookDriftRoute(req: Request, res: Response) {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const drift = await loadCreatorCampaignPlaybookDriftCollection(req.user!.id);
      return res.json({
        ok: true,
        count: drift.items.length,
        items: drift.items,
        summary: drift.summary,
        attributionNotes: drift.attributionNotes,
        generatedAt: drift.generatedAt,
      });
    } catch (error) {
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-drift", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook drift"));
    }
  }
  
  r.get("/creator-dashboard/campaign-playbook-drift", requireAuth, handleCreatorCampaignPlaybookDriftRoute);
  
  r.get("/campaigns/:id/playbook-fit", requireAuth, async (req, res) => {
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
      const fit = await loadCreatorCampaignPlaybookFitCollection(req.user!.id, campaignId);
      const item = fit.items[0] ?? null;
      if (!item) {
        return res.status(404).json({ ok: false, error: "Campaign not found." });
      }
  
      return res.json({
        ok: true,
        ...item,
        attributionNotes: fit.attributionNotes,
        generatedAt: fit.generatedAt,
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to load campaign playbook fit";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/playbook-fit", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook fit"));
    }
  });
  
  r.get("/campaigns/:id/playbook-onboarding", requireAuth, async (req, res) => {
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
      const onboarding = await loadCreatorCampaignPlaybookOnboarding(campaign, req.user!.id);
  
      return res.json({
        ok: true,
        campaignId,
        item: onboarding,
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to load playbook onboarding";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/playbook-onboarding", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook onboarding"));
    }
  });
  
  r.get("/campaigns/:id/playbook-drift", requireAuth, async (req, res) => {
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
      const drift = await loadCreatorCampaignPlaybookDriftCollection(req.user!.id, campaignId);
      const item = drift.items[0] ?? null;
      if (!item) {
        return res.status(404).json({ ok: false, error: "Campaign does not have an applied playbook." });
      }
  
      return res.json({
        ok: true,
        campaignId,
        item,
        attributionNotes: drift.attributionNotes,
        generatedAt: drift.generatedAt,
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to load playbook drift";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/playbook-drift", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to load campaign playbook drift"));
    }
  });
  
  r.post("/campaigns/:id/save-playbook-profile", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = saveCampaignPlaybookProfileBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid playbook save payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const values = await buildCreatorCampaignPlaybookProfileFromCampaign({
        creatorUserId: req.user!.id,
        campaign,
        name: parsed.data.name ?? undefined,
        description: parsed.data.description ?? undefined,
        notes: parsed.data.notes ?? undefined,
      });
  
      const inserted = await db
        .insert(creatorCampaignPlaybookProfiles)
        .values(values)
        .onConflictDoUpdate({
          target: [creatorCampaignPlaybookProfiles.creatorUserId, creatorCampaignPlaybookProfiles.name],
          set: {
            description: values.description,
            visibilityStrategy: values.visibilityStrategy,
            rolloutMode: values.rolloutMode,
            startsWithAudience: values.startsWithAudience,
            recommendedFollowerUnlockDelayHours: values.recommendedFollowerUnlockDelayHours,
            recommendedPublicUnlockDelayHours: values.recommendedPublicUnlockDelayHours,
            preferredCtaDirection: values.preferredCtaDirection,
            preferredExperimentTypes: values.preferredExperimentTypes,
            preferredAudienceFit: values.preferredAudienceFit,
            notes: values.notes,
            sourceCampaignId: values.sourceCampaignId,
            derivedFromType: values.derivedFromType,
            updatedAt: new Date(),
          },
        })
        .returning();
  
      return res.status(201).json({
        ok: true,
        sourceCampaignId: campaign.id,
        item: serializeCreatorCampaignPlaybookProfile(inserted[0]!),
        message: "Campaign playbook profile saved from campaign strategy.",
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to save campaign playbook profile";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/save-playbook-profile", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to save campaign playbook profile"));
    }
  });
  
  r.post("/campaigns/:id/update-playbook-from-campaign", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = updatePlaybookFromCampaignBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid playbook evolution payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const targetPlaybookId = parsed.data.playbookProfileId?.trim() || campaign.appliedPlaybookProfileId || "";
      if (!targetPlaybookId) {
        return res.status(400).json({ ok: false, error: "Choose a saved playbook to update from this campaign." });
      }
  
      const targetRows = await db
        .select()
        .from(creatorCampaignPlaybookProfiles)
        .where(and(
          eq(creatorCampaignPlaybookProfiles.id, targetPlaybookId),
          eq(creatorCampaignPlaybookProfiles.creatorUserId, req.user!.id),
        ))
        .limit(1);
      const target = targetRows[0];
      if (!target) {
        return res.status(404).json({ ok: false, error: "Campaign playbook profile not found." });
      }
  
      const evolvedValues = await buildCreatorCampaignPlaybookProfileFromCampaign({
        creatorUserId: req.user!.id,
        campaign,
        name: target.name,
        description: parsed.data.description !== undefined ? parsed.data.description : target.description,
        notes: parsed.data.notes !== undefined ? parsed.data.notes : target.notes,
        parentPlaybookProfileId: target.parentPlaybookProfileId ?? null,
        sourceCampaignId: campaign.id,
        derivedFromType: target.parentPlaybookProfileId ? "playbook" : "campaign",
        versionLabel: parsed.data.versionLabel !== undefined ? parsed.data.versionLabel : target.versionLabel,
      });
  
      const updatedRows = await db
        .update(creatorCampaignPlaybookProfiles)
        .set({
          description: evolvedValues.description,
          visibilityStrategy: evolvedValues.visibilityStrategy,
          rolloutMode: evolvedValues.rolloutMode,
          startsWithAudience: evolvedValues.startsWithAudience,
          recommendedFollowerUnlockDelayHours: evolvedValues.recommendedFollowerUnlockDelayHours,
          recommendedPublicUnlockDelayHours: evolvedValues.recommendedPublicUnlockDelayHours,
          preferredCtaDirection: evolvedValues.preferredCtaDirection,
          preferredExperimentTypes: evolvedValues.preferredExperimentTypes,
          preferredAudienceFit: evolvedValues.preferredAudienceFit,
          notes: evolvedValues.notes,
          sourceCampaignId: campaign.id,
          derivedFromType: evolvedValues.derivedFromType,
          versionLabel: evolvedValues.versionLabel,
          updatedAt: new Date(),
        })
        .where(eq(creatorCampaignPlaybookProfiles.id, target.id))
        .returning();
  
      return res.json({
        ok: true,
        sourceCampaignId: campaign.id,
        playbookProfileId: target.id,
        item: serializeCreatorCampaignPlaybookProfile(updatedRows[0]!),
        copiedFields: [...PLAYBOOK_EVOLUTION_STRATEGY_FIELDS],
        message: "Saved campaign strategy back into the selected playbook.",
        safety: {
          analyticsCopied: false,
          followersCopied: false,
          purchasesCopied: false,
          membershipsCopied: false,
          alertsCopied: false,
          actionStateCopied: false,
        },
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to update playbook from campaign";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/update-playbook-from-campaign", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to update playbook from campaign"));
    }
  });
  
  r.post("/campaigns/:id/create-playbook-fork", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const campaignId = String(req.params.id ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "Campaign id is required." });
      }
  
      const parsed = createPlaybookForkFromCampaignBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid playbook fork payload." });
      }
  
      const campaign = await loadCampaignForOwnerOrThrow(campaignId, req.user!.id);
      const parentPlaybookId = parsed.data.parentPlaybookProfileId?.trim() || campaign.appliedPlaybookProfileId || null;
      const parentRows = parentPlaybookId
        ? await db
            .select()
            .from(creatorCampaignPlaybookProfiles)
            .where(and(
              eq(creatorCampaignPlaybookProfiles.id, parentPlaybookId),
              eq(creatorCampaignPlaybookProfiles.creatorUserId, req.user!.id),
            ))
            .limit(1)
        : [];
      const parent = parentRows[0] ?? null;
      if (parentPlaybookId && !parent) {
        return res.status(404).json({ ok: false, error: "Parent playbook profile not found." });
      }
  
      const versionLabel = await buildNextPlaybookVersionLabel({
        creatorUserId: req.user!.id,
        parentPlaybookProfileId: parent?.id ?? null,
        requestedVersionLabel: parsed.data.versionLabel,
      });
  
      const values = await buildCreatorCampaignPlaybookProfileFromCampaign({
        creatorUserId: req.user!.id,
        campaign,
        name: parsed.data.name ?? (parent ? `${parent.name} ${versionLabel ?? "Fork"}` : `${campaign.name} Strategy`),
        description: parsed.data.description ?? parent?.description ?? campaign.description,
        notes: parsed.data.notes ?? parent?.notes ?? null,
        parentPlaybookProfileId: parent?.id ?? null,
        sourceCampaignId: campaign.id,
        derivedFromType: parsed.data.derivedFromType ?? (parent ? "playbook" : "campaign"),
        versionLabel,
      });
  
      const insertedRows = await db
        .insert(creatorCampaignPlaybookProfiles)
        .values(values)
        .returning();
  
      return res.status(201).json({
        ok: true,
        sourceCampaignId: campaign.id,
        item: serializeCreatorCampaignPlaybookProfile(insertedRows[0]!),
        copiedFields: [...PLAYBOOK_EVOLUTION_STRATEGY_FIELDS],
        message: "Created a new playbook fork from this campaign.",
        safety: {
          analyticsCopied: false,
          followersCopied: false,
          purchasesCopied: false,
          membershipsCopied: false,
          alertsCopied: false,
          actionStateCopied: false,
        },
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to create playbook fork from campaign";
      if (baseMessage === "Campaign not found." || baseMessage === "Parent playbook profile not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/campaigns/:id/create-playbook-fork", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to create playbook fork from campaign"));
    }
  });
  
  r.post("/creator-dashboard/campaign-playbook-profiles/:id/apply-to-campaign/:campaignId", requireAuth, async (req, res) => {
    try {
      await ensureDrinkCollectionsSchema();
      if (!db) {
        return res.status(503).json({ ok: false, error: "Database unavailable" });
      }
  
      const profileId = String(req.params.id ?? "").trim();
      const campaignId = String(req.params.campaignId ?? "").trim();
      if (!profileId || !campaignId) {
        return res.status(400).json({ ok: false, error: "Playbook profile id and campaign id are required." });
      }
  
      const [profileRows, campaign] = await Promise.all([
        db
          .select()
          .from(creatorCampaignPlaybookProfiles)
          .where(and(eq(creatorCampaignPlaybookProfiles.id, profileId), eq(creatorCampaignPlaybookProfiles.creatorUserId, req.user!.id)))
          .limit(1),
        loadCampaignForOwnerOrThrow(campaignId, req.user!.id),
      ]);
      const profile = profileRows[0];
      if (!profile) {
        return res.status(404).json({ ok: false, error: "Campaign playbook profile not found." });
      }
  
      const updatedCampaign = await applyCreatorCampaignPlaybookProfileToCampaign({
        profile,
        campaign,
        actorUserId: req.user!.id,
      });
      const [detail, onboarding] = await Promise.all([
        loadCreatorCampaignDetail(updatedCampaign, req.user!.id),
        loadCreatorCampaignPlaybookOnboarding(updatedCampaign, req.user!.id),
      ]);
  
      return res.json({
        ok: true,
        profile: serializeCreatorCampaignPlaybookProfile(profile),
        appliedToCampaignId: updatedCampaign.id,
        message: "Campaign playbook profile applied.",
        playbookOnboarding: onboarding,
        ...detail,
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Failed to apply campaign playbook profile";
      if (baseMessage === "Campaign not found.") {
        return res.status(404).json({ ok: false, error: baseMessage });
      }
      const message = logCollectionRouteError("/creator-dashboard/campaign-playbook-profiles/:id/apply-to-campaign/:campaignId", req, error);
      return res.status(500).json(collectionServerError(message, "Failed to apply campaign playbook profile"));
    }
  });
  }
