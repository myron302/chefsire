import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type User = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  royalTitle?: string | null;
  avatar?: string | null;
  bio?: string | null;
  subscriptionTier?: string;
  nutritionPremium?: boolean;
  nutritionTrialEndsAt?: string;
  subscription?: string;
  trialEndDate?: string;
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
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate session on mount by checking with server
  useEffect(() => {
    const validateSession = async () => {
      try {
        // First check if we have a user in localStorage
        const raw = localStorage.getItem("user");
        if (!raw) {
          setLoading(false);
          return;
        }

        // We have a stored user, validate their token with the server
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Token is valid, update user with fresh data from server
            const cleanUser: User = {
              id: String(data.user.id),
              email: data.user.email,
              username: data.user.username,
              displayName: data.user.displayName,
              royalTitle: data.user.royalTitle ?? null,
              avatar: data.user.avatar ?? null,
              bio: data.user.bio ?? null,
              subscriptionTier: data.user.subscriptionTier || data.user.subscription || 'free',
              nutritionPremium: data.user.nutritionPremium,
              nutritionTrialEndsAt: data.user.nutritionTrialEndsAt,
              subscription: data.user.subscription || data.user.subscriptionTier || 'free',
              trialEndDate: data.user.trialEndDate || data.user.subscriptionEndsAt,
            };
            localStorage.setItem("user", JSON.stringify(cleanUser));
            setUser(cleanUser);
          } else {
            // Invalid response, clear session
            localStorage.removeItem("user");
            setUser(null);
          }
        } else {
          // Token is invalid or expired, clear local storage
          console.warn("Session invalid, clearing stored user");
          localStorage.removeItem("user");
          setUser(null);
        }
      } catch (e) {
        console.error("Failed to validate session:", e);
        // On network error, keep local user but don't fail
        try {
          const raw = localStorage.getItem("user");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              if (parsed.id && typeof parsed.id !== "string") parsed.id = String(parsed.id);
              delete parsed.password;
              setUser(parsed as User);
            }
          }
        } catch {
          localStorage.removeItem("user");
        }
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  const persist = (u: User | null) => {
    if (!u) {
      localStorage.removeItem("user");
      setUser(null);
      return;
    }
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Server returns messages like “Please verify your email…”
        const msg =
          data?.error ||
          (res.status === 403
            ? "Please verify your email to log in."
            : "Invalid email or password");
        return { ok: false, error: msg };
      }

      // Expect { success: true, user: {...} }
      if (!data?.success || !data?.user) {
        return { ok: false, error: "Unexpected server response" };
      }

      const cleanUser: User = {
        id: String(data.user.id),
        email: data.user.email,
        username: data.user.username,
        displayName: data.user.displayName,
        royalTitle: data.user.royalTitle ?? null,
        avatar: data.user.avatar ?? null,
        bio: data.user.bio ?? null,
        subscriptionTier: data.user.subscriptionTier || data.user.subscription || 'free',
        nutritionPremium: data.user.nutritionPremium,
        nutritionTrialEndsAt: data.user.nutritionTrialEndsAt,
        subscription: data.user.subscription || data.user.subscriptionTier || 'free',
        trialEndDate: data.user.trialEndDate || data.user.subscriptionEndsAt,
      };

      persist(cleanUser);
      return { ok: true };
    } catch (e) {
      console.error("Login failed:", e);
      return { ok: false, error: "Network error. Please try again." };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: Record<string, unknown>
  ) => {
    try {
      setLoading(true);

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
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call server to clear the auth cookie
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout API call failed:", e);
    }
    // Always clear local storage even if API call fails
    persist(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(merged));
      return merged;
    });

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
          console.error("Failed to update user on server:", await response.text());
        }
      }
    } catch (error) {
      console.error("Error updating user on server:", error);
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout, signup, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}
