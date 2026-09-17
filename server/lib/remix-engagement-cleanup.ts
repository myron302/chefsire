// server/lib/remix-engagement-cleanup.ts
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { recipeRemixes, remixLikes, remixSaves, users } from "../../shared/schema";

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
  insert: (...args: any[]) => any;
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
  // ----------------------------------------------------------------------------------------------
  // THE OUTER SERIALIZATION POINT: this account's own `users` row, taken BEFORE discovery.
  //
  // Discovering first and locking afterwards leaves a window. Between reading which remixes the
  // account engaged with and locking them, the SAME account can commit engagement on a remix that
  // was not in the discovered set -- so the cleanup never sees it, and the caller's DELETE FROM
  // users then trips the NO ACTION foreign key and fails with 23503. The counters stay exact (the
  // whole transaction rolls back), but a legitimate account deletion fails for no reason the user
  // can act on. Reproduced against a real server at the previous head.
  //
  // FOR UPDATE here is what forecloses it. Inserting a `remix_likes` / `remix_saves` row needs
  // FOR KEY SHARE on the actor's `users` row for the foreign key, and FOR KEY SHARE conflicts with
  // FOR UPDATE. So once this lock is held, no new engagement for this account can commit until this
  // transaction ends -- and because the lock is taken BEFORE the discovery below, and every
  // statement after it gets a fresh READ COMMITTED snapshot, the discovery sees everything that
  // committed beforehand. The set it produces is therefore complete, not a guess.
  //
  // The engagement path takes the same `users` row explicitly (FOR KEY SHARE) before it takes any
  // remix row, so the global order across the feature is: users, then recipe_remixes ascending.
  // Nothing acquires a `users` row after a remix row, which is what makes a cycle impossible.
  // ----------------------------------------------------------------------------------------------
  const actor: Array<{ id: string }> = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("update");

  // Already gone -- nothing to clean, and the caller's delete will report no rows.
  if (actor.length === 0) return [];

  // Which remixes this account engaged with. Complete, because the lock above stops the set from
  // growing, and captured before the rows go, because afterwards there is nothing left to say which
  // counters need repairing.
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

  if (affected.length === 0) return affected;

  // ----------------------------------------------------------------------------------------------
  // THE SERIALIZATION POINT. Take the row lock on every affected remix BEFORE anything below reads
  // or writes a relationship.
  //
  // This has to happen first, and the reason is specific to READ COMMITTED. Under it, each statement
  // takes its OWN snapshot at the moment the statement begins. A recomputing UPDATE whose subquery
  // reads `remix_likes` therefore behaves exactly as the manual warns: "it can see the effects of
  // concurrent updating commands on the same rows it is trying to update, but it does not see
  // effects of those commands on other rows in the database." So if the UPDATE were the first thing
  // to touch this remix, it would take its snapshot, then block on a concurrent liker's row lock,
  // and when that liker committed it would resume and recompute from its OWN older snapshot -- one
  // in which the new like does not exist -- and write a count that is already wrong, overwriting the
  // liker's correct value. Reproduced: one surviving relationship, counter 0.
  //
  // Acquiring the lock first inverts that. The lock waits for any competing transaction to finish,
  // and every statement AFTER it gets a fresh snapshot that includes whatever that transaction
  // committed. The delete and the recomputation below therefore both see the true current state.
  //
  // LOCK ORDER: ascending by primary id, always. Account deletion can touch many remixes at once,
  // so a fixed total order is what stops two concurrent deletions over overlapping sets from
  // deadlocking. Every other path that locks more than one remix row uses the same ascending order.
  // ----------------------------------------------------------------------------------------------
  const locked: Array<{ id: string }> = await tx
    .select({ id: recipeRemixes.id })
    .from(recipeRemixes)
    .where(inArray(recipeRemixes.id, affected))
    .orderBy(asc(recipeRemixes.id))
    .for("update");

  const lockedIds = locked.map((row) => row.id);
  if (lockedIds.length === 0) return affected;

  // Scoped to the remixes actually locked, so this can never delete a relationship whose counter is
  // not about to be repaired. With the `users` row held from the start the discovered set cannot
  // grow, so the only way `lockedIds` is smaller than `affected` is a remix deleted concurrently --
  // which took this account's engagement rows with it through ON DELETE CASCADE, leaving nothing to
  // clean. The foreign key on `DELETE FROM users` remains as a backstop, but it is no longer
  // expected to fire for engagement this account created itself.
  await tx
    .delete(remixLikes)
    .where(and(eq(remixLikes.userId, userId), inArray(remixLikes.remixId, lockedIds)));
  await tx
    .delete(remixSaves)
    .where(and(eq(remixSaves.userId, userId), inArray(remixSaves.remixId, lockedIds)));

  // Recomputed from what actually survives. The subqueries run on a snapshot taken after the lock
  // was granted, so a concurrent liker's committed row is included rather than missed.
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
    .where(inArray(recipeRemixes.id, lockedIds));

  return affected;
}

