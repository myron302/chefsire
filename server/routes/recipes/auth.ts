import type { Request, Response } from "express";

type UserWithId = { id: string };

type RequestWithUser = Request & { user?: UserWithId };

export function resolveAuthenticatedUserId(req: RequestWithUser, requestedUserId?: string): string | null {
  const authenticatedUserId = req.user?.id;
  if (!authenticatedUserId) return null;

  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    return null;
  }

  return authenticatedUserId;
}

export function extractRequestedUserId(req: Request): string | undefined {
  const fromBody = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  if (fromBody !== undefined) return fromBody;

  return typeof req.query?.userId === "string" ? req.query.userId : undefined;
}

export function resolveSaveRouteUserId(req: RequestWithUser, res: Response): string | null {
  const requestedUserId = extractRequestedUserId(req);
  const userId = resolveAuthenticatedUserId(req, requestedUserId);
  if (!userId) {
    res.status(403).json({ ok: false, error: "Not allowed" });
    return null;
  }

  return userId;
}
