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

/** What a disconnect did at Square. Mirrors the server: LOCAL disconnect and SQUARE revocation are different things. */
export type SquareProviderRevocation = "revoked" | "retained_for_shared_connection" | "unconfirmed" | "not_applicable";

/** Exactly what `POST /api/square-connection/disconnect` returns. */
export type SquareDisconnectResponse = {
  ok: true;
  changed: boolean;
  providerRevocation?: SquareProviderRevocation;
  providerRevoked?: boolean;
  connection: SquareConnectionStatus;
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

/**
 * What to tell the provider after a disconnect. The account is always disconnected from ChefSire locally; whether Square's
 * authorization was revoked is a separate fact, and an unconfirmed revocation is surfaced as a warning rather than success.
 * A response from an older server (no `providerRevocation`) is judged by `providerRevoked`, and anything unclear is a warning.
 */
export function squareDisconnectNotice(response: Pick<SquareDisconnectResponse, "changed" | "providerRevocation" | "providerRevoked">): { tone: "good" | "attention"; text: string } | null {
  if (!response.changed) return null;
  const revocation: SquareProviderRevocation = response.providerRevocation ?? (response.providerRevoked === true ? "revoked" : "unconfirmed");
  switch (revocation) {
    case "revoked":
      return { tone: "good", text: "Square disconnected. ChefSire's access to your Square account has been revoked." };
    case "retained_for_shared_connection":
      return { tone: "attention", text: "Disconnected from this ChefSire account. Another ChefSire account uses the same Square account, so ChefSire's access in Square was left in place for it." };
    case "not_applicable":
      return null;
    case "unconfirmed":
    default:
      return {
        tone: "attention",
        text: "Disconnected from ChefSire, but we couldn't confirm that Square has revoked ChefSire's access, so it may still be active. To be sure, remove ChefSire from the connected apps in your Square account.",
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
    case "authorization_superseded":
      return { tone: "attention", text: "Square access was revoked while connecting. Nothing was saved; please connect again." };
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
