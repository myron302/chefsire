import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware";

const router = Router();

const campaignIdSchema = z.object({ campaignId: z.string().min(1).max(160) });

function userIdFrom(req: any): string {
  return req.user?.id;
}

router.get("/state", requireAuth, async (req, res) => {
  try {
    const userId = userIdFrom(req);
    const saved = await db.execute(sql`
      SELECT campaign_id AS "campaignId", status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM user_nutrition_campaigns
      WHERE user_id = ${userId} AND status = 'saved'
      ORDER BY updated_at DESC
    `);
    const active = await db.execute(sql`
      SELECT campaign_id AS "campaignId", status, created_at AS "createdAt", updated_at AS "updatedAt", started_at AS "startedAt"
      FROM user_nutrition_campaigns
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY started_at DESC NULLS LAST, updated_at DESC
      LIMIT 1
    `);
    res.json({ savedCampaigns: saved.rows, activeCampaign: active.rows[0] ?? null });
  } catch (error) {
    console.error("nutrition campaigns state error", error);
    res.status(500).json({ message: "Failed to load campaign state" });
  }
});

router.get("/saved", requireAuth, async (req, res) => {
  try {
    const userId = userIdFrom(req);
    const result = await db.execute(sql`
      SELECT campaign_id AS "campaignId", status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM user_nutrition_campaigns
      WHERE user_id = ${userId} AND status = 'saved'
      ORDER BY updated_at DESC
    `);
    res.json({ savedCampaigns: result.rows });
  } catch (error) {
    console.error("nutrition campaigns saved error", error);
    res.status(500).json({ message: "Failed to load saved campaigns" });
  }
});

router.get("/active", requireAuth, async (req, res) => {
  try {
    const userId = userIdFrom(req);
    const result = await db.execute(sql`
      SELECT campaign_id AS "campaignId", status, created_at AS "createdAt", updated_at AS "updatedAt", started_at AS "startedAt"
      FROM user_nutrition_campaigns
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY started_at DESC NULLS LAST, updated_at DESC
      LIMIT 1
    `);
    res.json({ activeCampaign: result.rows[0] ?? null });
  } catch (error) {
    console.error("nutrition campaigns active error", error);
    res.status(500).json({ message: "Failed to load active campaign" });
  }
});

router.post("/saved", requireAuth, async (req, res) => {
  const parsed = campaignIdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid campaign id" });
  try {
    const userId = userIdFrom(req);
    const { campaignId } = parsed.data;
    const result = await db.execute(sql`
      INSERT INTO user_nutrition_campaigns (user_id, campaign_id, status)
      VALUES (${userId}, ${campaignId}, 'saved')
      ON CONFLICT (user_id, campaign_id, status)
      DO UPDATE SET updated_at = NOW()
      RETURNING campaign_id AS "campaignId", status, created_at AS "createdAt", updated_at AS "updatedAt"
    `);
    res.status(201).json({ savedCampaign: result.rows[0] });
  } catch (error) {
    console.error("nutrition campaigns save error", error);
    res.status(500).json({ message: "Failed to save campaign" });
  }
});

router.delete("/saved/:campaignId", requireAuth, async (req, res) => {
  const parsed = campaignIdSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: "Invalid campaign id" });
  try {
    const userId = userIdFrom(req);
    await db.execute(sql`
      DELETE FROM user_nutrition_campaigns
      WHERE user_id = ${userId} AND campaign_id = ${parsed.data.campaignId} AND status = 'saved'
    `);
    res.json({ ok: true, campaignId: parsed.data.campaignId });
  } catch (error) {
    console.error("nutrition campaigns unsave error", error);
    res.status(500).json({ message: "Failed to unsave campaign" });
  }
});

router.post("/active", requireAuth, async (req, res) => {
  const parsed = campaignIdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid campaign id" });
  try {
    const userId = userIdFrom(req);
    const { campaignId } = parsed.data;
    await db.execute(sql`UPDATE user_nutrition_campaigns SET status = 'completed', updated_at = NOW() WHERE user_id = ${userId} AND status = 'active'`);
    const result = await db.execute(sql`
      INSERT INTO user_nutrition_campaigns (user_id, campaign_id, status, started_at)
      VALUES (${userId}, ${campaignId}, 'active', NOW())
      ON CONFLICT (user_id, campaign_id, status)
      DO UPDATE SET updated_at = NOW(), started_at = COALESCE(user_nutrition_campaigns.started_at, NOW())
      RETURNING campaign_id AS "campaignId", status, created_at AS "createdAt", updated_at AS "updatedAt", started_at AS "startedAt"
    `);
    res.status(201).json({ activeCampaign: result.rows[0] });
  } catch (error) {
    console.error("nutrition campaigns activate error", error);
    res.status(500).json({ message: "Failed to start campaign" });
  }
});

export default router;
