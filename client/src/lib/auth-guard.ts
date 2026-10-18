import type { SessionStatus } from "./session-controller";

/**
 * Should a protected page send the visitor to the login screen?
 *
 * Only when the session is CONFIRMED anonymous. `user === null` alone is also true while the session is still being verified (an OAuth return whose
 * check got a 503 and is retrying) and after the retries were exhausted without an answer (`unavailable`); neither is evidence that the visitor is
 * signed out, and redirecting then abandons the destination they just authenticated for.
 */
export function shouldRedirectToLogin(input: { loading: boolean; user: unknown; sessionStatus: SessionStatus }): boolean {
  return !input.loading && !input.user && input.sessionStatus === "anonymous";
}
