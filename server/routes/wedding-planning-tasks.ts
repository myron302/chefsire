// server/routes/wedding-planning-tasks.ts
//
// Wedding Planning Checklist (planning progress) API backed by Neon/Postgres.

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

type PlanningTask = {
  id: string;
  label: string;
  completed: boolean;
  budgetKey?: string;
  cost?: number;
};

function sanitizeTasks(input: unknown): PlanningTask[] {
  if (!Array.isArray(input)) return [];

  const out: PlanningTask[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const t = item as any;
    const id = typeof t.id === "string" ? t.id.trim() : "";
    const label = typeof t.label === "string" ? t.label.trim() : "";
    const completed = typeof t.completed === "boolean" ? t.completed : false;
    const budgetKey = typeof t.budgetKey === "string" ? t.budgetKey.trim() : "";
    const cost = typeof t.cost === "number" && Number.isFinite(t.cost) && t.cost >= 0 ? t.cost : undefined;

    if (!id || !label) continue;

    out.push({
      id,
      label,
      completed,
      ...(budgetKey ? { budgetKey } : null),
      ...(typeof cost === "number" ? { cost } : null),
    });

    if (out.length >= 200) break; // safety cap
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Ensure table exists (runs automatically on first access)
async function ensureWeddingPlanningTasksTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_planning_tasks (
      user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_planning_tasks_user_idx
      ON wedding_planning_tasks(user_id)
  `);
}
// ────────────────────────────────────────────────────────────────

/**
 * GET /api/wedding/planning-tasks
 */
router.get("/planning-tasks", requireAuth, async (req, res) => {
  try {
    await ensureWeddingPlanningTasksTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const result: any = await db.execute(sql`
      SELECT tasks
      FROM wedding_planning_tasks
      WHERE user_id = ${userId}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    const tasks = sanitizeTasks(row?.tasks ?? []);

    return res.json({ ok: true, tasks });
  } catch (err: any) {
    console.error("[Wedding Planning] fetch planning tasks error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * POST /api/wedding/planning-tasks
 * Body: { tasks: PlanningTask[] }
 */
router.post("/planning-tasks", requireAuth, async (req, res) => {
  try {
    await ensureWeddingPlanningTasksTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const tasks = sanitizeTasks(req.body?.tasks);
    const payload = JSON.stringify(tasks);

    const result: any = await db.execute(sql`
      INSERT INTO wedding_planning_tasks (user_id, tasks, updated_at, created_at)
      VALUES (${userId}, ${payload}::jsonb, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET tasks = EXCLUDED.tasks, updated_at = NOW()
      RETURNING tasks, updated_at AS "updatedAt"
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    return res.json({ ok: true, tasks: sanitizeTasks(row?.tasks ?? tasks), updatedAt: row?.updatedAt ?? null });
  } catch (err: any) {
    console.error("[Wedding Planning] save planning tasks error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
