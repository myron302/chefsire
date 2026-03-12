export function resolveEngagementUserId(req: any): string | null {
  return typeof req?.user?.id === "string" && req.user.id.trim() ? req.user.id : null;
}

export function parseTrackedEventBody(
  body: unknown,
  trackableEvents: ReadonlySet<string>
):
  | { ok: true; slug: string; eventType: string }
  | { ok: false; status: number; error: string } {
  const payload = body as Record<string, unknown> | null | undefined;
  const slug = typeof payload?.slug === "string" ? payload.slug.trim() : "";
  const eventType = typeof payload?.eventType === "string" ? payload.eventType.trim().toLowerCase() : "";

  if (!slug) {
    return { ok: false, status: 400, error: "slug is required" };
  }

  if (!trackableEvents.has(eventType)) {
    return { ok: false, status: 400, error: "Unsupported event_type" };
  }

  return {
    ok: true,
    slug,
    eventType,
  };
}
