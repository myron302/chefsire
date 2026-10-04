/**
 * What the provider sees for their Square connection. Pure functions over the server's safe status view, so the screen
 * never decides on its own what a state means and the copy is testable without a browser.
 *
 * This screen only CONNECTS a Square account. It must never read as if customers can already pay online.
 */

export type SquareConnectionState =
  | "not_connected"
  | "active"
  | "needs_reauthorization"
  | "no_payment_location"
  | "configuration_error"
  | "verification_unavailable";

/** Exactly the fields `GET /api/square-connection/status` returns, and nothing else. */
export type SquareConnectionStatus = {
  state: SquareConnectionState;
  connected: boolean;
  paymentReady: boolean;
  needsReauthorization: boolean;
  merchantDisplayName: string | null;
  locationDisplayName: string | null;
};

export type SquareConnectionAction = "connect" | "reconnect" | "recheck" | "disconnect";

export type SquareConnectionPresentation = {
  label: string;
  tone: "neutral" | "good" | "attention";
  detail: string;
  actions: readonly SquareConnectionAction[];
};

export const SQUARE_CONNECTION_SCOPE_NOTE =
  "This connects your Square account only. Online payment for catering invoices is not available yet, and nothing is charged by connecting.";

export const SQUARE_CONNECTION_STATUS_PATH = "/api/square-connection/status";
export const SQUARE_CONNECTION_RECHECK_PATH = "/api/square-connection/recheck";
export const SQUARE_CONNECTION_DISCONNECT_PATH = "/api/square-connection/disconnect";
export const SQUARE_CONNECTION_START_PATH = "/api/payouts/connect-square";

export function squareConnectionPresentation(status: SquareConnectionStatus | null | undefined): SquareConnectionPresentation {
  if (!status) {
    return { label: "Checking…", tone: "neutral", detail: "Looking up your Square connection.", actions: [] };
  }
  const account = status.merchantDisplayName ? ` (${status.merchantDisplayName})` : "";
  switch (status.state) {
    case "active":
      return {
        label: "Connected",
        tone: "good",
        detail: status.locationDisplayName
          ? `Your Square account${account} is connected. Location: ${status.locationDisplayName}.`
          : `Your Square account${account} is connected.`,
        actions: ["disconnect"],
      };
    case "no_payment_location":
      return {
        label: "Connected, but no eligible payment location",
        tone: "attention",
        detail: `Your Square account${account} is connected, but Square reports no active location that can accept card payments. Set one up in Square, then check again.`,
        actions: ["recheck", "reconnect", "disconnect"],
      };
    case "needs_reauthorization":
      return {
        label: "Needs reconnect",
        tone: "attention",
        detail: `Square no longer accepts the saved connection${account}. Reconnect to continue.`,
        actions: ["reconnect", "disconnect"],
      };
    case "verification_unavailable":
      return {
        label: "Can't confirm right now",
        tone: "attention",
        detail: "We couldn't reach Square to confirm your connection. Try again in a moment.",
        actions: ["recheck", "disconnect"],
      };
    case "configuration_error":
      return {
        label: "Unavailable",
        tone: "attention",
        detail: "Connecting Square isn't available right now. Please try again later.",
        actions: [],
      };
    case "not_connected":
    default:
      return {
        label: "Not connected",
        tone: "neutral",
        detail: "Connect your Square account so customers can pay you directly when online payment launches.",
        actions: ["connect"],
      };
  }
}

/** Messages for the `?error=` / `?connected=` the OAuth callback redirects back with. Anything unknown says nothing. */
export function squareCallbackMessage(search: string): { tone: "good" | "attention"; text: string } | null {
  const params = new URLSearchParams(search);
  if (params.get("connected") === "true") return { tone: "good", text: "Square connected." };
  switch (params.get("error")) {
    case "merchant_mismatch":
      return { tone: "attention", text: "Square returned a different account than the one authorized. Nothing was connected; please try again." };
    case "scopes_insufficient":
      return { tone: "attention", text: "Square didn't grant every permission needed. Nothing was connected; please try again and approve all of them." };
    case "square_not_configured":
      return { tone: "attention", text: "Connecting Square isn't available right now." };
    case "square_auth_failed":
    case "callback_failed":
      return { tone: "attention", text: "We couldn't connect your Square account. Nothing was saved; please try again." };
    default:
      return null;
  }
}

/** Only ever navigate to Square itself, whatever a response says. */
export function isSquareAuthorizeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "connect.squareup.com" || url.hostname === "connect.squareupsandbox.com") && url.pathname === "/oauth2/authorize";
  } catch {
    return false;
  }
}
