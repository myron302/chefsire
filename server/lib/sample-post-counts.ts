import { sql } from "drizzle-orm";
import { isSamplePost } from "../../shared/social-sample";

/**
 * Replaces the invented popularity on sample posts with what the database can actually prove.
 *
 * The seed wrote likesCount/commentsCount values with no rows behind them. Those columns are
 * production data, so they are NOT rewritten here: the numbers are corrected at read time, from a
 * count of the real like and comment rows. Nothing is mutated, and the day the demo rows are
 * deleted this becomes a no-op rather than something to undo.
 *
 * Why read-time rather than a migration: a migration would have to decide what the "right" stored
 * number is, and the right number is simply however many rows exist -- which is exactly what a
 * count query answers, always, without a second source of truth to keep in step.
 */

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export type CountableSamplePost = {
  id?: unknown;
  userId?: unknown;
  likesCount?: number | null;
  commentsCount?: number | null;
};

/**
 * Returns the posts with sample popularity corrected. Real posts are returned untouched, and the
 * array is left in its original order.
 *
 * `executor` is the db or a transaction. One extra query runs only when the page actually contains
 * a sample post, so the common case -- a feed of real posts -- costs nothing.
 */
export async function withRealSampleCounts<T extends CountableSamplePost>(
  executor: { execute: (query: any) => Promise<any> },
  posts: readonly T[],
): Promise<T[]> {
  const sampleIds = posts.filter((post) => isSamplePost(post)).map((post) => String(post.id));
  if (sampleIds.length === 0) return [...posts];

  const ids = sql.join(sampleIds.map((id) => sql`${id}`), sql`, `);
  // Counted separately rather than with two joins, so neither count multiplies the other.
  const counted = rowsOf(await executor.execute(sql`
    SELECT p.id::text AS id,
           (SELECT count(*) FROM likes l WHERE l.post_id = p.id)::int AS likes,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int AS comments
      FROM posts p
     WHERE p.id IN (${ids})
  `));

  const real = new Map<string, { likes: number; comments: number }>(
    counted.map((row) => [String(row.id), { likes: Number(row.likes), comments: Number(row.comments) }]),
  );

  return posts.map((post) => {
    if (!isSamplePost(post)) return post;
    // A sample post whose row could not be counted reports zero rather than its invented number:
    // an unverifiable count must not fall back to the value this function exists to replace.
    const actual = real.get(String(post.id)) ?? { likes: 0, comments: 0 };
    return { ...post, likesCount: actual.likes, commentsCount: actual.comments };
  });
}
