import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const r = Router();


// ────────────────────────────────────────────────────────────────
// Ensure table exists (runs automatically on first access)
async function ensureWeddingBudgetSettingsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_budget_settings (
      user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      budget_min INTEGER NOT NULL DEFAULT 5000,
      budget_max INTEGER NOT NULL DEFAULT 50000,
      guest_count INTEGER NOT NULL DEFAULT 100,
      allocations JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_budget_settings_user_idx
      ON wedding_budget_settings(user_id)
  `);
}
// ────────────────────────────────────────────────────────────────


/**
 * Budget settings for Wedding Planning
 * GET /api/wedding/budget-settings
 * POST /api/wedding/budget-settings
 */
r.get("/budget-settings", requireAuth, async (req, res) => {
  try {
    await ensureWeddingBudgetSettingsTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const result: any = await db.execute(sql`
      SELECT budget_min AS "budgetMin",
             budget_max AS "budgetMax",
             guest_count AS "guestCount",
             allocations
      FROM wedding_budget_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    if (!row) {
      return res.json({
        ok: true,
        settings: null,
      });
    }

    return res.json({
      ok: true,
      settings: {
        budgetMin: typeof row.budgetMin === "number" ? row.budgetMin : null,
        budgetMax: typeof row.budgetMax === "number" ? row.budgetMax : null,
        guestCount: typeof row.guestCount === "number" ? row.guestCount : null,
        allocations: row.allocations ?? null,
      },
    });
  } catch (err: any) {
    console.error("[Wedding Budget] fetch budget settings error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

r.post("/budget-settings", requireAuth, async (req, res) => {
  try {
    await ensureWeddingBudgetSettingsTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const budgetMin = Number(req.body?.budgetMin);
    const budgetMax = Number(req.body?.budgetMax);
    const guestCount = Number(req.body?.guestCount);
    const allocations = req.body?.allocations ?? {};

    if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin < 0 || budgetMax < 0 || budgetMax < budgetMin) {
      return res.status(400).json({ ok: false, error: "Invalid budget range" });
    }

    if (!Number.isFinite(guestCount) || guestCount < 0) {
      return res.status(400).json({ ok: false, error: "Invalid guest count" });
    }

    const payload = JSON.stringify(allocations);

    const result: any = await db.execute(sql`
      INSERT INTO wedding_budget_settings (user_id, budget_min, budget_max, guest_count, allocations, updated_at, created_at)
      VALUES (${userId}, ${budgetMin}, ${budgetMax}, ${guestCount}, ${payload}::jsonb, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        budget_min = EXCLUDED.budget_min,
        budget_max = EXCLUDED.budget_max,
        guest_count = EXCLUDED.guest_count,
        allocations = EXCLUDED.allocations,
        updated_at = NOW()
      RETURNING budget_min AS "budgetMin",
                budget_max AS "budgetMax",
                guest_count AS "guestCount",
                allocations,
                updated_at AS "updatedAt"
    `);

    const row = result?.rows?.[0] ?? result?.[0];

    return res.json({
      ok: true,
      settings: {
        budgetMin: row?.budgetMin ?? budgetMin,
        budgetMax: row?.budgetMax ?? budgetMax,
        guestCount: row?.guestCount ?? guestCount,
        allocations: row?.allocations ?? allocations,
        updatedAt: row?.updatedAt ?? null,
      },
    });
  } catch (err: any) {
    console.error("[Wedding Budget] save budget settings error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default r;