/**
 * Apply one account's like/save/unlike/unsave to one remix, under the shared lock.
 *
 * This is the OTHER side of the serialization protocol, and it lives here beside the purge so that
 * both sides demonstrably take the same locks, in the same order, on the same resources. The result
 * distinguishes a missing remix (the caller turns that into a 404) from an account that no longer
 * exists (a 401 -- it was deleted while this request was in flight).
 *
 * The lock comes FIRST -- before the relationship is inserted or deleted, and before the counter
 * moves. See `purgeRemixEngagementForUser` for why that ordering is what closes the READ COMMITTED
 * recomputation race; from this side the point is that the relationship write and its counter move
 * cannot be split by a transaction that recomputes the counter from the relationship table.
 *
 * The counter moves by arithmetic here rather than by recomputation, and that stays exact: `x + 1`
 * and `GREATEST(x - 1, 0)` are re-evaluated by PostgreSQL against the newest version of the row
 * being updated, which is the one case READ COMMITTED does handle, and the row is held under this
 * transaction's lock for the whole sequence anyway. It moves only when a row was really created or
 * really deleted, so the counter still counts relationships and nothing else.
 */
export async function applyRemixEngagement(
  tx: EngagementTx,
  params: {
    remixId: string;
    userId: string;
    kind: "like" | "save";
    action: "add" | "remove";
  }
): Promise<
  | { status: "ok"; remix: any; changed: boolean }
  | { status: "actor-missing" }
  | { status: "remix-missing" }
> {
  const { remixId, userId, kind, action } = params;
  const table = kind === "like" ? remixLikes : remixSaves;

  // FIRST LOCK: the actor's own `users` row, in the weakest mode that does the job.
  //
  // FOR KEY SHARE is exactly the lock the foreign key on `remix_likes.user_id` would take when the
  // row below is inserted -- this only takes it EARLIER and explicitly. Two engagement requests from
  // the same account are both FOR KEY SHARE and so do not block each other, while an account
  // deletion's FOR UPDATE on the same row conflicts with both. That is what stops this account from
  // committing engagement that a deletion in flight has already finished discovering.
  //
  // Taking it before the remix row is also what keeps the global order acyclic: users, then
  // recipe_remixes ascending. The previous order (remix first, users implicitly second via the FK)
  // was the reverse, and would cycle against a deletion holding `users` and waiting for a remix.
  const actor: Array<{ id: string }> = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("key share");

  if (actor.length === 0) return { status: "actor-missing" };

  // SECOND LOCK: the remix row, still before any relationship read or write.
  const [remix] = await tx
    .select()
    .from(recipeRemixes)
    .where(eq(recipeRemixes.id, remixId))
    .limit(1)
    .for("update");

  if (!remix) return { status: "remix-missing" };

  let changed = false;

  if (action === "add") {
    const [inserted] = await tx
      .insert(table)
      .values({ userId, remixId })
      .onConflictDoNothing({ target: [table.userId, table.remixId] })
      .returning();
    changed = Boolean(inserted);
  } else {
    const removed = await tx
      .delete(table)
      .where(and(eq(table.remixId, remixId), eq(table.userId, userId)))
      .returning();
    changed = removed.length > 0;
  }

  if (changed) {
    const column = kind === "like" ? recipeRemixes.likesCount : recipeRemixes.savesCount;
    const next =
      action === "add" ? sql`${column} + 1` : sql`GREATEST(${column} - 1, 0)`;
    await tx
      .update(recipeRemixes)
      .set(kind === "like" ? { likesCount: next } : { savesCount: next })
      .where(eq(recipeRemixes.id, remixId));
  }

  const [updated] = await tx
    .select()
    .from(recipeRemixes)
    .where(eq(recipeRemixes.id, remixId))
    .limit(1);

  return { status: "ok", remix: updated, changed };
}
