/**
 * How the client reads the answer to "is my session still good?" (`GET /api/auth/me`). Stability Phase 2C.
 *
 * The server separates three cases and the client must too:
 *   - the session is definitively not valid  -> 401 (the server answered "no"): forget the stored user;
 *   - the session is valid                   -> 200 with a user payload;
 *   - the server could not check (database outage, overload, gateway error) -> 5xx / 429 / 408: say NOTHING about the session.
 *
 * There is exactly ONE reader of that answer (`verifySessionOnce`) and it returns the validated user from the very response it examined, so
 * no caller needs a second GET to obtain the user (a second request could answer differently from the first).
 */
export type SessionVerdict = "valid" | "invalid" | "unavailable";

export function classifySessionStatus(status: number): SessionVerdict {
  if (status >= 200 && status < 300) return "valid";
  if (status === 401) return "invalid";
  // 403 on /me has no server meaning today; treat any other client error as "the server refused", i.e. not a valid session.
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return "invalid";
  return "unavailable";
}

/** Bounded background re-check after an "unavailable" answer: 3 retries, increasing delay, then stop (no polling loop, no retry storm). */
export const SESSION_RECHECK_DELAYS_MS = [5_000, 15_000, 45_000] as const;

export type SessionCheckResult<U> =
  | { kind: "valid"; user: U }
  | { kind: "invalid" }
  /** No authoritative answer. `reason` is for diagnostics/tests only; callers must treat every reason the same way. */
  | { kind: "unavailable"; reason: "status" | "network" | "malformed" | "timeout" }
  /** The request was abandoned because the caller's generation ended (logout, login, unmount, newer run). Carries no information. */
  | { kind: "cancelled" };

/** Longest ONE verification attempt may take, headers and body together. The bounded retry schedule is built on top of this. */
export const SESSION_VERIFY_TIMEOUT_MS = 10_000;

export type SessionVerifyOptions = {
  timeoutMs?: number;
  /** Resolves after `ms` or when `stop` aborts (the timer is released). Defaults to a real timer; tests inject a controllable one. */
  deadline?: (ms: number, stop: AbortSignal) => Promise<void>;
};

/** The unbounded part: one request, its status classification and its body. Aborting `signal` ends it (headers wait AND body read). */
async function readSession<U>(
  fetchFn: typeof fetch,
  signal: AbortSignal,
  parseUser: (payload: unknown) => U,
): Promise<SessionCheckResult<U>> {
  let response: Response;
  try {
    response = await fetchFn("/api/auth/me", { credentials: "include", signal });
  } catch {
    return signal.aborted ? { kind: "cancelled" } : { kind: "unavailable", reason: "network" };
  }
  const verdict = classifySessionStatus(response.status);
  if (verdict === "invalid") return { kind: "invalid" };
  if (verdict === "unavailable") return { kind: "unavailable", reason: "status" };
  try {
    const body = (await response.json()) as { user?: unknown } | null;
    return { kind: "valid", user: parseUser(body?.user) };
  } catch {
    return signal.aborted ? { kind: "cancelled" } : { kind: "unavailable", reason: "malformed" };
  }
}

/**
 * One request, one answer, ONE DEADLINE. A connection that stalls before the headers, or after them while the body is read, can no longer leave the
 * attempt pending forever: at the deadline the request is aborted and the answer is "unavailable" (no information about the session -- never "invalid").
 *
 * The deadline is not tied to the arrival of headers, so a healthy response is never cut before its body is read. A fetch that ignores the abort
 * still cannot hang the attempt: the verdict does not wait for it, and its late result is discarded. Cancellation by the caller ('signal') wins over the
 * deadline and is reported as 'cancelled'. The timer and the listener are released on every outcome.
 *
 * A 2xx whose body does not contain a user the caller accepts (`parseUser` throws) is NOT a verification: it is reported as unavailable/"malformed".
 */
export async function verifySessionOnce<U>(
  fetchFn: typeof fetch,
  signal: AbortSignal,
  parseUser: (payload: unknown) => U,
  options: SessionVerifyOptions = {},
): Promise<SessionCheckResult<U>> {
  if (signal.aborted) return { kind: "cancelled" };
  const attempt = new AbortController();
  const stopTimer = new AbortController();
  let finished = false;
  let timedOut = false;
  let announceCancelled!: () => void;
  const cancelled = new Promise<"cancelled">((resolve) => { announceCancelled = () => resolve("cancelled"); });
  const onCallerAbort = () => { attempt.abort(); announceCancelled(); };
  signal.addEventListener("abort", onCallerAbort, { once: true });
  const timeout = new Promise<"timeout">((resolve) => {
    void (options.deadline ?? abortableSleep)(options.timeoutMs ?? SESSION_VERIFY_TIMEOUT_MS, stopTimer.signal).then(() => {
      if (finished || signal.aborted) return;
      timedOut = true;
      attempt.abort();
      resolve("timeout");
    });
  });
  const work = readSession(fetchFn, attempt.signal, parseUser);
  work.catch(() => undefined);
  try {
    const first = await Promise.race([work, timeout, cancelled]);
    if (first === "cancelled") return { kind: "cancelled" };
    if (first === "timeout") return { kind: "unavailable", reason: "timeout" };
    if (first.kind === "cancelled") return signal.aborted ? { kind: "cancelled" } : timedOut ? { kind: "unavailable", reason: "timeout" } : first;
    return first;
  } finally {
    finished = true;
    stopTimer.abort(); // releases the timer
    signal.removeEventListener("abort", onCallerAbort);
  }
}

/** Abortable delay: resolves after `ms`, or immediately when the signal aborts (the caller re-checks its generation either way). */
export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
