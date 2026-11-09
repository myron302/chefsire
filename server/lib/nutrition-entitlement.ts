import { sql } from "drizzle-orm";
import { db } from "../db";
import { hasAuthoritativePaidEntitlement } from "./subscription-security";

/**
 * Nutrition Premium: a one-time, cardless 30-day introductory trial, recorded server-side in nutrition_intro_trials
 * (same model as wedding_intro_trials). The database sets activated_at and expires_at; the primary key allows one
 * trial per account ever; a conflict never extends or restarts it. Legacy users.nutrition_premium /
 * nutrition_trial_ends_at values are NOT evidence (clients could once set them), and there is no verified paid
 * Nutrition subscription yet, so an active trial row is the only source of access.
 */
export const NUTRITION_TRIAL_DAYS = 30;

type TrialRow = { activatedAt: string | Date; expiresAt: string | Date; revokedAt: string | Date | null; active: boolean; remainingDays: number };
const rows = (result: any): TrialRow[] => result?.rows ?? (Array.isArray(result) ? result : []);

export function presentNutritionTrial(row?: TrialRow) {
  return {
    eligible: !row,
    status: !row ? "eligible" : row.revokedAt ? "cancelled" : row.active ? "active" : "expired",
    activatedAt: row?.activatedAt ?? null,
    expiresAt: row?.expiresAt ?? null,
    remainingDays: row?.remainingDays ?? 0,
  } as const;
}

export async function readNutritionTrial(userId: string, executor = db) {
  const result = await executor.execute(sql`
    SELECT activated_at AS "activatedAt", expires_at AS "expiresAt", revoked_at AS "revokedAt",
      (revoked_at IS NULL AND activated_at <= statement_timestamp() AND expires_at > statement_timestamp()) AS active,
      CASE WHEN revoked_at IS NULL THEN greatest(0, ceil(extract(epoch FROM (expires_at - statement_timestamp())) / 86400))::int ELSE 0 END AS "remainingDays"
    FROM nutrition_intro_trials WHERE user_id = ${userId}
  `);
  return presentNutritionTrial(rows(result)[0]);
}

/** Starts the one trial this account will ever get. Returns null if it already had one (any state). */
export async function activateNutritionTrial(userId: string) {
  const result = await db.execute(sql`
    INSERT INTO nutrition_intro_trials (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
    RETURNING activated_at AS "activatedAt", expires_at AS "expiresAt", revoked_at AS "revokedAt", true AS active,
      ${NUTRITION_TRIAL_DAYS}::int AS "remainingDays"
  `);
  const row = rows(result)[0];
  return row ? presentNutritionTrial(row) : null;
}

/** Ends an active trial early (downgrade to Free). It is never restartable. */
export async function revokeNutritionTrial(userId: string) {
  await db.execute(sql`UPDATE nutrition_intro_trials SET revoked_at = statement_timestamp() WHERE user_id = ${userId} AND revoked_at IS NULL`);
}

/** Server-verified Nutrition access. Throws if the trial record can't be read; callers fail closed. */
export async function nutritionEntitlement(userId: string, executor = db) {
  const trial = await readNutritionTrial(userId, executor);
  const premium = trial.status === "active" || hasAuthoritativePaidEntitlement();
  return { premium, endsAt: trial.status === "active" ? trial.expiresAt : null, trial };
}

/** Fail-closed boolean for gates and display: any read failure means no premium access. */
export async function hasNutritionPremium(userId: string): Promise<boolean> {
  try {
    return (await nutritionEntitlement(userId)).premium;
  } catch (error) {
    console.error("Nutrition entitlement unavailable:", (error as Error)?.message);
    return false;
  }
}

/** Overlays the verified Nutrition state onto a serialized signed-in user (fail closed). */
export async function withNutritionEntitlement<T extends { id: string }>(user: T): Promise<T & { nutritionPremium: boolean; nutritionTrialEndsAt: string | Date | null }> {
  try {
    const entitlement = await nutritionEntitlement(user.id);
    return { ...user, nutritionPremium: entitlement.premium, nutritionTrialEndsAt: entitlement.endsAt };
  } catch (error) {
    console.error("Nutrition entitlement unavailable:", (error as Error)?.message);
    return { ...user, nutritionPremium: false, nutritionTrialEndsAt: null };
  }
}
