import { beginGoogleSignIn } from "./session-controller";

/**
 * The URL a "Continue with Google" control should navigate to. It records a single-use nonce in this browser and passes it along as
 * `client_state`; the server echoes it back on the callback as `oauth_state`, which is what lets a GENUINE sign-in supersede a pending
 * logout (a bare `?google-login=success` URL cannot). Without storage/crypto the plain URL is returned and the flow still works.
 */
export function googleSignInUrl(baseUrl: string, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage): string {
  try {
    if (!storage) return baseUrl;
    const nonce = beginGoogleSignIn(storage);
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}client_state=${encodeURIComponent(nonce)}`;
  } catch {
    return baseUrl;
  }
}
