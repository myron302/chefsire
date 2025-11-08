import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type User = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  royalTitle?: string | null;
  avatar?: string | null;
  bio?: string | null;
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

  // Load any existing session from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Very light cleanup for legacy shapes
        if (parsed && typeof parsed === "object") {
          if (parsed.id && typeof parsed.id !== "string") parsed.id = String(parsed.id);
          delete parsed.password; // never keep password
          setUser(parsed as User);
        }
      }
    } catch (e) {
      console.error("Failed to read saved user:", e);
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
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

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout, signup, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}
