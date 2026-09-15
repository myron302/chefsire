// server/lib/competition-visibility.ts
//
// The single authoritative answer to "may this viewer see this competition?".
//
// ChefSire's competition privacy model is per-competition, and the product states it in the create
// flow's own copy (`CreateCompetitionPage.tsx`):
//
//     public  -> "Anyone can discover and join"
//     private -> "Only people with invite link can join"
//
// So discoverability is a property of a PUBLIC competition, and a private one is neither listed nor
// readable except by the people who belong to it. Membership is the `competition_participants` row:
// the creator gets one with role `host` at creation, entrants get one with role `competitor`. There
// is no invitation, pending or rejected state in the schema -- a row exists or it does not -- and no
// judge/moderator/admin path into a competition either, so membership is the whole of the rule:
//
//     visible  <=>  isPrivate = false
//                   OR viewer IS the creator
//                   OR viewer has a competition_participants row for it
//
// The invite link that copy promises is NOT implemented anywhere in the repository, so today the
// only people inside a private competition are its creator and anyone already holding a participant
// row. That is deliberately the narrowest reading: when an invite endpoint does land, it grants
// access by creating the membership row this module already honours, and nothing here changes.
//
// Two shapes of the same rule live here so list queries and direct reads cannot drift apart --
// the same split, for the same reason, as `post-visibility.ts`:
//   - `visibleCompetitionsCondition(viewerId)` -- a SQL predicate, used by BOTH reads: the library
//                                                 listing and the `/:id` detail lookup, which folds
//                                                 it into its `where` so one query settles the row
//                                                 and the permission together.
//   - `canViewCompetition(id, comp, viewerId)` -- a row-level check for the writes that are only
//                                                 allowed on a competition the actor can see, where
//                                                 the row has already been loaded.
//
// Both refuse in EQUAL WORK. A 404 that hides a competition and a 404 for an id that was never real
// have to cost the same, or the difference in response time is itself the answer the 404 is
// withholding -- so neither shape short-circuits on a path that would tell those two cases apart.
//
// The viewer is ALWAYS the authenticated identity (`viewerIdFrom`, re-exported from
// `post-visibility` so there is exactly one definition of it in the server). A viewer id arriving in
// a query string, a body or a path segment is never an identity.

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { competitions, competitionParticipants } from "../db/competitions";

/**
 * The viewer for a request: the validated authenticated identity, or null for an anonymous caller.
 *
 * Re-exported rather than redefined. `post-visibility` owns the one implementation, and the social
 * routes' identity test already pins it to `req.user`; a second copy here would be a second thing to
 * get wrong later.
 */
export { viewerIdFrom } from "./post-visibility";

/** The columns `canViewCompetition` needs, so a partial select can be checked as well as a full row. */
export type CompetitionVisibilityFields = {
  id: string;
  creatorId: string;
  isPrivate?: boolean | null;
};

/**
 * SQL predicate selecting the competitions `viewerId` may see, for list queries.
 *
 * Filtering happens in the database, not after the fact: a private competition the viewer has no
 * claim on is never read, never counted in `total`, and never occupies a slot in a page of results.
 * Because it is one more `and(...)` term, it composes with the library's own filters instead of
 * replacing them.
 */
export function visibleCompetitionsCondition(viewerId?: string | null) {
  const isPublic = or(eq(competitions.isPrivate, false), isNull(competitions.isPrivate));

  if (!viewerId) return isPublic;

  return or(
    isPublic,
    eq(competitions.creatorId, viewerId),
    sql`EXISTS (SELECT 1 FROM ${competitionParticipants} WHERE ${competitionParticipants.competitionId} = ${competitions.id} AND ${competitionParticipants.userId} = ${viewerId})`
  );
}

/**
 * May `viewerId` see the competition `competitionId`? The row-level twin of the predicate above,
 * matching it case for case -- public, creator, member -- so a direct read and a listing can never
 * disagree.
 *
 * `comp` is the already-loaded row, or null/undefined when no such competition exists. The id is
 * passed separately AND the absent case is not short-circuited, because those two refusals have to
 * be indistinguishable: an earlier version returned `false` immediately for a missing row while a
 * private competition the caller had no claim on cost an extra membership query first, so timing a
 * pair of 404s told an attacker which ids were real. Every refusal now takes the same path.
 *
 * Only a competition proven PUBLIC, and an anonymous caller, decide without a query -- neither can
 * distinguish anything, because a public competition answers 200 to everyone and an anonymous
 * caller is refused on both branches without one. Everything else reaches the same single lookup.
 */
export async function canViewCompetition(
  competitionId: string,
  comp: CompetitionVisibilityFields | null | undefined,
  viewerId: string | null | undefined
): Promise<boolean> {
  // Public: open to everyone including anonymous callers -- that is what "public" means here, and
  // it is why competition reads sit behind `optionalAuth` rather than `requireAuth`.
  if (comp && !comp.isPrivate) return true;
  // Anonymous: refused whether or not the competition exists, and without a query either way.
  if (!viewerId) return false;

  const [membership] = await db
    .select({ id: competitionParticipants.id })
    .from(competitionParticipants)
    .where(
      and(
        eq(competitionParticipants.competitionId, competitionId),
        eq(competitionParticipants.userId, viewerId)
      )
    )
    .limit(1);

  // The creator is checked AFTER the lookup, never instead of it. They hold a `host` participant row
  // from creation so the lookup alone almost always answers, but a competition whose host row was
  // lost must still belong to whoever made it.
  return Boolean(membership) || (comp != null && comp.creatorId === viewerId);
}
