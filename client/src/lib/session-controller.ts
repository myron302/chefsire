/**
 * The client's session lifecycle, in one place (Stability Phase 2C, session recovery).
 *
 * Every path that decides "who is signed in" -- initial cached-user check, Google OAuth return, background retries, explicit login, explicit
 * logout, refresh -- goes through this controller, so there is one retry policy and one staleness rule:
 *
 *   EPOCH   An integer identifying the current identity. It is bumped (and every in-flight request aborted) by logout, by the START of a login,
 *           by a successful login, and by unmount. An asynchronous step captures the epoch before it starts and, after EVERY await (request,
 *           body parsing, sleep), checks it is still current before it touches state or localStorage. A stale step does nothing.
 *   RUN     Verification runs supersede each other (starting a new run aborts the previous one) but, unlike the epoch, do not discard a login.
 *
 * COOKIE ORDER. The session is one cookie in one jar, and what ends up in the jar is decided by the order in which login/logout RESPONSES are
 * delivered -- something a client cannot reorder once requests are in flight. So every cookie-changing request (login, logout) is SERIALIZED through
 * one queue: a request is sent only after the previous one has been fully delivered (its Set-Cookie already applied). The final cookie is therefore
 * always the one belonging to the LAST intent, and a superseded login never needs a "cleanup" logout issued from its own (late) response handler -- the
 * logout/login the user actually asked for is already queued behind it. A queued login that was superseded before it started is never sent at all.
 *
 * Authority: the server cookie decides who is authenticated; this controller only decides what the UI shows. A cached profile shown during an
 * outage is continuity, not authorization -- every protected API call is still checked by the server. With no cache (e.g. the first load after
 * Google OAuth) no user is invented: the state stays signed-out/"unavailable" and offers a retry.
 *
 * Pure of React and of the browser: fetch, storage, location, timers are injected, so the races are tested deterministically.
 */
import { SESSION_RECHECK_DELAYS_MS, verifySessionOnce } from "./session-verification";

export type SessionStatus =
  /** A verification is in flight and nothing authoritative is known yet. */
  | "checking"
  | "authenticated"
  | "anonymous"
  /** The server could not tell us (outage / malformed answer). Not a logout; a retry is possible. */
  | "unavailable";

export type SessionState<U> = {
  user: U | null;
  loading: boolean;
  sessionStatus: SessionStatus;
  /** True from the Google OAuth return until the session is resolved (the URL marker is kept until then). */
  pendingOAuth: boolean;
  /** True while a verification run (including its scheduled retries) is active. */
  verifying: boolean;
};

export type SessionControllerDeps<U extends { id: string }> = {
  fetch: typeof fetch;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  getLocation: () => { pathname: string; search: string; hash: string };
  replaceUrl: (url: string) => void;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Validates a server user payload; throws if it is incomplete. */
  parseUser: (payload: unknown) => U;
  onChange: (state: SessionState<U>) => void;
  delaysMs?: readonly number[];
  /** Resolves after `ms` or when the signal aborts. Used only as the deadline of a cookie-changing request. Defaults to a real timer. */
  mutationDeadline?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Longest a login/logout request may hold the queue. Default 30s. */
  mutationTimeoutMs?: number;
};

/** After the deadline aborts a request, how long a fetch that ignores the abort is given before the exchange is abandoned. */
const MUTATION_GRACE_MS = 2_000;

const SUPERSEDED_LOGIN = { ok: false, error: "Sign-in was superseded by a newer request." } as const;

export const USER_STORAGE_KEY = "user";
/** Set when the user asked to log out; cleared only when the server confirmed it (or a new login happens). Prevents restoring a lingering cookie. */
export const LOGOUT_PENDING_KEY = "auth_logout_pending";
export const OAUTH_MARKER_PARAM = "google-login";

