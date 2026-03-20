export type CreatorDropStatus = "upcoming" | "live" | "archived";

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCreatorDropDateTime(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function getCreatorDropCountdownLabel(value: string, status: CreatorDropStatus, now = new Date()) {
  if (status === "live") return "Live now";
  if (status === "archived") return "Past drop";

  const date = parseDate(value);
  if (!date) return "Schedule TBD";

  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Starting soon";

  const minute = 1000 * 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (diffMs >= day * 2) {
    const days = Math.round(diffMs / day);
    return `Live in ${days} days`;
  }
  if (diffMs >= day) return "Tomorrow";
  if (diffMs >= hour * 2) {
    const hours = Math.round(diffMs / hour);
    return `Live in ${hours} hours`;
  }
  if (diffMs >= hour) return "Live in 1 hour";
  if (diffMs >= minute * 2) {
    const minutes = Math.max(2, Math.round(diffMs / minute));
    return `Live in ${minutes} minutes`;
  }
  return "Starting soon";
}

export function getCreatorDropScheduleMessage(value: string, status: CreatorDropStatus) {
  const formatted = formatCreatorDropDateTime(value);

  if (status === "live") return `Started ${formatted}`;
  if (status === "archived") return `Went live ${formatted}`;
  return `Starts ${formatted}`;
}

export function getCreatorDropStatusLabel(status: CreatorDropStatus) {
  switch (status) {
    case "live":
      return "Live now";
    case "archived":
      return "Released";
    case "upcoming":
    default:
      return "Upcoming";
  }
}

export function getCreatorDropLifecycleHeading(status: CreatorDropStatus) {
  switch (status) {
    case "live":
      return "Launch is live";
    case "archived":
      return "Launch replay";
    case "upcoming":
    default:
      return "Launch landing page";
  }
}

export function getCreatorDropLifecycleDescription(status: CreatorDropStatus) {
  switch (status) {
    case "live":
      return "This drop has crossed its go-live time and should send people straight into the release.";
    case "archived":
      return "This release has moved into replay mode so recap notes and launch destinations stay easy to revisit.";
    case "upcoming":
    default:
      return "This page acts as the dedicated destination before launch so creators can build anticipation without replacing posts, alerts, or roadmap updates.";
  }
}

export function getCreatorDropPrimaryActionLabel(status: CreatorDropStatus, destination: "collection" | "challenge" | "promo" | "drop") {
  if (destination === "collection") {
    if (status === "live") return "Open live collection";
    if (status === "archived") return "Replay collection release";
    return "Preview launch collection";
  }
  if (destination === "challenge") {
    if (status === "live") return "Join live challenge";
    if (status === "archived") return "Replay challenge launch";
    return "Preview linked challenge";
  }
  if (destination === "promo") {
    if (status === "live") return "Use live promo";
    if (status === "archived") return "Review promo release";
    return "Preview linked promo";
  }
  if (status === "archived") return "Open replay page";
  if (status === "live") return "Open launch page";
  return "Open landing page";
}
