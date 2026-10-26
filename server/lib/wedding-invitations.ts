import { sql } from "drizzle-orm";
import { db } from "../db";
import { weddingRsvpInvitations } from "../../shared/schema";
import { weddingEntitlement } from "./wedding-entitlement";

/** Serialize new invitations per account; never trim guests on a downgrade. */
export async function createWeddingInvitation(userId: string, values: typeof weddingRsvpInvitations.$inferInsert) {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    const { currentTier } = await weddingEntitlement(userId, undefined, tx);
    if (currentTier === "free") throw new Error("Premium or Elite Wedding access required. Your saved guests are preserved.");
    if (currentTier === "premium") {
      const result = await tx.execute(sql`SELECT count(*)::int AS count FROM wedding_rsvp_invitations WHERE user_id = ${userId}`);
      if (Number(result.rows[0].count) >= 150) throw new Error("Premium supports 150 guests. Upgrade to Elite to add more. Your saved guests are preserved.");
    }
    const [invitation] = await tx.insert(weddingRsvpInvitations).values({ ...values, userId }).returning();
    return invitation;
  });
}
