const firedEvents = new Set<string>();

function analyticsSessionKey() {
  const key = "chefsire_meal_planner_analytics_session";
  try {
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "";
  }
}

export function trackMealPlannerEventOnce(event: {
  eventType: "plan_view" | "storefront_view" | "shared_week_view";
  creatorId?: string | null;
  mealPlanId?: string | null;
  sharedWeekToken?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const dedupeKey = [event.eventType, event.creatorId || "", event.mealPlanId || "", event.sharedWeekToken || ""].join(":");
  if (firedEvents.has(dedupeKey)) return;
  firedEvents.add(dedupeKey);
  void fetch("/api/meal-planner/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...event, sessionKey: analyticsSessionKey() }),
  }).catch(() => undefined);
}
