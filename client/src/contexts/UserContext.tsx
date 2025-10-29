// client/src/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  royalTitle?: string;
  avatar?: string;
  bio?: string;
  subscription?: SubscriptionTier;
  productCount?: number;
  trialEndDate?: string | null; // keep as ISO string in storage
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  isChef?: boolean;
  specialty?: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  updateUser: (updates: Partial<User>) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  signup: (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: { firstName?: string; lastName?: string; username?: string; [k: string]: any }
  ) => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
};

const STORAGE_KEY = 'user';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        setUser(parsed);
      }
    } catch (e) {
      console.error('Failed to read saved user:', e);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const persistUser = (u: User | null) => {
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      persistUser(merged);
      return merged;
    });
  };

  /**
   * Proper backend login:
   * - POST /api/auth/login with email/password
   * - On 200, save returned user to localStorage and context
   * - On 403, email not verified (surface message in UI that calls this)
   * - On 401, invalid credentials
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Surface known server messages to the UI by returning false
        // (The calling page is already showing friendly messages)
        if (res.status === 403) {
          console.warn('Email not verified');
        } else if (res.status === 401) {
          console.warn('Invalid email or password');
        } else {
          console.warn('Login failed:', data?.error);
        }
        return false;
      }

      // Expecting shape: { success: true, user: { ... } }
      const serverUser = (data && data.user) as Partial<User> | undefined;
      if (!serverUser || !serverUser.id || !serverUser.email) {
        console.error('Unexpected login response payload:', data);
        return false;
      }

      const normalized: User = {
        id: String(serverUser.id),
        email: String(serverUser.email),
        username: String(serverUser.username ?? ''),
        displayName: serverUser.displayName ?? serverUser.username ?? '',
        royalTitle: serverUser.royalTitle,
        avatar: serverUser.avatar,
        bio: serverUser.bio,
        subscription: (serverUser.subscription as SubscriptionTier) ?? 'free',
        productCount: serverUser.productCount ?? 0,
        trialEndDate: (serverUser as any)?.trialEndDate ?? null,
        postsCount: serverUser.postsCount ?? 0,
        followersCount: serverUser.followersCount ?? 0,
        followingCount: serverUser.followingCount ?? 0,
        isChef: serverUser.isChef ?? false,
        specialty: serverUser.specialty,
      };

      setUser(normalized);
      persistUser(normalized);
      return true;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Signup:
   * - POST /api/auth/signup
   * - On success, DO NOT log in immediately; redirect to verify page (your UI already does this)
   * - The verify page will send them to login after they click the email link
   */
  const signup = async (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: { firstName?: string; lastName?: string; username?: string; [k: string]: any }
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const firstName = meta?.firstName || name.split(' ')[0] || name;
      const lastName = meta?.lastName || name.split(' ').slice(1).join(' ') || '';
      const username = meta?.username || name;

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
        alert(data?.error || 'Signup failed');
        return false;
      }

      // Store email for the verify page to display / resend if needed
      sessionStorage.setItem('pendingVerificationEmail', email.trim());
      alert(data?.message || 'Account created! Please check your email to verify your account.');
      return true;
    } catch (e) {
      console.error('Signup error:', e);
      alert('An error occurred during signup. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    persistUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, updateUser, login, logout, signup }}>
      {children}
    </UserContext.Provider>
  );
};
