import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const r = Router();

/**
 * Budget settings for Wedding Planning (cross-device sync).
 *
 * Table: wedding_budget_settings
 * Primary key: user_id
 *
 * Endpoints:
 *   GET  /api/wedding/budget-settings
 *   POST /api/wedding/budget-settings
 */

function clampInt(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function normalizeAllocations(allocations: any) {
  if (!Array.isArray(allocations)) return null;

  const allowedKeys = new Set(["catering", "venue", "photography", "music", "flowers", "other"]);
  const cleaned = allocations
    .filter((a) => a && typeof a === "object" && allowedKeys.has(String(a.key)))
    .map((a) => ({
      key: String(a.key),
      label: String(a.label ?? "").slice(0, 80),
      percentage: clampInt(a.percentage, 0, 100),
    }));

  if (cleaned.length === 0) return null;

  // Ensure we always keep all keys (server will also accept partial, but filling keeps client simpler)
  const defaults = [
    { key: "catering", label: "Catering & Bar", percentage: 40 },
    { key: "venue", label: "Venue", percentage: 20 },
    { key: "photography", label: "Photography", percentage: 12 },
    { key: "music", label: "Music & Entertainment", percentage: 8 },
    { key: "flowers", label: "Flowers & Decor", percentage: 10 },
    { key: "other", label: "Other", percentage: 10 },
  ];

  const byKey = new Map(defaults.map((d) => [d.key, d]));
  for (const item of cleaned) {
    byKey.set(item.key, {
      key: item.key,
      label: item.label || byKey.get(item.key)?.label || item.key,
      percentage: item.percentage,
    });
  }

  const filled = defaults.map((d) => byKey.get(d.key) ?? d);

  // Rebalance other so totals don't exceed 100 (best-effort)
  const nonOtherTotal = filled.filter((a) => a.key !== "other").reduce((sum, a) => sum + a.percentage, 0);
  const otherPct = clampInt(100 - nonOtherTotal, 0, 100);

  return filled.map((a) => (a.key === "other" ? { ...a, percentage: otherPct } : a));
}

r.get("/budget-settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await db.execute(
      sql`
        SELECT user_id, budget_min, budget_max, guest_count, allocations, updated_at
        FROM wedding_budget_settings
        WHERE user_id = ${userId}
        LIMIT 1
      `
    );

    const row = (result as any).rows?.[0];
    if (!row) {
      return res.json({ ok: true, settings: null });
    }

    return res.json({
      ok: true,
      settings: {
        budgetMin: row.budget_min ?? 5000,
        budgetMax: row.budget_max ?? 50000,
        guestCount: row.guest_count ?? 100,
        allocations: row.allocations ?? null,
        updatedAt: row.updated_at ?? null,
      },
    });
  } catch (error) {
    console.error("[wedding-budget-settings] GET error:", error);
    return res.status(500).json({ ok: false, error: "Failed to load budget settings" });
  }
});

r.post("/budget-settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    const budgetMin = clampInt(req.body?.budgetMin, 0, 10000000);
    const budgetMax = clampInt(req.body?.budgetMax, 0, 10000000);
    const guestCount = clampInt(req.body?.guestCount, 0, 100000);

    const allocations = normalizeAllocations(req.body?.allocations);
    const allocationsJson = allocations ? JSON.stringify(allocations) : null;

    await db.execute(
      sql`
        INSERT INTO wedding_budget_settings (user_id, budget_min, budget_max, guest_count, allocations, updated_at)
        VALUES (${userId}, ${budgetMin}, ${budgetMax}, ${guestCount}, ${allocations ? sql`${JSON.stringify(allocations)}::jsonb` : sql`NULL`}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          budget_min = EXCLUDED.budget_min,
          budget_max = EXCLUDED.budget_max,
          guest_count = EXCLUDED.guest_count,
          allocations = EXCLUDED.allocations,
          updated_at = NOW()
      `
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("[wedding-budget-settings] POST error:", error);
    return res.status(500).json({ ok: false, error: "Failed to save budget settings" });
  }
});

export default r;
