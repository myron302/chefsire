import type { Request } from "express";

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
