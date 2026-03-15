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

  return fetch(url, options)
    .then((response) => {
      if (!response.ok && import.meta.env.DEV) {
        console.warn(`[engagement-events] POST ${url} failed with status ${response.status}`, payload);
      }

      return response;
    })
    .catch((error) => {
      if (import.meta.env.DEV) {
        console.warn(`[engagement-events] POST ${url} request failed`, { payload, error });
      }
      // Non-blocking analytics event.
      return undefined;
    });
}
