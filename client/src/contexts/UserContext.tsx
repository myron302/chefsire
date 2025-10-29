// client/src/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Subscription = 'free' | 'pro' | 'enterprise';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  royalTitle?: string | null;
  avatar?: string | null;
  bio?: string | null;
  subscription?: Subscription;
  productCount?: number;
  trialEndDate?: string | null; // keep as ISO string if coming from API
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  isChef?: boolean;
  specialty?: string | null;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  updateUser: (patch: Partial<User>) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  /**
   * Note: signup DOES NOT log the user in.
   * It triggers backend signup + verification email, then returns true/false.
   */
  signup: (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: { firstName?: string; lastName?: string; username?: string; [key: string]: any }
  ) => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
};

interface ProviderProps { children: ReactNode }

const STORAGE_KEY = 'user';

export const UserProvider: React.FC<ProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing session from localStorage on boot
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to parse stored user:', e);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = (u: User | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
  };

  const updateUser = (patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  /**
   * Server-backed login. Requires email to be verified on the backend.
   * On success, stores user object in localStorage and sets context.
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // surface the backend message when possible
        const message = data?.error || 'Login failed';
        console.warn('Login failed:', message);
        // Do NOT persist any user on failure
        persist(null);
        return false;
      }

      // Expecting shape: { success: true, user: { id, email, username, ... } }
      const loggedInUser: User = data.user;
      if (!loggedInUser || !loggedInUser.id || !loggedInUser.email) {
        console.warn('Login response missing user payload');
        persist(null);
        return false;
      }

      persist(loggedInUser);
      return true;
    } catch (e) {
      console.error('Login error:', e);
      persist(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Signup calls backend and triggers verification email.
   * Does NOT log the user in (must verify first, then login).
   */
  const signup = async (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: { firstName?: string; lastName?: string; username?: string; [key: string]: any }
  ): Promise<boolean> => {
    try {
      setLoading(true);

      const firstName = meta?.firstName || name.split(' ')[0] || name;
      const lastName = meta?.lastName || name.split(' ').slice(1).join(' ') || '';
      const username = meta?.username || name; // use what user typed on the form

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const message = data?.error || 'Signup failed';
        console.error('Signup failed:', message);
        // no local persistence here
        return false;
      }

      // Store email in session for “resend verification” UX if needed
      try {
        sessionStorage.setItem('pendingVerificationEmail', email.toLowerCase().trim());
      } catch {}

      // Optionally alert the message coming from server
      if (data?.message) {
        // eslint-disable-next-line no-alert
        alert(data.message);
      }

      return true;
    } catch (e) {
      console.error('Signup error:', e);
      // eslint-disable-next-line no-alert
      alert('An error occurred during signup. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => persist(null);

  return (
    <UserContext.Provider value={{ user, loading, updateUser, login, logout, signup }}>
      {children}
    </UserContext.Provider>
  );
};
