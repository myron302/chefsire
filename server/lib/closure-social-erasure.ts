import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/**
 * Test-only bounded social erasure primitive. Must be invoked only by a future
 * verified closure coordinator AFTER media references have been durably
 * inventoried and the account's financial/digital obligations are clear.
 *
 * Preserve other members' replies on surviving posts: redact the closing
 * author's comment text in place instead of cascading their replies away.
 * A whole post removed by its author necessarily removes that post's thread.
 *
 * Any third-party dependency not covered explicitly (e.g. meal-plan entries
 * referencing a recipe) makes PostgreSQL refuse the DELETE, rolling back the
 * entire coordinator transaction rather than silently destroying a purchase.
 */
export const CLOSED_MEMBER_COMMENT_PLACEHOLDER = "This comment was removed";
const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);
export type ClosureSocialErasureCounts = Record<string, number>;

export async function eraseMemberSocialContentWithinTransaction(tx: any, userId: string):
  Promise<ClosureSocialErasureCounts> {
  assertInternalClosureMutationAllowed();
  const steps: [string, ReturnType<typeof sql>][] = [
    ["review_helpful", sql`
      DELETE FROM review_helpful WHERE user_id = ${userId}
        OR review_id IN (
          SELECT rr.id FROM recipe_reviews rr
          WHERE rr.user_id = ${userId}
            OR rr.recipe_id IN (SELECT r.id FROM recipes r
              JOIN posts p ON p.id = r.post_id WHERE p.user_id = ${userId})
        ) RETURNING 1`],
    ["recipe_review_photos", sql`
      DELETE FROM recipe_review_photos WHERE review_id IN (
        SELECT rr.id FROM recipe_reviews rr WHERE rr.user_id = ${userId}
          OR rr.recipe_id IN (SELECT r.id FROM recipes r
            JOIN posts p ON p.id = r.post_id WHERE p.user_id = ${userId})
      ) RETURNING 1`],
    ["recipe_reviews", sql`
      DELETE FROM recipe_reviews WHERE user_id = ${userId}
        OR recipe_id IN (SELECT r.id FROM recipes r
          JOIN posts p ON p.id = r.post_id WHERE p.user_id = ${userId})
      RETURNING 1`],
    ["recipe_saves", sql`
      DELETE FROM recipe_saves WHERE user_id = ${userId}
        OR recipe_id IN (SELECT r.id FROM recipes r
          JOIN posts p ON p.id = r.post_id WHERE p.user_id = ${userId})
      RETURNING 1`],
    ["recipe_allergens", sql`
      DELETE FROM recipe_allergens WHERE recipe_id IN (
        SELECT r.id FROM recipes r JOIN posts p ON p.id = r.post_id WHERE p.user_id = ${userId}
      ) RETURNING 1`],
    ["comment_likes", sql`
      DELETE FROM comment_likes WHERE user_id = ${userId}
        OR comment_id IN (
          SELECT c.id FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.user_id = ${userId}
        ) RETURNING 1`],
    ["comments_on_deleted_posts", sql`
      DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id = ${userId})
      RETURNING 1`],
    ["comments_redacted", sql`
      UPDATE comments SET content = 'This comment was removed'
      WHERE user_id = ${userId} AND content <> 'This comment was removed'
      RETURNING 1`],
    ["likes", sql`
      DELETE FROM likes WHERE user_id = ${userId}
        OR post_id IN (SELECT id FROM posts WHERE user_id = ${userId})
      RETURNING 1`],
    ["follow_requests", sql`
      DELETE FROM follow_requests WHERE requester_id = ${userId} OR target_id = ${userId}
      RETURNING 1`],
    ["follows", sql`
      DELETE FROM follows WHERE follower_id = ${userId} OR following_id = ${userId}
      RETURNING 1`],
    ["stories", sql`DELETE FROM stories WHERE user_id = ${userId} RETURNING 1`],
    ["recipes", sql`
      DELETE FROM recipes WHERE post_id IN (SELECT id FROM posts WHERE user_id = ${userId})
      RETURNING 1`],
    ["posts", sql`DELETE FROM posts WHERE user_id = ${userId} RETURNING 1`],
  ];
  const counts: ClosureSocialErasureCounts = {};
  for (const [name, query] of steps) counts[name] = rowsOf(await tx.execute(query)).length;
  return counts;
}
