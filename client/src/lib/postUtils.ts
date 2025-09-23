// client/src/lib/postUtils.ts

import type { PostWithUser } from "@shared/schema";

/**
 * Ensures we always have a "title"-like field,
 * falling back to caption since posts don't actually have a title column.
 */
export function getPostTitle(post: PostWithUser): string {
  return post.caption || "Recipe";
}
