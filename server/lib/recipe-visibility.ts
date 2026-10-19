import { sql, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";

/**
 * The one visibility rule for a recipe, used by every read surface.
 *
 * A recipe is ordinary (visible to everyone) unless `recipes.origin_club_id` says it was created for a club. A club-created
 * recipe is visible to everyone while that club is public, and otherwise only to the club's creator and its members. Being
 * referenced by a club post says nothing: sharing a recipe into a club neither hides it nor exposes it.
 */
export function recipeVisibleToViewer(recipeId: SQL | string, viewerId?: string | null): SQL {
  const viewer = viewerId || "";
  const id = typeof recipeId === "string" ? sql`${recipeId}` : recipeId;
  return sql`NOT EXISTS (
    SELECT 1 FROM recipes rv INNER JOIN clubs rc ON rc.id = rv.origin_club_id
    WHERE rv.id = ${id}
      AND rc.is_public IS NOT TRUE
      AND NOT (
        ${viewer} <> '' AND (
          rc.creator_id = ${viewer}
          OR EXISTS (SELECT 1 FROM club_memberships rm WHERE rm.club_id = rc.id AND rm.user_id = ${viewer})
        )
      )
  )`;
}

/** Existing recipe ids from `ids` that this viewer may see. */
export async function filterVisibleRecipeIds(ids: string[], viewerId?: string | null): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Set();
  const result = await db.execute(sql`
    SELECT r.id FROM recipes r
    WHERE r.id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)}) AND ${recipeVisibleToViewer(sql`r.id`, viewerId)}
  `);
  return new Set(((result as any).rows ?? []).map((row: any) => String(row.id)));
}

export async function canViewRecipe(recipeId: string, viewerId?: string | null): Promise<boolean> {
  return (await filterVisibleRecipeIds([recipeId], viewerId)).has(recipeId);
}
