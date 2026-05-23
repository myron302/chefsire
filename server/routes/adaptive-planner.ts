import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware";
import {
  getAdaptivePlannerHistory,
  getAdaptivePlannerProfile,
  getNutritionPersonalityProfile,
  getPlannerObjectives,
  getRelationshipLearning,
  saveAdaptivePlannerProfile,
  saveAdaptivePlannerSnapshot,
  saveNutritionPersonalityProfile,
  savePlannerObjective,
  saveRelationshipLearning,
} from "../adaptive-planner-storage";

const router = Router();
router.use(requireAuth);

const jsonRecord = z.record(z.string(), z.unknown()).default({});

router.get("/history", async (req, res, next) => { try { res.json({ items: await getAdaptivePlannerHistory(req.user!.id) }); } catch (e) { next(e); } });
router.post("/history", async (req, res, next) => {
  try {
    const body = z.object({ weekKey: z.string(), snapshotVersion: z.number().int().default(1), objectiveState: jsonRecord, adherenceState: jsonRecord, sustainabilityState: jsonRecord }).parse(req.body ?? {});
    const item = await saveAdaptivePlannerSnapshot(req.user!.id, body);
    res.status(201).json({ item: item[0] ?? null });
  } catch (e) { next(e); }
});

router.get("/profile", async (req, res, next) => { try { res.json({ item: (await getAdaptivePlannerProfile(req.user!.id))[0] ?? null }); } catch (e) { next(e); } });
router.post("/profile", async (req, res, next) => {
  try {
    const body = z.object({ profileVersion: z.string().default("v1"), plannerMode: z.string().default("balanced"), adaptationCadence: z.string().default("weekly"), currentGoalFocus: z.string().nullable().optional(), profileMetadata: jsonRecord }).parse(req.body ?? {});
    const item = await saveAdaptivePlannerProfile(req.user!.id, { ...body, currentGoalFocus: body.currentGoalFocus ?? null });
    res.status(201).json({ item: item[0] ?? null });
  } catch (e) { next(e); }
});

router.get("/personality", async (req, res, next) => { try { res.json({ item: (await getNutritionPersonalityProfile(req.user!.id))[0] ?? null }); } catch (e) { next(e); } });
router.post("/personality", async (req, res, next) => {
  try {
    const body = z.object({ personalityVersion: z.number().int().default(1), consistencyScore: z.number().int().default(0), noveltySeekingScore: z.number().int().default(0), routineAffinityScore: z.number().int().default(0), preferenceTags: z.array(z.string()).default([]), profileMetadata: jsonRecord }).parse(req.body ?? {});
    const item = await saveNutritionPersonalityProfile(req.user!.id, body);
    res.status(201).json({ item: item[0] ?? null });
  } catch (e) { next(e); }
});

router.get("/objectives", async (req, res, next) => { try { res.json({ items: await getPlannerObjectives(req.user!.id) }); } catch (e) { next(e); } });
router.post("/objectives", async (req, res, next) => {
  try {
    const body = z.object({ objectiveVersion: z.number().int().default(1), objectiveKey: z.string(), objectiveStatus: z.string().default("active"), objectiveScore: z.number().int().default(0), summaryMetadata: jsonRecord, observedAt: z.coerce.date().optional() }).parse(req.body ?? {});
    const item = await savePlannerObjective(req.user!.id, { ...body, observedAt: body.observedAt ?? new Date() });
    res.status(201).json({ item: item[0] ?? null });
  } catch (e) { next(e); }
});

router.get("/relationships", async (req, res, next) => { try { res.json({ items: await getRelationshipLearning(req.user!.id) }); } catch (e) { next(e); } });
router.post("/relationships", async (req, res, next) => {
  try {
    const body = z.object({ relationshipVersion: z.number().int().default(1), sourceDimension: z.string(), targetDimension: z.string(), confidenceScore: z.number().int().default(0), relationshipMetadata: jsonRecord }).parse(req.body ?? {});
    const item = await saveRelationshipLearning(req.user!.id, body);
    res.status(201).json({ item: item[0] ?? null });
  } catch (e) { next(e); }
});

export default router;
