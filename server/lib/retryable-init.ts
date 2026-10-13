// server/lib/retryable-init.ts
/**
 * Lazy, single-flight, self-healing initialization (the "ensure the tables exist" pattern).
 *
 * The pattern this replaces was:
 *
 *   let ready: Promise<void> | null = null;
 *   async function ensure() { if (ready) return ready; ready = (async () => { ...DDL... })(); return ready; }
 *
 * The promise is stored BEFORE it settles and is never cleared, so a single transient failure (a Neon cold start, a
 * dropped connection, a statement timeout) is cached for the life of the process: every later call re-awaits the same
 * rejected promise, the work is never attempted again, and the feature stays down until someone restarts the server.
 *
 * What this does instead:
 *
 *  - SUCCESS is cached forever. After the first successful run `ensure()` is a resolved promise and never touches the
 *    database again.
 *  - SINGLE-FLIGHT. While an attempt is running every caller shares it, so a burst of requests during initialization
 *    runs the DDL once, never concurrently.
 *  - FAILURE IS NOT CACHED, but it is rate limited. After a failed attempt the next attempt is not allowed before an
 *    exponentially growing delay (initialBackoffMs, doubled per consecutive failure, capped at maxBackoffMs). Callers
 *    that arrive inside that window are refused immediately WITHOUT a database round trip, so a database that is down
 *    (or an unauthenticated flood against an endpoint that needs this init) can never turn into a retry storm or a
 *    stream of DDL. The window is bounded, so recovery is bounded: once the database is back the next attempt after the
 *    window succeeds and the feature heals itself.
 *  - CALLERS NEVER WAIT FOREVER. A caller waits for the running attempt for at most attemptTimeoutMs of that attempt's
 *    life. If the attempt is wedged (a hung connection), callers get the same "unavailable" answer instead of hanging
 *    with it. A new attempt is not started while one is still running, except for an attempt that has been wedged for
 *    abandonAfterMs: that one is written off as a failure (the usual backoff applies) so a driver that never settles
 *    cannot disable the feature permanently. A late success of a written-off attempt still counts, because the work it
 *    did is real; a late failure of one is ignored.
 *  - ERRORS ARE OPAQUE TO CALLERS. `ensure()` rejects with InitializationUnavailableError, whose message names only the
 *    initializer. The underlying driver error is kept as `cause` for the server log and is never meant to be serialized.
 *
 * It deliberately knows nothing about SQL or Express beyond `initGuard`; it is a few dozen lines of state so the
 * guarantees above are easy to read and to test.
 */
import type { Request, RequestHandler, Response } from "express";

export const RETRYABLE_INIT_DEFAULTS = {
  /** How long a caller waits on a running attempt (measured from the attempt's start). */
  attemptTimeoutMs: 15_000,
  /** A running attempt older than this is written off so a hung driver cannot block recovery forever. */
  abandonAfterMs: 60_000,
  /** Delay after the first failure; doubled for each consecutive failure. */
  initialBackoffMs: 1_000,
  /** Ceiling for the delay: at worst one attempt per this interval, however long the outage lasts. */
  maxBackoffMs: 30_000,
} as const;

export class InitializationUnavailableError extends Error {
  readonly code = "initialization_unavailable";
  /** Earliest moment, in ms from now, at which a new attempt can be made. Always at least 1000 for use in Retry-After. */
  readonly retryAfterMs: number;

