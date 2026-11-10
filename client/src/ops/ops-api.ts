/**
 * Requests to the staff portal API. Every request carries the portal's own header, which the server requires on
 * every change (cross-site request protection), and same-origin cookies only.
 */
export class OpsApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Called when the staff session has ended (signed out elsewhere, idle, disabled), so the app can show sign-in. */
let onSignedOut: (() => void) | null = null;
export const setOpsSignedOutHandler = (fn: (() => void) | null) => { onSignedOut = fn; };

export async function opsRequest<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "X-ChefSire-Ops": "1", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new OpsApiError(res.status, (data as any)?.error || `Request failed (${res.status})`, (data as any)?.code);
    // Only the back office API reports an ended session; sign-in steps have their own messages.
    if (res.status === 401 && (data as any)?.code === "STAFF_SIGN_IN_REQUIRED" && url.startsWith("/api/ops/admin")) onSignedOut?.();
    throw error;
  }
  return data as T;
}

/** The back office API (/api/ops/admin). */
export const opsApi = <T,>(method: string, path: string, body?: unknown) => opsRequest<T>(method, `/api/ops/admin${path}`, body);
