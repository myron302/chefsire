import { sql } from "drizzle-orm";
import type { RequestHandler } from "express";
import { db } from "../db";
import { hasAuthoritativePaidEntitlement } from "./subscription-security";

export type WeddingTier = "free" | "premium" | "elite";
type TrialRow = { tier: "premium" | "elite"; activatedAt: string | Date; expiresAt: string | Date; revokedAt: string | Date | null; active: boolean; remainingDays: number };
const rows = (result: any): TrialRow[] => result?.rows ?? (Array.isArray(result) ? result : []);

// All dates, identity and entitlement evidence originate on the server/database.
export async function readWeddingTrial(userId: string, executor = db) {
  const result = await executor.execute(sql`
    SELECT tier, activated_at AS "activatedAt", expires_at AS "expiresAt", revoked_at AS "revokedAt",
      (revoked_at IS NULL AND activated_at <= statement_timestamp() AND expires_at > statement_timestamp()) AS active,
      CASE WHEN revoked_at IS NULL THEN greatest(0, ceil(extract(epoch FROM (expires_at - statement_timestamp())) / 86400))::int ELSE 0 END AS "remainingDays"
    FROM wedding_intro_trials WHERE user_id = ${userId}
  `);
  return presentWeddingTrial(rows(result)[0]);
}

export function presentWeddingTrial(row?: TrialRow) {
  return {
    eligible: !row,
    status: !row ? "eligible" : row.revokedAt ? "cancelled" : row.active ? "active" : "expired",
    tier: row?.tier ?? null,
    activatedAt: row?.activatedAt ?? null,
    expiresAt: row?.expiresAt ?? null,
    remainingDays: row?.remainingDays ?? 0,
  };
}

export async function activateWeddingTrial(userId: string, tier: "premium" | "elite") {
  // A single insert is the transaction. The primary key arbitrates concurrent
  // requests, including different tiers. Conflicts never extend or replace a row.
  const result = await db.execute(sql`
    INSERT INTO wedding_intro_trials (user_id, tier) VALUES (${userId}, ${tier})
    ON CONFLICT (user_id) DO NOTHING
    RETURNING tier, activated_at AS "activatedAt", expires_at AS "expiresAt", revoked_at AS "revokedAt", true AS active, 14 AS "remainingDays"
  `);
  const row = rows(result)[0];
  return row ? presentWeddingTrial(row) : null;
}

export async function revokeWeddingTrial(userId: string) {
  await db.execute(sql`UPDATE wedding_intro_trials SET revoked_at = statement_timestamp() WHERE user_id = ${userId} AND revoked_at IS NULL`);
}

export async function weddingEntitlement(userId: string, recordedTier?: string | null, executor = db) {
  const trial = await readWeddingTrial(userId, executor);
  const paidTier = hasAuthoritativePaidEntitlement() && (recordedTier === "premium" || recordedTier === "elite") ? recordedTier : "free";
  const currentTier: WeddingTier = paidTier === "elite" ? "elite" : trial.status === "active" ? trial.tier! : paidTier;
  return {
    currentTier,
    status: currentTier === "free" ? "inactive" : "active",
    endsAt: trial.status === "active" ? trial.expiresAt : null,
    trial,
  };
}

export const requireWeddingTier = (minimum: "premium" | "elite"): RequestHandler => async (req, res, next) => {
  const userId = (req.user as { id?: string } | undefined)?.id;
  if (!userId) { res.status(401).json({ ok: false, error: "Not authenticated" }); return; }
  try {
    const { currentTier } = await weddingEntitlement(userId);
    if (currentTier === "free" || (minimum === "elite" && currentTier !== "elite")) {
      res.status(403).json({ ok: false, code: "WEDDING_TIER_REQUIRED", error: `${minimum === "elite" ? "Elite" : "Premium or Elite"} Wedding access required. Your saved content is preserved.` });
      return;
    }
    next();
  } catch (error) {
    console.error("Wedding entitlement unavailable:", error);
    res.status(503).json({ ok: false, error: "Unable to verify Wedding access. Please try again." });
  }
};