export function createSessionController<U extends { id: string }>(deps: SessionControllerDeps<U>) {
  const delays = deps.delaysMs ?? SESSION_RECHECK_DELAYS_MS;
  // localStorage can throw (private mode, quota, disabled). The session decision must never depend on it succeeding halfway: it is a best-effort cache.
  const storage = {
    getItem: (k: string) => { try { return deps.storage.getItem(k); } catch { return null; } },
    setItem: (k: string, v: string) => { try { deps.storage.setItem(k, v); } catch { /* best effort */ } },
    removeItem: (k: string) => { try { deps.storage.removeItem(k); } catch { /* best effort */ } },
  };
  let epoch = 0;
  let disposed = false;
  let runSeq = 0;
  let runAbort: AbortController | undefined;
  const inflight = new Set<AbortController>();
  // Cookie-changing requests: one at a time, in intent order.
  let mutationTail: Promise<unknown> = Promise.resolve();
  let mutationSeq = 0; // identifies the LATEST login/logout intent
  let queuedMutations = 0;
  const mutationAborts = new Set<AbortController>(); // aborted only by the deadline or unmount, never by a newer intent
  /** True when the jar may hold a session the UI did not adopt (a superseded login that the server accepted, or an uncertain one). */
  let foreignCookieSuspected = false;
  const mutationDeadline = deps.mutationDeadline ?? ((ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); }
    signal.addEventListener("abort", done, { once: true });
  }));
  let state: SessionState<U> = { user: null, loading: true, sessionStatus: "checking", pendingOAuth: false, verifying: false };

  const set = (patch: Partial<SessionState<U>>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    deps.onChange(state);
  };
  const track = () => { const ac = new AbortController(); inflight.add(ac); return ac; };
  const untrack = (ac: AbortController) => { inflight.delete(ac); };
  /** End the current identity: nothing started before this point may apply its result any more, and its requests are abandoned. */
  const invalidateAll = () => {
    epoch += 1;
    runSeq += 1;
    runAbort = undefined;
    for (const ac of Array.from(inflight)) ac.abort();
    inflight.clear();
  };

  const oauthMarkerPresent = () => new URLSearchParams(deps.getLocation().search).get(OAUTH_MARKER_PARAM) === "success";
  /** Remove only the marker; the requested path, every other query parameter and the fragment are preserved. */
  const stripOAuthMarker = () => {
    const loc = deps.getLocation();
    const params = new URLSearchParams(loc.search);
    if (!params.has(OAUTH_MARKER_PARAM)) return;
    params.delete(OAUTH_MARKER_PARAM);
    const search = params.toString();
    deps.replaceUrl(`${loc.pathname}${search ? `?${search}` : ""}${loc.hash}`);
  };

  const readCachedUser = (): U | null => {
    try {
      const raw = storage.getItem(USER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
      const copy = { ...parsed, id: String(parsed.id) };
      delete copy.password;
      return copy as U;
    } catch {
      storage.removeItem(USER_STORAGE_KEY);
      return null;
    }
  };

  const commitVerifiedUser = (user: U) => {
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    set({ user, loading: false, sessionStatus: "authenticated", pendingOAuth: false, verifying: false });
    stripOAuthMarker();
  };
  const commitSignedOut = () => {
    storage.removeItem(USER_STORAGE_KEY);
    set({ user: null, loading: false, sessionStatus: "anonymous", pendingOAuth: false, verifying: false });
    stripOAuthMarker();
  };

  /**
   * One verification run: an immediate attempt, then up to `delays.length` retries -- only while the answer is "unavailable". A definitive
   * answer (valid / invalid) ends the run. Bounded: no timer remains scheduled once it returns.
   */
  async function verifyRun(cachedForContinuity: U | null): Promise<void> {
    runAbort?.abort();
    const ac = track();
    runAbort = ac;
    const myEpoch = epoch;
    const myRun = ++runSeq;
    const current = () => !disposed && myEpoch === epoch && myRun === runSeq;
    set({ verifying: true });
    try {
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) {
          await deps.sleep(delays[attempt - 1], ac.signal);
          if (!current()) return;
        }
        const result = await verifySessionOnce(deps.fetch, ac.signal, deps.parseUser);
        if (!current()) return; // logout / login / unmount / newer run happened while we waited: apply nothing
        if (result.kind === "valid") return commitVerifiedUser(result.user);
        if (result.kind === "invalid") return commitSignedOut();
        if (result.kind === "cancelled") return;
        // Unavailable: the answer says nothing about the session. Show the cached profile for continuity (never for an OAuth return,
        // where the account may be a different one), stay "unavailable", and let the loop try again.
        set({
          loading: false,
          sessionStatus: "unavailable",
          ...(attempt === 0 && cachedForContinuity && !state.user ? { user: cachedForContinuity } : {}),
        });
      }
      set({ verifying: false }); // retries exhausted: recoverable via retry(); never claimed invalid
    } finally {
      untrack(ac);
      if (runAbort === ac) runAbort = undefined;
    }
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    queuedMutations += 1;
    const run = mutationTail.then(task, task).finally(() => {
      queuedMutations -= 1;
      if (queuedMutations === 0 && !disposed) set({ loading: false });
    });
    mutationTail = run.catch(() => undefined);
    return run;
  }

  type DeadlineOutcome<T> =
    | { kind: "done"; value: T }
    /** Our deadline (or an unmount) ended the exchange before it produced a result. The server may nevertheless have processed the request. */
    | { kind: "deadline" }
    | { kind: "failed"; error: unknown };

  /**
   * Run ONE cookie-changing exchange -- request AND reading of its body -- under one deadline.
   *
   * The abort signal stays live until the whole exchange is finished: aborting it when the headers arrive would cut the body stream and make an
   * ordinary successful login unreadable (fetch aborts reading as well as connecting). The deadline timer is cancelled by completion, never by
   * aborting the request. When the deadline fires the request is aborted; if the fetch implementation ignores the abort, the exchange is
   * abandoned after a short grace so the queue can never be left permanently pending.
   */
  async function withMutationDeadline<T>(run: (signal: AbortSignal) => Promise<T>): Promise<DeadlineOutcome<T>> {
    const ac = new AbortController();
    mutationAborts.add(ac);
    const stopTimers = new AbortController();
    let finished = false;
    let timedOut = false;
    const settled = run(ac.signal).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    );
    const abandoned = new Promise<"abandoned">((resolve) => {
      void mutationDeadline(deps.mutationTimeoutMs ?? 30_000, stopTimers.signal).then(async () => {
        if (finished) return;
        timedOut = true;
        ac.abort();
        await mutationDeadline(MUTATION_GRACE_MS, stopTimers.signal);
        if (!finished) resolve("abandoned");
      });
    });
    try {
      const first = await Promise.race([settled, abandoned]);
      if (first === "abandoned") return { kind: "deadline" };
      if (first.ok) return { kind: "done", value: first.value };
      return timedOut || ac.signal.aborted ? { kind: "deadline" } : { kind: "failed", error: first.error };
    } finally {
      finished = true;
      mutationAborts.delete(ac);
      stopTimers.abort(); // cancels the timers; the request itself is NOT aborted by finishing
    }
  }

  type Exchange =
    | { kind: "response"; status: number; ok: boolean; body: unknown; bodyReadable: boolean }
    /** fetch rejected without a response (offline, refused, reset): the browser processed no Set-Cookie for this request. */
    | { kind: "network" }
    /** The deadline ended it first. Whether the server processed it -- and whether a Set-Cookie was applied -- is unknown. */
    | { kind: "deadline" };

  async function mutationExchange(url: string, init: RequestInit, readBody: boolean): Promise<Exchange> {
    const outcome = await withMutationDeadline(async (signal) => {
      let res: Response;
      try {
        res = await deps.fetch(url, { ...init, signal });
      } catch (e) {
        if (signal.aborted) throw e; // our deadline / unmount
        return { noResponse: true as const };
      }
      let body: unknown;
      let bodyReadable = false;
      if (readBody) {
        try { body = await res.json(); bodyReadable = true; } catch { /* missing, truncated, not JSON, or cut by the deadline */ }
      } else {
        try { await res.body?.cancel(); } catch { /* nothing to read */ }
      }
      return { status: res.status, ok: res.ok, body, bodyReadable };
    });
    if (outcome.kind === "deadline") return { kind: "deadline" };
    if (outcome.kind === "failed") return { kind: "network" };
    return "noResponse" in outcome.value ? { kind: "network" } : { kind: "response", ...outcome.value };
  }

  /** Ask the server to drop the cookie. Confirmed (2xx, or 401 = already gone) settles the local logout intent; anything else keeps it. Runs INSIDE a queue slot. */
  async function serverLogout(): Promise<void> {
    const ex = await mutationExchange("/api/auth/logout", { method: "POST", credentials: "include" }, false);
    if (ex.kind === "response" && (ex.ok || ex.status === 401)) {
      storage.removeItem(LOGOUT_PENDING_KEY);
      foreignCookieSuspected = false;
    }
    // Anything else (network, deadline, 5xx): the intent stays recorded and is retried on the next start.
  }

  /**
   * The cookie may have changed to a session we were not told about. Show nobody until the SERVER says who it is, then adopt exactly that identity.
   * If the server cannot say (outage / malformed / deadline) the session is uncertain and is cleared rather than guessed at. Runs inside a queue slot.
   * Returns the adopted user, or null.
   */
  async function reconcileUncertainSession(seq: number): Promise<U | null> {
    storage.removeItem(USER_STORAGE_KEY);
    set({ user: null, sessionStatus: "checking", pendingOAuth: false });
    const outcome = await withMutationDeadline((signal) => verifySessionOnce(deps.fetch, signal, deps.parseUser));
    if (disposed || seq !== mutationSeq) {
      foreignCookieSuspected = true; // a newer intent follows in the queue; it decides the final state
      return null;
    }
    const result = outcome.kind === "done" ? outcome.value : undefined;
    if (result?.kind === "valid") {
      storage.removeItem(LOGOUT_PENDING_KEY);
      foreignCookieSuspected = false;
      commitVerifiedUser(result.user);
      epoch += 1;
      return result.user;
    }
    if (result?.kind === "invalid") {
      foreignCookieSuspected = false; // the server says there is no session
      commitSignedOut();
      return null;
    }
    await dropForeignSession(); // cannot tell who the cookie belongs to: clear it
    return null;
  }

  /** A session may sit in the jar that the UI did not adopt: remove it, and show signed-out like the jar. Runs inside a queue slot. */
  async function dropForeignSession(): Promise<void> {
    storage.setItem(LOGOUT_PENDING_KEY, "1");
    commitSignedOut();
    await serverLogout();
  }

  return {
    getState: () => state,

    /** Decide the initial state and, when there is something to verify, start the single verification run. */
    start() {
      if (oauthMarkerPresent()) {
        // Returning from Google: the cookie was just set by the server. Whatever was cached may belong to another account, so it is not shown.
        storage.removeItem(LOGOUT_PENDING_KEY);
        set({ pendingOAuth: true, user: null, sessionStatus: "checking" });
        void verifyRun(null);
        return;
      }
      if (storage.getItem(LOGOUT_PENDING_KEY)) {
        // The user logged out but the server never confirmed. The cookie may still be valid; it must not bring them back.
        set({ user: null, loading: false, sessionStatus: "anonymous" });
        storage.removeItem(USER_STORAGE_KEY);
        void enqueue(serverLogout);
        return;
      }
      const cached = readCachedUser();
      if (!cached) {
        set({ loading: false, sessionStatus: "anonymous" });
        return;
      }
      set({ sessionStatus: "checking" });
      void verifyRun(cached);
    },

    /** User-initiated retry after the automatic retries were exhausted (or the answer was malformed). */
    retry() {
      if (disposed || state.verifying) return;
      const cached = readCachedUser();
      void verifyRun(state.pendingOAuth ? null : cached);
    },

    login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
      invalidateAll(); // any earlier session's checks end here, before the new identity can exist
      const seq = ++mutationSeq; // this is now the latest intent: every earlier login/logout is superseded
      set({ loading: true });
      return enqueue(async () => {
        const superseded = () => disposed || seq !== mutationSeq;
        try {
        // Superseded while waiting its turn (a newer login or a logout was requested): it is never sent.
        if (superseded()) return { ...SUPERSEDED_LOGIN };

        const ex = await mutationExchange(
          "/api/auth/login",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.toLowerCase().trim(), password }) },
          true,
        );

        if (ex.kind === "network") {
          // No response at all: THIS request cannot have changed the cookie. But an earlier superseded login the server accepted may have, and the
          // jar must not keep a session the UI never adopted.
          if (superseded()) return { ...SUPERSEDED_LOGIN };
          if (foreignCookieSuspected) await dropForeignSession();
          return { ok: false, error: "Network error. Please try again." };
        }

        if (ex.kind === "deadline") {
          // No answer in time. The server may have processed the request and the browser may have applied its Set-Cookie: a network failure proves nothing.
          if (superseded()) { foreignCookieSuspected = true; return { ...SUPERSEDED_LOGIN }; }
          const hadForeign = foreignCookieSuspected;
          foreignCookieSuspected = true;
          if (hadForeign) {
            // A session we never adopted is already known to be in the jar; adopting whatever the server reports would show an account the user
            // abandoned. Clear instead.
            await dropForeignSession();
            return { ok: false, error: "Sign-in timed out. Please try again." };
          }
          const adopted = await reconcileUncertainSession(seq);
          const typed = email.toLowerCase().trim();
          const sameAccount = !!adopted && String((adopted as { email?: string }).email ?? "").toLowerCase() === typed;
          return sameAccount ? { ok: true } : { ok: false, error: "Sign-in timed out. Please try again." };
        }

        const data = ex.body as any;
        if (!ex.ok) {
          if (superseded()) return { ...SUPERSEDED_LOGIN };
          if (foreignCookieSuspected) await dropForeignSession(); // cookie, UI and storage must not disagree
          const msg = data?.error || (ex.status === 403 ? "Please verify your email to log in." : "Invalid email or password");
          return { ok: false, error: msg };
        }

        // From here the response is a 2xx: the browser has ALREADY applied its Set-Cookie, whatever the body says. A 2xx whose body we cannot use
        // therefore means "the cookie may belong to someone we cannot name", not "nothing happened".
        let user: U | null = null;
        if (ex.bodyReadable && data?.success && data?.user) {
          try { user = deps.parseUser(data.user); } catch { user = null; }
        }
        if (superseded()) {
          // A newer intent exists. Do NOT adopt this result and do NOT send a cleanup request from here: whatever the newer intent is (logout / another
          // login) is already queued behind this slot and replaces the cookie. If that intent turns out not to replace it, foreignCookieSuspected lets it.
          foreignCookieSuspected = true;
          return { ...SUPERSEDED_LOGIN };
        }
        if (user) {
          storage.removeItem(LOGOUT_PENDING_KEY);
          foreignCookieSuspected = false; // this response's cookie is the one in the jar and the one we display
          commitVerifiedUser(user);
          epoch += 1; // checks that began while this login was in flight may have read the previous cookie: they must not apply
          return { ok: true };
        }
        console.error("Login response was successful but its body was unusable; reconciling the session with the server.");
        return (await reconcileUncertainSession(seq))
          ? { ok: true }
          : { ok: false, error: "We couldn't confirm your sign-in. Please try again." };
        } catch (e) {
          // Anything unexpected inside a queue slot must neither reject the caller nor leave the jar unaccounted for: the request may have succeeded.
          console.error("Login handling failed unexpectedly:", e);
          if (!superseded()) foreignCookieSuspected = true;
          return { ok: false, error: "Something went wrong. Please try again." };
        }
      });
    },

    logout(): Promise<void> {
      invalidateAll(); // FIRST: nothing in flight may write the user back after this line
      ++mutationSeq; // supersedes every login that has not been adopted yet
      storage.setItem(LOGOUT_PENDING_KEY, "1");
      commitSignedOut();
      return enqueue(serverLogout); // behind any login still in flight: its cookie lands first and this logout then removes it
    },

    /** Re-read the account from the server. Resolves quietly if superseded; rejects when the server could not confirm. */
    async refresh(): Promise<void> {
      const myEpoch = epoch;
      const ac = track();
      try {
        const result = await verifySessionOnce(deps.fetch, ac.signal, deps.parseUser);
        if (disposed || myEpoch !== epoch || result.kind === "cancelled") return;
        if (result.kind !== "valid") throw new Error("Unable to refresh your account");
        commitVerifiedUser(result.user);
      } finally {
        untrack(ac);
      }
    },

    /** Local, optimistic profile edit (the caller persists it to the server). Ignored when nobody is signed in. */
    patchUser(updates: Partial<U>) {
      if (!state.user) return;
      const merged = { ...state.user, ...updates } as U;
      storage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
      set({ user: merged });
    },

    /** Unmount: abandon everything, schedule nothing, apply nothing. */
    dispose() {
      invalidateAll();
      disposed = true;
      for (const ac of Array.from(mutationAborts)) ac.abort();
    },
  };
}

export type SessionController<U extends { id: string }> = ReturnType<typeof createSessionController<U>>;
