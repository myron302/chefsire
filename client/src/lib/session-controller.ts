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
};

export const USER_STORAGE_KEY = "user";
/** Set when the user asked to log out; cleared only when the server confirmed it (or a new login happens). Prevents restoring a lingering cookie. */
export const LOGOUT_PENDING_KEY = "auth_logout_pending";
export const OAUTH_MARKER_PARAM = "google-login";

export function createSessionController<U extends { id: string }>(deps: SessionControllerDeps<U>) {
  const delays = deps.delaysMs ?? SESSION_RECHECK_DELAYS_MS;
  let epoch = 0;
  let disposed = false;
  let runSeq = 0;
  let runAbort: AbortController | undefined;
  const inflight = new Set<AbortController>();
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
      const raw = deps.storage.getItem(USER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
      const copy = { ...parsed, id: String(parsed.id) };
      delete copy.password;
      return copy as U;
    } catch {
      deps.storage.removeItem(USER_STORAGE_KEY);
      return null;
    }
  };

  const commitVerifiedUser = (user: U) => {
    deps.storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    set({ user, loading: false, sessionStatus: "authenticated", pendingOAuth: false, verifying: false });
    stripOAuthMarker();
  };
  const commitSignedOut = () => {
    deps.storage.removeItem(USER_STORAGE_KEY);
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

  /** Ask the server to drop the cookie. Confirmed (2xx, or 401 = already gone) clears the local logout intent; anything else keeps it. */
  async function serverLogout(): Promise<void> {
    try {
      const res = await deps.fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (res.ok || res.status === 401) deps.storage.removeItem(LOGOUT_PENDING_KEY);
    } catch {
      /* intent stays recorded */
    }
  }

  return {
    getState: () => state,

    /** Decide the initial state and, when there is something to verify, start the single verification run. */
    start() {
      if (oauthMarkerPresent()) {
        // Returning from Google: the cookie was just set by the server. Whatever was cached may belong to another account, so it is not shown.
        deps.storage.removeItem(LOGOUT_PENDING_KEY);
        set({ pendingOAuth: true, user: null, sessionStatus: "checking" });
        void verifyRun(null);
        return;
      }
      if (deps.storage.getItem(LOGOUT_PENDING_KEY)) {
        // The user logged out but the server never confirmed. The cookie may still be valid; it must not bring them back.
        set({ user: null, loading: false, sessionStatus: "anonymous" });
        deps.storage.removeItem(USER_STORAGE_KEY);
        void serverLogout();
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

    async login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
      invalidateAll(); // any earlier session's checks end here, before the new identity can exist
      const myEpoch = epoch;
      set({ loading: true });
      try {
        const res = await deps.fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (disposed || myEpoch !== epoch) {
          // Superseded (e.g. logout pressed meanwhile). If the server accepted this login it set a cookie nobody asked to keep.
          if (res.ok && data?.success) void serverLogout();
          return { ok: false, error: "Sign-in was cancelled." };
        }
        if (!res.ok) {
          const msg = data?.error || (res.status === 403 ? "Please verify your email to log in." : "Invalid email or password");
          return { ok: false, error: msg };
        }
        if (!data?.success || !data?.user) return { ok: false, error: "Unexpected server response" };
        const user = deps.parseUser(data.user);
        deps.storage.removeItem(LOGOUT_PENDING_KEY);
        commitVerifiedUser(user);
        epoch += 1; // checks that began while this login was in flight may have seen the previous cookie: they must not apply
        return { ok: true };
      } catch (e) {
        console.error("Login failed:", e);
        return { ok: false, error: "Network error. Please try again." };
      } finally {
        set({ loading: false });
      }
    },

    async logout(): Promise<void> {
      invalidateAll(); // FIRST: nothing in flight may write the user back after this line
      deps.storage.setItem(LOGOUT_PENDING_KEY, "1");
      commitSignedOut();
      await serverLogout();
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
      deps.storage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
      set({ user: merged });
    },

    /** Unmount: abandon everything, schedule nothing, apply nothing. */
    dispose() {
      invalidateAll();
      disposed = true;
    },
  };
}

export type SessionController<U extends { id: string }> = ReturnType<typeof createSessionController<U>>;
