// server/routes/remixes.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  posts,
  recipeRemixes,
  recipes,
  remixLikes,
  remixSaves,
  users,
} from "../../shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";
import {
  remixCreateSchema,
  remixPatchSchema,
  toRemixPatch,
} from "../../shared/planner-remix-mutations";
import { sendRemixNotification } from "../services/notification-service";
import { applyRemixEngagement } from "../lib/remix-engagement-cleanup";

const router = Router();

// GET /api/remixes - Get all public remixes
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const remixes = await db
      .select({
        remix: recipeRemixes,
        originalRecipe: recipes,
        user: users,
      })
      .from(recipeRemixes)
      .innerJoin(recipes, eq(recipeRemixes.originalRecipeId, recipes.id))
      .innerJoin(users, eq(recipeRemixes.userId, users.id))
      .where(eq(recipeRemixes.isPublic, true))
      .orderBy(desc(recipeRemixes.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ remixes, count: remixes.length, limit, offset });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/remixes/recipe/:recipeId - Get all remixes of a specific recipe
router.get("/recipe/:recipeId", async (req, res) => {
  try {
    const { recipeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const remixes = await db
      .select({
        remix: recipeRemixes,
        remixedRecipe: recipes,
        user: users,
      })
      .from(recipeRemixes)
      .innerJoin(recipes, eq(recipeRemixes.remixedRecipeId, recipes.id))
      .innerJoin(users, eq(recipeRemixes.userId, users.id))
      .where(
        and(
          eq(recipeRemixes.originalRecipeId, recipeId),
          eq(recipeRemixes.isPublic, true)
        )
      )
      .orderBy(desc(recipeRemixes.likesCount))
      .limit(limit);

    return res.json({ remixes, count: remixes.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/remixes/my-remixes - Get authenticated user's remixes
router.get("/my-remixes", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const remixes = await db
      .select({
        remix: recipeRemixes,
        originalRecipe: recipes,
      })
      .from(recipeRemixes)
      .innerJoin(recipes, eq(recipeRemixes.originalRecipeId, recipes.id))
      .where(eq(recipeRemixes.userId, userId))
      .orderBy(desc(recipeRemixes.createdAt));

    return res.json({ remixes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/remixes/user/:userId - Get user's PUBLIC remixes only
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const remixes = await db
      .select({
        remix: recipeRemixes,
        originalRecipe: recipes,
      })
      .from(recipeRemixes)
      .innerJoin(recipes, eq(recipeRemixes.originalRecipeId, recipes.id))
      .where(
        and(
          eq(recipeRemixes.userId, userId),
          eq(recipeRemixes.isPublic, true)
        )
      )
      .orderBy(desc(recipeRemixes.createdAt));

    return res.json({ remixes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Who owns a recipe.
 *
 * `recipes` carries no `user_id`. A recipe's author is the author of the post it was published as --
 * `recipes.post_id -> posts.user_id` -- and `post_id` is nullable, so a recipe can genuinely have no
 * provable owner (club recipes are inserted with `postId: null`, see routes/clubs.ts). The three
 * outcomes are distinct and the caller has to tell them apart, so they are returned as such:
 * `missing` (no such recipe), an owner id, or `null` (the recipe exists but no account can be shown
 * to own it).
 *
 * This is also the bug behind remix notifications never firing: the handler used to read
 * `originalRecipe.userId`, a property the `recipes` row does not have, so the guard was always false.
 */
async function loadRecipeWithOwner(recipeId: string) {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  if (!recipe) return { missing: true as const };
  if (!recipe.postId) return { missing: false as const, recipe, ownerId: null };

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, recipe.postId))
    .limit(1);

  return { missing: false as const, recipe, ownerId: post?.userId ?? null };
}

// POST /api/remixes - Create a new remix
//
// A remix row is an attribution claim: "this recipe, by me, is a remix of that one". Before this
// repair the only thing checked was that both ids resolved to SOME recipe, so knowing two ids was
// enough to publish a lineage claiming any recipe on the platform as your own remix output -- and
// each replay of that request re-ran the counter update and re-sent a notification.
//
// Three things now stand between a request and a row:
//
//   1. The actor is `req.user!.id` and nothing else. No body, query or header field is read for
//      identity, and `remixCreateSchema` is `.strict()`, so a payload that even mentions `userId` is
//      a 400 before any query runs.
//   2. The caller must own `remixedRecipeId` -- the recipe they are claiming to have made. The
//      source recipe is deliberately NOT ownership-checked: remixing someone else's recipe is the
//      entire feature. Self-remixing stays allowed, because nothing in the schema or the UI
//      prohibits remixing your own recipe; only original === remixed is refused, since a recipe
//      cannot be its own parent.
//   3. Insert and counter move inside one transaction, and the insert defers to the unique lineage
//      index rather than to a preceding SELECT, so two concurrent identical requests produce one row
//      between them instead of racing through a check that passed for both.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { originalRecipeId, remixedRecipeId, remixType, changes, isPublic } =
      remixCreateSchema.parse(req.body ?? {});
    const userId = req.user!.id;

    // A recipe is not a remix of itself. Allowing it would let a single recipe inflate its own
    // remix_count, since the row would be both the child of and the parent counted by the update
    // below.
    if (originalRecipeId === remixedRecipeId) {
      return res
        .status(400)
        .json({ error: "A recipe cannot be a remix of itself" });
    }

    const original = await loadRecipeWithOwner(originalRecipeId);
    const remixed = await loadRecipeWithOwner(remixedRecipeId);

    if (original.missing || remixed.missing) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // The attribution check. A recipe with no resolvable owner cannot be claimed by anyone: there is
    // no account it can be shown to belong to, so "the caller authored it" is unprovable and the
    // claim is refused rather than assumed.
    if (remixed.ownerId !== userId) {
      return res.status(403).json({
        error: "You can only submit a recipe you authored as your remix",
      });
    }

    // One transaction: the row and the counter it drives either both land or neither does. A replay
    // that loses the race to the unique index leaves BOTH alone -- which is the whole point, since a
    // counter that moved for a row that was not created is exactly the drift this repair removes.
    const outcome = await db.transaction(async (tx: typeof db) => {
      const [created] = await tx
        .insert(recipeRemixes)
        .values({
          originalRecipeId,
          remixedRecipeId,
          userId,
          remixType,
          changes,
          isPublic,
        })
        .onConflictDoNothing({
          target: [
            recipeRemixes.originalRecipeId,
            recipeRemixes.remixedRecipeId,
            recipeRemixes.userId,
          ],
        })
        .returning();

      if (!created) {
        // The relationship already existed. Return it unchanged: same response shape, no counter
        // movement, no notification. Retrying a create is a no-op, not a second remix.
        const [existing] = await tx
          .select()
          .from(recipeRemixes)
          .where(
            and(
              eq(recipeRemixes.originalRecipeId, originalRecipeId),
              eq(recipeRemixes.remixedRecipeId, remixedRecipeId),
              eq(recipeRemixes.userId, userId)
            )
          )
          .limit(1);

        return { remix: existing, created: false };
      }

      // remix_count is "how many times the recipe THIS row produced has been remixed", so the rows
      // that just became truer are the ones whose OUTPUT is the recipe being remixed now:
      // remixed_recipe_id = originalRecipeId.
      //
      // The pre-repair statement was `WHERE original_recipe_id = $1`, which is a different set
      // entirely -- every sibling remix that shares the source recipe, none of which was remixed by
      // this request, and never the parent that was. Siblings, and every unrelated row, are
      // untouched by the predicate below.
      await tx
        .update(recipeRemixes)
        .set({ remixCount: sql`${recipeRemixes.remixCount} + 1` })
        .where(eq(recipeRemixes.remixedRecipeId, originalRecipeId));

      return { remix: created, created: true };
    });

    // Notifications are sent only for a relationship that was actually created, and only after the
    // transaction has committed -- so a replay is silent, and a rolled-back create never announces a
    // remix that does not exist. `notifications` is written by a separate service on its own
    // connection and so cannot join this transaction; sequencing it after the commit means the
    // residual failure mode is a missing notification for a real remix, never a notification for a
    // remix that was not stored. sendRemixNotification already suppresses self-notification, and
    // that behaviour is preserved.
    if (outcome.created && original.ownerId && original.ownerId !== userId) {
      const [remixer] = await db
        .select({ username: users.username, avatar: users.avatar })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (remixer) {
        sendRemixNotification(
          original.ownerId,
          userId,
          remixer.username || 'Someone',
          remixer.avatar,
          remixedRecipeId,
          original.recipe.title || 'your recipe'
        );
      }
    }

    return res.json({ remix: outcome.remix });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message, errors: error.issues });
    }
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/remixes/:id - Update a remix
//
// A remix edit touches the author's own metadata and nothing else. The body is parsed as a whole
// against a `.strict()` contract, so a payload naming lineage (`originalRecipeId`,
// `remixedRecipeId`), ownership (`userId`), identity (`id`), a counter (`likesCount`, `savesCount`,
// `remixCount`) or `createdAt` is refused outright and leaves the row untouched. The update is still
// scoped to (remix id, authenticated author), so it can only ever reach the caller's own row.
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const patch = toRemixPatch(remixPatchSchema.parse(req.body ?? {}));

    const [updated] = await db
      .update(recipeRemixes)
      .set(patch)
      .where(and(eq(recipeRemixes.id, id), eq(recipeRemixes.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Remix not found or not authorized" });
    }

    return res.json({ remix: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message, errors: error.issues });
    }
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/remixes/:id - Delete a remix
//
// Deleting a lineage row un-does what creating it counted, so the parent counters come back down in
// the same transaction. Without this, delete-and-recreate would ratchet remix_count upward forever.
// The remix's own likes and saves are removed by the ON DELETE CASCADE on remix_likes.remix_id and
// remix_saves.remix_id, so no orphan engagement rows survive the row they described.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const deleted = await db.transaction(async (tx: typeof db) => {
      // Read first, unlocked, only to learn which rows this deletion will touch: the remix itself
      // and the parents whose remix_count it reverses.
      const [candidate] = await tx
        .select({ id: recipeRemixes.id, originalRecipeId: recipeRemixes.originalRecipeId })
        .from(recipeRemixes)
        .where(and(eq(recipeRemixes.id, id), eq(recipeRemixes.userId, userId)))
        .limit(1);

      if (!candidate) return null;

      const parents = await tx
        .select({ id: recipeRemixes.id })
        .from(recipeRemixes)
        .where(eq(recipeRemixes.remixedRecipeId, candidate.originalRecipeId));

      // Lock the whole affected set in ONE ascending-by-id pass, the same order the account-deletion
      // purge uses. Without this, deleting a remix would lock its own row (via the DELETE) and only
      // then its parents, which is descending whenever a parent sorts lower -- and that is a lock
      // cycle against a multi-remix account deletion holding the parent and waiting for this row.
      // One ordered pass over the union removes the cycle rather than relying on deadlock detection.
      const affected = [candidate.id, ...parents.map((row: { id: string }) => row.id)];
      const uniqueAffected: string[] = [];
      const seen = new Set<string>();
      for (const remixId of affected) {
        if (!seen.has(remixId)) {
          seen.add(remixId);
          uniqueAffected.push(remixId);
        }
      }
      await tx
        .select({ id: recipeRemixes.id })
        .from(recipeRemixes)
        .where(inArray(recipeRemixes.id, uniqueAffected))
        .orderBy(asc(recipeRemixes.id))
        .for("update");

      // Re-checked after the lock: a concurrent request may have deleted it while we waited.
      const [row] = await tx
        .delete(recipeRemixes)
        .where(and(eq(recipeRemixes.id, id), eq(recipeRemixes.userId, userId)))
        .returning();

      if (!row) return null;

      await tx
        .update(recipeRemixes)
        .set({ remixCount: sql`GREATEST(${recipeRemixes.remixCount} - 1, 0)` })
        .where(eq(recipeRemixes.remixedRecipeId, row.originalRecipeId));

      return row;
    });

    if (!deleted) {
      return res.status(404).json({ error: "Remix not found or not authorized" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Add or remove one account's engagement row and move the matching counter by exactly one.
 *
 * Both endpoints previously did `SET likes_count = likes_count + 1` with no authentication and no
 * record of who acted, so the columns counted REQUESTS: one caller, anonymous, could raise them
 * without limit and nothing could ever be undone. The relationship row is now the fact and the
 * counter is its tally, which is what makes these operations idempotent:
 *
 *   - `add` inserts and lets the unique (user_id, remix_id) index decide. If the index rejects the
 *     insert the account already had the row, so the counter is NOT touched. That decision is made
 *     by the database on the write itself, not by a SELECT that two concurrent requests could both
 *     pass, so simultaneous duplicates cannot each produce a like.
 *   - `remove` deletes and counts what it actually deleted. A second unlike deletes nothing and so
 *     decrements nothing.
 *
 * Insert/delete and the counter share one transaction, so the row and its tally cannot diverge if
 * either half fails. GREATEST(..., 0) is a floor for rows whose counter predates the relationship
 * tables; a counter that is only ever moved by this function cannot reach it.
 */
async function setEngagement(
  req: Request,
  res: Response,
  kind: "like" | "save",
  action: "add" | "remove"
) {
  const { id } = req.params;
  const userId = req.user!.id;

  // The lock-first protocol and the counter arithmetic live in one place, shared with the
  // account-deletion purge, so both sides of the race provably serialize on the same remix row.
  const result = await db.transaction(async (tx: typeof db) =>
    applyRemixEngagement(tx as any, { remixId: id, userId, kind, action })
  );

  if (!result) {
    return res.status(404).json({ error: "Remix not found" });
  }

  // `{ remix }` is the shape both endpoints already returned, so existing callers are unaffected.
  // The per-user flag is added because it is now a real, readable fact about the caller.
  const active = action === "add";
  return res.json(
    kind === "like"
      ? { remix: result.remix, liked: active, likesCount: result.remix?.likesCount ?? 0 }
      : { remix: result.remix, saved: active, savesCount: result.remix?.savesCount ?? 0 }
  );
}

// POST /api/remixes/:id/like - Like a remix (idempotent: liking twice leaves one like)
//
// POST stays "like", not "toggle": RemixesPage.handleLikeRemix fires this and never reads the
// result, so a toggle would silently turn a double click into an unlike. Undoing is DELETE.
router.post("/:id/like", requireAuth, async (req, res) => {
  try {
    return await setEngagement(req, res, "like", "add");
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/remixes/:id/like - Remove this account's like (idempotent)
router.delete("/:id/like", requireAuth, async (req, res) => {
  try {
    return await setEngagement(req, res, "like", "remove");
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/remixes/:id/save - Save a remix (idempotent)
//
// This is a save of the REMIX, keyed by recipe_remixes.id, which is what saves_count counts and what
// the endpoint has always addressed. The repository's existing `recipe_saves` is a different
// relationship -- an account to a `recipes` row -- and cannot express "saved this lineage" or back
// this column, so reusing it would have silently changed what the endpoint means.
router.post("/:id/save", requireAuth, async (req, res) => {
  try {
    return await setEngagement(req, res, "save", "add");
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/remixes/:id/save - Remove this account's save (idempotent)
router.delete("/:id/save", requireAuth, async (req, res) => {
  try {
    return await setEngagement(req, res, "save", "remove");
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
