// server/routes/wedding-insights.ts
//
// Wedding Planning - Custom Smart Tips & Next Steps (per user) backed by Neon/Postgres.

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const r = Router();

type InsightTip = {
  id: string;
  title: string;
  detail: string;
};

type InsightAction = {
  id: string;
  label: string;
  done: boolean;
};

// ────────────────────────────────────────────────────────────────
// Ensure table exists (runs automatically on first access)
async function ensureWeddingPlanningInsightsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_planning_insights (
      user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tips JSONB NOT NULL DEFAULT '[]'::jsonb,
      actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_planning_insights_user_idx
      ON wedding_planning_insights(user_id)
  `);
}
// ────────────────────────────────────────────────────────────────

function sanitizeTips(input: unknown): InsightTip[] {
  if (!Array.isArray(input)) return [];

  const out: InsightTip[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const t = item as any;

    const id = typeof t.id === "string" ? t.id.trim().slice(0, 64) : "";
    const title = typeof t.title === "string" ? t.title.trim().slice(0, 80) : "";
    const detail = typeof t.detail === "string" ? t.detail.trim().slice(0, 360) : "";

    if (!id) continue;
    if (!title && !detail) continue;

    out.push({ id, title: title || "Pinned tip", detail });
    if (out.length >= 25) break;
  }
  return out;
}

function sanitizeActions(input: unknown): InsightAction[] {
  if (!Array.isArray(input)) return [];

  const out: InsightAction[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const a = item as any;

    const id = typeof a.id === "string" ? a.id.trim().slice(0, 64) : "";
    const label = typeof a.label === "string" ? a.label.trim().slice(0, 120) : "";
    const done = typeof a.done === "boolean" ? a.done : false;

    if (!id || !label) continue;
    out.push({ id, label, done });
    if (out.length >= 25) break;
  }
  return out;
}

/**
 * GET /api/wedding/insights
 */
r.get("/insights", requireAuth, async (req, res) => {
  try {
    await ensureWeddingPlanningInsightsTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const result: any = await db.execute(sql`
      SELECT tips, actions
      FROM wedding_planning_insights
      WHERE user_id = ${userId}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    const tips = sanitizeTips(row?.tips ?? []);
    const actions = sanitizeActions(row?.actions ?? []);

    return res.json({ ok: true, tips, actions });
  } catch (err: any) {
    console.error("[Wedding Planning] fetch insights error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * POST /api/wedding/insights
 * Body: { tips: InsightTip[], actions: InsightAction[] }
 */
r.post("/insights", requireAuth, async (req, res) => {
  try {
    await ensureWeddingPlanningInsightsTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const tips = sanitizeTips(req.body?.tips);
    const actions = sanitizeActions(req.body?.actions);

    const tipsPayload = JSON.stringify(tips);
    const actionsPayload = JSON.stringify(actions);

    const result: any = await db.execute(sql`
      INSERT INTO wedding_planning_insights (user_id, tips, actions, updated_at, created_at)
      VALUES (${userId}, ${tipsPayload}::jsonb, ${actionsPayload}::jsonb, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET tips = EXCLUDED.tips, actions = EXCLUDED.actions, updated_at = NOW()
      RETURNING tips, actions, updated_at AS "updatedAt"
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    return res.json({
      ok: true,
      tips: sanitizeTips(row?.tips ?? tips),
      actions: sanitizeActions(row?.actions ?? actions),
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (err: any) {
    console.error("[Wedding Planning] save insights error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default r;
