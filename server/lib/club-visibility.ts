import { sql, type SQL } from "drizzle-orm";

/**
 * The one SQL expression for "may this viewer read things that belong to this club?", shared by every feature that hangs private
 * content off a club (club-created recipes, club challenges) so there is a single membership rule, not several copies that drift.
 *
 * - no club (NULL)           -> not club content: readable
 * - public club              -> readable by everyone
 * - private club (or NULL flag, or missing club row) -> only the club's creator and rows in club_memberships
 *
 * `clubId` is any SQL expression yielding a club id. The viewer is always the verified session user (or none), never client input.
 */
export function clubReadableToViewer(clubId: SQL, viewerId?: string | null): SQL {
  const viewer = viewerId || "";
  return sql`(
    ${clubId} IS NULL OR EXISTS (
      SELECT 1 FROM clubs xc
      WHERE xc.id = ${clubId}
        AND (
          xc.is_public IS TRUE
          OR (
            ${viewer} <> '' AND (
              xc.creator_id = ${viewer}
              OR EXISTS (SELECT 1 FROM club_memberships xm WHERE xm.club_id = xc.id AND xm.user_id = ${viewer})
            )
          )
        )
    )
  )`;
}
