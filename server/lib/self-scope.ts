import type { Request, Response } from "express";

/**
 * Private self-service data is selected by the authenticated actor, never by a client-supplied id.
 *
 * Legacy routes carry the account id in the path (`/users/:id/pantry`). Those stay mounted so existing clients keep
 * working, but the id is only ever compared with `req.user` -- it can name the actor (or the alias `me`) and nothing
 * else. Query, body and header identities are not consulted at all.
 *
 * A mismatch is one fixed denial regardless of whether the named account exists, so the response is not an
 * existence oracle. Callers must run behind `requireAuth`; an unauthenticated request is refused here as well so a
 * route that forgets the middleware still fails closed.
 *
 * @returns the actor's id, or `null` after the response has been sent.
 */
export function resolveSelfUserId(
  req: Request,
  res: Response,
  requested?: string,
  denied: unknown = { message: "Forbidden" },
): string | null {
  const actor = (req.user as { id?: string } | undefined)?.id;
  if (!actor) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  if (requested !== undefined && requested !== "me" && requested !== actor) {
    res.status(403).json(denied);
    return null;
  }
  return actor;
}
