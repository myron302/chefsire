/**
 * How the client reads the answer to "is my session still good?" (`GET /api/auth/me`). Stability Phase 2C.
 *
 * The server now separates three cases and the client must too:
 *   - the session is definitively not valid  -> 401 (the server answered "no"): forget the stored user;
 *   - the session is valid                   -> 200;
 *   - the server could not check (database outage, overload, gateway error) -> 5xx / 429 / 408: say NOTHING about the session.
 * Before this, every non-OK answer cleared the stored user, so a database blip logged everyone out of the UI.
 */
export type SessionVerdict = "valid" | "invalid" | "unavailable";

export function classifySessionStatus(status: number): SessionVerdict {
  if (status >= 200 && status < 300) return "valid";
  if (status === 401) return "invalid";
  // 403 on /me has no server meaning today; treat any other client error as "the server refused", i.e. not a valid session.
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return "invalid";
  return "unavailable";
}

/** Bounded background re-check after an "unavailable" answer: 3 tries, increasing delay, then stop (no polling loop, no retry storm). */
export const SESSION_RECHECK_DELAYS_MS = [5_000, 15_000, 45_000] as const;

export async function recheckSession(
  fetchStatus: () => Promise<number>,
  options: { delaysMs?: readonly number[]; sleep?: (ms: number) => Promise<void>; shouldStop?: () => boolean } = {},
): Promise<SessionVerdict> {
  const delays = options.delaysMs ?? SESSION_RECHECK_DELAYS_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (const delay of delays) {
    await sleep(delay);
    if (options.shouldStop?.()) return "unavailable";
    let verdict: SessionVerdict;
    try {
      verdict = classifySessionStatus(await fetchStatus());
    } catch {
      verdict = "unavailable"; // network failure: still no information
    }
    if (verdict !== "unavailable") return verdict;
  }
  return "unavailable";
}