  constructor(readonly initName: string, retryAfterMs: number, cause?: unknown) {
    super(`Initialization "${initName}" is not available`);
    this.name = "InitializationUnavailableError";
    this.retryAfterMs = Math.max(1_000, Math.ceil(retryAfterMs));
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export interface RetryableInitOptions {
  /** Used in log lines and errors only. */
  name: string;
  /** The idempotent work. Must be safe to run again after a partial failure (e.g. CREATE ... IF NOT EXISTS). */
  run: () => Promise<void>;
  attemptTimeoutMs?: number;
  abandonAfterMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  /** Monotonic-ish clock in ms. Defaults to Date.now. */
  now?: () => number;
  /** Failure sink. Defaults to console.error; receives the real driver error, which is for the server log only. */
  logger?: (message: string, error: unknown) => void;
}

export interface RetryableInit {
  /** Resolves once the work has succeeded; rejects with InitializationUnavailableError otherwise. Never hangs. */
  ensure(): Promise<void>;
  isReady(): boolean;
  /** Counters for tests and diagnostics. Contains no error detail. */
  stats(): { attempts: number; consecutiveFailures: number; ready: boolean; running: boolean; retryNotBeforeMs: number };
  /** Test seams, in the style of setSessionLookupForTests: not used by production code. */
  setClockForTests(now: (() => number) | null): void;
  resetForTests(): void;
}

type Attempt = { startedAt: number; promise: Promise<void> };

export function createRetryableInit(options: RetryableInitOptions): RetryableInit {
  const name = options.name;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? RETRYABLE_INIT_DEFAULTS.attemptTimeoutMs;
  const abandonAfterMs = options.abandonAfterMs ?? RETRYABLE_INIT_DEFAULTS.abandonAfterMs;
  const initialBackoffMs = options.initialBackoffMs ?? RETRYABLE_INIT_DEFAULTS.initialBackoffMs;
  const maxBackoffMs = options.maxBackoffMs ?? RETRYABLE_INIT_DEFAULTS.maxBackoffMs;
  const log = options.logger ?? ((message: string, error: unknown) => console.error(message, error));

  let clock: () => number = options.now ?? Date.now;
  let ready = false;
  let current: Attempt | null = null;
  let attempts = 0;
  let consecutiveFailures = 0;
  let retryNotBefore = 0;
  let lastError: unknown;

  const now = () => clock();

  function recordFailure(error: unknown, at: number): void {
    consecutiveFailures += 1;
    lastError = error;
    const delay = Math.min(initialBackoffMs * 2 ** Math.min(consecutiveFailures - 1, 30), maxBackoffMs);
    retryNotBefore = at + delay;
    log(`[init:${name}] attempt failed (${consecutiveFailures} consecutive); next attempt not before +${delay}ms`, error);
  }

  function start(at: number): Attempt {
    attempts += 1;
    const attempt: Attempt = { startedAt: at, promise: Promise.resolve() };
    // An async IIFE so a synchronous throw from `run` is a rejection like any other.
    attempt.promise = (async () => options.run())().then(
      () => {
        // A success is always real, even for an attempt that was written off while it ran.
        ready = true;
        consecutiveFailures = 0;
        retryNotBefore = 0;
        lastError = undefined;
        if (current === attempt) current = null;
      },
      (error) => {
        if (current === attempt) {
          current = null;
          recordFailure(error, now());
        } else {
          log(`[init:${name}] a written-off attempt failed late (ignored)`, error);
        }
        throw error;
      },
    );
    // Callers observe the outcome through waitFor(); this guarantees a rejection nobody is waiting on (every caller timed
    // out, or hung up) can never become an unhandled rejection, which this process treats as fatal.
    attempt.promise.catch(() => undefined);
    current = attempt;
    return attempt;
  }

  function waitFor(attempt: Attempt, at: number): Promise<void> {
    const remaining = attempt.startedAt + attemptTimeoutMs - at;
    if (remaining <= 0) {
      return Promise.reject(new InitializationUnavailableError(name, Math.max(retryNotBefore - at, 0), lastError));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new InitializationUnavailableError(name, Math.max(retryNotBefore - now(), 0), lastError));
      }, remaining);
      attempt.promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (error) => {
          clearTimeout(timer);
          reject(new InitializationUnavailableError(name, Math.max(retryNotBefore - now(), 0), error));
        },
      );
    });
  }

  function ensure(): Promise<void> {
    if (ready) return Promise.resolve();
    const at = now();

    if (current && at - current.startedAt >= abandonAfterMs) {
      // Wedged. Stop waiting on it and let the normal backoff decide when the next attempt may run.
      current = null;
      recordFailure(new Error(`attempt exceeded ${abandonAfterMs}ms and was written off`), at);
    }

    if (current) return waitFor(current, at);
    if (at < retryNotBefore) {
      return Promise.reject(new InitializationUnavailableError(name, retryNotBefore - at, lastError));
    }
    return waitFor(start(at), at);
  }

  return {
    ensure,
    isReady: () => ready,
    stats: () => ({ attempts, consecutiveFailures, ready, running: current !== null, retryNotBeforeMs: retryNotBefore }),
    setClockForTests(next) {
      clock = next ?? options.now ?? Date.now;
    },
    resetForTests() {
      ready = false;
      current = null;
      attempts = 0;
      consecutiveFailures = 0;
      retryNotBefore = 0;
      lastError = undefined;
    },
  };
}

export interface InitGuardResponse {
  /** Human message; keep the pre-existing wording where a client may already display it. */
  message: string;
  /** Stable machine code. */
  code: string;
}

/**
 * Express middleware that requires an initializer before the handlers after it run.
 *
 * Mount it on the ROUTES that need the initialization (after authentication, so an unauthenticated caller can neither
 * trigger it nor learn its state) and never on a router that is mounted without a path: a router-level middleware runs
 * for every request that reaches the router, whether or not any of its routes match.
 *
 * On failure the answer is 503 with Retry-After and a fixed body. No driver message, SQL, host name or stack is ever
 * included, and the detail goes to the server log only.
 */
export function initGuard(init: Pick<RetryableInit, "ensure">, response: InitGuardResponse): RequestHandler {
  return async (_req: Request, res: Response, next) => {
    try {
      await init.ensure();
    } catch (error) {
      const retryAfterMs = error instanceof InitializationUnavailableError ? error.retryAfterMs : 1_000;
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1_000)));
      res.status(503).json({ message: response.message, code: response.code, retryable: true });
      return;
    }
    next();
  };
}
