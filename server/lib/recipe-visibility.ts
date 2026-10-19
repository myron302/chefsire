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

/**
 * Classify recipe references by what the DATABASE says, never by how the id looks.
 *
 * Only ids that match a row in `recipes` appear in the result (`visible` or `hidden` for this viewer). Any other value -- an
 * external provider reference such as `mealdb_123`, or garbage -- is absent, i.e. "not a local recipe". An id cannot be disguised
 * as external to dodge this: a private local recipe's real id matches its row whatever label the client attaches to it.
 */
export async function classifyLocalRecipeRefs(ids: string[], viewerId?: string | null): Promise<Map<string, "visible" | "hidden">> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out = new Map<string, "visible" | "hidden">();
  if (!unique.length) return out;
  const result = await db.execute(sql`
    SELECT r.id, ${recipeVisibleToViewer(sql`r.id`, viewerId)} AS visible FROM recipes r
    WHERE r.id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})
  `);
  for (const row of ((result as any).rows ?? []) as Array<{ id: string; visible: boolean }>) {
    out.set(String(row.id), row.visible ? "visible" : "hidden");
  }
  return out;
}

export const UNAVAILABLE_RECIPE_NAME = "Recipe unavailable";

/**
 * Reader-time redaction for planner entries hydrated with a joined recipe. If the reader may no longer (or never could) see the
 * recipe, the entry keeps its slot and the numbers the planner owner typed in, but loses the recipe row, the recipe link, the
 * name (which was copied from the recipe title) and any stored item list. Entries with no recipe pass through untouched.
 */
export async function redactUnavailableRecipes<T extends { recipe?: any; recipeId?: string | null }>(entries: T[], viewerId?: string | null): Promise<Array<T & { recipeUnavailable?: true }>> {
  const refs = entries.map((entry) => entry.recipe?.id ?? entry.recipeId).filter(Boolean) as string[];
  if (!refs.length) return entries;
  const visible = await filterVisibleRecipeIds(refs, viewerId);
  return entries.map((entry) => {
    const ref = entry.recipe?.id ?? entry.recipeId;
    if (!ref || visible.has(ref)) return entry;
    return { ...entry, recipe: null, recipeId: null, customName: UNAVAILABLE_RECIPE_NAME, mealItems: null, recipeUnavailable: true as const };
  });
}
