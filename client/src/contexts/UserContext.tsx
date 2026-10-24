import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { abortableSleep } from "@/lib/session-verification";
import { createSessionController, type SessionController, type SessionState, type SessionStatus, USER_STORAGE_KEY, LOGOUT_PENDING_KEY } from "@/lib/session-controller";

type User = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  royalTitle?: string | null;
  avatar?: string | null;
  bio?: string | null;
  isPrivate?: boolean;
  followersCount?: number;
  followingCount?: number;
  // Marketplace/Store fields
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string;
  nutritionPremium?: boolean;
  nutritionTrialEndsAt?: string;
  subscription?: 'free' | 'starter' | 'professional' | 'enterprise' | 'premium_plus' | string;
  trialEndDate?: string;
  productCount?: number;
  specialty?: string | null;
  cateringEnabled?: boolean;
  cateringLocation?: string | null;
  cateringLatitude?: string | null;
  cateringLongitude?: string | null;
  cateringRadius?: number | null;
  cateringBio?: string | null;
  cateringAvailable?: boolean;
};

type UserContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  signup: (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  /**
   * Additive (Phase 2C). "unavailable" = the server could not confirm the session (outage); NOT a logout. A cached profile may still be
   * shown for continuity, but the server decides every protected request.
   */
  sessionStatus: SessionStatus;
  /** User-initiated re-check after the automatic retries ran out. */
  retrySession: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

const REQUIRED_CATERING_FIELDS = [
  "specialty",
  "cateringEnabled",
  "cateringLocation",
  "cateringLatitude",
  "cateringLongitude",
  "cateringRadius",
  "cateringBio",
  "cateringAvailable",
] as const;

export function authenticatedUserFromPayload(payload: unknown): User {
  if (!payload || typeof payload !== "object" || !("id" in payload) || !("email" in payload)) {
    throw new Error("Incomplete authenticated user response");
  }
  const record = payload as Record<string, unknown>;
  if (REQUIRED_CATERING_FIELDS.some((field) => !Object.prototype.hasOwnProperty.call(record, field))) {
    throw new Error("Incomplete catering profile in authenticated user response");
  }
  // Preserve null, false, zero, and every other server-owned value verbatim.
  return { ...record, id: String(record.id) } as User;
}

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
};

const NOT_READY = { ok: false, error: "Please try again in a moment." } as const;

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState<User>>({ user: null, loading: true, sessionStatus: "checking", pendingOAuth: false, verifying: false });
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<SessionController<User> | null>(null);

  // All session decisions (cached-user check, Google OAuth return, background retries, login, logout, refresh) live in one controller with
  // one epoch-based staleness rule -- see lib/session-controller. The provider only binds it to React and to the browser.
  useEffect(() => {
    const controller = createSessionController<User>({
      fetch: (input, init) => window.fetch(input, init),
      storage: window.localStorage,
      getLocation: () => window.location,
      replaceUrl: (url) => window.history.replaceState({}, "", url),
      sleep: abortableSleep,
      parseUser: authenticatedUserFromPayload,
      onChange: setSession,
    });
    controllerRef.current = controller;
    const sync = () => controller.sync();
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage &&
          (event.key === null || event.key === USER_STORAGE_KEY || event.key === LOGOUT_PENDING_KEY)) sync();
    };
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", onVisible);
    controller.start();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", onVisible);
      controller.dispose(); // unmount: abort everything, apply nothing
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);

  const user = session.user;
  const login = async (email: string, password: string) => controllerRef.current?.login(email, password) ?? NOT_READY;

  const signup = async (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: Record<string, unknown>
  ) => {
    try {
      setBusy(true);

      // Split name best-effort
      const [firstName, ...rest] = name.trim().split(/\s+/);
      const lastName = rest.join(" ");
      const username = (meta as any)?.username || name;

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          email: email.toLowerCase().trim(),
          password,
          selectedTitle: royalTitle,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.error || "Signup failed" };
      }

      // Don’t persist user here — they must verify email first
      // Show whatever message server returned
      return { ok: true };
    } catch (e) {
      console.error("Signup failed:", e);
      return { ok: false, error: "Network error. Please try again." };
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await controllerRef.current?.logout();
  };

  const updateUser = async (updates: Partial<User>) => {
    controllerRef.current?.patchUser(updates);

    // Persist to server
    try {
      if (user?.id) {
        const response = await fetch(`/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          console.error("[UserContext] Failed to update user on server:", await response.text());
        }
      }
    } catch (error) {
      console.error("[UserContext] Error updating user on server:", error);
    }
  };

  const refreshUser = async () => {
    if (!controllerRef.current) throw new Error("Unable to refresh your account");
    await controllerRef.current.refresh();
  };

  const retrySession = () => controllerRef.current?.retry();
  const showOutageNotice = session.sessionStatus === "unavailable" && !session.verifying;

  return (
    <UserContext.Provider value={{ user, loading: session.loading || busy, login, logout, signup, updateUser, refreshUser, sessionStatus: session.sessionStatus, retrySession }}>
      {children}
      {showOutageNotice && (
        <div role="status" data-testid="session-unavailable" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 2147483000, padding: "10px 14px", borderRadius: 8, background: "#1f2937", color: "#fff", fontSize: 14, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <span>We couldn’t confirm your sign-in because ChefSire is temporarily unavailable. You haven’t been signed out.</span>
          <button type="button" onClick={retrySession} style={{ padding: "4px 12px", borderRadius: 6, border: 0, background: "#fff", color: "#1f2937", cursor: "pointer" }}>Try again</button>
        </div>
      )}
    </UserContext.Provider>
  );
}
