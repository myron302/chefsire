import { sql } from "drizzle-orm";
import { db } from "../../db";
import { subscriptionHistory } from "../../../shared/schema";
import type { NutritionTierKey } from "./constants";

export async function ensureSubscriptionHistoryTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscription_history (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id),
      tier TEXT NOT NULL,
      amount NUMERIC(8,2) NOT NULL,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP NOT NULL,
      status TEXT NOT NULL,
      payment_method TEXT,
      subscription_type TEXT DEFAULT 'marketplace',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    ALTER TABLE subscription_history
      ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'marketplace';
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS subscription_history_user_idx
      ON subscription_history(user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS subscription_history_created_at_idx
      ON subscription_history(created_at)
  `);
}

export async function logNutritionSubscriptionHistory(params: {
  userId: string;
  tier: NutritionTierKey;
  amount: string;
  startDate: Date;
  endDate: Date;
  status: string;
  paymentMethod?: string | null;
}) {
  await ensureSubscriptionHistoryTable();

  // Prefix tier values so shared /api/subscriptions/history can distinguish nutrition rows
  // without changing the subscription_history schema.
  const tierForHistory = `nutrition_${params.tier}`;

  await db.insert(subscriptionHistory).values({
    userId: params.userId,
    tier: tierForHistory,
    amount: params.amount,
    startDate: params.startDate,
    endDate: params.endDate,
    status: params.status,
    paymentMethod: params.paymentMethod ?? null,
    subscriptionType: "nutrition",
  } as any);
}
