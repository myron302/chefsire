type EventPayload = {
  slug: string;
  eventType: string;
};

export function postEngagementEvent(url: string, payload: EventPayload, withCredentials = false) {
  const options: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };

  if (withCredentials) {
    options.credentials = "include";
  }

  return fetch(url, options).catch(() => {
    // Non-blocking analytics event.
  });
}
