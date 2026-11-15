/**
 * Sample feed posts.
 *
 * server/seed.ts creates five demo posts ("post-1".."post-5") owned by the demo accounts
 * "user-1".."user-7". They stay visible so a new feed is not empty, but they are not real content,
 * and -- the reason this module exists -- the seed also writes INVENTED popularity onto them:
 * likesCount values of 234, 156, 89, 178 and 145 with no like rows behind them.
 *
 * That is not a cosmetic problem. `getTrendingRecipes` ranks by `likesCount * 2 + commentsCount`,
 * so a demo post claiming 234 likes outranks every real post a member has actually earned. The
 * invented numbers decide what real people see as popular.
 *
 * The marker is the seeded id pair (post id AND author id), never the caption or the image. Real
 * posts get UUIDs and real members get UUIDs, so a real post can never match -- the same discipline
 * as shared/marketplace-sample.ts, for the same reason: a title-based marker would one day flag
 * somebody's real work.
 */

export const SAMPLE_POST_IDS: ReadonlySet<string> = new Set(
  Array.from({ length: 5 }, (_, i) => `post-${i + 1}`),
);

/** The same demo accounts the sample marketplace listings belong to. */
export const SAMPLE_AUTHOR_IDS: ReadonlySet<string> = new Set(
  Array.from({ length: 7 }, (_, i) => `user-${i + 1}`),
);

export const SAMPLE_POST_LABEL = "Sample post";

export const SAMPLE_POST_NOTE =
  "A sample post showing what ChefSire looks like with content. It isn't from a real member.";

/**
 * The feed also carries a second family of demonstration content: the client-side array shown to a
 * signed-out visitor when the real feed is empty or errored, with ids "demo-post-N" authored by
 * "chef-N". Those already report zero counts, but they were just as unlabelled -- a visitor could
 * not tell them from real members' work. Both prefixes are safe markers for the same reason the
 * seeded ids are: real posts and members get UUIDs.
 */
const CLIENT_DEMO_POST_PREFIX = "demo-post-";
const CLIENT_DEMO_AUTHOR_PREFIX = "chef-";

export function isSamplePost(post: { id?: unknown; userId?: unknown } | null | undefined): boolean {
  if (!post) return false;
  const id = String(post.id ?? "");
  const authorId = String(post.userId ?? "");
  if (SAMPLE_POST_IDS.has(id) && SAMPLE_AUTHOR_IDS.has(authorId)) return true;
  return id.startsWith(CLIENT_DEMO_POST_PREFIX) && authorId.startsWith(CLIENT_DEMO_AUTHOR_PREFIX);
}

/** True for the demo accounts themselves, so their own profile totals can be treated the same way. */
export function isSampleAuthorId(userId: unknown): boolean {
  return SAMPLE_AUTHOR_IDS.has(String(userId ?? ""));
}
