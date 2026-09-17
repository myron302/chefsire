// server/lib/remix-engagement-cleanup.ts
import { eq, inArray, sql } from "drizzle-orm";
import { recipeRemixes, remixLikes, remixSaves } from "../../shared/schema";

/**
 * The subset of a drizzle transaction this helper needs.
 *
 * Typed structurally rather than against one driver, because the production path runs on
 * `drizzle-orm/neon-serverless` while the tests drive the very same function over
 * `drizzle-orm/node-postgres` against a real PostgreSQL server. The runtime API is identical; only
 * the static types differ per driver, and pinning one of them here would mean the tests could no
 * longer exercise this code.
 */
type EngagementTx = {
  select: (...args: any[]) => any;
  delete: (...args: any[]) => any;
  update: (...args: any[]) => any;
};

/**
 * Remove one account's remix likes and saves, and repair the counters they backed.
 *
 * WHY THIS EXISTS. `remix_likes.user_id` and `remix_saves.user_id` reference `users(id)` with NO
 * ACTION, deliberately. `ON DELETE CASCADE` would let those rows vanish with an account WITHOUT
 * moving the denormalized `recipe_remixes.likes_count` / `saves_count` they back, leaving a counter
 * permanently above the number of relationships that justify it -- the exact drift the P2-03
 * migration exists to remove. So the constraint is a guard, and this function is what satisfies it:
 * a deletion path that skipped the cleanup would fail loudly on the foreign key rather than
 * silently corrupt a counter.
 *
 * It lives here, rather than in a route, so that every legitimate caller inherits the invariant
 * instead of having to remember it.
 *
 * COUNTERS ARE RECOMPUTED, NOT DECREMENTED. The relationship tables are the source of truth, as the
 * migration established. Recomputing is what makes an account that both liked AND saved the same
 * remix correct with no special case, and it cannot double-adjust when one remix appears in both
 * affected sets -- there is no arithmetic to apply twice. `count(DISTINCT user_id)` matches the
 * migration's own reconstruction and the semantic identity the unique indexes enforce.
 *
 * The caller MUST supply a transaction. Deleting the rows and repairing the counters are not
 * independently valid states, and neither is valid without the account deletion that follows.
 */
export async function purgeRemixEngagementForUser(tx: EngagementTx, userId: string): Promise<string[]> {
  // Which remixes this account engaged with. Captured BEFORE the rows go, because afterwards there
  // is nothing left to say which counters need repairing.
  const [likedRemixes, savedRemixes] = await Promise.all([
    tx.select({ remixId: remixLikes.remixId }).from(remixLikes).where(eq(remixLikes.userId, userId)),
    tx.select({ remixId: remixSaves.remixId }).from(remixSaves).where(eq(remixSaves.userId, userId)),
  ]);

  // De-duplicated without iterating a Set: the repository targets a JS version where spreading one
  // needs --downlevelIteration, and a remix that was both liked and saved must appear exactly once.
  const seen = new Set<string>();
  const affected: string[] = [];
  for (const row of [...likedRemixes, ...savedRemixes] as Array<{ remixId: string }>) {
    if (!seen.has(row.remixId)) {
      seen.add(row.remixId);
      affected.push(row.remixId);
    }
  }

  await tx.delete(remixLikes).where(eq(remixLikes.userId, userId));
  await tx.delete(remixSaves).where(eq(remixSaves.userId, userId));

  // Scoped to the remixes this account actually touched, so no unrelated row is rewritten. The
  // subqueries see the post-delete state inside this transaction, which is what makes the result
  // equal to what survives rather than to what was there a moment ago.
  if (affected.length > 0) {
    await tx
      .update(recipeRemixes)
      .set({
        likesCount: sql`(
          SELECT count(DISTINCT ${remixLikes.userId})
          FROM ${remixLikes}
          WHERE ${remixLikes.remixId} = ${recipeRemixes.id}
        )`,
        savesCount: sql`(
          SELECT count(DISTINCT ${remixSaves.userId})
          FROM ${remixSaves}
          WHERE ${remixSaves.remixId} = ${recipeRemixes.id}
        )`,
      })
      .where(inArray(recipeRemixes.id, affected));
  }

  return affected;
}
