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
